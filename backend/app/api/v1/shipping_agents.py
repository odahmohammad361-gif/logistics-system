import os
import shutil
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.shipping_agent import ShippingAgent
from app.models.shipping_quote import ShippingQuote, QuoteServiceMode, QuoteStatus
from app.models.client import Client
from app.schemas.agent import (
    AgentCreate, AgentUpdate, AgentResponse, AgentListResponse,
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteListResponse,
    CompareEntry, CompareResponse,
)

router = APIRouter()

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads",
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _quote_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(ShippingQuote).filter(
        ShippingQuote.quote_number.like(f"QT-{year}-%")
    ).count()
    return f"QT-{year}-{str(count + 1).zfill(4)}"


def _calc_totals(p: QuoteCreate | QuoteUpdate) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Returns (total_origin, total_destination, total_surcharges, total_all)."""
    def _s(*vals) -> Decimal:
        return sum((Decimal(str(v)) for v in vals if v is not None), Decimal("0"))

    origin = _s(
        p.thc_origin, p.bl_fee, p.doc_fee, p.sealing_fee,
        p.inspection_fee, p.trucking_origin, p.stuffing_fee, p.warehouse_handling,
    )
    dest = _s(
        p.thc_destination, p.customs_destination,
        p.brokerage_destination, p.trucking_destination,
    )
    surcharges = _s(p.baf, p.eca_surcharge, p.war_risk_surcharge, p.other_surcharges)

    freight = Decimal(str(p.ocean_freight)) if p.ocean_freight else Decimal("0")
    total_all = freight + origin + dest + surcharges
    return origin, dest, surcharges, total_all


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT CRUD
# ═══════════════════════════════════════════════════════════════════════════════

# IMPORTANT: /compare must be defined BEFORE /{agent_id} to avoid route collision

@router.get("/compare", response_model=CompareResponse)
def compare_agents(
    port_of_loading: str = Query(None),
    port_of_discharge: str = Query(None),
    service_mode: QuoteServiceMode = Query(None),
    container_type: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compare all active shipping agents for a given route/mode.
    Returns quotes sorted cheapest-first by total_all.
    """
    q = db.query(ShippingQuote).filter(
        ShippingQuote.is_active == True,
        ShippingQuote.status == QuoteStatus.ACTIVE,
    )
    if port_of_loading:
        q = q.filter(ShippingQuote.port_of_loading.ilike(f"%{port_of_loading}%"))
    if port_of_discharge:
        q = q.filter(ShippingQuote.port_of_discharge.ilike(f"%{port_of_discharge}%"))
    if service_mode:
        q = q.filter(ShippingQuote.service_mode == service_mode)
    if container_type:
        q = q.filter(ShippingQuote.container_type == container_type)

    quotes = q.all()
    entries = [
        CompareEntry(
            agent_id=sq.agent_id,
            agent_name=sq.agent.name,
            agent_wechat=sq.agent.wechat_id,
            quote_id=sq.id,
            quote_number=sq.quote_number,
            service_mode=sq.service_mode,
            container_type=sq.container_type,
            incoterm=sq.incoterm.value if sq.incoterm else None,
            transit_days=sq.transit_days,
            total_origin=sq.total_origin,
            total_destination=sq.total_destination,
            total_surcharges=sq.total_surcharges,
            total_all=sq.total_all,
            ocean_freight=sq.ocean_freight,
            validity_to=sq.validity_to,
            status=sq.status,
        )
        for sq in quotes
    ]
    # Sort: cheapest first (None totals go last)
    entries.sort(key=lambda e: e.total_all if e.total_all is not None else Decimal("999999999"))

    return CompareResponse(
        port_of_loading=port_of_loading,
        port_of_discharge=port_of_discharge,
        service_mode=service_mode.value if service_mode else None,
        container_type=container_type,
        count=len(entries),
        results=entries,
    )


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = ShippingAgent(**payload.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.get("", response_model=AgentListResponse)
def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str = Query(""),
    country: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ShippingAgent).filter(ShippingAgent.is_active == True)
    if search:
        q = q.filter(ShippingAgent.name.ilike(f"%{search}%"))
    if country:
        q = q.filter(ShippingAgent.country.ilike(f"%{country}%"))
    total = q.count()
    results = q.order_by(ShippingAgent.name).offset((page - 1) * page_size).limit(page_size).all()
    return AgentListResponse(total=total, page=page, page_size=page_size, results=results)


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agent = db.query(ShippingAgent).filter(
        ShippingAgent.id == agent_id, ShippingAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Shipping agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: int,
    payload: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = db.query(ShippingAgent).filter(
        ShippingAgent.id == agent_id, ShippingAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Shipping agent not found")
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
    agent = db.query(ShippingAgent).filter(
        ShippingAgent.id == agent_id, ShippingAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Shipping agent not found")
    agent.is_active = False
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# QUOTES (nested under agent)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{agent_id}/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    agent_id: int,
    payload: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    agent = db.query(ShippingAgent).filter(
        ShippingAgent.id == agent_id, ShippingAgent.is_active == True
    ).first()
    if not agent:
        raise HTTPException(404, "Shipping agent not found")

    if payload.client_id:
        if not db.query(Client).filter(Client.id == payload.client_id).first():
            raise HTTPException(404, "Client not found")

    origin, dest, surcharges, total_all = _calc_totals(payload)

    quote = ShippingQuote(
        quote_number=_quote_number(db),
        agent_id=agent_id,
        created_by_id=current_user.id,
        total_origin=origin,
        total_destination=dest,
        total_surcharges=surcharges,
        total_all=total_all,
        **payload.model_dump(),
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    return quote


@router.get("/{agent_id}/quotes", response_model=QuoteListResponse)
def list_quotes(
    agent_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service_mode: QuoteServiceMode = Query(None),
    quote_status: QuoteStatus = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(ShippingAgent).filter(ShippingAgent.id == agent_id).first():
        raise HTTPException(404, "Shipping agent not found")

    q = db.query(ShippingQuote).filter(
        ShippingQuote.agent_id == agent_id,
        ShippingQuote.is_active == True,
    )
    if service_mode:
        q = q.filter(ShippingQuote.service_mode == service_mode)
    if quote_status:
        q = q.filter(ShippingQuote.status == quote_status)

    total = q.count()
    results = q.order_by(ShippingQuote.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return QuoteListResponse(total=total, page=page, page_size=page_size, results=results)


@router.get("/{agent_id}/quotes/{quote_id}", response_model=QuoteResponse)
def get_quote(
    agent_id: int,
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = db.query(ShippingQuote).filter(
        ShippingQuote.id == quote_id,
        ShippingQuote.agent_id == agent_id,
        ShippingQuote.is_active == True,
    ).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    return quote


@router.patch("/{agent_id}/quotes/{quote_id}", response_model=QuoteResponse)
def update_quote(
    agent_id: int,
    quote_id: int,
    payload: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    quote = db.query(ShippingQuote).filter(
        ShippingQuote.id == quote_id,
        ShippingQuote.agent_id == agent_id,
        ShippingQuote.is_active == True,
    ).first()
    if not quote:
        raise HTTPException(404, "Quote not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(quote, field, value)

    # Recompute totals with merged data (current + updated)
    merged = QuoteCreate(
        service_mode=quote.service_mode,
        ocean_freight=quote.ocean_freight,
        air_freight_per_kg=quote.air_freight_per_kg,
        baf=quote.baf, eca_surcharge=quote.eca_surcharge,
        war_risk_surcharge=quote.war_risk_surcharge, other_surcharges=quote.other_surcharges,
        thc_origin=quote.thc_origin, bl_fee=quote.bl_fee, doc_fee=quote.doc_fee,
        sealing_fee=quote.sealing_fee, inspection_fee=quote.inspection_fee,
        trucking_origin=quote.trucking_origin, stuffing_fee=quote.stuffing_fee,
        warehouse_handling=quote.warehouse_handling,
        thc_destination=quote.thc_destination, customs_destination=quote.customs_destination,
        brokerage_destination=quote.brokerage_destination, trucking_destination=quote.trucking_destination,
    )
    origin, dest, surcharges, total_all = _calc_totals(merged)
    quote.total_origin = origin
    quote.total_destination = dest
    quote.total_surcharges = surcharges
    quote.total_all = total_all

    db.commit()
    db.refresh(quote)
    return quote


@router.delete("/{agent_id}/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    agent_id: int,
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    quote = db.query(ShippingQuote).filter(
        ShippingQuote.id == quote_id,
        ShippingQuote.agent_id == agent_id,
        ShippingQuote.is_active == True,
    ).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    quote.is_active = False
    db.commit()


@router.post("/{agent_id}/quotes/{quote_id}/document", response_model=QuoteResponse)
def upload_quote_document(
    agent_id: int,
    quote_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """Upload original quote document received from agent (WeChat screenshot / PDF)."""
    quote = db.query(ShippingQuote).filter(
        ShippingQuote.id == quote_id,
        ShippingQuote.agent_id == agent_id,
        ShippingQuote.is_active == True,
    ).first()
    if not quote:
        raise HTTPException(404, "Quote not found")

    allowed = ("image/png", "image/jpeg", "application/pdf")
    if file.content_type not in allowed:
        raise HTTPException(400, "Only PNG, JPEG or PDF files are allowed")

    doc_dir = os.path.join(UPLOAD_DIR, "quotes")
    os.makedirs(doc_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    filename = f"quote_{quote_id}_agent_{agent_id}.{ext}"
    path = os.path.join(doc_dir, filename)

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    quote.document_path = os.path.join("quotes", filename)
    db.commit()
    db.refresh(quote)
    return quote
