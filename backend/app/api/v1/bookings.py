import os
import uuid
import shutil
from decimal import Decimal
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.booking import Booking, BookingCargoLine, BookingCargoImage, BookingCargoDocument, BookingLoadingPhoto, CONTAINER_CBM
from app.models.company_warehouse import CompanyWarehouse
from app.models.client import Client
from app.models.shipping_agent import AgentCarrierRate
from app.models.clearance_agent import ClearanceAgent, ClearanceAgentRate
from app.schemas.booking import (
    BookingCreate, BookingUpdate, BookingResponse, BookingListResponse, BookingListItem,
    BookingCargoLineCreate, BookingCargoLineUpdate, BookingCargoLineResponse,
    BookingCargoImageResponse, BookingCargoDocumentResponse, AgentShort, BranchShort, ClientShort,
)

router = APIRouter()

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "bookings",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

_AIR_DIVISOR = Decimal("6000")
DOCUMENT_TYPES = {
    "pi", "ci", "pl", "sc", "co", "bl_copy",
    "security_approval", "goods_invoice", "invoice", "other",
}
GOODS_SOURCES = {"company_buying_service", "client_ready_goods"}


# ── Destination helpers ───────────────────────────────────────────────────────

JORDAN_KEYWORDS = ['jordan', 'aqaba', 'amman', 'zarqa', 'irbid']
IRAQ_KEYWORDS   = ['iraq', 'basra', 'umm qasr', 'baghdad', 'erbil', 'mosul', 'basrah', 'umm_qasr']


def _port_to_destination(port: str | None) -> str | None:
    """Detect destination from port name. Returns 'jordan', 'iraq', or None."""
    if not port:
        return None
    p = port.lower()
    if any(kw in p for kw in JORDAN_KEYWORDS):
        return 'jordan'
    if any(kw in p for kw in IRAQ_KEYWORDS):
        return 'iraq'
    return None


def _margin_pct(buy: Decimal | None, sell: Decimal | None) -> Decimal:
    if not buy or not sell or buy <= 0:
        return Decimal("0")
    return ((sell - buy) / buy * Decimal("100")).quantize(Decimal("0.01"))


def _rate_snapshot_values(rate: AgentCarrierRate, mode: str, container_size: str | None) -> dict:
    """Return the immutable booking pricing/routing values from a forwarder rate."""
    size = (container_size or "").upper()
    if mode == "AIR":
        return {
            "carrier_name": rate.carrier_name,
            "port_of_loading": rate.pol,
            "port_of_discharge": rate.pod,
        "freight_cost": rate.buy_air_kg,
        "max_cbm": None,
        "markup_pct": _margin_pct(rate.buy_air_kg, rate.sell_air_kg),
        "container_size": None,
        "etd": rate.vessel_day,
        "loading_warehouse_id": rate.loading_warehouse_id,
    }

    if mode == "LCL":
        lcl = {
            "20GP": (rate.buy_lcl_20gp or rate.buy_lcl_cbm, rate.sell_lcl_20gp or rate.sell_lcl_cbm, rate.cbm_20gp or Decimal("28")),
            "40GP": (rate.buy_lcl_40ft or rate.buy_lcl_cbm, rate.sell_lcl_40ft or rate.sell_lcl_cbm, rate.cbm_40ft or Decimal("67")),
            "40HQ": (rate.buy_lcl_40hq or rate.buy_lcl_cbm, rate.sell_lcl_40hq or rate.sell_lcl_cbm, rate.cbm_40hq or Decimal("76")),
        }
        buy, sell, cap = lcl.get(size, (None, None, None))
        return {
            "carrier_name": rate.carrier_name,
            "port_of_loading": rate.pol,
            "port_of_discharge": rate.pod,
            "freight_cost": buy,
            "max_cbm": cap,
            "markup_pct": _margin_pct(buy, sell),
            "container_size": size or None,
            "etd": rate.vessel_day,
            "loading_warehouse_id": rate.loading_warehouse_id,
        }

    fcl = {
        "20GP": (rate.buy_20gp, rate.sell_20gp, rate.cbm_20gp or Decimal("28")),
        "40GP": (rate.buy_40ft, rate.sell_40ft, rate.cbm_40ft or Decimal("67")),
        "40HQ": (rate.buy_40hq, rate.sell_40hq, rate.cbm_40hq or Decimal("76")),
    }
    buy, sell, cap = fcl.get(size, (None, None, None))
    return {
        "carrier_name": rate.carrier_name,
        "port_of_loading": rate.pol,
        "port_of_discharge": rate.pod,
        "freight_cost": buy,
        "max_cbm": cap,
        "markup_pct": _margin_pct(buy, sell),
        "container_size": size or None,
        "etd": rate.vessel_day,
        "loading_warehouse_id": rate.loading_warehouse_id,
    }


