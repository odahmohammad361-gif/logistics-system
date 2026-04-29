"""
Admin API for managing website customers (shop signups).
Includes listing, notes update, migrate-to-client, and deactivation.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.branch import Branch
from app.models.client import Client
from app.models.customer import Customer
from app.models.user import User, UserRole
from app.schemas.contact_validators import clean_arabic_name, clean_optional_email, clean_optional_phone, clean_english_name

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class CustomerAdminUpdate(BaseModel):
    notes:     Optional[str]  = None
    is_active: Optional[bool] = None


class MigrateToClientRequest(BaseModel):
    name:      Optional[str] = None
    name_ar:   Optional[str] = None
    phone:     Optional[str] = None
    email:     Optional[str] = None
    city:      Optional[str] = None
    country:   Optional[str] = None
    address:   Optional[str] = None
    branch_id: Optional[int] = None
    notes:     Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def valid_english_name(cls, v):
        return clean_english_name(v)

    @field_validator("name_ar", mode="before")
    @classmethod
    def valid_arabic_name(cls, v):
        return clean_arabic_name(v)

    @field_validator("phone", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, v):
        return clean_optional_email(v)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _serialize(c: Customer) -> dict:
    return {
        "id":          c.id,
        "full_name":   c.full_name,
        "email":       c.email,
        "phone":       c.phone,
        "telegram":    c.telegram,
        "country":     c.country,
        "is_verified": c.is_verified,
        "is_active":   c.is_active,
        "notes":       c.notes,
        "created_at":  c.created_at.isoformat() if c.created_at else None,
    }


# ── List ───────────────────────────────────────────────────────────────────────

@router.get("")
def list_customers(
    page:        int            = Query(1, ge=1),
    page_size:   int            = Query(20, ge=1, le=200),
    search:      str            = Query(""),
    is_verified: Optional[bool] = Query(None),
    db:          Session        = Depends(get_db),
    _:           User           = Depends(require_role(UserRole.STAFF)),
):
    q = db.query(Customer)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Customer.full_name.ilike(term)
            | Customer.email.ilike(term)
            | Customer.phone.ilike(term)
        )
    if is_verified is not None:
        q = q.filter(Customer.is_verified == is_verified)

    total   = q.count()
    results = q.order_by(Customer.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "results": [_serialize(c) for c in results]}


# ── Update (notes / active flag) ───────────────────────────────────────────────

@router.patch("/{customer_id}")
def update_customer(
    customer_id: int,
    payload:     CustomerAdminUpdate,
    db:          Session = Depends(get_db),
    _:           User    = Depends(require_role(UserRole.STAFF)),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return _serialize(c)


# ── Migrate to main Client ─────────────────────────────────────────────────────

@router.post("/{customer_id}/migrate")
def migrate_to_client(
    customer_id: int,
    payload:     MigrateToClientRequest,
    db:          Session = Depends(get_db),
    current_user: User   = Depends(require_role(UserRole.STAFF)),
):
    from app.api.v1.clients import _generate_client_code

    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")

    # Prevent duplicate if already migrated
    existing = (
        db.query(Client)
        .filter(Client.email == c.email, Client.is_active == True)
        .first()
    )
    if existing:
        raise HTTPException(
            409,
            f"A client with email {c.email} already exists (code: {existing.client_code})",
        )

    branch = None
    branch_code = "JO"
    if payload.branch_id:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(404, "Branch not found")
        branch_code = branch.code

    client_country = branch.country if branch else (payload.country or c.country)
    client_city = payload.city or (branch.city if branch else None)

    client = Client(
        name=payload.name or c.full_name,
        name_ar=payload.name_ar,
        phone=payload.phone or c.phone,
        email=payload.email or c.email,
        country=client_country,
        city=client_city,
        address=payload.address or None,
        branch_id=payload.branch_id,
        notes=payload.notes or c.notes,
        client_code=_generate_client_code(db, branch_code),
        created_by_id=current_user.id,
    )
    db.add(client)
    c.is_verified = True          # mark as migrated / verified
    db.commit()
    db.refresh(client)

    return {
        "client":      {"id": client.id, "client_code": client.client_code, "name": client.name},
        "customer_id": customer_id,
        "message":     "Customer successfully migrated to main client",
    }


# ── Deactivate ─────────────────────────────────────────────────────────────────

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_customer(
    customer_id: int,
    db:          Session = Depends(get_db),
    _:           User    = Depends(require_role(UserRole.ADMIN)),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")
    c.is_active = False
    db.commit()
