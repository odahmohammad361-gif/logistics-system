import os
import uuid
import shutil
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.booking import Booking, BookingCargoLine, BookingCargoImage, CONTAINER_CBM
from app.models.client import Client
from app.schemas.booking import (
    BookingCreate, BookingUpdate, BookingResponse, BookingListResponse, BookingListItem,
    BookingCargoLineCreate, BookingCargoLineUpdate, BookingCargoLineResponse,
    BookingCargoImageResponse, AgentShort, BranchShort, ClientShort,
)

router = APIRouter()

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "bookings",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

_AIR_DIVISOR = Decimal("6000")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_booking_number(db: Session, mode: str) -> str:
    year = datetime.now().year
    prefix = mode.upper()
    pattern = f"{prefix}-{year}-%"
    count = db.query(Booking).filter(Booking.booking_number.like(pattern)).count()
    return f"{prefix}-{year}-{str(count + 1).zfill(4)}"


def _compute_air_weights(line: BookingCargoLine) -> None:
    """Recalculate volumetric & chargeable weight for air cargo lines."""
    if (line.carton_length_cm and line.carton_width_cm and
            line.carton_height_cm and line.cartons):
        vol = (Decimal(str(line.carton_length_cm)) *
               Decimal(str(line.carton_width_cm)) *
               Decimal(str(line.carton_height_cm)) *
               Decimal(str(line.cartons))) / _AIR_DIVISOR
        line.volumetric_weight_kg = round(vol, 3)
        actual = Decimal(str(line.gross_weight_kg)) if line.gross_weight_kg else Decimal("0")
        line.chargeable_weight_kg = round(max(actual, vol), 3)
    else:
        line.volumetric_weight_kg = None
        line.chargeable_weight_kg = None


def _fill_stats(booking: Booking) -> tuple[Decimal, float | None, float | None]:
    used = sum(Decimal(str(ln.cbm)) for ln in booking.cargo_lines if ln.cbm)
    capacity = CONTAINER_CBM.get(booking.container_size) if booking.container_size else None
    pct = round(float(used) / capacity * 100, 1) if capacity and capacity > 0 else None
    return used, capacity, pct


def _serialize_line(line: BookingCargoLine) -> BookingCargoLineResponse:
    return BookingCargoLineResponse(
        id=line.id,
        booking_id=line.booking_id,
        client=ClientShort(
            id=line.client.id,
            name=line.client.name,
            name_ar=line.client.name_ar,
            client_code=line.client.client_code,
        ),
        sort_order=line.sort_order,
        description=line.description,
        description_ar=line.description_ar,
        hs_code=line.hs_code,
        shipping_marks=line.shipping_marks,
        cartons=line.cartons,
        gross_weight_kg=line.gross_weight_kg,
        net_weight_kg=line.net_weight_kg,
        cbm=line.cbm,
        carton_length_cm=line.carton_length_cm,
        carton_width_cm=line.carton_width_cm,
        carton_height_cm=line.carton_height_cm,
        volumetric_weight_kg=line.volumetric_weight_kg,
        chargeable_weight_kg=line.chargeable_weight_kg,
        freight_share=line.freight_share,
        notes=line.notes,
        images=[
            BookingCargoImageResponse(
                id=img.id,
                file_path=img.file_path,
                original_filename=img.original_filename,
                uploaded_at=img.uploaded_at,
            )
            for img in line.images
        ],
        created_at=line.created_at,
    )