def _client_destination(client: Client) -> str | None:
    """
    Derive a client's effective destination from:
    1. country field
    2. client_code prefix (JO- = Jordan, IQ- = Iraq)
    3. phone country code (+962 = Jordan, +964 = Iraq)
    Returns None if unknown → allowed in any booking.
    """
    if client.country:
        c = client.country.lower()
        if 'jordan' in c or c in ('jo',):
            return 'jordan'
        if 'iraq' in c or c in ('iq',):
            return 'iraq'

    if client.client_code:
        code = client.client_code.upper()
        if code.startswith('JO-'):
            return 'jordan'
        if code.startswith('IQ-'):
            return 'iraq'

    if client.phone:
        p = client.phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if p.startswith('+962') or p.startswith('00962'):
            return 'jordan'
        if p.startswith('+964') or p.startswith('00964'):
            return 'iraq'

    return None   # unknown → unrestricted


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_booking_number(db: Session, mode: str) -> str:
    year = datetime.now().year
    prefix = mode.upper()
    pattern = f"{prefix}-{year}-%"
    rows = db.query(Booking.booking_number).filter(Booking.booking_number.like(pattern)).all()
    max_seq = 0
    for (booking_number,) in rows:
        try:
            max_seq = max(max_seq, int(str(booking_number).rsplit("-", 1)[-1]))
        except (TypeError, ValueError):
            continue
    return f"{prefix}-{year}-{str(max_seq + 1).zfill(4)}"


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


LOCKED_STATUSES = {"confirmed", "in_transit", "arrived", "delivered", "cancelled"}

def _assert_cargo_editable(b: Booking) -> None:
    """Raise 423 if the booking is sealed and cargo lines cannot be changed."""
    if b.status in LOCKED_STATUSES:
        raise HTTPException(
            status_code=423,
            detail=f"Container is {b.status} — cargo lines are locked and cannot be modified.",
        )


def _validate_clearance_selection(db: Session, line_data) -> None:
    def val(name: str):
        return line_data.get(name) if isinstance(line_data, dict) else getattr(line_data, name, None)

    if val("clearance_through_us") is True:
        if not val("clearance_agent_id"):
            raise HTTPException(400, "Clearance agent is required when clearance is through us")
        agent = db.query(ClearanceAgent).filter(
            ClearanceAgent.id == val("clearance_agent_id"),
            ClearanceAgent.is_active == True,  # noqa: E712
        ).first()
        if not agent:
            raise HTTPException(404, "Clearance agent not found")
        if val("clearance_agent_rate_id"):
            rate = db.query(ClearanceAgentRate).filter(
                ClearanceAgentRate.id == val("clearance_agent_rate_id"),
                ClearanceAgentRate.agent_id == val("clearance_agent_id"),
                ClearanceAgentRate.is_active == True,  # noqa: E712
            ).first()
            if not rate:
                raise HTTPException(404, "Clearance agent rate not found")


