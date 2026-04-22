from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.clearance_agent import ClearanceAgent
from app.schemas.clearance_agent import (
    ClearanceAgentCreate, ClearanceAgentUpdate,
    ClearanceAgentResponse, ClearanceAgentListResponse,
)

router = APIRouter()


@router.post("", response_model=ClearanceAgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: ClearanceAgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = ClearanceAgent(**payload.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.get("", response_model=ClearanceAgentListResponse)
def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    country: str = Query(""),
    city: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ClearanceAgent).filter(ClearanceAgent.is_active == True)
    if search:
        q = q.filter(ClearanceAgent.name.ilike(f"%{search}%"))
    if country:
        q = q.filter(ClearanceAgent.country.ilike(f"%{country}%"))
    if city:
        q = q.filter(ClearanceAgent.city.ilike(f"%{city}%"))
    total = q.count()
    results = q.order_by(ClearanceAgent.country, ClearanceAgent.name).offset((page - 1) * page_size).limit(page_size).all()
    return ClearanceAgentListResponse(total=total, page=page, page_size=page_size, results=results)


@router.get("/{agent_id}", response_model=ClearanceAgentResponse)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agent = db.query(ClearanceAgent).filter(
        ClearanceAgent.id == agent_id, ClearanceAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Clearance agent not found")
    return agent


@router.patch("/{agent_id}", response_model=ClearanceAgentResponse)
def update_agent(
    agent_id: int,
    payload: ClearanceAgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = db.query(ClearanceAgent).filter(
        ClearanceAgent.id == agent_id, ClearanceAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Clearance agent not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    agent = db.query(ClearanceAgent).filter(
        ClearanceAgent.id == agent_id, ClearanceAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Clearance agent not found")
    agent.is_active = False
    db.commit()
