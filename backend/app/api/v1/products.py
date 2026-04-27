import os
import uuid
import shutil
import json as _json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.product import Product, ProductPhoto
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse

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


@router.post("/admin", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    if db.query(Product).filter(Product.code == payload.code).first():
        raise HTTPException(400, f"Product code '{payload.code}' already exists")
    product = Product(**payload.model_dump())
    db.add(product)
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
    product.is_active = False
    db.commit()


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
