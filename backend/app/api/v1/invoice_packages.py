import os
import shutil
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.accounting import AccountingEntry
from app.models.booking import Booking, BookingCargoLine
from app.models.client import Client
from app.models.company_settings import CompanySettings
from app.models.customs_calculator import CustomsEstimate
from app.models.invoice_package import (
    InvoiceActivityLog,
    InvoiceDocument,
    InvoiceFile,
    InvoicePackage,
    InvoicePackageItem,
)
from app.models.product import HSCodeReference, Product
from app.models.user import User, UserRole
from app.schemas.invoice_package import (
    InvoiceDocumentCreate,
    InvoiceDocumentResponse,
    InvoiceFileResponse,
    InvoicePackageCreate,
    InvoicePackageItemCreate,
    InvoicePackageItemResponse,
    InvoicePackageItemUpdate,
    InvoicePackageListResponse,
    InvoicePackageResponse,
    InvoicePackageUpdate,
)
from app.utils.pdf_generator import generate_pdf

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
PACKAGE_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "invoice_packages")
os.makedirs(PACKAGE_UPLOAD_DIR, exist_ok=True)

DOCUMENT_TYPES = {"PI", "CI", "PL", "SC", "CO", "BL", "OTHER"}
LANGUAGES = {"en", "ar"}
AIR_DIVISOR = Decimal("6000")


def _d(value, default: Decimal = Decimal("0")) -> Decimal:
    if value is None or value == "":
        return default
    return Decimal(str(value))


def _safe_filename(value: str | None, fallback: str = "file") -> str:
    raw = (value or fallback).strip().replace("\\", "_").replace("/", "_")
    return "".join(ch for ch in raw if ch.isalnum() or ch in "._- ").strip() or fallback


def _generate_package_number(db: Session) -> str:
    from datetime import date

    year = date.today().year
    pattern = f"PKG-{year}-%"
    count = db.query(InvoicePackage).filter(InvoicePackage.package_number.like(pattern)).count()
    return f"PKG-{year}-{count + 1:04d}"


def _generate_document_number(db: Session, package: InvoicePackage, document_type: str) -> str:
    count = db.query(InvoiceDocument).filter(
        InvoiceDocument.package_id == package.id,
        InvoiceDocument.document_type == document_type,
    ).count()
    return f"{document_type}-{package.package_number}-{count + 1:02d}"


def _compute_air_weights(item_data) -> tuple[Decimal | None, Decimal | None]:
    if not all([
        getattr(item_data, "carton_length_cm", None),
        getattr(item_data, "carton_width_cm", None),
        getattr(item_data, "carton_height_cm", None),
        getattr(item_data, "cartons", None),
    ]):
        return None, None
    volumetric = (
        _d(item_data.carton_length_cm)
        * _d(item_data.carton_width_cm)
        * _d(item_data.carton_height_cm)
        * _d(item_data.cartons)
    ) / AIR_DIVISOR
    actual = _d(getattr(item_data, "gross_weight", None))
    chargeable = max(actual, volumetric)
    return volumetric.quantize(Decimal("0.001")), chargeable.quantize(Decimal("0.001"))


def _line_total(item_data) -> Decimal:
    return (_d(getattr(item_data, "quantity", None)) * _d(getattr(item_data, "unit_price", None))).quantize(Decimal("0.01"))


def _recalculate_package_totals(db: Session, package: InvoicePackage) -> None:
    db.flush()
    subtotal = db.query(func.coalesce(func.sum(InvoicePackageItem.total_price), 0)).filter(
        InvoicePackageItem.package_id == package.id
    ).scalar()
    package.subtotal = _d(subtotal).quantize(Decimal("0.01"))
    package.total = max(package.subtotal - _d(package.discount), Decimal("0")).quantize(Decimal("0.01"))


def _add_log(db: Session, package_id: int, action: str, summary: str | None, user: User | None) -> None:
    db.add(InvoiceActivityLog(
        package_id=package_id,
        action=action,
        summary=summary,
        changed_by_id=user.id if user else None,
    ))


def _get_package(db: Session, package_id: int) -> InvoicePackage:
    package = db.query(InvoicePackage).filter(InvoicePackage.id == package_id).first()
    if not package:
        raise HTTPException(404, "Invoice package not found")
    return package


def _validate_links(
    db: Session,
    client_id: int | None = None,
    booking_id: int | None = None,
    booking_cargo_line_id: int | None = None,
) -> None:
    if client_id and not db.query(Client.id).filter(Client.id == client_id).first():
        raise HTTPException(404, "Client not found")
    if booking_id and not db.query(Booking.id).filter(Booking.id == booking_id).first():
        raise HTTPException(404, "Container/booking not found")
    if booking_cargo_line_id and not db.query(BookingCargoLine.id).filter(BookingCargoLine.id == booking_cargo_line_id).first():
        raise HTTPException(404, "Container client cargo line not found")


