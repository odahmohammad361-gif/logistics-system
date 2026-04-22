import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_role
from app.models.user import User, UserRole
from app.models.company_settings import CompanySettings
from app.schemas.invoice import CompanySettingsUpdate, CompanySettingsResponse

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")


def _get_or_create(db: Session) -> CompanySettings:
    company = db.query(CompanySettings).filter(CompanySettings.is_active == True).first()
    if not company:
        company = CompanySettings(name="My Company", is_active=True)
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


@router.get("", response_model=CompanySettingsResponse)
def get_company(db: Session = Depends(get_db), current_user: User = Depends(require_role(UserRole.STAFF))):
    return _get_or_create(db)


@router.patch("", response_model=CompanySettingsResponse)
def update_company(
    payload: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    company = _get_or_create(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.post("/logo", response_model=CompanySettingsResponse)
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    if file.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Only PNG or JPEG allowed")
    company = _get_or_create(db)
    asset_dir = os.path.join(UPLOAD_DIR, "company")
    os.makedirs(asset_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1]
    path = os.path.join(asset_dir, f"logo.{ext}")
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    company.logo_path = os.path.join("company", f"logo.{ext}")
    db.commit()
    db.refresh(company)
    return company


@router.post("/stamp", response_model=CompanySettingsResponse)
def upload_stamp(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    if file.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(400, "Only PNG or JPEG allowed")
    company = _get_or_create(db)
    asset_dir = os.path.join(UPLOAD_DIR, "company")
    os.makedirs(asset_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1]
    path = os.path.join(asset_dir, f"stamp.{ext}")
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    company.stamp_path = os.path.join("company", f"stamp.{ext}")
    db.commit()
    db.refresh(company)
    return company
