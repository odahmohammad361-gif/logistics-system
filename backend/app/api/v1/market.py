from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.market_rate import MarketRate
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus
from app.models.container import Container
from app.models.client import Client
from app.models.shipping_quote import ShippingQuote, QuoteStatus
from app.models.shipping_agent import ShippingAgent
from app.schemas.market import (
    RateEntry, RatesSnapshot, TopClientEntry, AgentRateEntry, AgentQuickPrice, BoardResponse,
)
from app.utils.currency import fetch_rates, TARGET_CURRENCIES

router = APIRouter()

CACHE_MINUTES = 30   # Refresh rates from API if cached data is older than this


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_cached_rates(db: Session) -> tuple[dict[str, float], datetime | None]:
    """Return ({currency: rate}, latest_fetched_at) from DB."""
    # Latest rate per target currency
    subq = (
        db.query(
            MarketRate.target_currency,
            func.max(MarketRate.fetched_at).label("max_at"),
        )
        .group_by(MarketRate.target_currency)
        .subquery()
    )
    rows = (
        db.query(MarketRate)
        .join(
            subq,
            (MarketRate.target_currency == subq.c.target_currency)
            & (MarketRate.fetched_at == subq.c.max_at),
        )
        .all()
    )
    rates = {row.target_currency: float(row.rate) for row in rows}
    latest = max((row.fetched_at for row in rows), default=None)
    return rates, latest


def _store_rates(db: Session, rates: dict[str, float]) -> datetime:
    """Persist a batch of rates to the DB and return the timestamp."""
    now = datetime.now(timezone.utc)
    for currency, rate in rates.items():
        db.add(MarketRate(base_currency="USD", target_currency=currency, rate=rate, fetched_at=now))
    db.commit()
    return now


def _resolve_rates(db: Session, force: bool = False) -> tuple[dict[str, float], datetime, bool]:
    """
    Returns (rates, fetched_at, is_stale).
    Fetches fresh data if cache is expired or force=True.
    """
    cached, cached_at = _get_cached_rates(db)
    now = datetime.now(timezone.utc)

    need_refresh = (
        force
        or not cached
        or cached_at is None
        or (now - cached_at.replace(tzinfo=timezone.utc) if cached_at.tzinfo is None
            else now - cached_at) > timedelta(minutes=CACHE_MINUTES)
    )

    if need_refresh:
        fresh = fetch_rates()
        fetched_at = _store_rates(db, fresh)
        return fresh, fetched_at, False

    return cached, cached_at, False


def _build_rates_snapshot(rates: dict[str, float], fetched_at: datetime, is_stale: bool) -> RatesSnapshot:
    entries = [
        RateEntry(
            currency=c,
            rate=round(rates[c], 6),
            inverse=round(1 / rates[c], 6) if rates[c] else 0,
        )
        for c in TARGET_CURRENCIES
        if c in rates
    ]
    return RatesSnapshot(base="USD", rates=entries, fetched_at=fetched_at, is_stale=is_stale)


def _top_clients_by_revenue(db: Session, limit: int = 10) -> list[TopClientEntry]:
    rows = (
        db.query(
            Client.id,
            Client.name,
            Client.name_ar,
            Client.client_code,
            func.sum(Invoice.total).label("total_amount"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .join(Invoice, Invoice.client_id == Client.id)
        .filter(
            Client.is_active == True,
            Invoice.invoice_type == InvoiceType.CI,
            Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.APPROVED]),
        )
        .group_by(Client.id, Client.name, Client.name_ar, Client.client_code)
        .order_by(desc("total_amount"))
        .limit(limit)
        .all()
    )
    return [
        TopClientEntry(
            rank=i + 1,
            client_id=r.id,
            name=r.name,
            name_ar=r.name_ar,
            client_code=r.client_code,
            value=Decimal(str(r.total_amount or 0)),
            label=f"USD {r.total_amount:,.0f}" if r.total_amount else "USD 0",
        )
        for i, r in enumerate(rows)
    ]