def _validate_item_links(db: Session, item_data) -> None:
    product_id = getattr(item_data, "product_id", None)
    if product_id and not db.query(Product.id).filter(Product.id == product_id).first():
        raise HTTPException(404, "Product not found")
    hs_ref_id = getattr(item_data, "hs_code_ref_id", None)
    if hs_ref_id and not db.query(HSCodeReference.id).filter(HSCodeReference.id == hs_ref_id).first():
        raise HTTPException(404, "HS/customs reference not found")


def _make_item(package_id: int, item_data, sort_fallback: int) -> InvoicePackageItem:
    vol_w, chargeable_w = _compute_air_weights(item_data)
    return InvoicePackageItem(
        package_id=package_id,
        product_id=item_data.product_id,
        hs_code_ref_id=item_data.hs_code_ref_id,
        description=item_data.description,
        description_ar=item_data.description_ar,
        details=item_data.details,
        details_ar=item_data.details_ar,
        product_image_path=item_data.product_image_path,
        hs_code=item_data.hs_code,
        customs_unit_basis=item_data.customs_unit_basis,
        customs_unit_quantity=item_data.customs_unit_quantity,
        quantity=item_data.quantity,
        unit=item_data.unit,
        unit_price=item_data.unit_price,
        total_price=_line_total(item_data),
        cartons=item_data.cartons,
        pcs_per_carton=item_data.pcs_per_carton,
        gross_weight=item_data.gross_weight,
        net_weight=item_data.net_weight,
        cbm=item_data.cbm,
        carton_length_cm=item_data.carton_length_cm,
        carton_width_cm=item_data.carton_width_cm,
        carton_height_cm=item_data.carton_height_cm,
        volumetric_weight_kg=vol_w,
        chargeable_weight_kg=chargeable_w,
        source_product_snapshot_json=item_data.source_product_snapshot_json,
        sort_order=item_data.sort_order or sort_fallback,
    )


def _package_pdf_adapter(package: InvoicePackage, document: InvoiceDocument):
    return SimpleNamespace(
        invoice_type=document.document_type,
        invoice_number=document.document_number,
        status=document.status,
        client=package.client,
        buyer_name=package.buyer_name,
        issue_date=document.issue_date or date.today(),
        due_date=document.due_date,
        origin=package.origin,
        payment_terms=package.payment_terms,
        shipping_term=package.shipping_term,
        port_of_loading=package.port_of_loading,
        port_of_discharge=package.port_of_discharge or package.destination,
        shipping_marks=package.shipping_marks,
        container_no=package.container_no,
        seal_no=package.seal_no,
        bl_number=package.bl_number,
        vessel_name=package.vessel_name,
        voyage_number=package.voyage_number,
        container=package.booking,
        items=package.items,
        subtotal=package.subtotal,
        discount=package.discount,
        total=package.total,
        currency=package.currency,
        notes=document.notes or package.notes,
        notes_ar=package.notes_ar,
        stamp_image_path=None,
        document_background_path=None,
        stamp_position="bottom-right",
        bank_account_name=None,
        bank_account_no=None,
        bank_swift=None,
        bank_name=None,
        bank_address=None,
    )


