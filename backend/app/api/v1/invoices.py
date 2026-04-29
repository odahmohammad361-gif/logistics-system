import base64
import html
import io
import os
import re
import shutil
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus, InvoicePaymentSchedule, InvoicePayment
from app.models.invoice_item import InvoiceItem
from app.models.client import Client
from app.models.company_settings import CompanySettings
from app.models.product import Product
from app.models.accounting import AccountingDirection, AccountingStatus, AccountingEntry
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListResponse, InvoicePaymentCreate, InvoicePaymentResponse,
)
from app.utils.pdf_generator import generate_pdf
from app.utils.number_to_words import amount_to_words_en, amount_to_words_ar

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

SMART_PAYMENT_TERMS = [
    "100% payment before shipping",
    "100% payment after shipping",
    "30% before shipping / 70% after shipping",
    "30% deposit / 70% before delivery",
    "50% deposit / 50% before shipping",
    "30% deposit / 40% before loading / 30% before release",
    "Net 7",
    "Net 15",
    "Net 30",
]


def _generate_invoice_number(db: Session, inv_type: InvoiceType, client_code: str, year: int) -> str:
    prefix = TYPE_PREFIX[inv_type]
    # Compact client code: "JO-0001" → "JO0001"
    client_compact = client_code.replace("-", "")
    pattern = f"{prefix}-{client_compact}-{year}-%"
    count = db.query(Invoice).filter(
        Invoice.invoice_number.like(pattern)
    ).count()
    return f"{prefix}-{client_compact}-{year}-{str(count + 1).zfill(4)}"