def _top_clients_by_shipments(db: Session, limit: int = 10) -> list[TopClientEntry]:
    rows = (
        db.query(
            Client.id,
            Client.name,
            Client.name_ar,
            Client.client_code,
            func.count(Container.id).label("container_count"),
        )
        .join(Container, Container.client_id == Client.id)
        .filter(
            Client.is_active == True,
            Container.is_active == True,
        )
        .group_by(Client.id, Client.name, Client.name_ar, Client.client_code)
        .order_by(desc("container_count"))
        .limit(limit)
        .all()
    )
    return [
        TopClientEntry(
            rank=i + 1,
            client_id=r.id,
            name=r.name,
            name_ar=r.name_ar,
            client_code=r.client_code,
            value=Decimal(str(r.container_count or 0)),
            label=f"{r.container_count} shipment{'s' if r.container_count != 1 else ''}",
        )
        for i, r in enumerate(rows)
    ]


def _agent_quick_prices(db: Session) -> list[AgentQuickPrice]:
    """Return quick-reference prices for all active agents that have at least one price set."""
    agents = (
        db.query(ShippingAgent)
        .filter(ShippingAgent.is_active == True)
        .filter(
            (ShippingAgent.price_20gp != None) |
            (ShippingAgent.price_40ft != None) |
            (ShippingAgent.price_40hq != None) |
            (ShippingAgent.price_air_kg != None)
        )
        .order_by(ShippingAgent.name)
        .all()
    )
    return [
        AgentQuickPrice(
            agent_id=a.id,
            agent_name=a.name,
            agent_wechat=a.wechat_id,
            warehouse_city=a.warehouse_city,
            country=a.country,
            price_20gp=a.price_20gp,
            price_40ft=a.price_40ft,
            price_40hq=a.price_40hq,
            price_air_kg=a.price_air_kg,
            transit_sea_days=a.transit_sea_days,
            transit_air_days=a.transit_air_days,
        )
        for a in agents
    ]


def _agent_rates(db: Session, limit: int = 20) -> list[AgentRateEntry]:
    quotes = (
        db.query(ShippingQuote)
        .filter(ShippingQuote.is_active == True, ShippingQuote.status == QuoteStatus.ACTIVE)
        .order_by(ShippingQuote.total_all.asc().nullslast())
        .limit(limit)
        .all()
    )
    return [
        AgentRateEntry(
            agent_id=q.agent_id,
            agent_name=q.agent.name,
            agent_wechat=q.agent.wechat_id,
            quote_number=q.quote_number,
            route=f"{q.port_of_loading or '?'} → {q.port_of_discharge or '?'}",
            container_type=q.container_type,
            incoterm=q.incoterm.value if q.incoterm else None,
            transit_days=q.transit_days,
            total_usd=q.total_all,
            ocean_freight=q.ocean_freight,
            validity_to=q.validity_to,
        )
        for q in quotes
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/board", response_model=BoardResponse)
def get_board(db: Session = Depends(get_db)):
    """
    Main TV-display endpoint — no auth required.
    Returns exchange rates, top clients, and agent price comparison.
    Auto-refreshes rates when cache expires (every 30 min).
    """
    rates, fetched_at, is_stale = _resolve_rates(db)
    return BoardResponse(
        rates=_build_rates_snapshot(rates, fetched_at, is_stale),
        top_clients_by_revenue=_top_clients_by_revenue(db),
        top_clients_by_shipments=_top_clients_by_shipments(db),
        agent_rates=_agent_rates(db),
        agent_quick_prices=_agent_quick_prices(db),
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/rates", response_model=RatesSnapshot)
def get_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current exchange rates (from cache or fresh fetch)."""
    rates, fetched_at, is_stale = _resolve_rates(db)
    return _build_rates_snapshot(rates, fetched_at, is_stale)


@router.post("/rates/refresh", response_model=RatesSnapshot)
def refresh_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Force-refresh exchange rates from the currency API (admin only)."""
    rates, fetched_at, is_stale = _resolve_rates(db, force=True)
    return _build_rates_snapshot(rates, fetched_at, is_stale)


@router.get("/top-clients", response_model=dict)
def get_top_clients(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top clients by invoice revenue and by container count."""
    return {
        "by_revenue": _top_clients_by_revenue(db, limit),
        "by_shipments": _top_clients_by_shipments(db, limit),
    }
