from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.branch import Branch

router = APIRouter()


class BranchOut(BaseModel):
    id: int
    name: str
    name_ar: str
    code: str
    country: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[BranchOut])
def list_branches(db: Session = Depends(get_db)):
    """Return all active branches — no auth required (used by forms)."""
    return db.query(Branch).filter(Branch.is_active == True).order_by(Branch.id).all()
