import os
import shutil
import uuid
from datetime import datetime, timezone, date as date_type
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.shipping_agent import ShippingAgent, AgentPriceHistory, AgentContract, AgentEditLog
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

    changes = []
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        old = getattr(agent, field, None)
        if str(old) != str(value):
            changes.append(f"{field}: {old} → {value}")
        setattr(agent, field, value)

    if changes:
        db.add(AgentEditLog(
            agent_id=agent_id,
            action="update",
            summary="; ".join(changes),
            changed_by_id=current_user.id,
        ))

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


# ── Helper: serialize agent fully ────────────────────────────────────────────

def _serialize_agent(a: ShippingAgent) -> dict:
    def f(v): return float(v) if v is not None else None
    return {
        "id": a.id, "name": a.name, "name_ar": a.name_ar,
        "country": a.country, "contact_person": a.contact_person,
        "phone": a.phone, "whatsapp": a.whatsapp, "wechat_id": a.wechat_id, "email": a.email,
        "warehouse_address": a.warehouse_address, "warehouse_city": a.warehouse_city,
        "bank_name": a.bank_name, "bank_account": a.bank_account, "bank_swift": a.bank_swift,
        "price_20gp": f(a.price_20gp), "price_40ft": f(a.price_40ft),
        "price_40hq": f(a.price_40hq), "price_air_kg": f(a.price_air_kg),
        "sell_price_20gp": f(a.sell_price_20gp), "sell_price_40ft": f(a.sell_price_40ft),
        "sell_price_40hq": f(a.sell_price_40hq), "sell_price_air_kg": f(a.sell_price_air_kg),
        "transit_sea_days": a.transit_sea_days, "transit_air_days": a.transit_air_days,
        "serves_sea": a.serves_sea, "serves_air": a.serves_air,
        "notes": a.notes, "is_active": a.is_active,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "price_history": [_serialize_ph(p) for p in a.price_history],
        "contracts":     [_serialize_contract(c) for c in a.contracts],
        "edit_log":      [_serialize_log(l) for l in a.edit_log],
    }

