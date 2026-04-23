import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.product import Product, ProductPhoto
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse

router = APIRouter()

UPLOAD_DIR = "uploads/products"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


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
    db.delete(product)
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
        q = q.filter(Product.name.ilike(f"%{search}%") | Product.code.ilike(f"%{search}%"))
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
