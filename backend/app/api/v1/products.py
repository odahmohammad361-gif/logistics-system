import base64
import os
import uuid
import shutil
import json as _json
from copy import deepcopy
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.exc import IntegrityError

from app.database import get_db, SessionLocal
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.product import (
    Product, ProductPhoto, ProductMainCategory, ProductSubcategory,
    ProductType, HSCodeReference,
)
from app.models.market_rate import MarketRate
from app.models.invoice_item import InvoiceItem
from app.models.customs_calculator import CustomsEstimateLine
from app.models.booking import BookingCargoLine
from app.utils.currency import FALLBACK_RATES
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductReferenceDataResponse,
    ProductMainCategoryCreate,
    ProductMainCategoryUpdate,
    ProductMainCategoryResponse,
    ProductSubcategoryCreate,
    ProductSubcategoryUpdate,
    ProductSubcategoryResponse,
    ProductTypeCreate,
    ProductTypeUpdate,
    ProductTypeResponse,
    HSCodeReferenceCreate,
    HSCodeReferenceUpdate,
    HSCodeReferenceResponse,
)

router = APIRouter()

UPLOAD_DIR = "uploads/products"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class ScanFolderRequest(BaseModel):
    folder_path: str


class BulkImportConfig(BaseModel):
    folder_path: str
    supplier_id: Optional[int] = None
    default_price: str = "0.00"
    default_pcs: int = 250
    default_cbm: str = "0.20"
    default_min: int = 1
    default_category: Optional[str] = None


class ProductFromInvoiceItem(BaseModel):
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    hs_code: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    unit: Optional[str] = None
    unit_price: float = 0
    currency: str = "USD"
    cartons: Optional[int] = None
    pcs_per_carton: Optional[float] = None
    quantity: Optional[float] = None
    cbm: Optional[float] = None
    gross_weight: Optional[float] = None
    net_weight: Optional[float] = None
    carton_length_cm: Optional[float] = None
    carton_width_cm: Optional[float] = None
    carton_height_cm: Optional[float] = None
    product_image_data: Optional[str] = None


def _save_photo(file: UploadFile) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Only JPG, PNG, WEBP images allowed")
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return path


def _save_photo_data(data_str: str | None) -> str | None:
    if not data_str:
        return None
    if "," in data_str:
        header, b64data = data_str.split(",", 1)
        ext = ".jpg" if "jpeg" in header or "jpg" in header else ".png"
    else:
        b64data = data_str
        ext = ".png"
    try:
        img_bytes = base64.b64decode(b64data)
    except Exception:
        raise HTTPException(400, "Invalid product image data")
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(path, "wb") as f:
        f.write(img_bytes)
    return path


def _generate_invoice_product_code(db: Session) -> str:
    prefix = "INV-"
    count = db.query(Product).filter(Product.code.like(f"{prefix}%")).count()
    while True:
        code = f"{prefix}{str(count + 1).zfill(5)}"
        if not db.query(Product).filter(Product.code == code).first():
            return code
        count += 1


def _per_piece_price(unit_price: float, unit: str | None, pcs_per_carton: float) -> float:
    unit_key = (unit or "pcs").lower()
    divisor = 1.0
    if unit_key in {"carton", "cartons", "ctn"}:
        divisor = pcs_per_carton or 1.0
    elif unit_key in {"dozen", "dozens", "dz"}:
        divisor = 12.0
    return round((unit_price or 0) / divisor, 4)


def _latest_usd_to_cny(db: Session) -> Decimal:
    row = (
        db.query(MarketRate)
        .filter(MarketRate.target_currency == "CNY")
        .order_by(MarketRate.fetched_at.desc())
        .first()
    )
    return Decimal(str(row.rate if row else FALLBACK_RATES["CNY"]))