@router.get("", response_model=InvoicePackageListResponse)
def list_packages(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    client_id: int | None = Query(None),
    booking_id: int | None = Query(None),
    booking_cargo_line_id: int | None = Query(None),
    search: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(InvoicePackage).filter(InvoicePackage.is_active == True)  # noqa: E712
    if source_type:
        q = q.filter(InvoicePackage.source_type == source_type)
    if status_filter:
        q = q.filter(InvoicePackage.status == status_filter)
    if client_id:
        q = q.filter(InvoicePackage.client_id == client_id)
    if booking_id:
        q = q.filter(InvoicePackage.booking_id == booking_id)
    if booking_cargo_line_id:
        q = q.filter(InvoicePackage.booking_cargo_line_id == booking_cargo_line_id)
    if search:
        q = q.outerjoin(Client, InvoicePackage.client_id == Client.id).filter(
            or_(
                InvoicePackage.package_number.ilike(f"%{search}%"),
                InvoicePackage.title.ilike(f"%{search}%"),
                InvoicePackage.buyer_name.ilike(f"%{search}%"),
                Client.name.ilike(f"%{search}%"),
                Client.name_ar.ilike(f"%{search}%"),
                Client.client_code.ilike(f"%{search}%"),
            )
        )

    total = q.count()
    results = q.order_by(InvoicePackage.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return InvoicePackageListResponse(total=total, page=page, page_size=page_size, results=results)


@router.post("", response_model=InvoicePackageResponse, status_code=status.HTTP_201_CREATED)
def create_package(
    payload: InvoicePackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    if not payload.client_id and not payload.buyer_name:
        raise HTTPException(422, "Client or manual buyer name is required")
    _validate_links(db, payload.client_id, payload.booking_id, payload.booking_cargo_line_id)
    for item in payload.items:
        _validate_item_links(db, item)

    package = InvoicePackage(
        package_number=_generate_package_number(db),
        source_type=payload.source_type,
        status=payload.status,
        title=payload.title,
        client_id=payload.client_id,
        buyer_name=payload.buyer_name,
        booking_id=payload.booking_id,
        booking_cargo_line_id=payload.booking_cargo_line_id,
        origin=payload.origin,
        destination=payload.destination,
        port_of_loading=payload.port_of_loading,
        port_of_discharge=payload.port_of_discharge,
        shipping_term=payload.shipping_term,
        payment_terms=payload.payment_terms,
        shipping_marks=payload.shipping_marks,
        container_no=payload.container_no,
        seal_no=payload.seal_no,
        bl_number=payload.bl_number,
        vessel_name=payload.vessel_name,
        voyage_number=payload.voyage_number,
        awb_number=payload.awb_number,
        flight_number=payload.flight_number,
        currency=payload.currency,
        discount=payload.discount,
        notes=payload.notes,
        notes_ar=payload.notes_ar,
        branch_id=payload.branch_id,
        created_by_id=current_user.id,
    )
    db.add(package)
    db.flush()

    for idx, item_data in enumerate(payload.items):
        db.add(_make_item(package.id, item_data, idx))
    db.flush()
    _recalculate_package_totals(db, package)

    if package.booking_cargo_line_id:
        cargo_line = db.query(BookingCargoLine).filter(BookingCargoLine.id == package.booking_cargo_line_id).first()
        if cargo_line:
            cargo_line.invoice_package_id = package.id
            if package.client_id and cargo_line.client_id != package.client_id:
                raise HTTPException(422, "Package client must match the selected container client cargo line")

    _add_log(db, package.id, "create", "Invoice package created", current_user)
    db.commit()
    db.refresh(package)
    return package


@router.get("/{package_id}", response_model=InvoicePackageResponse)
def get_package(
    package_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_package(db, package_id)


@router.patch("/{package_id}", response_model=InvoicePackageResponse)
def update_package(
    package_id: int,
    payload: InvoicePackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    data = payload.model_dump(exclude_unset=True)
    _validate_links(
        db,
        data.get("client_id", package.client_id),
        data.get("booking_id", package.booking_id),
        data.get("booking_cargo_line_id", package.booking_cargo_line_id),
    )
    for field, value in data.items():
        setattr(package, field, value)
    _recalculate_package_totals(db, package)

    if package.booking_cargo_line_id:
        cargo_line = db.query(BookingCargoLine).filter(BookingCargoLine.id == package.booking_cargo_line_id).first()
        if cargo_line:
            if package.client_id and cargo_line.client_id != package.client_id:
                raise HTTPException(422, "Package client must match the selected container client cargo line")
            cargo_line.invoice_package_id = package.id

    _add_log(db, package.id, "update", "Invoice package updated", current_user)
    db.commit()
    db.refresh(package)
    return package


@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_package(
    package_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    package = _get_package(db, package_id)
    package.is_active = False
    if package.booking_cargo_line_id:
        cargo_line = db.query(BookingCargoLine).filter(BookingCargoLine.invoice_package_id == package.id).first()
        if cargo_line:
            cargo_line.invoice_package_id = None
    db.query(CustomsEstimate).filter(CustomsEstimate.invoice_package_id == package.id).update({"invoice_package_id": None})
    db.query(AccountingEntry).filter(AccountingEntry.invoice_package_id == package.id).update({"invoice_package_id": None})
    _add_log(db, package.id, "archive", "Invoice package archived", current_user)
    db.commit()
    return None


@router.post("/{package_id}/items", response_model=InvoicePackageItemResponse, status_code=status.HTTP_201_CREATED)
def add_item(
    package_id: int,
    payload: InvoicePackageItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    _validate_item_links(db, payload)
    item = _make_item(package.id, payload, len(package.items))
    db.add(item)
    db.flush()
    _recalculate_package_totals(db, package)
    _add_log(db, package.id, "item_add", f"Added item: {item.description}", current_user)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{package_id}/items/{item_id}", response_model=InvoicePackageItemResponse)
def update_item(
    package_id: int,
    item_id: int,
    payload: InvoicePackageItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    item = db.query(InvoicePackageItem).filter(
        InvoicePackageItem.id == item_id,
        InvoicePackageItem.package_id == package.id,
    ).first()
    if not item:
        raise HTTPException(404, "Invoice package item not found")

    _validate_item_links(db, payload)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.total_price = _line_total(item)
    item.volumetric_weight_kg, item.chargeable_weight_kg = _compute_air_weights(item)
    _recalculate_package_totals(db, package)
    _add_log(db, package.id, "item_update", f"Updated item: {item.description}", current_user)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{package_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    package_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    item = db.query(InvoicePackageItem).filter(
        InvoicePackageItem.id == item_id,
        InvoicePackageItem.package_id == package.id,
    ).first()
    if not item:
        raise HTTPException(404, "Invoice package item not found")
    summary = f"Deleted item: {item.description}"
    db.delete(item)
    db.flush()
    _recalculate_package_totals(db, package)
    _add_log(db, package.id, "item_delete", summary, current_user)
    db.commit()
    return None


@router.post("/{package_id}/documents/generate", response_model=InvoiceDocumentResponse, status_code=status.HTTP_201_CREATED)
def generate_document(
    package_id: int,
    payload: InvoiceDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    document_type = payload.document_type.upper()
    language = payload.language.lower()
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(422, "Unsupported document type")
    if language not in LANGUAGES:
        raise HTTPException(422, "Unsupported document language")

    document = InvoiceDocument(
        package_id=package.id,
        document_type=document_type,
        document_number=_generate_document_number(db, package, document_type),
        language=language,
        status=payload.status,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        notes=payload.notes,
        created_by_id=current_user.id,
    )
    db.add(document)
    _add_log(db, package.id, "document_generate", f"Generated {document_type} document record", current_user)
    db.commit()
    db.refresh(document)
    return document


@router.get("/{package_id}/documents/{document_id}/pdf")
def download_document_pdf(
    package_id: int,
    document_id: int,
    lang: str | None = Query(None, pattern="^(en|ar)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    package = _get_package(db, package_id)
    document = db.query(InvoiceDocument).filter(
        InvoiceDocument.id == document_id,
        InvoiceDocument.package_id == package.id,
    ).first()
    if not document:
        raise HTTPException(404, "Invoice document not found")

    language = (lang or document.language or "en").lower()
    if language not in LANGUAGES:
        raise HTTPException(422, "Unsupported document language")

    company = db.query(CompanySettings).filter(CompanySettings.is_active == True).first()  # noqa: E712
    pdf_bytes = generate_pdf(_package_pdf_adapter(package, document), company, language)
    filename = f"{document.document_number}_{language}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Type": "application/pdf",
        },
    )


@router.post("/{package_id}/files", response_model=InvoiceFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    package_id: int,
    document_type: str = Form("OTHER"),
    document_id: int | None = Form(None),
    custom_file_type: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    document_type = document_type.upper()
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(422, "Unsupported file document type")
    document = None
    if document_id:
        document = db.query(InvoiceDocument).filter(
            InvoiceDocument.id == document_id,
            InvoiceDocument.package_id == package.id,
        ).first()
        if not document:
            raise HTTPException(404, "Invoice document not found")

    package_dir = os.path.join(PACKAGE_UPLOAD_DIR, str(package.id))
    os.makedirs(package_dir, exist_ok=True)
    filename = f"{uuid4().hex}_{_safe_filename(file.filename)}"
    full_path = os.path.join(package_dir, filename)
    with open(full_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    rel_path = os.path.relpath(full_path, UPLOAD_DIR)
    row = InvoiceFile(
        package_id=package.id,
        document_id=document.id if document else None,
        document_type=document_type,
        custom_file_type=custom_file_type,
        file_path=rel_path,
        original_filename=file.filename,
        content_type=file.content_type,
        file_size=os.path.getsize(full_path),
        uploaded_by_id=current_user.id,
    )
    db.add(row)
    _add_log(db, package.id, "file_upload", f"Uploaded {document_type}: {file.filename}", current_user)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{package_id}/files/{file_id}")
def download_file(
    package_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(InvoiceFile).filter(InvoiceFile.id == file_id, InvoiceFile.package_id == package_id).first()
    if not row:
        raise HTTPException(404, "Invoice file not found")
    full_path = os.path.join(UPLOAD_DIR, row.file_path)
    if not os.path.exists(full_path):
        raise HTTPException(404, "File missing from disk")
    return FileResponse(full_path, media_type=row.content_type, filename=row.original_filename or os.path.basename(full_path))


@router.delete("/{package_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    package_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    package = _get_package(db, package_id)
    row = db.query(InvoiceFile).filter(InvoiceFile.id == file_id, InvoiceFile.package_id == package.id).first()
    if not row:
        raise HTTPException(404, "Invoice file not found")
    full_path = os.path.join(UPLOAD_DIR, row.file_path)
    if os.path.exists(full_path):
        os.remove(full_path)
    summary = f"Deleted file: {row.original_filename or row.file_path}"
    db.delete(row)
    _add_log(db, package.id, "file_delete", summary, current_user)
    db.commit()
    return None