def _serialize_ph(p: AgentPriceHistory) -> dict:
    def f(v): return float(v) if v is not None else None
    return {
        "id": p.id, "effective_date": str(p.effective_date),
        "buy_20gp": f(p.buy_20gp), "sell_20gp": f(p.sell_20gp),
        "buy_40ft": f(p.buy_40ft), "sell_40ft": f(p.sell_40ft),
        "buy_40hq": f(p.buy_40hq), "sell_40hq": f(p.sell_40hq),
        "buy_air_kg": f(p.buy_air_kg), "sell_air_kg": f(p.sell_air_kg),
        "transit_sea_days": p.transit_sea_days, "transit_air_days": p.transit_air_days,
        "notes": p.notes,
        "created_by": p.created_by.full_name if p.created_by else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

def _serialize_contract(c: AgentContract) -> dict:
    return {
        "id": c.id, "title": c.title, "file_path": c.file_path,
        "original_filename": c.original_filename,
        "valid_from": str(c.valid_from) if c.valid_from else None,
        "valid_to":   str(c.valid_to)   if c.valid_to   else None,
        "notes": c.notes,
        "uploaded_by": c.uploaded_by.full_name if c.uploaded_by else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }

def _serialize_log(l: AgentEditLog) -> dict:
    return {
        "id": l.id, "action": l.action, "summary": l.summary,
        "changed_by": l.changed_by.full_name if l.changed_by else None,
        "changed_at": l.changed_at.isoformat() if l.changed_at else None,
    }


# ── Agent profile (full data) ─────────────────────────────────────────────────

@router.get("/{agent_id}/profile")
def get_agent_profile(
    agent_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.query(ShippingAgent).filter(ShippingAgent.id == agent_id).first()
    if not a:
        raise HTTPException(404, "Agent not found")
    return _serialize_agent(a)


# ── Price history ─────────────────────────────────────────────────────────────

class PriceHistoryCreate(BaseModel):
    effective_date:   str
    buy_20gp:         Optional[float] = None
    sell_20gp:        Optional[float] = None
    buy_40ft:         Optional[float] = None
    sell_40ft:        Optional[float] = None
    buy_40hq:         Optional[float] = None
    sell_40hq:        Optional[float] = None
    buy_air_kg:       Optional[float] = None
    sell_air_kg:      Optional[float] = None
    transit_sea_days: Optional[int]   = None
    transit_air_days: Optional[int]   = None
    notes:            Optional[str]   = None
    update_current:   bool            = True  # also update agent's current prices


@router.post("/{agent_id}/price-history")
def add_price_history(
    agent_id: int,
    payload:  PriceHistoryCreate,
    db:       Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    a = db.query(ShippingAgent).filter(ShippingAgent.id == agent_id).first()
    if not a:
        raise HTTPException(404, "Agent not found")

    ph = AgentPriceHistory(
        agent_id=agent_id,
        effective_date=payload.effective_date,
        buy_20gp=payload.buy_20gp,   sell_20gp=payload.sell_20gp,
        buy_40ft=payload.buy_40ft,   sell_40ft=payload.sell_40ft,
        buy_40hq=payload.buy_40hq,   sell_40hq=payload.sell_40hq,
        buy_air_kg=payload.buy_air_kg, sell_air_kg=payload.sell_air_kg,
        transit_sea_days=payload.transit_sea_days,
        transit_air_days=payload.transit_air_days,
        notes=payload.notes,
        created_by_id=current_user.id,
    )
    db.add(ph)

    # Optionally sync to agent's current prices
    if payload.update_current:
        if payload.buy_20gp    is not None: a.price_20gp    = payload.buy_20gp
        if payload.buy_40ft    is not None: a.price_40ft    = payload.buy_40ft
        if payload.buy_40hq    is not None: a.price_40hq    = payload.buy_40hq
        if payload.buy_air_kg  is not None: a.price_air_kg  = payload.buy_air_kg
        if payload.sell_20gp   is not None: a.sell_price_20gp    = payload.sell_20gp
        if payload.sell_40ft   is not None: a.sell_price_40ft    = payload.sell_40ft
        if payload.sell_40hq   is not None: a.sell_price_40hq    = payload.sell_40hq
        if payload.sell_air_kg is not None: a.sell_price_air_kg  = payload.sell_air_kg
        if payload.transit_sea_days is not None: a.transit_sea_days = payload.transit_sea_days
        if payload.transit_air_days is not None: a.transit_air_days = payload.transit_air_days

    db.add(AgentEditLog(
        agent_id=agent_id,
        action="price_update",
        summary=f"Price update for {payload.effective_date} — sea buy:{payload.buy_20gp}/{payload.buy_40ft}/{payload.buy_40hq} sell:{payload.sell_20gp}/{payload.sell_40ft}/{payload.sell_40hq} | air buy:{payload.buy_air_kg} sell:{payload.sell_air_kg}",
        changed_by_id=current_user.id,
    ))
    db.commit()
    db.refresh(ph)
    return _serialize_ph(ph)


# ── Contracts ─────────────────────────────────────────────────────────────────

CONTRACT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "agent_contracts",
)
os.makedirs(CONTRACT_DIR, exist_ok=True)


@router.post("/{agent_id}/contracts")
async def upload_contract(
    agent_id:          int,
    file:              UploadFile = File(...),
    title:             str        = Form(...),
    valid_from:        str        = Form(""),
    valid_to:          str        = Form(""),
    notes:             str        = Form(""),
    db:                Session    = Depends(get_db),
    current_user:      User       = Depends(require_role(UserRole.STAFF)),
):
    a = db.query(ShippingAgent).filter(ShippingAgent.id == agent_id).first()
    if not a:
        raise HTTPException(404, "Agent not found")

    allowed = ("application/pdf", "image/jpeg", "image/png")
    if file.content_type not in allowed:
        raise HTTPException(400, "Only PDF, JPEG or PNG files allowed")

    agent_dir = os.path.join(CONTRACT_DIR, str(agent_id))
    os.makedirs(agent_dir, exist_ok=True)

    ext   = os.path.splitext(file.filename or "contract.pdf")[1].lower() or ".pdf"
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(agent_dir, fname)
    content = await file.read()
    with open(fpath, "wb") as fp:
        fp.write(content)

    contract = AgentContract(
        agent_id=agent_id,
        title=title,
        file_path=f"agent_contracts/{agent_id}/{fname}",
        original_filename=file.filename,
        valid_from=valid_from or None,
        valid_to=valid_to or None,
        notes=notes or None,
        uploaded_by_id=current_user.id,
    )
    db.add(contract)
    db.add(AgentEditLog(
        agent_id=agent_id,
        action="contract_upload",
        summary=f"Contract uploaded: {title} ({file.filename})",
        changed_by_id=current_user.id,
    ))
    db.commit()
    db.refresh(contract)
    return _serialize_contract(contract)


@router.get("/{agent_id}/contracts/{contract_id}/download")
def download_contract(
    agent_id:    int,
    contract_id: int,
    db:          Session = Depends(get_db),
    _:           User    = Depends(get_current_user),
):
    c = db.query(AgentContract).filter(
        AgentContract.id == contract_id,
        AgentContract.agent_id == agent_id,
    ).first()
    if not c:
        raise HTTPException(404, "Contract not found")

    uploads_root = os.path.dirname(CONTRACT_DIR)
    full_path    = os.path.join(uploads_root, c.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        full_path,
        filename=c.original_filename or "contract.pdf",
        media_type="application/octet-stream",
    )


@router.delete("/{agent_id}/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    agent_id:    int,
    contract_id: int,
    db:          Session = Depends(get_db),
    current_user: User   = Depends(require_role(UserRole.STAFF)),
):
    c = db.query(AgentContract).filter(
        AgentContract.id == contract_id,
        AgentContract.agent_id == agent_id,
    ).first()
    if not c:
        raise HTTPException(404, "Contract not found")

    uploads_root = os.path.dirname(CONTRACT_DIR)
    full_path    = os.path.join(uploads_root, c.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)

    db.add(AgentEditLog(
        agent_id=agent_id,
        action="contract_delete",
        summary=f"Contract deleted: {c.title} ({c.original_filename})",
        changed_by_id=current_user.id,
    ))
    db.delete(c)
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