def _derive_usd_from_cny(db: Session, price_cny) -> Decimal | None:
    if price_cny in (None, ""):
        return None
    rate = _latest_usd_to_cny(db)
    if not rate:
        return None
    return (Decimal(str(price_cny)) / rate).quantize(Decimal("0.0001"))


def _apply_product_price_defaults(product: Product, db: Session) -> None:
    if product.price_cny is not None and product.price_usd in (None, ""):
        product.price_usd = _derive_usd_from_cny(db, product.price_cny)


def _remove_file_if_local(path: str | None) -> None:
    if not path:
        return
    full_path = os.path.abspath(path)
    uploads_root = os.path.abspath(UPLOAD_DIR)
    if not full_path.startswith(uploads_root + os.sep):
        return
    if os.path.isfile(full_path):
        os.remove(full_path)


def _detach_product_from_cargo_goods(db: Session, product_id: int) -> int:
    changed = 0
    lines = (
        db.query(BookingCargoLine)
        .filter(BookingCargoLine.extracted_goods.isnot(None))
        .all()
    )
    for line in lines:
        extracted = line.extracted_goods
        if not isinstance(extracted, dict) or not isinstance(extracted.get("goods"), list):
            continue
        updated = deepcopy(extracted)
        line_changed = False
        for item in updated.get("goods", []):
            if isinstance(item, dict) and str(item.get("product_id") or "") == str(product_id):
                item["product_id"] = None
                line_changed = True
        if line_changed:
            line.extracted_goods = updated
            flag_modified(line, "extracted_goods")
            changed += 1
    return changed


def _apply_reference_defaults(product: Product, db: Session) -> None:
    main_category = db.query(ProductMainCategory).filter(ProductMainCategory.id == product.main_category_id).first() if product.main_category_id else None
    subcategory = db.query(ProductSubcategory).filter(ProductSubcategory.id == product.subcategory_id).first() if product.subcategory_id else None
    product_type = db.query(ProductType).filter(ProductType.id == product.product_type_id).first() if product.product_type_id else None
    hs_ref = db.query(HSCodeReference).filter(HSCodeReference.id == product.hs_code_ref_id).first() if product.hs_code_ref_id else None

    if product_type:
        product.main_category_id = product_type.main_category_id
        product.subcategory_id = product_type.subcategory_id
        main_category = product_type.main_category
        subcategory = product_type.subcategory
        if not product.hs_code_ref_id and product_type.hs_code_ref_id:
            product.hs_code_ref_id = product_type.hs_code_ref_id
            hs_ref = product_type.hs_code_ref

    if product.subcategory_id and not subcategory:
        raise HTTPException(404, "Product subcategory not found")
    if product.main_category_id and not main_category:
        raise HTTPException(404, "Product main category not found")
    if product.product_type_id and not product_type:
        raise HTTPException(404, "Product type not found")
    if product.hs_code_ref_id and not hs_ref:
        raise HTTPException(404, "HS code reference not found")

    if subcategory and product.main_category_id and subcategory.main_category_id != product.main_category_id:
        raise HTTPException(400, "Selected subcategory does not belong to the selected main category")

    if main_category and not product.category:
        product.category = main_category.name


def _commit_reference(db: Session, duplicate_message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(400, duplicate_message) from exc


def _patch_model(obj, payload: BaseModel) -> None:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)


def _validate_subcategory_parent(db: Session, main_category_id: int) -> None:
    if not db.query(ProductMainCategory).filter(ProductMainCategory.id == main_category_id).first():
        raise HTTPException(404, "Product main category not found")


def _validate_product_type_tree(
    db: Session,
    main_category_id: int,
    subcategory_id: int,
    hs_code_ref_id: Optional[int],
) -> None:
    if not db.query(ProductMainCategory).filter(ProductMainCategory.id == main_category_id).first():
        raise HTTPException(404, "Product main category not found")
    subcategory = db.query(ProductSubcategory).filter(ProductSubcategory.id == subcategory_id).first()
    if not subcategory:
        raise HTTPException(404, "Product subcategory not found")
    if subcategory.main_category_id != main_category_id:
        raise HTTPException(400, "Selected subcategory does not belong to the selected main category")
    if hs_code_ref_id and not db.query(HSCodeReference).filter(HSCodeReference.id == hs_code_ref_id).first():
        raise HTTPException(404, "HS code reference not found")