def _calc_totals(items_data: list, discount: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = sum(
        Decimal(str(it.unit_price)) * Decimal(str(it.quantity))
        for it in items_data
    )
    total = max(subtotal - discount, Decimal("0"))
    return subtotal, total


def _money(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def _q2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _generate_receipt_number(db: Session, paid_at: datetime) -> str:
    pattern = f"RCPT-{paid_at.year}-%"
    count = db.query(InvoicePayment).filter(InvoicePayment.receipt_number.like(pattern)).count()
    return f"RCPT-{paid_at.year}-{str(count + 1).zfill(5)}"


def _generate_entry_number(db: Session, direction: AccountingDirection, entry_date) -> str:
    prefix = "REC" if direction == AccountingDirection.MONEY_IN else "PAY"
    pattern = f"{prefix}-{entry_date.year}-%"
    count = db.query(AccountingEntry).filter(AccountingEntry.entry_number.like(pattern)).count()
    return f"{prefix}-{entry_date.year}-{str(count + 1).zfill(5)}"


def _payment_parts(term: str | None) -> list[tuple[Decimal, str]]:
    text = (term or "").strip()
    if not text:
        return [(Decimal("100"), "Payment due")]
    normalized = text.lower()
    if normalized.startswith("net "):
        return [(Decimal("100"), text)]
    if normalized in {"cash", "t/t", "l/c", "d/p", "d/a"}:
        return [(Decimal("100"), text)]

    parts: list[tuple[Decimal, str]] = []
    for segment in re.split(r"\s*(?:/|;|\+|,)\s*", text):
        match = re.search(r"(\d+(?:\.\d+)?)\s*%", segment)
        if not match:
            continue
        percent = Decimal(match.group(1))
        label = re.sub(r"(\d+(?:\.\d+)?)\s*%", "", segment).strip(" -:") or f"{percent}% payment"
        parts.append((percent, label))

    if not parts:
        if "before shipping" in normalized:
            return [(Decimal("100"), "Before shipping")]
        if "after shipping" in normalized:
            return [(Decimal("100"), "After shipping")]
        return [(Decimal("100"), text)]

    total_pct = sum((pct for pct, _ in parts), Decimal("0"))
    if total_pct < Decimal("100"):
        parts.append((Decimal("100") - total_pct, "Balance"))
    return parts


def _sync_payment_schedule(db: Session, inv: Invoice) -> None:
    db.query(InvoicePaymentSchedule).filter(InvoicePaymentSchedule.invoice_id == inv.id).delete()
    parts = _payment_parts(inv.payment_terms)
    assigned = Decimal("0.00")
    for index, (percent, label) in enumerate(parts):
        if index == len(parts) - 1:
            amount = _money(inv.total) - assigned
        else:
            amount = _q2(_money(inv.total) * percent / Decimal("100"))
            assigned += amount
        db.add(InvoicePaymentSchedule(
            invoice_id=inv.id,
            label=f"{percent.normalize()}% - {label}",
            trigger=label,
            percent=percent,
            amount=max(amount, Decimal("0")),
            due_date=inv.due_date,
            sort_order=index,
        ))


def _refresh_payment_schedule_status(db: Session, inv: Invoice) -> None:
    paid_total = _money(db.query(func.coalesce(func.sum(InvoicePayment.amount), 0)).filter(
        InvoicePayment.invoice_id == inv.id
    ).scalar())
    remaining = paid_total
    rows = db.query(InvoicePaymentSchedule).filter(
        InvoicePaymentSchedule.invoice_id == inv.id
    ).order_by(InvoicePaymentSchedule.sort_order).all()
    for row in rows:
        amount = _money(row.amount)
        if amount <= 0:
            row.status = "paid"
        elif remaining >= amount:
            row.status = "paid"
            remaining -= amount
        elif remaining > 0:
            row.status = "partial"
            remaining = Decimal("0")
        else:
            row.status = "pending"


def _refresh_invoice_payment_status(inv: Invoice) -> None:
    if _money(inv.total) > 0 and _money(inv.paid_amount) >= _money(inv.total):
        inv.status = InvoiceStatus.PAID


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


def _validate_product_ids(db: Session, items_data: list) -> None:
    product_ids = {it.product_id for it in items_data if getattr(it, "product_id", None)}
    if not product_ids:
        return
    found_ids = {
        row[0]
        for row in db.query(Product.id).filter(Product.id.in_(product_ids)).all()
    }
    missing = product_ids - found_ids
    if missing:
        raise HTTPException(404, f"Product not found: {sorted(missing)[0]}")


def _relative_upload_path(path: str | None) -> str | None:
    if not path:
        return None
    normalized = path.replace("\\", "/")
    if normalized.startswith("uploads/"):
        return normalized[len("uploads/"):]
    uploads_marker = "/uploads/"
    if uploads_marker in normalized:
        return normalized.split(uploads_marker, 1)[1]
    return normalized


def _product_main_image_path(product: Product | None) -> str | None:
    if not product or not product.photos:
        return None
    photo = next((p for p in product.photos if p.is_main), product.photos[0])
    return _relative_upload_path(photo.file_path)


def _save_item_image_data(data_str: str | None) -> str | None:
    if not data_str:
        return None
    if "," in data_str:
        header, b64data = data_str.split(",", 1)
        ext = "jpg" if "jpeg" in header or "jpg" in header else "png"
    else:
        b64data = data_str
        ext = "png"
    try:
        img_bytes = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(400, "Invalid item image data")

    img_dir = os.path.join(UPLOAD_DIR, "products")
    os.makedirs(img_dir, exist_ok=True)
    filename = f"item_{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(img_dir, filename), "wb") as f:
        f.write(img_bytes)
    return os.path.join("products", filename)


def _add_invoice_item(
    db: Session,
    invoice_id: int,
    item_data,
    index: int,
    product_image_path: str | None = None,
) -> None:
    tp = Decimal(str(item_data.unit_price)) * Decimal(str(item_data.quantity))
    vol_w, chrg_w = _compute_air_weights(item_data)
    product = db.query(Product).filter(Product.id == item_data.product_id).first() if item_data.product_id else None
    image_path = (
        _save_item_image_data(getattr(item_data, "product_image_data", None))
        or _product_main_image_path(product)
        or _relative_upload_path(getattr(item_data, "product_image_path", None))
        or _relative_upload_path(product_image_path)
    )
    item = InvoiceItem(
        invoice_id=invoice_id,
        product_id=item_data.product_id,
        description=item_data.description,
        description_ar=item_data.description_ar,
        details=item_data.details,
        details_ar=item_data.details_ar,
        product_image_path=image_path,
        hs_code=item_data.hs_code,
        customs_unit_basis=item_data.customs_unit_basis,
        customs_unit_quantity=item_data.customs_unit_quantity,
        quantity=item_data.quantity,
        unit=item_data.unit,
        unit_price=item_data.unit_price,
        total_price=tp,
        cartons=item_data.cartons,
        pcs_per_carton=item_data.pcs_per_carton,
        gross_weight=item_data.gross_weight,
        net_weight=item_data.net_weight,
        cbm=item_data.cbm,
        carton_length_cm=item_data.carton_length_cm,
        carton_width_cm=item_data.carton_width_cm,
        carton_height_cm=item_data.carton_height_cm,
        volumetric_weight_kg=vol_w,
        chargeable_weight_kg=chrg_w,
        sort_order=item_data.sort_order or index,
    )
    db.add(item)


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    # Validate: need either client_id or buyer_name
    if not payload.client_id and not payload.buyer_name:
        raise HTTPException(422, "يجب تحديد عميل أو إدخال اسم المشتري يدوياً")

    client = None
    if payload.client_id:
        client = db.query(Client).filter(Client.id == payload.client_id).first()
        if not client:
            raise HTTPException(404, "Client not found")

    year = payload.issue_date.year
    # For dummy invoices use "MAN" as client code segment
    client_code = client.client_code if client else "MAN"
    inv_number = _generate_invoice_number(db, payload.invoice_type, client_code, year)

    subtotal, total = _calc_totals(payload.items, payload.discount)
    _validate_product_ids(db, payload.items)

    # Dummy invoices are always status=DUMMY
    initial_status = InvoiceStatus.DUMMY if not payload.client_id else InvoiceStatus.DRAFT

    inv = Invoice(
        invoice_number=inv_number,
        invoice_type=payload.invoice_type,
        status=initial_status,
        client_id=payload.client_id,
        buyer_name=payload.buyer_name,
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
        _add_invoice_item(db, inv.id, it, idx)

    _sync_payment_schedule(db, inv)

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
        from sqlalchemy import or_
        q = q.outerjoin(Client, Invoice.client_id == Client.id).filter(
            or_(
                Invoice.invoice_number.ilike(f"%{search}%"),
                Invoice.buyer_name.ilike(f"%{search}%"),
                Client.name.ilike(f"%{search}%"),
                Client.name_ar.ilike(f"%{search}%"),
                Client.client_code.ilike(f"%{search}%"),
            )
        )

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

    update_data = payload.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)

    for field, value in update_data.items():
        setattr(inv, field, value)

    if items_data is not None:
        _validate_product_ids(db, payload.items or [])
        old_images = {
            idx: item.product_image_path
            for idx, item in enumerate(sorted(inv.items, key=lambda row: (row.sort_order, row.id)))
        }
        inv.items.clear()
        db.flush()
        for idx, it in enumerate(payload.items or []):
            _add_invoice_item(db, inv.id, it, idx, old_images.get(idx))
        subtotal, total = _calc_totals(payload.items or [], inv.discount)
        inv.subtotal = subtotal
        inv.total = total
    elif payload.discount is not None:
        inv.subtotal, inv.total = _calc_totals(inv.items, inv.discount)

    if items_data is not None or payload.discount is not None or payload.payment_terms is not None or payload.due_date is not None:
        db.flush()
        _sync_payment_schedule(db, inv)
        db.flush()
        _refresh_payment_schedule_status(db, inv)
    _refresh_invoice_payment_status(inv)

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


@router.post("/{invoice_id}/payments", response_model=InvoicePaymentResponse, status_code=status.HTTP_201_CREATED)
def create_invoice_payment(
    invoice_id: int,
    payload: InvoicePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    paid_at = payload.paid_at or datetime.now(timezone.utc)
    amount = _q2(payload.amount)
    receipt_no = _generate_receipt_number(db, paid_at)

    entry = AccountingEntry(
        entry_number=_generate_entry_number(db, AccountingDirection.MONEY_IN, paid_at.date()),
        direction=AccountingDirection.MONEY_IN.value,
        status=AccountingStatus.POSTED.value,
        entry_date=paid_at.date(),
        amount=amount,
        currency=payload.currency or inv.currency,
        payment_method=payload.payment_method,
        category="client_payment",
        counterparty_type="client",
        counterparty_name=inv.client.name if inv.client else inv.buyer_name,
        reference_no=payload.reference_no or receipt_no,
        description=f"Client payment for invoice {inv.invoice_number}",
        notes=payload.notes,
        client_id=inv.client_id,
        invoice_id=inv.id,
        branch_id=payload.branch_id or inv.branch_id,
        created_by_id=current_user.id,
    )
    db.add(entry)
    db.flush()

    payment = InvoicePayment(
        invoice_id=inv.id,
        receipt_number=receipt_no,
        amount=amount,
        currency=payload.currency or inv.currency,
        payment_method=payload.payment_method,
        paid_at=paid_at,
        reference_no=payload.reference_no,
        notes=payload.notes,
        branch_id=payload.branch_id or inv.branch_id,
        accounting_entry_id=entry.id,
        created_by_id=current_user.id,
    )
    db.add(payment)
    db.flush()
    paid_total = db.query(func.coalesce(func.sum(InvoicePayment.amount), 0)).filter(
        InvoicePayment.invoice_id == inv.id
    ).scalar()
    if _money(inv.total) > 0 and _money(paid_total) >= _money(inv.total):
        inv.status = InvoiceStatus.PAID
    _refresh_payment_schedule_status(db, inv)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{invoice_id}/payments/{payment_id}/receipt")
def print_payment_receipt(
    invoice_id: int,
    payment_id: int,
    lang: str = Query("ar", pattern="^(en|ar)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    payment = db.query(InvoicePayment).filter(
        InvoicePayment.id == payment_id,
        InvoicePayment.invoice_id == invoice_id,
    ).first()
    if not inv or not payment:
        raise HTTPException(404, "Receipt not found")

    company = db.query(CompanySettings).filter(CompanySettings.is_active == True).first()
    is_ar = lang == "ar"
    amount = float(payment.amount or 0)
    amount_words = amount_to_words_ar(amount) if is_ar else amount_to_words_en(amount)
    client_name = inv.client.name_ar if is_ar and inv.client and inv.client.name_ar else (inv.client.name if inv.client else inv.buyer_name or "—")
    company_name = (
        (company.name_ar if is_ar and company and company.name_ar else company.name)
        if company else "Husam Trading Co., Ltd"
    )
    branch_name = payment.branch.name_ar if is_ar and payment.branch and payment.branch.name_ar else (payment.branch.name if payment.branch else "")

    labels = {
        "title": "سند قبض" if is_ar else "Money Receipt",
        "receipt": "رقم السند" if is_ar else "Receipt No.",
        "date": "التاريخ" if is_ar else "Date",
        "received_from": "استلمنا من السيد/السادة" if is_ar else "Received from",
        "amount": "المبلغ" if is_ar else "Amount",
        "amount_words": "المبلغ كتابة" if is_ar else "Amount in words",
        "method": "طريقة الدفع" if is_ar else "Payment method",
        "invoice": "عن فاتورة رقم" if is_ar else "For invoice",
        "reference": "رقم المرجع" if is_ar else "Reference",
        "notes": "ملاحظات" if is_ar else "Notes",
        "accountant": "المحاسب" if is_ar else "Accountant",
        "receiver": "المستلم" if is_ar else "Received by",
        "manager": "المدير" if is_ar else "Manager",
        "print": "طباعة" if is_ar else "Print",
    }

    def esc(value) -> str:
        return html.escape(str(value or "—"))

    body_dir = "rtl" if is_ar else "ltr"
    body = f"""
<!doctype html>
<html lang="{lang}" dir="{body_dir}">
<head>
  <meta charset="utf-8" />
  <title>{esc(payment.receipt_number)}</title>
  <style>
    @page {{ size: A5 landscape; margin: 10mm; }}
    body {{ margin: 0; background: #e8edf2; font-family: Arial, Tahoma, sans-serif; color: #172033; }}
    .toolbar {{ padding: 12px; text-align: center; }}
    .toolbar button {{ border: 0; background: #193a6b; color: white; padding: 9px 20px; border-radius: 8px; font-size: 14px; }}
    .receipt {{ width: 190mm; min-height: 120mm; margin: 0 auto 16px; background: white; border: 1px solid #cfd7e3; position: relative; overflow: hidden; }}
    .edge {{ position: absolute; inset-block: 0; inset-inline-start: 0; width: 18mm; background: #193a6b; }}
    .edge:after {{ content: ""; position: absolute; inset-block: 0; inset-inline-end: 0; width: 4mm; background: #2bb673; }}
    .content {{ padding: 11mm 13mm 10mm 25mm; }}
    [dir="rtl"] .content {{ padding: 11mm 25mm 10mm 13mm; }}
    .header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #193a6b; padding-bottom: 8px; }}
    .brand {{ font-size: 18px; font-weight: 800; color: #193a6b; }}
    .branch {{ color: #2bb673; font-size: 12px; margin-top: 3px; }}
    .title {{ background: #193a6b; color: white; padding: 7px 22px; font-size: 20px; font-weight: 800; border-radius: 2px; }}
    .meta {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin-top: 14px; font-size: 13px; }}
    .line {{ border-bottom: 1px dotted #8090a6; padding: 7px 0 5px; min-height: 21px; }}
    .label {{ color: #5d6c82; font-size: 11px; margin-inline-end: 8px; }}
    .amount {{ font-size: 22px; color: #193a6b; font-weight: 900; }}
    .words {{ margin-top: 16px; padding: 11px 13px; background: #eef8f1; border: 1px solid #bfe5cb; color: #174b2a; font-weight: 700; line-height: 1.7; }}
    .reason {{ margin-top: 12px; line-height: 1.8; font-size: 14px; }}
    .signatures {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }}
    .sig {{ text-align: center; padding-top: 30px; border-top: 1px solid #9aa8bb; color: #536276; font-size: 12px; }}
    .stamp {{ position: absolute; inset-inline-start: 82mm; top: 53mm; width: 34mm; height: 34mm; border: 2px solid rgba(25,58,107,.28); border-radius: 50%; color: rgba(25,58,107,.45); display: flex; align-items: center; justify-content: center; transform: rotate(-18deg); font-weight: 800; }}
    .footer {{ position: absolute; inset-inline: 25mm 12mm; bottom: 7mm; font-size: 10px; color: #607086; display: flex; justify-content: space-between; }}
    @media print {{ body {{ background: white; }} .toolbar {{ display: none; }} .receipt {{ margin: 0; border: 0; }} }}
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">{esc(labels["print"])}</button></div>
  <main class="receipt">
    <div class="edge"></div>
    <section class="content">
      <div class="header">
        <div>
          <div class="brand">{esc(company_name)}</div>
          <div class="branch">{esc(branch_name)}</div>
        </div>
        <div class="title">{esc(labels["title"])}</div>
      </div>
      <div class="meta">
        <div class="line"><span class="label">{esc(labels["receipt"])}:</span>{esc(payment.receipt_number)}</div>
        <div class="line"><span class="label">{esc(labels["date"])}:</span>{esc(payment.paid_at.strftime("%Y-%m-%d"))}</div>
        <div class="line"><span class="label">{esc(labels["received_from"])}:</span>{esc(client_name)}</div>
        <div class="line amount">{esc(payment.amount)} {esc(payment.currency)}</div>
        <div class="line"><span class="label">{esc(labels["method"])}:</span>{esc(payment.payment_method)}</div>
        <div class="line"><span class="label">{esc(labels["reference"])}:</span>{esc(payment.reference_no)}</div>
      </div>
      <div class="words"><span class="label">{esc(labels["amount_words"])}:</span>{esc(amount_words)}</div>
      <div class="reason">
        <div><span class="label">{esc(labels["invoice"])}:</span>{esc(inv.invoice_number)}</div>
        <div><span class="label">{esc(labels["notes"])}:</span>{esc(payment.notes)}</div>
      </div>
      <div class="stamp">{esc(company_name[:18])}</div>
      <div class="signatures">
        <div class="sig">{esc(labels["accountant"])}</div>
        <div class="sig">{esc(labels["receiver"])}</div>
        <div class="sig">{esc(labels["manager"])}</div>
      </div>
    </section>
    <div class="footer">
      <span>{esc(payment.receipt_number)}</span>
      <span>{esc(inv.invoice_number)}</span>
    </div>
  </main>
</body>
</html>
"""
    return Response(content=body, media_type="text/html")


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


@router.get("/{invoice_id}/barcode")
def get_invoice_barcode(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a Code128 barcode SVG for the invoice number."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    try:
        from barcode import Code128          # type: ignore[import]
        from barcode.writer import SVGWriter  # type: ignore[import]
    except ImportError:
        raise HTTPException(503, "Barcode library not installed. Run: pip install python-barcode")

    buffer = io.BytesIO()
    barcode = Code128(inv.invoice_number, writer=SVGWriter())
    barcode.write(
        buffer,
        options={
            "module_height": 10.0,
            "module_width": 0.3,
            "quiet_zone": 4.0,
            "font_size": 7,
            "text_distance": 3.0,
            "background": "#ffffff",
            "foreground": "#000000",
            "write_text": True,
        },
    )
    buffer.seek(0)
    return Response(
        content=buffer.read(),
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'inline; filename="{inv.invoice_number}.svg"'},
    )


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
