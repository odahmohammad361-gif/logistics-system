import base64
import io
import os
import shutil
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.models.container import Container
from app.models.client import Client
from app.models.company_settings import CompanySettings
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListResponse,
)
from app.utils.pdf_generator import generate_pdf

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

TYPE_PREFIX = {
    InvoiceType.PRICE_OFFER: "PO",
    InvoiceType.PI: "PI",
    InvoiceType.CI: "CI",
    InvoiceType.PL: "PL",
    InvoiceType.SC: "SC",
}

# IATA air volumetric divisor
_AIR_DIVISOR = Decimal("6000")


def _generate_invoice_number(db: Session, inv_type: InvoiceType, year: int) -> str:
    prefix = TYPE_PREFIX[inv_type]
    count = db.query(Invoice).filter(
        Invoice.invoice_type == inv_type,
        Invoice.invoice_number.like(f"{prefix}-{year}-%")
    ).count()
    return f"{prefix}-{year}-{str(count + 1).zfill(4)}"


def _calc_totals(items_data: list, discount: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = sum(
        Decimal(str(it.unit_price)) * Decimal(str(it.quantity))
        for it in items_data
    )
    total = max(subtotal - discount, Decimal("0"))
    return subtotal, total


def _compute_air_weights(item_data) -> tuple[Decimal | None, Decimal | None]:
    """Compute volumetric and chargeable weight for air cargo items."""
    if not all([item_data.carton_length_cm, item_data.carton_width_cm,
                item_data.carton_height_cm, item_data.cartons]):
        return None, None
    l = Decimal(str(item_data.carton_length_cm))
    w = Decimal(str(item_data.carton_width_cm))
    h = Decimal(str(item_data.carton_height_cm))
    c = Decimal(str(item_data.cartons))
    volumetric = (l * w * h * c) / _AIR_DIVISOR
    actual = Decimal(str(item_data.gross_weight or 0))
    chargeable = max(actual, volumetric)
    return volumetric.quantize(Decimal("0.001")), chargeable.quantize(Decimal("0.001"))


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    # Validate container link if provided
    if payload.container_id:
        container = db.query(Container).filter(
            Container.id == payload.container_id,
            Container.is_active == True,
        ).first()
        if not container:
            raise HTTPException(404, "Container not found")

    year = payload.issue_date.year
    inv_number = _generate_invoice_number(db, payload.invoice_type, year)

    subtotal, total = _calc_totals(payload.items, payload.discount)

    inv = Invoice(
        invoice_number=inv_number,
        invoice_type=payload.invoice_type,
        client_id=payload.client_id,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        origin=payload.origin,
        payment_terms=payload.payment_terms,
        shipping_term=payload.shipping_term,
        port_of_loading=payload.port_of_loading,
        port_of_discharge=payload.port_of_discharge,
        shipping_marks=payload.shipping_marks,
        container_no=payload.container_no,
        seal_no=payload.seal_no,
        bl_number=payload.bl_number,
        vessel_name=payload.vessel_name,
        voyage_number=payload.voyage_number,
        container_id=payload.container_id,
        stamp_position=payload.stamp_position or "bottom-right",
        bank_account_name=payload.bank_account_name,
        bank_account_no=payload.bank_account_no,
        bank_swift=payload.bank_swift,
        bank_name=payload.bank_name,
        bank_address=payload.bank_address,
        discount=payload.discount,
        subtotal=subtotal,
        total=total,
        currency=payload.currency,
        notes=payload.notes,
        notes_ar=payload.notes_ar,
        branch_id=payload.branch_id,
        created_by_id=current_user.id,
    )
    db.add(inv)
    db.flush()

    for idx, it in enumerate(payload.items):
        tp = Decimal(str(it.unit_price)) * Decimal(str(it.quantity))
        vol_w, chrg_w = _compute_air_weights(it)
        item = InvoiceItem(
            invoice_id=inv.id,
            description=it.description,
            description_ar=it.description_ar,
            details=it.details,
            details_ar=it.details_ar,
            hs_code=it.hs_code,
            quantity=it.quantity,
            unit=it.unit,
            unit_price=it.unit_price,
            total_price=tp,
            cartons=it.cartons,
            gross_weight=it.gross_weight,
            net_weight=it.net_weight,
            cbm=it.cbm,
            carton_length_cm=it.carton_length_cm,
            carton_width_cm=it.carton_width_cm,
            carton_height_cm=it.carton_height_cm,
            volumetric_weight_kg=vol_w,
            chargeable_weight_kg=chrg_w,
            sort_order=it.sort_order or idx,
        )
        db.add(item)

    db.commit()
    db.refresh(inv)
    return inv


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    invoice_type: InvoiceType = Query(None),
    client_id: int = Query(None),
    status: InvoiceStatus = Query(None),
    search: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Invoice)
    if invoice_type:
        q = q.filter(Invoice.invoice_type == invoice_type)
    if client_id:
        q = q.filter(Invoice.client_id == client_id)
    if status:
        q = q.filter(Invoice.status == status)
    if search:
        q = q.filter(Invoice.invoice_number.ilike(f"%{search}%"))

    total = q.count()
    results = q.order_by(Invoice.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return InvoiceListResponse(total=total, page=page, page_size=page_size, results=results)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    if payload.container_id is not None:
        container = db.query(Container).filter(
            Container.id == payload.container_id,
            Container.is_active == True,
        ).first()
        if not container:
            raise HTTPException(404, "Container not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    db.delete(inv)
    db.commit()


@router.post("/{invoice_id}/stamp", response_model=InvoiceResponse)
def upload_stamp(
    invoice_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if file.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Only PNG or JPEG images allowed")

    stamp_dir = os.path.join(UPLOAD_DIR, "stamps")
    os.makedirs(stamp_dir, exist_ok=True)
    filename = f"inv_{invoice_id}_stamp.{file.filename.rsplit('.', 1)[-1]}"
    path = os.path.join(stamp_dir, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    inv.stamp_image_path = os.path.join("stamps", filename)
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/{invoice_id}/background", response_model=InvoiceResponse)
def upload_background(
    invoice_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """Upload a document background image for the invoice."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if file.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Only PNG or JPEG images allowed")

    bg_dir = os.path.join(UPLOAD_DIR, "backgrounds")
    os.makedirs(bg_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"inv_{invoice_id}_bg.{ext}"
    path = os.path.join(bg_dir, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    inv.document_background_path = os.path.join("backgrounds", filename)
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/{invoice_id}/item/{item_id}/image")
def upload_item_image(
    invoice_id: int,
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    item = db.query(InvoiceItem).filter(
        InvoiceItem.id == item_id,
        InvoiceItem.invoice_id == invoice_id,
    ).first()
    if not item:
        raise HTTPException(404, "Item not found")
    if file.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Only PNG or JPEG images allowed")

    img_dir = os.path.join(UPLOAD_DIR, "products")
    os.makedirs(img_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"item_{item_id}.{ext}"
    path = os.path.join(img_dir, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    item.product_image_path = os.path.join("products", filename)
    db.commit()
    return {"message": "Image uploaded", "path": item.product_image_path}


class Base64ImagePayload(BaseModel):
    data: str  # data:image/png;base64,...


@router.post("/{invoice_id}/item/{item_id}/image-base64")
def upload_item_image_base64(
    invoice_id: int,
    item_id: int,
    payload: Base64ImagePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """Accept a base64-encoded image (pasted from clipboard) for an invoice item."""
    item = db.query(InvoiceItem).filter(
        InvoiceItem.id == item_id,
        InvoiceItem.invoice_id == invoice_id,
    ).first()
    if not item:
        raise HTTPException(404, "Item not found")

    data_str = payload.data
    if "," in data_str:
        header, b64data = data_str.split(",", 1)
        ext = "png" if "png" in header else "jpeg"
    else:
        b64data = data_str
        ext = "png"

    try:
        img_bytes = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")

    img_dir = os.path.join(UPLOAD_DIR, "products")
    os.makedirs(img_dir, exist_ok=True)
    filename = f"item_{item_id}.{ext}"
    path = os.path.join(img_dir, filename)
    with open(path, "wb") as f:
        f.write(img_bytes)

    item.product_image_path = os.path.join("products", filename)
    db.commit()
    return {"message": "Image saved", "path": item.product_image_path}


@router.post("/import-excel")
def import_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """
    Parse an Excel (.xlsx) file and return structured invoice items.
    Expected columns (row 1 = header, skipped):
    Description | Details | HS Code | QTY | Unit Price | Cartons | G.W.(kg) | N.W.(kg) | CBM
    Returns a list of item dicts — does NOT save to DB.
    """
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "openpyxl not installed")

    content = file.file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception:
        raise HTTPException(400, "Invalid Excel file")

    ws = wb.active
    items = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        def _safe(v):
            return str(v).strip() if v is not None else ""
        def _num(v):
            try:
                return float(v) if v is not None and str(v).strip() != "" else None
            except Exception:
                return None

        items.append({
            "description": _safe(row[0]),
            "details": _safe(row[1]) if len(row) > 1 else "",
            "hs_code": _safe(row[2]) if len(row) > 2 else "",
            "quantity": _num(row[3]) if len(row) > 3 else None,
            "unit_price": _num(row[4]) if len(row) > 4 else None,
            "cartons": int(row[5]) if len(row) > 5 and row[5] is not None else None,
            "gross_weight": _num(row[6]) if len(row) > 6 else None,
            "net_weight": _num(row[7]) if len(row) > 7 else None,
            "cbm": _num(row[8]) if len(row) > 8 else None,
        })

    return {"items": items, "count": len(items)}


@router.post("/{invoice_id}/populate-from-container", response_model=InvoiceResponse)
def populate_from_container(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """
    Copy container B/L, seal, and container number into the invoice fields.
    Requires the invoice to have a container_id set.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if not inv.container_id:
        raise HTTPException(400, "Invoice has no linked container")

    container = db.query(Container).filter(Container.id == inv.container_id).first()
    if not container:
        raise HTTPException(404, "Linked container not found")

    if container.bl_number and not inv.bl_number:
        inv.bl_number = container.bl_number
    if container.seal_no and not inv.seal_no:
        inv.seal_no = container.seal_no
    if container.container_number and not inv.container_no:
        inv.container_no = container.container_number
    if container.port_of_loading and not inv.port_of_loading:
        inv.port_of_loading = container.port_of_loading
    if container.port_of_discharge and not inv.port_of_discharge:
        inv.port_of_discharge = container.port_of_discharge

    db.commit()
    db.refresh(inv)
    return inv


@router.get("/{invoice_id}/pdf")
def download_pdf(
    invoice_id: int,
    lang: str = Query("en", pattern="^(en|ar)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    company = db.query(CompanySettings).filter(CompanySettings.is_active == True).first()
    pdf_bytes = generate_pdf(inv, company, lang)

    filename = f"{inv.invoice_number}_{lang}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )
