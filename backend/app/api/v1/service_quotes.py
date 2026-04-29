from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceStatus, InvoiceType
from app.models.invoice_item import InvoiceItem
from app.models.service_quote import ServiceQuote, ServiceQuoteMode, ServiceQuoteScope, ServiceQuoteStatus
from app.models.shipping_agent import AgentCarrierRate, ShippingAgent
from app.models.user import User, UserRole
from app.schemas.invoice import InvoiceResponse
from app.schemas.service_quote import (
    ServiceQuoteCreate,
    ServiceQuoteListResponse,
    ServiceQuoteResponse,
    ServiceQuoteSuggestion,
    ServiceQuoteUpdate,
)

router = APIRouter()


def _money(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def _q2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _q4(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"))


def _quote_number(db: Session) -> str:
    year = date.today().year
    pattern = f"SQ-{year}-%"
    count = db.query(ServiceQuote).filter(ServiceQuote.quote_number.like(pattern)).count()
    return f"SQ-{year}-{str(count + 1).zfill(5)}"


def _shipping_invoice_number(db: Session, client_code: str) -> str:
    year = date.today().year
    compact = (client_code or "MAN").replace("-", "")
    pattern = f"SHIP-{compact}-{year}-%"
    count = db.query(Invoice).filter(Invoice.invoice_number.like(pattern)).count()
    return f"SHIP-{compact}-{year}-{str(count + 1).zfill(4)}"


def _scope_has_origin(scope: str | ServiceQuoteScope) -> bool:
    return str(scope) != ServiceQuoteScope.PORT_TO_PORT.value


def _chargeable_quantity(mode: str | ServiceQuoteMode, cbm, gross_weight_kg, chargeable_weight_kg) -> tuple[str, Decimal]:
    mode_value = mode.value if isinstance(mode, ServiceQuoteMode) else str(mode)
    if mode_value == ServiceQuoteMode.AIR.value:
        return "kg", max(_money(chargeable_weight_kg), _money(gross_weight_kg))
    if mode_value == ServiceQuoteMode.SEA_FCL.value:
        return "container", Decimal("1")
    return "cbm", _money(cbm)


def _pick_rate(rate: AgentCarrierRate, mode: str | ServiceQuoteMode, container_size: str | None) -> tuple[Decimal, Decimal]:
    mode_value = mode.value if isinstance(mode, ServiceQuoteMode) else str(mode)
    size = (container_size or "").upper()
    if mode_value == ServiceQuoteMode.AIR.value:
        return _money(rate.buy_air_kg), _money(rate.sell_air_kg)
    if mode_value == ServiceQuoteMode.SEA_FCL.value:
        if size == "20GP":
            return _money(rate.buy_20gp), _money(rate.sell_20gp)
        if size in {"40GP", "40FT"}:
            return _money(rate.buy_40ft), _money(rate.sell_40ft)
        if size == "40HQ":
            return _money(rate.buy_40hq), _money(rate.sell_40hq)
        return Decimal("0"), Decimal("0")
    if size == "20GP":
        return _money(rate.buy_lcl_20gp or rate.buy_lcl_cbm), _money(rate.sell_lcl_20gp or rate.sell_lcl_cbm)
    if size in {"40GP", "40FT"}:
        return _money(rate.buy_lcl_40ft or rate.buy_lcl_cbm), _money(rate.sell_lcl_40ft or rate.sell_lcl_cbm)
    if size == "40HQ":
        return _money(rate.buy_lcl_40hq or rate.buy_lcl_cbm), _money(rate.sell_lcl_40hq or rate.sell_lcl_cbm)
    return _money(rate.buy_lcl_cbm), _money(rate.sell_lcl_cbm)


def _origin_fee_sum(rate: AgentCarrierRate | None) -> Decimal:
    if not rate:
        return Decimal("0")
    return _money(rate.fee_loading) + _money(rate.fee_bl) + _money(rate.fee_trucking) + _money(rate.fee_other)


def _margin_pct(total_sell: Decimal, total_buy: Decimal) -> Decimal | None:
    if total_sell <= 0:
        return None
    return _q2((total_sell - total_buy) / total_sell * Decimal("100"))


def _mode_label(mode: str) -> str:
    if mode == ServiceQuoteMode.SEA_LCL.value:
        return "Sea LCL"
    if mode == ServiceQuoteMode.SEA_FCL.value:
        return "Sea FCL"
    if mode == ServiceQuoteMode.AIR.value:
        return "Air cargo"
    return mode


def _scope_label(scope: str) -> str:
    return scope.replace("_", " ").title()


def _rate_snapshot(rate: AgentCarrierRate | None) -> dict:
    if not rate:
        return {"source": "manual"}
    return {
        "source": "agent_carrier_rate",
        "agent_carrier_rate_id": rate.id,
        "agent_id": rate.agent_id,
        "carrier_name": rate.carrier_name,
        "rate_type": rate.rate_type,
        "pol": rate.pol,
        "pod": rate.pod,
        "effective_date": rate.effective_date.isoformat() if rate.effective_date else None,
        "expiry_date": rate.expiry_date.isoformat() if rate.expiry_date else None,
        "sealing_day": rate.sealing_day.isoformat() if rate.sealing_day else None,
        "vessel_day": rate.vessel_day.isoformat() if rate.vessel_day else None,
        "fees": {
            "loading": float(_money(rate.fee_loading)),
            "bl": float(_money(rate.fee_bl)),
            "trucking": float(_money(rate.fee_trucking)),
            "other": float(_money(rate.fee_other)),
        },
    }


def _suggestions_query(
    db: Session,
    mode: ServiceQuoteMode,
    port_of_loading: str | None,
    port_of_discharge: str | None,
    loading_warehouse_id: int | None,
):
    today = date.today()
    rate_type = "air" if mode == ServiceQuoteMode.AIR else "sea"
    q = db.query(AgentCarrierRate).join(ShippingAgent, AgentCarrierRate.agent_id == ShippingAgent.id).filter(
        AgentCarrierRate.is_active == True,  # noqa: E712
        ShippingAgent.is_active == True,  # noqa: E712
        AgentCarrierRate.rate_type == rate_type,
        or_(AgentCarrierRate.expiry_date.is_(None), AgentCarrierRate.expiry_date >= today),
    )
    if port_of_loading:
        q = q.filter(or_(AgentCarrierRate.pol.is_(None), AgentCarrierRate.pol.ilike(f"%{port_of_loading}%")))
    if port_of_discharge:
        q = q.filter(or_(AgentCarrierRate.pod.is_(None), AgentCarrierRate.pod.ilike(f"%{port_of_discharge}%")))
    if loading_warehouse_id:
        q = q.filter(or_(AgentCarrierRate.loading_warehouse_id.is_(None), AgentCarrierRate.loading_warehouse_id == loading_warehouse_id))
    return q


def _build_suggestion(
    rate: AgentCarrierRate,
    mode: ServiceQuoteMode,
    service_scope: ServiceQuoteScope,
    container_size: str | None,
    cbm,
    gross_weight_kg,
    chargeable_weight_kg,
) -> ServiceQuoteSuggestion | None:
    buy_rate, sell_rate = _pick_rate(rate, mode, container_size)
    if sell_rate <= 0:
        return None
    basis, quantity = _chargeable_quantity(mode, cbm, gross_weight_kg, chargeable_weight_kg)
    if quantity <= 0:
        return None
    origin_fee = _origin_fee_sum(rate) if _scope_has_origin(service_scope) else Decimal("0")
    freight_buy = _q2(buy_rate * quantity)
    freight_sell = _q2(sell_rate * quantity)
    total_buy = _q2(freight_buy + origin_fee)
    total_sell = _q2(freight_sell + origin_fee)
    profit = _q2(total_sell - total_buy)
    return ServiceQuoteSuggestion(
        agent_id=rate.agent_id,
        agent_name=rate.agent.name if rate.agent else "",
        agent_name_ar=rate.agent.name_ar if rate.agent else None,
        agent_carrier_rate_id=rate.id,
        carrier_name=rate.carrier_name,
        rate_basis=basis,
        buy_rate=buy_rate,
        sell_rate=sell_rate,
        chargeable_quantity=_q4(quantity),
        freight_buy=freight_buy,
        freight_sell=freight_sell,
        origin_fees_buy=origin_fee,
        origin_fees_sell=origin_fee,
        total_buy=total_buy,
        total_sell=total_sell,
        profit=profit,
        margin_pct=_margin_pct(total_sell, total_buy),
        currency="USD",
        port_of_loading=rate.pol,
        port_of_discharge=rate.pod,
        transit_days=rate.transit_air_days if mode == ServiceQuoteMode.AIR else rate.transit_sea_days,
        vessel_day=rate.vessel_day,
        notes=rate.notes,
        snapshot=_rate_snapshot(rate),
    )


@router.get("", response_model=ServiceQuoteListResponse)
def list_service_quotes(
    client_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ServiceQuote)
    if client_id:
        q = q.filter(ServiceQuote.client_id == client_id)
    results = q.order_by(ServiceQuote.created_at.desc(), ServiceQuote.id.desc()).all()
    return {"total": len(results), "results": results}


@router.get("/suggestions", response_model=list[ServiceQuoteSuggestion])
def suggest_service_quote_rates(
    mode: ServiceQuoteMode = Query(...),
    service_scope: ServiceQuoteScope = Query(ServiceQuoteScope.WAREHOUSE_TO_PORT),
    container_size: str | None = Query(None),
    cbm: Decimal | None = Query(None, ge=0),
    gross_weight_kg: Decimal | None = Query(None, ge=0),
    chargeable_weight_kg: Decimal | None = Query(None, ge=0),
    port_of_loading: str | None = Query(None),
    port_of_discharge: str | None = Query(None),
    loading_warehouse_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rates = _suggestions_query(db, mode, port_of_loading, port_of_discharge, loading_warehouse_id).all()
    suggestions = [
        suggestion
        for rate in rates
        if (suggestion := _build_suggestion(rate, mode, service_scope, container_size, cbm, gross_weight_kg, chargeable_weight_kg))
    ]
    return sorted(suggestions, key=lambda row: (row.total_sell, row.agent_name))[:15]


@router.post("", response_model=ServiceQuoteResponse, status_code=status.HTTP_201_CREATED)
def create_service_quote(
    payload: ServiceQuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    if not db.query(Client).filter(Client.id == payload.client_id).first():
        raise HTTPException(404, "Client not found")

    selected_rate = None
    if payload.agent_carrier_rate_id:
        selected_rate = db.query(AgentCarrierRate).filter(
            AgentCarrierRate.id == payload.agent_carrier_rate_id,
            AgentCarrierRate.is_active == True,  # noqa: E712
        ).first()
        if not selected_rate:
            raise HTTPException(404, "Agent rate not found")

    buy_rate, sell_rate = (
        _pick_rate(selected_rate, payload.mode, payload.container_size)
        if selected_rate else
        (_money(payload.manual_buy_rate), _money(payload.manual_sell_rate))
    )
    basis, quantity = _chargeable_quantity(payload.mode, payload.cbm, payload.gross_weight_kg, payload.chargeable_weight_kg)
    if quantity <= 0:
        raise HTTPException(400, "Enter CBM, container size, or chargeable weight for this quote")
    if sell_rate <= 0:
        raise HTTPException(400, "Select an agent rate or enter a manual sell rate")

    default_origin_fee = _origin_fee_sum(selected_rate) if _scope_has_origin(payload.service_scope) else Decimal("0")
    origin_buy = _money(payload.origin_fees_buy) if payload.origin_fees_buy is not None else default_origin_fee
    origin_sell = _money(payload.origin_fees_sell) if payload.origin_fees_sell is not None else default_origin_fee
    destination_buy = _money(payload.destination_fees_buy)
    destination_sell = _money(payload.destination_fees_sell)
    other_buy = _money(payload.other_fees_buy)
    other_sell = _money(payload.other_fees_sell)

    freight_buy = _q2(buy_rate * quantity)
    freight_sell = _q2(sell_rate * quantity)
    total_buy = _q2(freight_buy + origin_buy + destination_buy + other_buy)
    total_sell = _q2(freight_sell + origin_sell + destination_sell + other_sell)
    profit = _q2(total_sell - total_buy)

    quote = ServiceQuote(
        quote_number=_quote_number(db),
        client_id=payload.client_id,
        mode=payload.mode.value,
        service_scope=payload.service_scope.value,
        cargo_source=payload.cargo_source,
        origin_country=payload.origin_country,
        origin_city=payload.origin_city,
        pickup_address=payload.pickup_address,
        loading_warehouse_id=payload.loading_warehouse_id,
        port_of_loading=payload.port_of_loading or (selected_rate.pol if selected_rate else None),
        port_of_discharge=payload.port_of_discharge or (selected_rate.pod if selected_rate else None),
        destination_country=payload.destination_country,
        destination_city=payload.destination_city,
        final_address=payload.final_address,
        container_size=payload.container_size,
        cbm=payload.cbm,
        gross_weight_kg=payload.gross_weight_kg,
        chargeable_weight_kg=payload.chargeable_weight_kg,
        cartons=payload.cartons,
        goods_description=payload.goods_description,
        clearance_through_us=payload.clearance_through_us,
        delivery_through_us=payload.delivery_through_us,
        shipping_agent_id=payload.shipping_agent_id or (selected_rate.agent_id if selected_rate else None),
        agent_carrier_rate_id=payload.agent_carrier_rate_id,
        agent_quote_id=payload.agent_quote_id,
        carrier_name=payload.carrier_name or (selected_rate.carrier_name if selected_rate else None),
        currency=payload.currency,
        rate_basis=basis,
        buy_rate=buy_rate,
        sell_rate=sell_rate,
        chargeable_quantity=_q4(quantity),
        freight_buy=freight_buy,
        freight_sell=freight_sell,
        origin_fees_buy=origin_buy,
        origin_fees_sell=origin_sell,
        destination_fees_buy=destination_buy,
        destination_fees_sell=destination_sell,
        other_fees_buy=other_buy,
        other_fees_sell=other_sell,
        total_buy=total_buy,
        total_sell=total_sell,
        profit=profit,
        margin_pct=_margin_pct(total_sell, total_buy),
        rate_snapshot=_rate_snapshot(selected_rate),
        calculation_notes=f"{basis.upper()} {quantity} x sell rate {sell_rate}",
        notes=payload.notes,
        created_by_id=current_user.id,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    return quote


@router.patch("/{quote_id}", response_model=ServiceQuoteResponse)
def update_service_quote(
    quote_id: int,
    payload: ServiceQuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    quote = db.query(ServiceQuote).filter(ServiceQuote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Service quote not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if isinstance(value, ServiceQuoteStatus):
            value = value.value
        setattr(quote, field, value)
    db.commit()
    db.refresh(quote)
    return quote


@router.post("/{quote_id}/invoice", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_shipping_invoice_from_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    quote = db.query(ServiceQuote).filter(ServiceQuote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Service quote not found")
    if quote.invoice_id:
        existing = db.query(Invoice).filter(Invoice.id == quote.invoice_id).first()
        if existing:
            return existing

    client = db.query(Client).filter(Client.id == quote.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    if _money(quote.total_sell) <= 0:
        raise HTTPException(400, "Quote total must be greater than zero")

    now = datetime.now(timezone.utc)
    invoice = Invoice(
        invoice_number=_shipping_invoice_number(db, client.client_code),
        invoice_type=InvoiceType.PI,
        invoice_kind="shipping",
        status=InvoiceStatus.DRAFT,
        client_id=client.id,
        issue_date=now,
        origin=quote.origin_country,
        payment_terms="100% payment before shipping",
        shipping_term=quote.service_scope,
        port_of_loading=quote.port_of_loading,
        port_of_discharge=quote.port_of_discharge,
        shipping_marks=client.client_code,
        subtotal=_q2(_money(quote.total_sell)),
        discount=Decimal("0"),
        total=_q2(_money(quote.total_sell)),
        currency=quote.currency,
        notes=f"Shipping invoice generated from service quote {quote.quote_number}.",
        notes_ar=f"فاتورة شحن صادرة من عرض الشحن {quote.quote_number}.",
        created_by_id=current_user.id,
    )
    db.add(invoice)
    db.flush()

    detail_lines = [
        f"Quote: {quote.quote_number}",
        f"Route: {quote.port_of_loading or '-'} -> {quote.port_of_discharge or '-'}",
        f"Carrier: {quote.carrier_name or '-'}",
        f"Chargeable: {quote.chargeable_quantity or 1} {quote.rate_basis or 'service'}",
        f"Freight sell: {quote.freight_sell} {quote.currency}",
        f"Origin fees sell: {quote.origin_fees_sell} {quote.currency}",
        f"Destination fees sell: {quote.destination_fees_sell} {quote.currency}",
        f"Other fees sell: {quote.other_fees_sell} {quote.currency}",
    ]
    db.add(InvoiceItem(
        invoice_id=invoice.id,
        description=f"Shipping service - {_mode_label(quote.mode)} - {_scope_label(quote.service_scope)}",
        description_ar=f"خدمة شحن - {_mode_label(quote.mode)} - {_scope_label(quote.service_scope)}",
        details="\n".join(detail_lines),
        quantity=Decimal("1"),
        unit="service",
        unit_price=_q2(_money(quote.total_sell)),
        total_price=_q2(_money(quote.total_sell)),
        cartons=quote.cartons,
        gross_weight=quote.gross_weight_kg,
        cbm=quote.cbm,
        sort_order=0,
    ))

    quote.invoice_id = invoice.id
    quote.status = ServiceQuoteStatus.INVOICED.value
    db.commit()
    db.refresh(invoice)
    return invoice
