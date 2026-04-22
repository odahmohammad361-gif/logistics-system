from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.company_warehouse import CompanyWarehouse
from app.schemas.warehouse import WarehouseCreate, WarehouseUpdate, WarehouseResponse, WarehouseListResponse

router = APIRouter()


@router.get("", response_model=WarehouseListResponse)
def list_warehouses(
    warehouse_type: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CompanyWarehouse)
    if warehouse_type:
        q = q.filter(CompanyWarehouse.warehouse_type == warehouse_type)
    results = q.order_by(CompanyWarehouse.warehouse_type, CompanyWarehouse.name).all()
    return {"total": len(results), "results": results}


@router.post("", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    wh = CompanyWarehouse(**payload.model_dump())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


@router.patch("/{wh_id}", response_model=WarehouseResponse)
def update_warehouse(
    wh_id: int,
    payload: WarehouseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    wh = db.query(CompanyWarehouse).filter(CompanyWarehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(wh, k, v)
    db.commit()
    db.refresh(wh)
    return wh


@router.delete("/{wh_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(
    wh_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    wh = db.query(CompanyWarehouse).filter(CompanyWarehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    db.delete(wh)
    db.commit()
