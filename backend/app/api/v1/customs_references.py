from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.database import get_db
from app.models.product import HSCodeReference, Product, ProductType
from app.models.user import User, UserRole
from app.schemas.product import (
    HSCodeReferenceCreate,
    HSCodeReferenceResponse,
    HSCodeReferenceUpdate,
)

router = APIRouter()


def _commit_hs_reference(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(400, "HS code reference already exists for this country/description") from exc


@router.get("/hs-codes", response_model=list[HSCodeReferenceResponse])
def list_hs_code_references(
    country: str | None = Query(None),
    search: str | None = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    q = db.query(HSCodeReference)
    if country:
        q = q.filter(HSCodeReference.country == country)
    if not include_inactive:
        q = q.filter(HSCodeReference.is_active == True)  # noqa: E712
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            HSCodeReference.hs_code.ilike(like),
            HSCodeReference.description.ilike(like),
            HSCodeReference.description_ar.ilike(like),
            HSCodeReference.chapter.ilike(like),
        ))
    return q.order_by(HSCodeReference.country, HSCodeReference.hs_code, HSCodeReference.description).all()


@router.post("/hs-codes", response_model=HSCodeReferenceResponse, status_code=status.HTTP_201_CREATED)
def create_hs_code_reference(
    payload: HSCodeReferenceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    ref = HSCodeReference(**payload.model_dump())
    db.add(ref)
    _commit_hs_reference(db)
    db.refresh(ref)
    return ref


@router.patch("/hs-codes/{ref_id}", response_model=HSCodeReferenceResponse)
def update_hs_code_reference(
    ref_id: int,
    payload: HSCodeReferenceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    ref = db.query(HSCodeReference).filter(HSCodeReference.id == ref_id).first()
    if not ref:
        raise HTTPException(404, "HS code reference not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ref, key, value)
    _commit_hs_reference(db)
    db.refresh(ref)
    return ref


@router.delete("/hs-codes/{ref_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hs_code_reference(
    ref_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    ref = db.query(HSCodeReference).filter(HSCodeReference.id == ref_id).first()
    if not ref:
        raise HTTPException(404, "HS code reference not found")

    db.query(Product).filter(Product.hs_code_ref_id == ref_id).update(
        {Product.hs_code_ref_id: None},
        synchronize_session=False,
    )
    db.query(ProductType).filter(ProductType.hs_code_ref_id == ref_id).update(
        {ProductType.hs_code_ref_id: None},
        synchronize_session=False,
    )
    db.delete(ref)
    db.commit()
