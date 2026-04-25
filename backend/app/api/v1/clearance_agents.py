from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.clearance_agent import ClearanceAgent, ClearanceAgentRate, ClearanceAgentEditLog
from app.schemas.clearance_agent import (
    ClearanceAgentCreate, ClearanceAgentUpdate,
    ClearanceAgentResponse, ClearanceAgentListResponse,
    ClearanceAgentRateCreate, ClearanceAgentRateUpdate, ClearanceAgentRateResponse,
)

router = APIRouter()


def _money(v):
    return float(v) if v is not None else None


def _serialize_rate(r: ClearanceAgentRate) -> dict:
    return {
        "id": r.id,
        "service_mode": r.service_mode,
        "country": r.country,
        "port": r.port,
        "route": r.route,
        "buy_clearance_fee": _money(r.buy_clearance_fee),
        "sell_clearance_fee": _money(r.sell_clearance_fee),
        "buy_transportation": _money(r.buy_transportation),
        "sell_transportation": _money(r.sell_transportation),
        "buy_delivery_authorization": _money(r.buy_delivery_authorization),
        "sell_delivery_authorization": _money(r.sell_delivery_authorization),
        "buy_inspection_ramp": _money(r.buy_inspection_ramp),
        "sell_inspection_ramp": _money(r.sell_inspection_ramp),
        "buy_port_inspection": _money(r.buy_port_inspection),
        "sell_port_inspection": _money(r.sell_port_inspection),
        "buy_import_export_card_pct": _money(r.buy_import_export_card_pct),
        "sell_import_export_card_pct": _money(r.sell_import_export_card_pct),
        "notes": r.notes,
        "is_active": r.is_active,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _serialize_log(l: ClearanceAgentEditLog) -> dict:
    return {
        "id": l.id,
        "action": l.action,
        "summary": l.summary,
        "changed_by": l.changed_by.full_name if l.changed_by else None,
        "changed_at": l.changed_at,
    }


def _serialize_agent(a: ClearanceAgent) -> dict:
    fees = [a.clearance_fee, a.service_fee, a.transport_fee, a.handling_fee]
    total = sum(float(f) for f in fees if f is not None)
    return {
        "id": a.id,
        "name": a.name,
        "name_ar": a.name_ar,
        "country": a.country,
        "city": a.city,
        "address": a.address,
        "contact_person": a.contact_person,
        "phone": a.phone,
        "whatsapp": a.whatsapp,
        "email": a.email,
        "license_number": a.license_number,
        "bank_name": a.bank_name,
        "bank_account": a.bank_account,
        "bank_swift": a.bank_swift,
        "clearance_fee": _money(a.clearance_fee),
        "service_fee": _money(a.service_fee),
        "transport_fee": _money(a.transport_fee),
        "handling_fee": _money(a.handling_fee),
        "storage_fee_per_day": _money(a.storage_fee_per_day),
        "total_fixed_fees": total or None,
        "notes": a.notes,
        "is_active": a.is_active,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "rates": [_serialize_rate(r) for r in a.rates if r.is_active],
        "edit_log": [_serialize_log(l) for l in a.edit_log],
    }


@router.post("", response_model=ClearanceAgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: ClearanceAgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = ClearanceAgent(**payload.model_dump())
    db.add(agent)
    db.flush()
    db.add(ClearanceAgentEditLog(
        agent_id=agent.id,
        action="create",
        summary=f"Created clearance agent {agent.name}",
        changed_by_id=current_user.id,
    ))
    db.commit()
    db.refresh(agent)
    return _serialize_agent(agent)


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
    return ClearanceAgentListResponse(total=total, page=page, page_size=page_size, results=[_serialize_agent(a) for a in results])


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
    return _serialize_agent(agent)


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
    changes = []
    for field, value in payload.model_dump(exclude_unset=True).items():
        old = getattr(agent, field, None)
        if str(old) != str(value):
            changes.append(f"{field}: {old} -> {value}")
        setattr(agent, field, value)
    if changes:
        db.add(ClearanceAgentEditLog(
            agent_id=agent_id,
            action="profile_edit",
            summary="; ".join(changes[:12]),
            changed_by_id=current_user.id,
        ))
    db.commit()
    db.refresh(agent)
    return _serialize_agent(agent)


@router.post("/{agent_id}/rates", response_model=ClearanceAgentRateResponse, status_code=status.HTTP_201_CREATED)
def create_rate(
    agent_id: int,
    payload: ClearanceAgentRateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = db.query(ClearanceAgent).filter(ClearanceAgent.id == agent_id, ClearanceAgent.is_active == True).first()
    if not agent:
        raise HTTPException(404, "Clearance agent not found")
    rate = ClearanceAgentRate(agent_id=agent_id, **payload.model_dump())
    db.add(rate)
    db.flush()
    db.add(ClearanceAgentEditLog(
        agent_id=agent_id,
        action="rate_create",
        summary=f"Added {rate.service_mode} clearance rate for {rate.country or '-'} / {rate.port or '-'}",
        changed_by_id=current_user.id,
    ))
    db.commit()
    db.refresh(rate)
    return _serialize_rate(rate)


@router.patch("/{agent_id}/rates/{rate_id}", response_model=ClearanceAgentRateResponse)
def update_rate(
    agent_id: int,
    rate_id: int,
    payload: ClearanceAgentRateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    rate = db.query(ClearanceAgentRate).filter(
        ClearanceAgentRate.id == rate_id,
        ClearanceAgentRate.agent_id == agent_id,
        ClearanceAgentRate.is_active == True,
    ).first()
    if not rate:
        raise HTTPException(404, "Clearance rate not found")

    changes = []
    for field, value in payload.model_dump(exclude_unset=True).items():
        old = getattr(rate, field, None)
        if str(old) != str(value):
            changes.append(f"{field}: {old} -> {value}")
            setattr(rate, field, value)
    if changes:
        db.add(ClearanceAgentEditLog(
            agent_id=agent_id,
            action="rate_edit",
            summary=f"{rate.service_mode} {rate.country or '-'} {rate.port or '-'}: " + "; ".join(changes[:12]),
            changed_by_id=current_user.id,
        ))
    db.commit()
    db.refresh(rate)
    return _serialize_rate(rate)


@router.delete("/{agent_id}/rates/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate(
    agent_id: int,
    rate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    rate = db.query(ClearanceAgentRate).filter(
        ClearanceAgentRate.id == rate_id,
        ClearanceAgentRate.agent_id == agent_id,
        ClearanceAgentRate.is_active == True,
    ).first()
    if not rate:
        raise HTTPException(404, "Clearance rate not found")
    rate.is_active = False
    db.add(ClearanceAgentEditLog(
        agent_id=agent_id,
        action="rate_delete",
        summary=f"Deleted {rate.service_mode} clearance rate for {rate.country or '-'} / {rate.port or '-'}",
        changed_by_id=current_user.id,
    ))
    db.commit()


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
    db.add(ClearanceAgentEditLog(
        agent_id=agent_id,
        action="delete",
        summary=f"Deleted clearance agent {agent.name}",
        changed_by_id=current_user.id,
    ))
    db.commit()