def _serialize_booking(b: Booking) -> BookingResponse:
    used, capacity, pct = _fill_stats(b)
    return BookingResponse(
        id=b.id,
        booking_number=b.booking_number,
        mode=b.mode,
        status=b.status,
        container_size=b.container_size,
        container_no=b.container_no,
        seal_no=b.seal_no,
        bl_number=b.bl_number,
        awb_number=b.awb_number,
        vessel_name=b.vessel_name,
        voyage_number=b.voyage_number,
        flight_number=b.flight_number,
        port_of_loading=b.port_of_loading,
        port_of_discharge=b.port_of_discharge,
        etd=b.etd,
        eta=b.eta,
        incoterm=b.incoterm,
        freight_cost=b.freight_cost,
        currency=b.currency or "USD",
        notes=b.notes,
        is_direct_booking=(b.is_direct_booking == "1"),
        carrier_name=b.carrier_name,
        agent=AgentShort(id=b.agent.id, name=b.agent.name) if b.agent else None,
        branch=BranchShort(
            id=b.branch.id, name=b.branch.name,
            name_ar=getattr(b.branch, "name_ar", None),
            code=b.branch.code,
        ) if b.branch else None,
        cargo_lines=[_serialize_line(ln) for ln in b.cargo_lines],
        total_cbm_used=used,
        container_cbm_capacity=capacity,
        fill_percent=pct,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=BookingListResponse)
def list_bookings(
    mode: str | None       = Query(None),
    status: str | None     = Query(None),
    agent_id: int | None   = Query(None),
    client_id: int | None  = Query(None),
    search: str | None     = Query(None),
    page: int              = Query(1, ge=1),
    page_size: int         = Query(20, ge=1, le=100),
    db: Session            = Depends(get_db),
    _: User                = Depends(get_current_user),
):
    q = db.query(Booking)
    if mode:
        q = q.filter(Booking.mode == mode.upper())
    if status:
        q = q.filter(Booking.status == status)
    if agent_id:
        q = q.filter(Booking.shipping_agent_id == agent_id)
    if client_id:
        q = q.join(BookingCargoLine, BookingCargoLine.booking_id == Booking.id)\
             .filter(BookingCargoLine.client_id == client_id)
    if search:
        pattern = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(or_(
            Booking.booking_number.ilike(pattern),
            Booking.bl_number.ilike(pattern),
            Booking.awb_number.ilike(pattern),
            Booking.vessel_name.ilike(pattern),
            Booking.flight_number.ilike(pattern),
            Booking.port_of_loading.ilike(pattern),
            Booking.port_of_discharge.ilike(pattern),
        ))

    total = q.count()
    bookings = q.order_by(Booking.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items: list[BookingListItem] = []
    for b in bookings:
        used, capacity, pct = _fill_stats(b)
        items.append(BookingListItem(
            id=b.id,
            booking_number=b.booking_number,
            mode=b.mode,
            status=b.status,
            container_size=b.container_size,
            port_of_loading=b.port_of_loading,
            port_of_discharge=b.port_of_discharge,
            etd=b.etd,
            eta=b.eta,
            client_count=len(b.cargo_lines),
            total_cbm_used=used,
            fill_percent=pct,
            agent_name=b.agent.name if b.agent else None,
            created_at=b.created_at,
        ))

    return BookingListResponse(total=total, page=page, page_size=page_size, results=items)


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    mode = payload.mode.upper()
    if mode not in ("LCL", "FCL", "AIR"):
        raise HTTPException(400, "mode must be LCL, FCL or AIR")

    booking = Booking(
        booking_number=_generate_booking_number(db, mode),
        mode=mode,
        status="draft",
        shipping_agent_id=payload.shipping_agent_id,
        branch_id=payload.branch_id,
        container_size=payload.container_size,
        container_no=payload.container_no or None,
        seal_no=payload.seal_no or None,
        bl_number=payload.bl_number or None,
        awb_number=payload.awb_number or None,
        vessel_name=payload.vessel_name or None,
        voyage_number=payload.voyage_number or None,
        flight_number=payload.flight_number or None,
        port_of_loading=payload.port_of_loading or None,
        port_of_discharge=payload.port_of_discharge or None,
        etd=payload.etd,
        eta=payload.eta,
        incoterm=payload.incoterm or None,
        freight_cost=payload.freight_cost,
        currency=payload.currency or "USD",
        notes=payload.notes or None,
        is_direct_booking="1" if payload.is_direct_booking else "0",
        carrier_name=payload.carrier_name or None,
    )
    db.add(booking)
    db.flush()

    for i, line_data in enumerate(payload.cargo_lines):
        client = db.query(Client).filter(Client.id == line_data.client_id).first()
        if not client:
            raise HTTPException(404, f"Client {line_data.client_id} not found")
        line = BookingCargoLine(
            booking_id=booking.id,
            client_id=line_data.client_id,
            sort_order=line_data.sort_order if line_data.sort_order else i,
            description=line_data.description or None,
            description_ar=line_data.description_ar or None,
            hs_code=line_data.hs_code or None,
            shipping_marks=line_data.shipping_marks or None,
            cartons=line_data.cartons,
            gross_weight_kg=line_data.gross_weight_kg,
            net_weight_kg=line_data.net_weight_kg,
            cbm=line_data.cbm,
            carton_length_cm=line_data.carton_length_cm,
            carton_width_cm=line_data.carton_width_cm,
            carton_height_cm=line_data.carton_height_cm,
            freight_share=line_data.freight_share,
            notes=line_data.notes or None,
        )
        if mode == "AIR":
            _compute_air_weights(line)
        db.add(line)

    db.commit()
    db.refresh(booking)
    return _serialize_booking(booking)


# ── Get ───────────────────────────────────────────────────────────────────────

@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    return _serialize_booking(b)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    data = payload.model_dump(exclude_unset=True)
    # is_direct_booking stored as string "1"/"0"
    if "is_direct_booking" in data:
        data["is_direct_booking"] = "1" if data["is_direct_booking"] else "0"
    for field, value in data.items():
        setattr(b, field, value)

    db.commit()
    db.refresh(b)
    return _serialize_booking(b)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.ADMIN)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    # Clean up uploaded images
    img_dir = os.path.join(UPLOAD_DIR, str(booking_id))
    if os.path.isdir(img_dir):
        shutil.rmtree(img_dir, ignore_errors=True)
    db.delete(b)
    db.commit()