# ── Admin endpoints (require auth) ────────────────────────────────────────────

@router.get("/admin", response_model=ProductListResponse)
def admin_list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = "",
    category: str = "",
    supplier_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Product)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%") | Product.code.ilike(f"%{search}%"))
    if category:
        q = q.filter(Product.category == category)
    if supplier_id:
        q = q.filter(Product.supplier_id == supplier_id)
    total = q.count()
    results = q.order_by(Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "results": results}


@router.get("/taxonomy", response_model=ProductReferenceDataResponse)
def list_product_taxonomy(
    country: str = "",
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    hs_q = db.query(HSCodeReference)
    main_q = db.query(ProductMainCategory)
    sub_q = db.query(ProductSubcategory)
    type_q = db.query(ProductType)
    if not include_inactive:
        hs_q = hs_q.filter(HSCodeReference.is_active == True)  # noqa: E712
        main_q = main_q.filter(ProductMainCategory.is_active == True)  # noqa: E712
        sub_q = sub_q.filter(ProductSubcategory.is_active == True)  # noqa: E712
        type_q = type_q.filter(ProductType.is_active == True)  # noqa: E712
    if country:
        hs_q = hs_q.filter(HSCodeReference.country == country)
    return {
        "main_categories": main_q
        .order_by(ProductMainCategory.sort_order, ProductMainCategory.name)
        .all(),
        "subcategories": sub_q
        .order_by(ProductSubcategory.main_category_id, ProductSubcategory.sort_order, ProductSubcategory.name)
        .all(),
        "product_types": type_q
        .order_by(ProductType.main_category_id, ProductType.subcategory_id, ProductType.sort_order, ProductType.name)
        .all(),
        "hs_codes": hs_q.order_by(HSCodeReference.country, HSCodeReference.hs_code, HSCodeReference.description).all(),
    }


@router.post("/taxonomy/main-categories", response_model=ProductMainCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_product_main_category(
    payload: ProductMainCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    category = ProductMainCategory(**payload.model_dump())
    db.add(category)
    _commit_reference(db, "Main category code already exists")
    db.refresh(category)
    return category


@router.patch("/taxonomy/main-categories/{category_id}", response_model=ProductMainCategoryResponse)
def update_product_main_category(
    category_id: int,
    payload: ProductMainCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    category = db.query(ProductMainCategory).filter(ProductMainCategory.id == category_id).first()
    if not category:
        raise HTTPException(404, "Product main category not found")
    _patch_model(category, payload)
    _commit_reference(db, "Main category code already exists")
    db.refresh(category)
    return category


@router.post("/taxonomy/subcategories", response_model=ProductSubcategoryResponse, status_code=status.HTTP_201_CREATED)
def create_product_subcategory(
    payload: ProductSubcategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    _validate_subcategory_parent(db, payload.main_category_id)
    subcategory = ProductSubcategory(**payload.model_dump())
    db.add(subcategory)
    _commit_reference(db, "Subcategory code already exists for this main category")
    db.refresh(subcategory)
    return subcategory


@router.patch("/taxonomy/subcategories/{subcategory_id}", response_model=ProductSubcategoryResponse)
def update_product_subcategory(
    subcategory_id: int,
    payload: ProductSubcategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    subcategory = db.query(ProductSubcategory).filter(ProductSubcategory.id == subcategory_id).first()
    if not subcategory:
        raise HTTPException(404, "Product subcategory not found")
    next_main_category_id = payload.main_category_id if payload.main_category_id is not None else subcategory.main_category_id
    _validate_subcategory_parent(db, next_main_category_id)
    _patch_model(subcategory, payload)
    _commit_reference(db, "Subcategory code already exists for this main category")
    db.refresh(subcategory)
    return subcategory


@router.post("/taxonomy/hs-codes", response_model=HSCodeReferenceResponse, status_code=status.HTTP_201_CREATED)
def create_hs_code_reference(
    payload: HSCodeReferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    hs_ref = HSCodeReference(**payload.model_dump())
    db.add(hs_ref)
    _commit_reference(db, "HS code reference already exists for this country/code/description")
    db.refresh(hs_ref)
    return hs_ref


@router.patch("/taxonomy/hs-codes/{hs_code_id}", response_model=HSCodeReferenceResponse)
def update_hs_code_reference(
    hs_code_id: int,
    payload: HSCodeReferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    hs_ref = db.query(HSCodeReference).filter(HSCodeReference.id == hs_code_id).first()
    if not hs_ref:
        raise HTTPException(404, "HS code reference not found")
    _patch_model(hs_ref, payload)
    _commit_reference(db, "HS code reference already exists for this country/code/description")
    db.refresh(hs_ref)
    return hs_ref


@router.post("/taxonomy/product-types", response_model=ProductTypeResponse, status_code=status.HTTP_201_CREATED)
def create_product_type(
    payload: ProductTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    _validate_product_type_tree(db, payload.main_category_id, payload.subcategory_id, payload.hs_code_ref_id)
    product_type = ProductType(**payload.model_dump())
    db.add(product_type)
    _commit_reference(db, "Product type code already exists for this subcategory")
    db.refresh(product_type)
    return product_type


@router.patch("/taxonomy/product-types/{product_type_id}", response_model=ProductTypeResponse)
def update_product_type(
    product_type_id: int,
    payload: ProductTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    product_type = db.query(ProductType).filter(ProductType.id == product_type_id).first()
    if not product_type:
        raise HTTPException(404, "Product type not found")
    next_main_category_id = payload.main_category_id if payload.main_category_id is not None else product_type.main_category_id
    next_subcategory_id = payload.subcategory_id if payload.subcategory_id is not None else product_type.subcategory_id
    next_hs_code_ref_id = payload.hs_code_ref_id if payload.hs_code_ref_id is not None else product_type.hs_code_ref_id
    _validate_product_type_tree(db, next_main_category_id, next_subcategory_id, next_hs_code_ref_id)
    _patch_model(product_type, payload)
    _commit_reference(db, "Product type code already exists for this subcategory")
    db.refresh(product_type)
    return product_type


@router.post("/admin", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    if db.query(Product).filter(Product.code == payload.code).first():
        raise HTTPException(400, f"Product code '{payload.code}' already exists")
    product = Product(**payload.model_dump())
    _apply_product_price_defaults(product, db)
    _apply_reference_defaults(product, db)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/admin/from-invoice-item", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product_from_invoice_item(
    payload: ProductFromInvoiceItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    cartons = payload.cartons or 1
    quantity = payload.quantity or 0
    pcs_per_carton = int(round(payload.pcs_per_carton or ((quantity / cartons) if cartons and quantity else 1))) or 1
    cbm_per_carton = (payload.cbm or 0) / cartons if cartons else 0
    gross_per_carton = (payload.gross_weight or 0) / cartons if cartons else None
    net_per_carton = (payload.net_weight or 0) / cartons if cartons else None
    per_piece = _per_piece_price(payload.unit_price, payload.unit, pcs_per_carton)
    currency = (payload.currency or "USD").upper()

    product = Product(
        code=_generate_invoice_product_code(db),
        name=payload.name.strip(),
        name_ar=payload.name_ar or None,
        description=payload.description or None,
        description_ar=payload.description_ar or None,
        price_usd=per_piece if currency != "CNY" else None,
        price_cny=per_piece if currency == "CNY" else 0,
        hs_code=payload.hs_code or None,
        customs_unit_basis=payload.customs_unit_basis or payload.unit or None,
        pcs_per_carton=pcs_per_carton,
        cbm_per_carton=cbm_per_carton or 0,
        min_order_cartons=max(int(cartons), 1),
        gross_weight_kg_per_carton=gross_per_carton or None,
        net_weight_kg_per_carton=net_per_carton or None,
        carton_length_cm=payload.carton_length_cm,
        carton_width_cm=payload.carton_width_cm,
        carton_height_cm=payload.carton_height_cm,
        is_active=True,
        is_featured=False,
    )
    _apply_product_price_defaults(product, db)
    _apply_reference_defaults(product, db)
    db.add(product)
    db.flush()

    image_path = _save_photo_data(payload.product_image_data)
    if image_path:
        db.add(ProductPhoto(product_id=product.id, file_path=image_path, is_main=True, sort_order=0))

    db.commit()
    db.refresh(product)
    return product


@router.patch("/admin/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(product, k, v)
    _apply_product_price_defaults(product, db)
    _apply_reference_defaults(product, db)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/admin/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    photo_paths = [photo.file_path for photo in product.photos]
    db.query(InvoiceItem).filter(InvoiceItem.product_id == product_id).update(
        {InvoiceItem.product_id: None},
        synchronize_session=False,
    )
    db.query(CustomsEstimateLine).filter(CustomsEstimateLine.product_id == product_id).update(
        {CustomsEstimateLine.product_id: None},
        synchronize_session=False,
    )
    _detach_product_from_cargo_goods(db, product_id)
    db.delete(product)
    db.commit()
    for path in photo_paths:
        _remove_file_if_local(path)


@router.post("/admin/{product_id}/photos", response_model=ProductResponse)
def upload_photo(
    product_id: int,
    file: UploadFile = File(...),
    is_main: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    path = _save_photo(file)
    if is_main:
        for p in product.photos:
            p.is_main = False
    sort_order = len(product.photos)
    photo = ProductPhoto(product_id=product_id, file_path=path, is_main=is_main or sort_order == 0, sort_order=sort_order)
    db.add(photo)
    db.commit()
    db.refresh(product)
    return product


@router.post("/admin/{product_id}/photos/bulk", response_model=ProductResponse)
def upload_photos_bulk(
    product_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    if not files:
        raise HTTPException(400, "No photos uploaded")
    if len(files) > 20:
        raise HTTPException(400, "Maximum 20 photos per upload")

    sort_order = len(product.photos)
    has_main = any(photo.is_main for photo in product.photos)
    for offset, file in enumerate(files):
        path = _save_photo(file)
        db.add(ProductPhoto(
            product_id=product_id,
            file_path=path,
            is_main=not has_main and offset == 0,
            sort_order=sort_order + offset,
        ))
    db.commit()
    db.refresh(product)
    return product


@router.delete("/admin/{product_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    product_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    photo = db.query(ProductPhoto).filter(
        ProductPhoto.id == photo_id,
        ProductPhoto.product_id == product_id,
    ).first()
    if not photo:
        raise HTTPException(404, "Photo not found")
    if os.path.exists(photo.file_path):
        os.remove(photo.file_path)
    db.delete(photo)
    db.commit()


# ── Bulk import endpoints ─────────────────────────────────────────────────────

@router.post("/admin/scan-folder")
def scan_folder(
    body: ScanFolderRequest,
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """Scan a local folder and return subfolder info for bulk import preview."""
    if not os.path.isdir(body.folder_path):
        raise HTTPException(400, f"Folder not found: {body.folder_path}")

    entries = []
    for entry in sorted(os.scandir(body.folder_path), key=lambda e: e.name):
        if not entry.is_dir():
            continue
        photos = [
            f for f in os.listdir(entry.path)
            if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
        ]
        entries.append({
            "code": entry.name,
            "path": entry.path,
            "photo_count": len(photos),
        })

    return {"folder": body.folder_path, "entries": entries, "total": len(entries)}


@router.post("/admin/bulk-import")
async def bulk_import(
    body: BulkImportConfig,
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """Stream SSE progress while importing product folders as products + photos."""
    if not os.path.isdir(body.folder_path):
        raise HTTPException(400, f"Folder not found: {body.folder_path}")

    async def generate():
        db = SessionLocal()
        try:
            folders = [
                e for e in sorted(os.scandir(body.folder_path), key=lambda e: e.name)
                if e.is_dir()
            ]
            total = len(folders)
            created = skipped = failed = 0

            yield f"data: {_json.dumps({'type': 'start', 'total': total})}\n\n"

            for i, entry in enumerate(folders):
                code = entry.name
                photos = sorted([
                    f for f in os.listdir(entry.path)
                    if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
                ])

                existing = db.query(Product).filter(Product.code == code).first()
                if existing:
                    skipped += 1
                    yield f"data: {_json.dumps({'type': 'progress', 'i': i+1, 'total': total, 'code': code, 'status': 'skipped', 'created': created, 'skipped': skipped, 'failed': failed})}\n\n"
                    continue

                try:
                    product = Product(
                        code=code,
                        name=code,
                        supplier_id=body.supplier_id,
                        price_cny=body.default_price,
                        pcs_per_carton=body.default_pcs,
                        cbm_per_carton=body.default_cbm,
                        min_order_cartons=body.default_min,
                        category=body.default_category or None,
                        is_active=True,
                        is_featured=False,
                    )
                    db.add(product)
                    db.flush()

                    os.makedirs(UPLOAD_DIR, exist_ok=True)
                    for j, photo_name in enumerate(photos):
                        photo_path = os.path.join(entry.path, photo_name)
                        ext = os.path.splitext(photo_name)[1].lower()
                        if ext not in ALLOWED_EXTENSIONS:
                            continue
                        new_name = f"{uuid.uuid4().hex}{ext}"
                        dest = os.path.join(UPLOAD_DIR, new_name)
                        shutil.copy2(photo_path, dest)
                        db.add(ProductPhoto(
                            product_id=product.id,
                            file_path=dest,
                            is_main=(j == 0),
                            sort_order=j,
                        ))

                    db.commit()
                    created += 1
                    yield f"data: {_json.dumps({'type': 'progress', 'i': i+1, 'total': total, 'code': code, 'status': 'created', 'photos': len(photos), 'created': created, 'skipped': skipped, 'failed': failed})}\n\n"
                except Exception as exc:
                    db.rollback()
                    failed += 1
                    yield f"data: {_json.dumps({'type': 'progress', 'i': i+1, 'total': total, 'code': code, 'status': 'error', 'error': str(exc), 'created': created, 'skipped': skipped, 'failed': failed})}\n\n"

            yield f"data: {_json.dumps({'type': 'done', 'created': created, 'skipped': skipped, 'failed': failed})}\n\n"
        finally:
            db.close()

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Public endpoints (no auth) ────────────────────────────────────────────────

@router.get("", response_model=ProductListResponse)
def public_list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = "",
    category: str = "",
    featured_only: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.is_active == True)
    if search:
        q = q.filter(
            Product.name.ilike(f"%{search}%")
            | Product.code.ilike(f"%{search}%")
            | Product.name_ar.ilike(f"%{search}%")
        )
    if category:
        q = q.filter(Product.category == category)
    if featured_only:
        q = q.filter(Product.is_featured == True)
    total = q.count()
    results = q.order_by(Product.is_featured.desc(), Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "results": results}


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Product.category).filter(
        Product.is_active == True,
        Product.category.isnot(None),
    ).distinct().all()
    return [r[0] for r in rows if r[0]]


@router.get("/{product_id}", response_model=ProductResponse)
def public_get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return product