def _validate_goods_source(source: str | None) -> str | None:
    if not source:
        return None
    normalized = source.strip().lower()
    if normalized not in GOODS_SOURCES:
        raise HTTPException(400, "goods_source must be company_buying_service or client_ready_goods")
    return normalized


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
        goods_source=line.goods_source,
        is_full_container_client=bool(line.is_full_container_client),
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
        clearance_through_us=line.clearance_through_us,
        clearance_agent_id=line.clearance_agent_id,
        clearance_agent_name=line.clearance_agent.name if line.clearance_agent else None,
        clearance_agent_rate_id=line.clearance_agent_rate_id,
        manual_clearance_agent_name=line.manual_clearance_agent_name,
        manual_clearance_agent_phone=line.manual_clearance_agent_phone,
        manual_clearance_agent_notes=line.manual_clearance_agent_notes,
        images=[
            BookingCargoImageResponse(
                id=img.id,
                file_path=img.file_path,
                original_filename=img.original_filename,
                uploaded_at=img.uploaded_at,
            )
            for img in line.images
        ],
        documents=[
            BookingCargoDocumentResponse(
                id=doc.id,
                document_type=doc.document_type,
                custom_file_type=doc.custom_file_type,
                file_path=doc.file_path,
                original_filename=doc.original_filename,
                uploaded_at=doc.uploaded_at,
            )
            for doc in line.documents
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
        agent_carrier_rate_id=b.agent_carrier_rate_id,
        is_agent_snapshot=bool(getattr(b, 'is_agent_snapshot', False)),
        agent=AgentShort(id=b.agent.id, name=b.agent.name) if b.agent else None,
        branch=BranchShort(
            id=b.branch.id, name=b.branch.name,
            name_ar=getattr(b.branch, "name_ar", None),
            code=b.branch.code,
        ) if b.branch else None,
        cargo_lines=[_serialize_line(ln) for ln in b.cargo_lines],
        max_cbm=b.max_cbm,
        markup_pct=b.markup_pct,
        total_cbm_used=used,
        container_cbm_capacity=capacity,
        fill_percent=pct,
        destination=b.destination,
        # Loading info
        loading_warehouse_id=b.loading_warehouse_id,
        loading_warehouse_name=b.loading_warehouse.name if b.loading_warehouse else None,
        loading_warehouse_city=b.loading_warehouse.city if b.loading_warehouse else None,
        loading_date=b.loading_date,
        loading_notes=b.loading_notes,
        loading_photos=[
            {"id": p.id, "file_path": p.file_path, "original_filename": p.original_filename,
             "caption": p.caption, "uploaded_at": p.uploaded_at}
            for p in b.loading_photos
        ],
        is_locked=(b.status in LOCKED_STATUSES),
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


# ── Ports lookup ─────────────────────────────────────────────────────────────

@router.get("/ports")
def get_ports(
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    """Return distinct ports from shipping quotes + existing bookings for dropdown."""
    from app.models.shipping_quote import ShippingQuote
    from sqlalchemy import union, select, literal_column

    sq_load = db.query(ShippingQuote.port_of_loading).filter(ShippingQuote.port_of_loading.isnot(None))
    bk_load = db.query(Booking.port_of_loading).filter(Booking.port_of_loading.isnot(None))
    loading = sorted({r[0] for r in sq_load.union(bk_load).all() if r[0]})

    sq_disch = db.query(ShippingQuote.port_of_discharge).filter(ShippingQuote.port_of_discharge.isnot(None))
    bk_disch = db.query(Booking.port_of_discharge).filter(Booking.port_of_discharge.isnot(None))
    discharge = sorted({r[0] for r in sq_disch.union(bk_disch).all() if r[0]})

    return {"loading": loading, "discharge": discharge}


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=BookingListResponse)
def list_bookings(
    mode:        str | None = Query(None),
    status:      str | None = Query(None),
    destination: str | None = Query(None),
    agent_id:    int | None = Query(None),
    client_id:   int | None = Query(None),
    search:      str | None = Query(None),
    page:        int        = Query(1, ge=1),
    page_size:   int        = Query(20, ge=1, le=100),
    db:          Session    = Depends(get_db),
    _:           User       = Depends(get_current_user),
):
    q = db.query(Booking)
    if mode:
        q = q.filter(Booking.mode == mode.upper())
    if status:
        q = q.filter(Booking.status == status)
    if destination:
        q = q.filter(Booking.destination == destination.lower())
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
            freight_cost=b.freight_cost,
            max_cbm=b.max_cbm,
            markup_pct=b.markup_pct,
            container_no=b.container_no,
            bl_number=b.bl_number,
            vessel_name=b.vessel_name,
            destination=b.destination,
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

    rate_snapshot = None
    if payload.agent_carrier_rate_id:
        rate = db.query(AgentCarrierRate).filter(
            AgentCarrierRate.id == payload.agent_carrier_rate_id,
            AgentCarrierRate.is_active == True,  # noqa: E712
        ).first()
        if not rate:
            raise HTTPException(404, "Agent carrier rate not found")
        if payload.shipping_agent_id and rate.agent_id != payload.shipping_agent_id:
            raise HTTPException(400, "Selected carrier rate does not belong to this shipping agent")
        rate_snapshot = _rate_snapshot_values(rate, mode, payload.container_size)
        payload.shipping_agent_id = rate.agent_id

    booking = Booking(
        booking_number=_generate_booking_number(db, mode),
        mode=mode,
        status="draft",
        shipping_agent_id=payload.shipping_agent_id,
        agent_carrier_rate_id=payload.agent_carrier_rate_id,
        branch_id=payload.branch_id,
        container_size=(rate_snapshot["container_size"] if rate_snapshot else payload.container_size),
        container_no=payload.container_no or None,
        seal_no=payload.seal_no or None,
        bl_number=payload.bl_number or None,
        awb_number=payload.awb_number or None,
        vessel_name=payload.vessel_name or None,
        voyage_number=payload.voyage_number or None,
        flight_number=payload.flight_number or None,
        port_of_loading=(rate_snapshot["port_of_loading"] if rate_snapshot and rate_snapshot["port_of_loading"] else payload.port_of_loading) or None,
        port_of_discharge=(rate_snapshot["port_of_discharge"] if rate_snapshot and rate_snapshot["port_of_discharge"] else payload.port_of_discharge) or None,
        etd=(rate_snapshot["etd"] if rate_snapshot and rate_snapshot["etd"] else payload.etd),
        eta=payload.eta,
        incoterm=payload.incoterm or None,
        freight_cost=(rate_snapshot["freight_cost"] if rate_snapshot else payload.freight_cost),
        currency="USD",
        notes=payload.notes or None,
        is_direct_booking="1" if payload.is_direct_booking else "0",
        carrier_name=(rate_snapshot["carrier_name"] if rate_snapshot else payload.carrier_name) or None,
        max_cbm=(rate_snapshot["max_cbm"] if rate_snapshot else payload.max_cbm),
        markup_pct=(rate_snapshot["markup_pct"] if rate_snapshot else payload.markup_pct),
        destination=_port_to_destination((rate_snapshot["port_of_discharge"] if rate_snapshot and rate_snapshot["port_of_discharge"] else payload.port_of_discharge)),
        loading_warehouse_id=(rate_snapshot["loading_warehouse_id"] if rate_snapshot else None),
    )
    # Mark snapshot if created from an agent carrier rate
    if payload.agent_carrier_rate_id:
        booking.is_agent_snapshot = True
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
    # If this booking was created from an agent snapshot, certain fields are immutable
    locked_fields = {"carrier_name", "container_size", "max_cbm", "port_of_loading", "port_of_discharge", "freight_cost"}
    if getattr(b, 'is_agent_snapshot', False):
        for k in list(data.keys()):
            if k in locked_fields:
                data.pop(k, None)
    for field, value in data.items():
        setattr(b, field, value)
    # Auto-update destination when port_of_discharge changes
    if "port_of_discharge" in data:
        new_dest = _port_to_destination(data["port_of_discharge"])
        if new_dest:   # only override if we can detect — don't clear existing
            b.destination = new_dest

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


# ── Eligible clients for a booking ───────────────────────────────────────────

@router.get("/{booking_id}/eligible-clients")
def get_eligible_clients(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    """
    Returns clients eligible to be added to this booking.
    Filtered by the booking's destination (jordan / iraq).
    Clients with no determinable destination are always included.
    """
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    all_clients = db.query(Client).filter(Client.is_active == True).all()
    destination = b.destination  # 'jordan' | 'iraq' | None

    results = []
    for c in all_clients:
        client_dest = _client_destination(c)
        # Include if: no booking destination, unknown client destination, or destinations match
        if not destination or client_dest is None or client_dest == destination:
            results.append({
                "id":          c.id,
                "name":        c.name,
                "name_ar":     c.name_ar,
                "client_code": c.client_code,
                "country":     c.country,
                "phone":       c.phone,
                "destination": client_dest,
            })

    # Sort: matching destination first, then unknowns
    if destination:
        results.sort(key=lambda x: (0 if x["destination"] == destination else 1, x["name"]))
    else:
        results.sort(key=lambda x: x["name"])

    return {
        "booking_destination": destination,
        "total": len(results),
        "results": results,
    }


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
    _assert_cargo_editable(b)
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    # Destination validation
    if b.destination:
        client_dest = _client_destination(client)
        if client_dest is not None and client_dest != b.destination:
            dest_label = {'jordan': 'Jordan 🇯🇴', 'iraq': 'Iraq 🇮🇶'}.get(b.destination, b.destination)
            raise HTTPException(
                status_code=400,
                detail=f"This container is going to {dest_label}. "
                       f"Client '{client.name}' ({client.client_code}) appears to be from {client_dest.title()}. "
                       f"Only {dest_label} clients can be added to this container.",
            )
    _validate_clearance_selection(db, payload)

    line = BookingCargoLine(
        booking_id=booking_id,
        client_id=payload.client_id,
        sort_order=payload.sort_order,
        goods_source=_validate_goods_source(payload.goods_source),
        is_full_container_client=payload.is_full_container_client,
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
        clearance_through_us=payload.clearance_through_us,
        clearance_agent_id=payload.clearance_agent_id if payload.clearance_through_us else None,
        clearance_agent_rate_id=payload.clearance_agent_rate_id if payload.clearance_through_us else None,
        manual_clearance_agent_name=None if payload.clearance_through_us else payload.manual_clearance_agent_name,
        manual_clearance_agent_phone=None if payload.clearance_through_us else payload.manual_clearance_agent_phone,
        manual_clearance_agent_notes=None if payload.clearance_through_us else payload.manual_clearance_agent_notes,
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

    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if b:
        _assert_cargo_editable(b)

    data = payload.model_dump(exclude_unset=True)
    if "goods_source" in data:
        data["goods_source"] = _validate_goods_source(data["goods_source"])
    merged = {
        "clearance_through_us": line.clearance_through_us,
        "clearance_agent_id": line.clearance_agent_id,
        "clearance_agent_rate_id": line.clearance_agent_rate_id,
    }
    merged.update({k: v for k, v in data.items() if k in merged})
    _validate_clearance_selection(db, merged)
    if merged.get("clearance_through_us") is True:
        data["manual_clearance_agent_name"] = None
        data["manual_clearance_agent_phone"] = None
        data["manual_clearance_agent_notes"] = None
    elif merged.get("clearance_through_us") is False:
        data["clearance_agent_id"] = None
        data["clearance_agent_rate_id"] = None
    for field, value in data.items():
        setattr(line, field, value)

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
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if b:
        _assert_cargo_editable(b)
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


# ── Cargo Documents ──────────────────────────────────────────────────────────

@router.post("/{booking_id}/cargo-lines/{line_id}/documents/{document_type}", response_model=list[BookingCargoDocumentResponse])
async def upload_cargo_documents(
    booking_id: int,
    line_id: int,
    document_type: str,
    files: list[UploadFile] = File(...),
    custom_file_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    doc_type = document_type.strip().lower()
    if doc_type not in DOCUMENT_TYPES:
        raise HTTPException(400, "document_type must be pi, ci, pl, sc, co, bl_copy, security_approval, goods_invoice or other")
    if doc_type == "invoice":
        doc_type = "goods_invoice"
    if doc_type == "other" and not custom_file_type:
        raise HTTPException(400, "custom_file_type is required for other documents")
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")

    client_folder = (line.client.client_code if line.client else f"line-{line_id}").replace("/", "-")
    doc_dir = os.path.join(UPLOAD_DIR, str(booking_id), "clients", client_folder, "documents", doc_type)
    os.makedirs(doc_dir, exist_ok=True)

    created: list[BookingCargoDocument] = []
    for f in files:
        ext = os.path.splitext(f.filename or "file.bin")[1].lower() or ".bin"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(doc_dir, fname)
        with open(fpath, "wb") as fp:
            fp.write(await f.read())
        doc = BookingCargoDocument(
            cargo_line_id=line_id,
            document_type=doc_type,
            custom_file_type=custom_file_type if doc_type == "other" else None,
            file_path=f"bookings/{booking_id}/clients/{client_folder}/documents/{doc_type}/{fname}",
            original_filename=f.filename,
        )
        db.add(doc)
        created.append(doc)

    db.commit()
    for doc in created:
        db.refresh(doc)
    return [
        BookingCargoDocumentResponse(
            id=doc.id,
            document_type=doc.document_type,
            custom_file_type=doc.custom_file_type,
            file_path=doc.file_path,
            original_filename=doc.original_filename,
            uploaded_at=doc.uploaded_at,
        )
        for doc in created
    ]


@router.get("/{booking_id}/cargo-lines/{line_id}/documents/{doc_id}")
def serve_cargo_document(
    booking_id: int,
    line_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(BookingCargoDocument).filter(
        BookingCargoDocument.id == doc_id,
        BookingCargoDocument.cargo_line_id == line_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, doc.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Document file not found on disk")
    return FileResponse(full_path, filename=doc.original_filename)


@router.delete("/{booking_id}/cargo-lines/{line_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_document(
    booking_id: int,
    line_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    doc = db.query(BookingCargoDocument).filter(
        BookingCargoDocument.id == doc_id,
        BookingCargoDocument.cargo_line_id == line_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, doc.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)
    db.delete(doc)
    db.commit()


# ── Loading Info ─────────────────────────────────────────────────────────────

class LoadingInfoUpdate(BaseModel):
    loading_warehouse_id: Optional[int] = None
    loading_date:         Optional[datetime] = None
    loading_notes:        Optional[str] = None


@router.patch("/{booking_id}/loading-info")
def update_loading_info(
    booking_id: int,
    payload: LoadingInfoUpdate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if payload.loading_warehouse_id is not None:
        wh = db.query(CompanyWarehouse).filter(CompanyWarehouse.id == payload.loading_warehouse_id).first()
        if not wh:
            raise HTTPException(404, "Warehouse not found")
        b.loading_warehouse_id = payload.loading_warehouse_id
    if payload.loading_date is not None:
        b.loading_date = payload.loading_date
    if payload.loading_notes is not None:
        b.loading_notes = payload.loading_notes or None
    db.commit()
    db.refresh(b)
    return _serialize_booking(b)


# ── Loading Photos ────────────────────────────────────────────────────────────

@router.post("/{booking_id}/loading-photos")
async def upload_loading_photos(
    booking_id: int,
    files:   list[UploadFile] = File(...),
    caption: str | None       = None,
    db:      Session          = Depends(get_db),
    _:       User             = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    photo_dir = os.path.join(UPLOAD_DIR, str(booking_id), "loading")
    os.makedirs(photo_dir, exist_ok=True)

    created = []
    for f in files:
        ext   = os.path.splitext(f.filename or "photo.jpg")[1].lower() or ".jpg"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(photo_dir, fname)
        with open(fpath, "wb") as fp:
            fp.write(await f.read())
        photo = BookingLoadingPhoto(
            booking_id=booking_id,
            file_path=f"bookings/{booking_id}/loading/{fname}",
            original_filename=f.filename,
            caption=caption or None,
        )
        db.add(photo)
        created.append(photo)

    db.commit()
    for p in created:
        db.refresh(p)

    return [
        {"id": p.id, "file_path": p.file_path, "original_filename": p.original_filename,
         "caption": p.caption, "uploaded_at": p.uploaded_at}
        for p in created
    ]


@router.get("/{booking_id}/loading-photos/{photo_id}")
def serve_loading_photo(
    booking_id: int,
    photo_id:   int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    photo = db.query(BookingLoadingPhoto).filter(
        BookingLoadingPhoto.id == photo_id,
        BookingLoadingPhoto.booking_id == booking_id,
    ).first()
    if not photo:
        raise HTTPException(404, "Photo not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path    = os.path.join(uploads_root, photo.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Photo file not found on disk")
    return FileResponse(full_path)


@router.delete("/{booking_id}/loading-photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loading_photo(
    booking_id: int,
    photo_id:   int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    photo = db.query(BookingLoadingPhoto).filter(
        BookingLoadingPhoto.id == photo_id,
        BookingLoadingPhoto.booking_id == booking_id,
    ).first()
    if not photo:
        raise HTTPException(404, "Photo not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path    = os.path.join(uploads_root, photo.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)
    db.delete(photo)
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
            "goods_source": ln.goods_source,
            "is_full_container_client": bool(ln.is_full_container_client),
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