# ── Cargo Lines ───────────────────────────────────────────────────────────────

@router.post("/{booking_id}/cargo-lines", response_model=BookingCargoLineResponse, status_code=status.HTTP_201_CREATED)
def add_cargo_line(
    booking_id: int,
    payload: BookingCargoLineCreate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    line = BookingCargoLine(
        booking_id=booking_id,
        client_id=payload.client_id,
        sort_order=payload.sort_order,
        description=payload.description or None,
        description_ar=payload.description_ar or None,
        hs_code=payload.hs_code or None,
        shipping_marks=payload.shipping_marks or None,
        cartons=payload.cartons,
        gross_weight_kg=payload.gross_weight_kg,
        net_weight_kg=payload.net_weight_kg,
        cbm=payload.cbm,
        carton_length_cm=payload.carton_length_cm,
        carton_width_cm=payload.carton_width_cm,
        carton_height_cm=payload.carton_height_cm,
        freight_share=payload.freight_share,
        notes=payload.notes or None,
    )
    if b.mode == "AIR":
        _compute_air_weights(line)
    db.add(line)
    db.commit()
    db.refresh(line)
    return _serialize_line(line)


@router.patch("/{booking_id}/cargo-lines/{line_id}", response_model=BookingCargoLineResponse)
def update_cargo_line(
    booking_id: int,
    line_id: int,
    payload: BookingCargoLineUpdate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(line, field, value)

    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if b and b.mode == "AIR":
        _compute_air_weights(line)

    db.commit()
    db.refresh(line)
    return _serialize_line(line)


@router.delete("/{booking_id}/cargo-lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_line(
    booking_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")
    db.delete(line)
    db.commit()


# ── Images ────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/cargo-lines/{line_id}/images", response_model=list[BookingCargoImageResponse])
async def upload_cargo_images(
    booking_id: int,
    line_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")

    img_dir = os.path.join(UPLOAD_DIR, str(booking_id), str(line_id))
    os.makedirs(img_dir, exist_ok=True)

    created: list[BookingCargoImage] = []
    for f in files:
        ext = os.path.splitext(f.filename or "img.jpg")[1].lower() or ".jpg"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(img_dir, fname)
        with open(fpath, "wb") as fp:
            fp.write(await f.read())
        img = BookingCargoImage(
            cargo_line_id=line_id,
            file_path=f"bookings/{booking_id}/{line_id}/{fname}",
            original_filename=f.filename,
        )
        db.add(img)
        created.append(img)

    db.commit()
    for img in created:
        db.refresh(img)

    return [
        BookingCargoImageResponse(
            id=img.id,
            file_path=img.file_path,
            original_filename=img.original_filename,
            uploaded_at=img.uploaded_at,
        )
        for img in created
    ]


@router.get("/{booking_id}/cargo-lines/{line_id}/images/{img_id}")
def serve_cargo_image(
    booking_id: int,
    line_id: int,
    img_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    img = db.query(BookingCargoImage).filter(
        BookingCargoImage.id == img_id,
        BookingCargoImage.cargo_line_id == line_id,
    ).first()
    if not img:
        raise HTTPException(404, "Image not found")

    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, img.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Image file not found on disk")

    return FileResponse(full_path)


@router.delete("/{booking_id}/cargo-lines/{line_id}/images/{img_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_image(
    booking_id: int,
    line_id: int,
    img_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    img = db.query(BookingCargoImage).filter(
        BookingCargoImage.id == img_id,
        BookingCargoImage.cargo_line_id == line_id,
    ).first()
    if not img:
        raise HTTPException(404, "Image not found")

    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, img.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)

    db.delete(img)
    db.commit()


# ── Packing List ──────────────────────────────────────────────────────────────

@router.get("/{booking_id}/packing-list")
def get_packing_list(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    lines_data = []
    totals = {"cartons": 0, "gross_weight_kg": Decimal("0"), "net_weight_kg": Decimal("0"), "cbm": Decimal("0")}

    for ln in b.cargo_lines:
        lines_data.append({
            "client_name": ln.client.name if ln.client else "",
            "client_name_ar": ln.client.name_ar if ln.client else "",
            "client_code": ln.client.client_code if ln.client else "",
            "shipping_marks": ln.shipping_marks or "",
            "description": ln.description or "",
            "description_ar": ln.description_ar or "",
            "hs_code": ln.hs_code or "",
            "cartons": ln.cartons or 0,
            "gross_weight_kg": float(ln.gross_weight_kg) if ln.gross_weight_kg else 0,
            "net_weight_kg": float(ln.net_weight_kg) if ln.net_weight_kg else 0,
            "cbm": float(ln.cbm) if ln.cbm else 0,
            "chargeable_weight_kg": float(ln.chargeable_weight_kg) if ln.chargeable_weight_kg else None,
            "freight_share": float(ln.freight_share) if ln.freight_share else None,
        })
        totals["cartons"] += ln.cartons or 0
        totals["gross_weight_kg"] += Decimal(str(ln.gross_weight_kg)) if ln.gross_weight_kg else 0
        totals["net_weight_kg"]   += Decimal(str(ln.net_weight_kg))   if ln.net_weight_kg   else 0
        totals["cbm"]             += Decimal(str(ln.cbm))             if ln.cbm             else 0

    return {
        "booking_number": b.booking_number,
        "mode": b.mode,
        "container_size": b.container_size,
        "container_no": b.container_no,
        "seal_no": b.seal_no,
        "bl_number": b.bl_number,
        "awb_number": b.awb_number,
        "vessel_name": b.vessel_name,
        "flight_number": b.flight_number,
        "port_of_loading": b.port_of_loading,
        "port_of_discharge": b.port_of_discharge,
        "etd": str(b.etd) if b.etd else None,
        "eta": str(b.eta) if b.eta else None,
        "incoterm": b.incoterm,
        "agent_name": b.agent.name if b.agent else None,
        "lines": lines_data,
        "totals": {
            "cartons": totals["cartons"],
            "gross_weight_kg": float(totals["gross_weight_kg"]),
            "net_weight_kg": float(totals["net_weight_kg"]),
            "cbm": float(totals["cbm"]),
        },
    }
