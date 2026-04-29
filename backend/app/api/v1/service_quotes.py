import json
import os
import re
import uuid
import zipfile
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.api.v1.bookings import _doc_full_path, _parse_cargo_documents, _read_document_text
from app.models.accounting import AccountingDirection, AccountingEntry, AccountingStatus
from app.models.booking import Booking, BookingCargoLine
from app.models.client import Client
from app.models.clearance_agent import ClearanceAgentRate
from app.models.invoice import Invoice, InvoiceStatus, InvoiceType
from app.models.invoice_item import InvoiceItem
from app.models.service_quote import ServiceQuote, ServiceQuoteCityFee, ServiceQuoteMode, ServiceQuoteScope, ServiceQuoteStatus
from app.models.shipping_agent import AgentCarrierRate, ShippingAgent
from app.models.user import User, UserRole
from app.schemas.invoice import InvoiceResponse
from app.schemas.service_quote import (
    ServiceQuoteCityFeeCreate,
    ServiceQuoteCityFeeResponse,
    ServiceQuoteCreate,
    ServiceQuoteFromCargoLineCreate,
    ServiceQuoteListResponse,
    ServiceQuoteResponse,
    ServiceQuoteSuggestion,
    ServiceQuoteUpdate,
)

router = APIRouter()

EXPORT_TMP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "service_quotes", "_tmp",
)
os.makedirs(EXPORT_TMP_DIR, exist_ok=True)


def _money(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def _q2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _q4(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"))


def _json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _safe_filename(value: str | None, fallback: str = "file") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", (value or fallback).strip()).strip("-._")
    return cleaned or fallback


def _zip_json(zf: zipfile.ZipFile, arcname: str, payload: dict | list) -> None:
    zf.writestr(arcname, json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default))


def _zip_file_if_exists(zf: zipfile.ZipFile, file_path: str | None, arcname: str) -> bool:
    if not file_path:
        return False
    try:
        full_path = _doc_full_path(file_path)
    except HTTPException:
        return False
    if not os.path.isfile(full_path):
        return False
    zf.write(full_path, arcname)
    return True


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


def _accounting_entry_number(db: Session) -> str:
    today = date.today()
    prefix = f"AC-{today:%Y%m}-"
    count = db.query(AccountingEntry).filter(AccountingEntry.entry_number.like(f"{prefix}%")).count()
    return f"{prefix}{str(count + 1).zfill(5)}"


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


def _city_fee_sum(rule: ServiceQuoteCityFee | None) -> tuple[Decimal, Decimal]:
    if not rule:
        return Decimal("0"), Decimal("0")
    return (
        _money(rule.buy_trucking) + _money(rule.buy_handling),
        _money(rule.sell_trucking) + _money(rule.sell_handling),
    )


def _clearance_fee_sum(rate: ClearanceAgentRate | None, customs_value_usd) -> tuple[Decimal, Decimal]:
    if not rate:
        return Decimal("0"), Decimal("0")
    customs_value = _money(customs_value_usd)
    buy_pct = customs_value * _money(rate.buy_import_export_card_pct) / Decimal("100")
    sell_pct = customs_value * _money(rate.sell_import_export_card_pct) / Decimal("100")
    buy = (
        _money(rate.buy_clearance_fee)
        + _money(rate.buy_transportation)
        + _money(rate.buy_delivery_authorization)
        + _money(rate.buy_inspection_ramp)
        + _money(rate.buy_port_inspection)
        + buy_pct
    )
    sell = (
        _money(rate.sell_clearance_fee)
        + _money(rate.sell_transportation)
        + _money(rate.sell_delivery_authorization)
        + _money(rate.sell_inspection_ramp)
        + _money(rate.sell_port_inspection)
        + sell_pct
    )
    return _q2(buy), _q2(sell)


def _clearance_snapshot(rate: ClearanceAgentRate | None, customs_value_usd) -> dict | None:
    if not rate:
        return None
    buy, sell = _clearance_fee_sum(rate, customs_value_usd)
    return {
        "clearance_agent_rate_id": rate.id,
        "clearance_agent_id": rate.agent_id,
        "agent_name": rate.agent.name if rate.agent else None,
        "service_mode": rate.service_mode,
        "country": rate.country,
        "port": rate.port,
        "route": rate.route,
        "container_size": rate.container_size,
        "carrier_name": rate.carrier_name,
        "customs_value_usd": float(_money(customs_value_usd)),
        "buy_total": float(buy),
        "sell_total": float(sell),
    }


def _city_fee_snapshot(rule: ServiceQuoteCityFee | None) -> dict | None:
    if not rule:
        return None
    buy, sell = _city_fee_sum(rule)
    return {
        "city_fee_id": rule.id,
        "origin_country": rule.origin_country,
        "origin_city": rule.origin_city,
        "port_of_loading": rule.port_of_loading,
        "service_scope": rule.service_scope,
        "buy_total": float(buy),
        "sell_total": float(sell),
    }


def _find_city_fee_rule(
    db: Session,
    city_fee_id: int | None,
    origin_city: str | None,
    port_of_loading: str | None,
    service_scope: str | ServiceQuoteScope,
) -> ServiceQuoteCityFee | None:
    if city_fee_id:
        rule = db.query(ServiceQuoteCityFee).filter(ServiceQuoteCityFee.id == city_fee_id, ServiceQuoteCityFee.is_active == True).first()  # noqa: E712
        if not rule:
            raise HTTPException(404, "City fee rule not found")
        return rule
    if not origin_city:
        return None
    scope_value = service_scope.value if isinstance(service_scope, ServiceQuoteScope) else str(service_scope)
    q = db.query(ServiceQuoteCityFee).filter(
        ServiceQuoteCityFee.is_active == True,  # noqa: E712
        ServiceQuoteCityFee.origin_city.ilike(origin_city.strip()),
    )
    if port_of_loading:
        q = q.filter(or_(ServiceQuoteCityFee.port_of_loading.is_(None), ServiceQuoteCityFee.port_of_loading.ilike(f"%{port_of_loading}%")))
    q = q.filter(or_(ServiceQuoteCityFee.service_scope.is_(None), ServiceQuoteCityFee.service_scope == scope_value))
    return q.order_by(ServiceQuoteCityFee.port_of_loading.desc().nullslast(), ServiceQuoteCityFee.service_scope.desc().nullslast()).first()


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


def _combined_snapshot(
    rate: AgentCarrierRate | None,
    city_fee: ServiceQuoteCityFee | None = None,
    clearance_rate: ClearanceAgentRate | None = None,
    customs_value_usd=None,
) -> dict:
    snapshot = _rate_snapshot(rate)
    city_snapshot = _city_fee_snapshot(city_fee)
    clearance = _clearance_snapshot(clearance_rate, customs_value_usd)
    if city_snapshot:
        snapshot["city_fee"] = city_snapshot
    if clearance:
        snapshot["clearance_fee"] = clearance
    return snapshot


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


def _enum_value(value) -> str | None:
    return value.value if hasattr(value, "value") else value


def _quote_from_data(db: Session, data: dict, current_user: User) -> ServiceQuote:
    client_id = data.get("client_id")
    if not db.query(Client).filter(Client.id == client_id).first():
        raise HTTPException(404, "Client not found")

    mode = ServiceQuoteMode(_enum_value(data.get("mode")))
    service_scope = ServiceQuoteScope(_enum_value(data.get("service_scope") or ServiceQuoteScope.WAREHOUSE_TO_PORT.value))

    selected_rate = None
    if data.get("agent_carrier_rate_id"):
        selected_rate = db.query(AgentCarrierRate).filter(
            AgentCarrierRate.id == data.get("agent_carrier_rate_id"),
        ).first()
        if not selected_rate:
            raise HTTPException(404, "Agent rate not found")

    clearance_rate = None
    if data.get("clearance_agent_rate_id"):
        clearance_rate = db.query(ClearanceAgentRate).filter(
            ClearanceAgentRate.id == data.get("clearance_agent_rate_id"),
            ClearanceAgentRate.is_active == True,  # noqa: E712
        ).first()
        if not clearance_rate:
            raise HTTPException(404, "Clearance rate not found")

    effective_pol = data.get("port_of_loading") or (selected_rate.pol if selected_rate else None)
    city_fee = _find_city_fee_rule(
        db,
        data.get("city_fee_id"),
        data.get("origin_city"),
        effective_pol,
        service_scope,
    ) if _scope_has_origin(service_scope) else None

    buy_rate, sell_rate = (
        _pick_rate(selected_rate, mode, data.get("container_size"))
        if selected_rate else
        (_money(data.get("manual_buy_rate")), _money(data.get("manual_sell_rate")))
    )
    basis, quantity = _chargeable_quantity(mode, data.get("cbm"), data.get("gross_weight_kg"), data.get("chargeable_weight_kg"))
    if quantity <= 0:
        raise HTTPException(400, "Enter CBM, container size, or chargeable weight for this quote")
    if sell_rate <= 0:
        raise HTTPException(400, "Select an agent rate or enter a manual sell rate")

    city_buy, city_sell = _city_fee_sum(city_fee)
    default_origin_fee = _origin_fee_sum(selected_rate) if _scope_has_origin(service_scope) else Decimal("0")
    origin_buy = (
        _money(data.get("origin_fees_buy"))
        if data.get("origin_fees_buy") is not None
        else default_origin_fee + city_buy
    )
    origin_sell = (
        _money(data.get("origin_fees_sell"))
        if data.get("origin_fees_sell") is not None
        else default_origin_fee + city_sell
    )
    clearance_buy = clearance_sell = Decimal("0")
    if data.get("clearance_through_us") and clearance_rate:
        clearance_buy, clearance_sell = _clearance_fee_sum(clearance_rate, data.get("customs_value_usd"))

    destination_buy = _money(data.get("destination_fees_buy")) + clearance_buy
    destination_sell = _money(data.get("destination_fees_sell")) + clearance_sell
    other_buy = _money(data.get("other_fees_buy"))
    other_sell = _money(data.get("other_fees_sell"))

    freight_buy = _q2(buy_rate * quantity)
    freight_sell = _q2(sell_rate * quantity)
    total_buy = _q2(freight_buy + origin_buy + destination_buy + other_buy)
    total_sell = _q2(freight_sell + origin_sell + destination_sell + other_sell)
    profit = _q2(total_sell - total_buy)

    notes = [
        f"{basis.upper()} {quantity} x sell rate {sell_rate}",
        f"freight={freight_sell}",
    ]
    if origin_sell:
        notes.append(f"origin={_q2(origin_sell)}")
    if clearance_sell:
        notes.append(f"clearance={_q2(clearance_sell)}")
    if destination_sell and destination_sell != clearance_sell:
        notes.append(f"destination={_q2(destination_sell)}")
    if other_sell:
        notes.append(f"other={_q2(other_sell)}")

    quote = ServiceQuote(
        quote_number=_quote_number(db),
        client_id=client_id,
        invoice_id=data.get("invoice_id"),
        booking_id=data.get("booking_id"),
        booking_cargo_line_id=data.get("booking_cargo_line_id"),
        mode=mode.value,
        service_scope=service_scope.value,
        cargo_source=data.get("cargo_source") or "outside_supplier",
        origin_country=data.get("origin_country"),
        origin_city=data.get("origin_city"),
        pickup_address=data.get("pickup_address"),
        loading_warehouse_id=data.get("loading_warehouse_id"),
        port_of_loading=effective_pol,
        port_of_discharge=data.get("port_of_discharge") or (selected_rate.pod if selected_rate else None),
        destination_country=data.get("destination_country"),
        destination_city=data.get("destination_city"),
        final_address=data.get("final_address"),
        container_size=data.get("container_size"),
        cbm=data.get("cbm"),
        gross_weight_kg=data.get("gross_weight_kg"),
        chargeable_weight_kg=data.get("chargeable_weight_kg"),
        cartons=data.get("cartons"),
        goods_description=data.get("goods_description"),
        clearance_through_us=bool(data.get("clearance_through_us")),
        delivery_through_us=bool(data.get("delivery_through_us")),
        clearance_agent_id=data.get("clearance_agent_id") or (clearance_rate.agent_id if clearance_rate else None),
        clearance_agent_rate_id=data.get("clearance_agent_rate_id"),
        customs_value_usd=data.get("customs_value_usd"),
        shipping_agent_id=data.get("shipping_agent_id") or (selected_rate.agent_id if selected_rate else None),
        agent_carrier_rate_id=data.get("agent_carrier_rate_id"),
        agent_quote_id=data.get("agent_quote_id"),
        city_fee_id=city_fee.id if city_fee else data.get("city_fee_id"),
        carrier_name=data.get("carrier_name") or (selected_rate.carrier_name if selected_rate else None),
        currency=data.get("currency") or "USD",
        rate_basis=basis,
        buy_rate=buy_rate,
        sell_rate=sell_rate,
        chargeable_quantity=_q4(quantity),
        freight_buy=freight_buy,
        freight_sell=freight_sell,
        origin_fees_buy=_q2(origin_buy),
        origin_fees_sell=_q2(origin_sell),
        destination_fees_buy=_q2(destination_buy),
        destination_fees_sell=_q2(destination_sell),
        other_fees_buy=other_buy,
        other_fees_sell=other_sell,
        total_buy=total_buy,
        total_sell=total_sell,
        profit=profit,
        margin_pct=_margin_pct(total_sell, total_buy),
        rate_snapshot=_combined_snapshot(selected_rate, city_fee, clearance_rate, data.get("customs_value_usd")),
        calculation_notes="; ".join(notes),
        notes=data.get("notes"),
        created_by_id=current_user.id,
    )
    db.add(quote)
    return quote


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
    quote = _quote_from_data(db, payload.model_dump(), current_user)
    db.commit()
    db.refresh(quote)
    return quote


@router.get("/city-fees", response_model=list[ServiceQuoteCityFeeResponse])
def list_city_fees(
    origin_city: str | None = Query(None),
    port_of_loading: str | None = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ServiceQuoteCityFee)
    if active_only:
        q = q.filter(ServiceQuoteCityFee.is_active == True)  # noqa: E712
    if origin_city:
        q = q.filter(ServiceQuoteCityFee.origin_city.ilike(f"%{origin_city.strip()}%"))
    if port_of_loading:
        q = q.filter(or_(ServiceQuoteCityFee.port_of_loading.is_(None), ServiceQuoteCityFee.port_of_loading.ilike(f"%{port_of_loading.strip()}%")))
    return q.order_by(ServiceQuoteCityFee.origin_country, ServiceQuoteCityFee.origin_city, ServiceQuoteCityFee.port_of_loading).all()


@router.post("/city-fees", response_model=ServiceQuoteCityFeeResponse, status_code=status.HTTP_201_CREATED)
def create_city_fee(
    payload: ServiceQuoteCityFeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    rule = ServiceQuoteCityFee(
        origin_country=payload.origin_country,
        origin_city=payload.origin_city.strip(),
        port_of_loading=payload.port_of_loading,
        service_scope=payload.service_scope.value if payload.service_scope else None,
        buy_trucking=payload.buy_trucking,
        sell_trucking=payload.sell_trucking,
        buy_handling=payload.buy_handling,
        sell_handling=payload.sell_handling,
        notes=payload.notes,
        is_active=payload.is_active,
        created_by_id=current_user.id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/city-fees/{fee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city_fee(
    fee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    rule = db.query(ServiceQuoteCityFee).filter(ServiceQuoteCityFee.id == fee_id).first()
    if not rule:
        raise HTTPException(404, "City fee rule not found")
    db.delete(rule)
    db.commit()
    return None


def _extract_documents_for_line(line: BookingCargoLine) -> dict:
    docs = [
        doc for doc in line.documents
        if doc.document_type in {"pl", "pi", "ci", "sc", "co", "bl_copy", "goods_invoice", "invoice", "other"}
    ]
    text_by_type: dict[str, str] = {}
    source_docs = []
    for doc in docs:
        full_path = _doc_full_path(doc.file_path)
        if not os.path.isfile(full_path):
            continue
        text = _read_document_text(full_path)
        if not text.strip():
            continue
        text_by_type[doc.document_type] = f"{text_by_type.get(doc.document_type, '')}\n{text}"
        source_docs.append({
            "id": doc.id,
            "type": doc.document_type,
            "filename": doc.original_filename,
            "characters": len(text),
        })
    if not text_by_type:
        raise HTTPException(400, "Could not extract readable text from the uploaded files.")
    parsed = _parse_cargo_documents(text_by_type)
    return {
        "version": 1,
        "extracted_at": datetime.utcnow().isoformat() + "Z",
        "confidence": parsed.get("confidence"),
        "invoice_no": parsed.get("invoice_no"),
        "source_documents": source_docs,
        "goods": parsed.get("goods") or [],
        "fields": parsed.get("fields") or {},
    }


def _goods_description_from_line(line: BookingCargoLine) -> str | None:
    if line.description:
        return line.description
    extracted = line.extracted_goods if isinstance(line.extracted_goods, dict) else {}
    goods = extracted.get("goods") if isinstance(extracted.get("goods"), list) else []
    if goods:
        return "; ".join(
            f"{item.get('description') or '-'}"
            f" ({item.get('cartons') or 0} cartons / {item.get('quantity') or '-'} pcs)"
            for item in goods[:8]
        )
    return line.description_ar


def _booking_mode_to_quote_mode(mode: str | None) -> ServiceQuoteMode:
    if mode == "AIR":
        return ServiceQuoteMode.AIR
    if mode == "FCL":
        return ServiceQuoteMode.SEA_FCL
    return ServiceQuoteMode.SEA_LCL


@router.post("/from-cargo-line/{line_id}", response_model=ServiceQuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote_from_cargo_line(
    line_id: int,
    payload: ServiceQuoteFromCargoLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(BookingCargoLine.id == line_id).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")
    booking = db.query(Booking).filter(Booking.id == line.booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")

    if payload.extract_documents:
        extracted = _extract_documents_for_line(line)
        fields = extracted.get("fields") or {}
        if fields.get("hs_code") and not line.hs_code:
            line.hs_code = fields["hs_code"]
        if fields.get("cartons") is not None and not line.cartons:
            line.cartons = fields["cartons"]
        if fields.get("gross_weight_kg") is not None and not line.gross_weight_kg:
            line.gross_weight_kg = fields["gross_weight_kg"]
        if fields.get("cbm") is not None and not line.cbm:
            line.cbm = fields["cbm"]
        line.extracted_goods = extracted

    data = {
        "client_id": line.client_id,
        "invoice_id": line.invoice_id,
        "booking_id": booking.id,
        "booking_cargo_line_id": line.id,
        "mode": _booking_mode_to_quote_mode(booking.mode),
        "service_scope": payload.service_scope,
        "cargo_source": payload.cargo_source,
        "origin_country": payload.origin_country,
        "origin_city": payload.origin_city,
        "pickup_address": payload.pickup_address,
        "loading_warehouse_id": booking.loading_warehouse_id,
        "port_of_loading": booking.port_of_loading,
        "port_of_discharge": booking.port_of_discharge,
        "destination_country": booking.destination or (line.client.country if line.client else None),
        "destination_city": payload.destination_city,
        "final_address": payload.final_address,
        "container_size": booking.container_size,
        "cbm": line.cbm,
        "gross_weight_kg": line.gross_weight_kg,
        "chargeable_weight_kg": line.chargeable_weight_kg,
        "cartons": line.cartons,
        "goods_description": _goods_description_from_line(line),
        "clearance_through_us": bool(line.clearance_through_us) if payload.clearance_through_us is None else payload.clearance_through_us,
        "delivery_through_us": payload.delivery_through_us,
        "clearance_agent_id": payload.clearance_agent_id or line.clearance_agent_id,
        "clearance_agent_rate_id": payload.clearance_agent_rate_id or line.clearance_agent_rate_id,
        "customs_value_usd": payload.customs_value_usd,
        "shipping_agent_id": booking.shipping_agent_id,
        "agent_carrier_rate_id": booking.agent_carrier_rate_id,
        "carrier_name": booking.carrier_name,
        "city_fee_id": payload.city_fee_id,
        "manual_sell_rate": payload.manual_sell_rate,
        "manual_buy_rate": payload.manual_buy_rate,
        "origin_fees_sell": payload.origin_fees_sell,
        "origin_fees_buy": payload.origin_fees_buy,
        "destination_fees_sell": payload.destination_fees_sell,
        "destination_fees_buy": payload.destination_fees_buy,
        "other_fees_sell": payload.other_fees_sell,
        "other_fees_buy": payload.other_fees_buy,
        "currency": booking.currency or "USD",
        "notes": payload.notes,
    }
    quote = _quote_from_data(db, data, current_user)
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


def _create_quote_cost_entry(db: Session, quote: ServiceQuote, invoice: Invoice, current_user: User) -> None:
    amount = _q2(_money(quote.total_buy))
    if amount <= 0:
        return
    reference = f"{quote.quote_number}:cost"
    existing = db.query(AccountingEntry).filter(AccountingEntry.reference_no == reference).first()
    if existing:
        return
    counterparty_name = None
    counterparty_type = None
    if quote.shipping_agent:
        counterparty_name = quote.shipping_agent.name
        counterparty_type = "shipping_agent"
    elif quote.clearance_agent:
        counterparty_name = quote.clearance_agent.name
        counterparty_type = "clearance_agent"
    db.add(AccountingEntry(
        entry_number=_accounting_entry_number(db),
        direction=AccountingDirection.MONEY_OUT.value,
        status=AccountingStatus.NEEDS_REVIEW.value,
        entry_date=date.today(),
        amount=amount,
        currency=quote.currency or "USD",
        payment_method="unpaid",
        category="shipping_service_cost",
        counterparty_type=counterparty_type,
        counterparty_name=counterparty_name,
        reference_no=reference,
        description=f"Expected buy cost for service quote {quote.quote_number}",
        notes="Auto-created when the shipping service invoice was generated. Review and attach supplier receipts before posting.",
        client_id=quote.client_id,
        invoice_id=invoice.id,
        booking_id=quote.booking_id,
        shipping_agent_id=quote.shipping_agent_id,
        clearance_agent_id=quote.clearance_agent_id,
        created_by_id=current_user.id,
    ))


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
    _create_quote_cost_entry(db, quote, invoice, current_user)
    db.commit()
    db.refresh(invoice)
    return invoice


def _quote_export_payload(quote: ServiceQuote) -> dict:
    return {
        "id": quote.id,
        "quote_number": quote.quote_number,
        "status": quote.status,
        "mode": quote.mode,
        "service_scope": quote.service_scope,
        "cargo_source": quote.cargo_source,
        "client": {
            "id": quote.client.id if quote.client else None,
            "name": quote.client.name if quote.client else None,
            "name_ar": quote.client.name_ar if quote.client else None,
            "client_code": quote.client.client_code if quote.client else None,
        },
        "route": {
            "origin_country": quote.origin_country,
            "origin_city": quote.origin_city,
            "pickup_address": quote.pickup_address,
            "port_of_loading": quote.port_of_loading,
            "port_of_discharge": quote.port_of_discharge,
            "destination_country": quote.destination_country,
            "destination_city": quote.destination_city,
            "final_address": quote.final_address,
        },
        "cargo": {
            "container_size": quote.container_size,
            "cbm": quote.cbm,
            "gross_weight_kg": quote.gross_weight_kg,
            "chargeable_weight_kg": quote.chargeable_weight_kg,
            "cartons": quote.cartons,
            "goods_description": quote.goods_description,
        },
        "pricing": {
            "currency": quote.currency,
            "rate_basis": quote.rate_basis,
            "buy_rate": quote.buy_rate,
            "sell_rate": quote.sell_rate,
            "chargeable_quantity": quote.chargeable_quantity,
            "freight_buy": quote.freight_buy,
            "freight_sell": quote.freight_sell,
            "origin_fees_buy": quote.origin_fees_buy,
            "origin_fees_sell": quote.origin_fees_sell,
            "destination_fees_buy": quote.destination_fees_buy,
            "destination_fees_sell": quote.destination_fees_sell,
            "other_fees_buy": quote.other_fees_buy,
            "other_fees_sell": quote.other_fees_sell,
            "total_buy": quote.total_buy,
            "total_sell": quote.total_sell,
            "profit": quote.profit,
            "margin_pct": quote.margin_pct,
        },
        "links": {
            "invoice_id": quote.invoice_id,
            "booking_id": quote.booking_id,
            "booking_cargo_line_id": quote.booking_cargo_line_id,
            "shipping_agent_id": quote.shipping_agent_id,
            "agent_carrier_rate_id": quote.agent_carrier_rate_id,
            "clearance_agent_id": quote.clearance_agent_id,
            "clearance_agent_rate_id": quote.clearance_agent_rate_id,
            "city_fee_id": quote.city_fee_id,
        },
        "rate_snapshot": quote.rate_snapshot,
        "calculation_notes": quote.calculation_notes,
        "notes": quote.notes,
        "created_at": quote.created_at,
        "updated_at": quote.updated_at,
    }


def _invoice_export_payload(invoice: Invoice | None) -> dict | None:
    if not invoice:
        return None
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_type": invoice.invoice_type.value if hasattr(invoice.invoice_type, "value") else invoice.invoice_type,
        "invoice_kind": invoice.invoice_kind,
        "status": invoice.status.value if hasattr(invoice.status, "value") else invoice.status,
        "issue_date": invoice.issue_date,
        "total": invoice.total,
        "currency": invoice.currency,
        "items": [
            {
                "description": item.description,
                "description_ar": item.description_ar,
                "quantity": item.quantity,
                "unit": item.unit,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
                "details": item.details,
            }
            for item in invoice.items
        ],
    }


def _cargo_line_export_payload(line: BookingCargoLine | None) -> dict | None:
    if not line:
        return None
    return {
        "id": line.id,
        "booking_id": line.booking_id,
        "client_id": line.client_id,
        "invoice_id": line.invoice_id,
        "invoice_package_id": line.invoice_package_id,
        "description": line.description,
        "description_ar": line.description_ar,
        "hs_code": line.hs_code,
        "shipping_marks": line.shipping_marks,
        "cartons": line.cartons,
        "gross_weight_kg": line.gross_weight_kg,
        "net_weight_kg": line.net_weight_kg,
        "cbm": line.cbm,
        "chargeable_weight_kg": line.chargeable_weight_kg,
        "freight_share": line.freight_share,
        "clearance_through_us": line.clearance_through_us,
        "clearance_agent_id": line.clearance_agent_id,
        "clearance_agent_rate_id": line.clearance_agent_rate_id,
        "extracted_goods": line.extracted_goods,
        "notes": line.notes,
    }


def _html_escape(value) -> str:
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


@router.get("/{quote_id}/print", response_class=HTMLResponse)
def print_service_quote(
    quote_id: int,
    lang: str = Query("en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = db.query(ServiceQuote).filter(ServiceQuote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Service quote not found")
    is_ar = lang.lower().startswith("ar")
    direction = "rtl" if is_ar else "ltr"
    title = "عرض شحن وخدمات" if is_ar else "Shipping & Service Quote"
    labels = {
        "client": "العميل" if is_ar else "Client",
        "route": "المسار" if is_ar else "Route",
        "mode": "الخدمة" if is_ar else "Service",
        "chargeable": "الكمية المحسوبة" if is_ar else "Chargeable",
        "freight": "الشحن" if is_ar else "Freight",
        "origin": "رسوم المصدر" if is_ar else "Origin fees",
        "destination": "رسوم الوجهة / التخليص" if is_ar else "Destination / clearance fees",
        "other": "رسوم أخرى" if is_ar else "Other fees",
        "total": "الإجمالي" if is_ar else "Total",
        "notes": "ملاحظات" if is_ar else "Notes",
    }
    client_name = quote.client.name_ar if is_ar and quote.client and quote.client.name_ar else quote.client.name if quote.client else "-"
    html = f"""<!doctype html>
<html lang="{_html_escape(lang)}" dir="{direction}">
<head>
  <meta charset="utf-8" />
  <title>{_html_escape(title)} {_html_escape(quote.quote_number)}</title>
  <style>
    body {{ font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }}
    .head {{ display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 18px; }}
    h1 {{ font-size: 24px; margin: 0 0 8px; }}
    .muted {{ color: #64748b; }}
    .grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }}
    .box {{ border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; }}
    .label {{ font-size: 12px; color: #64748b; margin-bottom: 4px; }}
    .value {{ font-size: 16px; font-weight: 700; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 10px; text-align: start; }}
    th {{ background: #f1f5f9; }}
    .total {{ font-size: 22px; font-weight: 800; color: #059669; }}
    @media print {{ body {{ margin: 12mm; }} }}
  </style>
</head>
<body>
  <div class="head">
    <div>
      <h1>{_html_escape(title)}</h1>
      <div class="muted">{_html_escape(quote.quote_number)} · {_html_escape(quote.status)}</div>
    </div>
    <div>
      <div class="label">{labels["client"]}</div>
      <div class="value">{_html_escape(client_name)}</div>
    </div>
  </div>
  <div class="grid">
    <div class="box"><div class="label">{labels["mode"]}</div><div class="value">{_html_escape(_mode_label(quote.mode))} · {_html_escape(_scope_label(quote.service_scope))}</div></div>
    <div class="box"><div class="label">{labels["route"]}</div><div class="value">{_html_escape(quote.port_of_loading or "-")} → {_html_escape(quote.port_of_discharge or "-")}</div></div>
    <div class="box"><div class="label">{labels["chargeable"]}</div><div class="value">{_html_escape(quote.chargeable_quantity)} {_html_escape(quote.rate_basis)}</div></div>
    <div class="box"><div class="label">{labels["total"]}</div><div class="total">{_html_escape(quote.total_sell)} {_html_escape(quote.currency)}</div></div>
  </div>
  <table>
    <thead><tr><th>{labels["freight"]}</th><th>{labels["origin"]}</th><th>{labels["destination"]}</th><th>{labels["other"]}</th><th>{labels["total"]}</th></tr></thead>
    <tbody><tr>
      <td>{_html_escape(quote.freight_sell)}</td>
      <td>{_html_escape(quote.origin_fees_sell)}</td>
      <td>{_html_escape(quote.destination_fees_sell)}</td>
      <td>{_html_escape(quote.other_fees_sell)}</td>
      <td><strong>{_html_escape(quote.total_sell)} {_html_escape(quote.currency)}</strong></td>
    </tr></tbody>
  </table>
  <div class="box" style="margin-top:24px">
    <div class="label">{labels["notes"]}</div>
    <div>{_html_escape(quote.goods_description or quote.notes or "-")}</div>
  </div>
</body>
</html>"""
    return HTMLResponse(html)


@router.get("/{quote_id}/clearance-package.zip")
def download_service_quote_package(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quote = db.query(ServiceQuote).filter(ServiceQuote.id == quote_id).first()
    if not quote:
        raise HTTPException(404, "Service quote not found")

    archive_root = _safe_filename(quote.quote_number, f"service-quote-{quote_id}")
    zip_path = os.path.join(EXPORT_TMP_DIR, f"{archive_root}-{uuid.uuid4().hex}.zip")
    missing_files: list[dict] = []
    try:
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            readme = [
                f"Service quote package: {quote.quote_number}",
                f"Generated at: {datetime.utcnow().isoformat()}Z",
                "",
                "Files included:",
                "- quote.json: service quote snapshot and full calculation",
                "- shipping-invoice.json: generated shipping invoice if available",
                "- cargo-line.json / extracted-goods.json: linked container cargo data if available",
                "- documents/photos: uploaded client originals from the linked container cargo line",
            ]
            zf.writestr(f"{archive_root}/README.txt", "\n".join(readme))
            _zip_json(zf, f"{archive_root}/quote.json", _quote_export_payload(quote))
            if quote.invoice:
                _zip_json(zf, f"{archive_root}/shipping-invoice.json", _invoice_export_payload(quote.invoice))
            line = quote.booking_cargo_line
            if line:
                _zip_json(zf, f"{archive_root}/cargo-line/cargo-line.json", _cargo_line_export_payload(line))
                if line.extracted_goods:
                    _zip_json(zf, f"{archive_root}/cargo-line/extracted-goods.json", line.extracted_goods)
                for doc in line.documents:
                    doc_folder = _safe_filename(doc.custom_file_type if doc.document_type == "other" else doc.document_type, "document")
                    filename = _safe_filename(doc.original_filename or os.path.basename(doc.file_path), f"document-{doc.id}")
                    arcname = f"{archive_root}/cargo-line/documents/{doc_folder}/{doc.id}-{filename}"
                    if not _zip_file_if_exists(zf, doc.file_path, arcname):
                        missing_files.append({"kind": "document", "id": doc.id, "path": doc.file_path})
                for img in line.images:
                    filename = _safe_filename(img.original_filename or os.path.basename(img.file_path), f"photo-{img.id}")
                    arcname = f"{archive_root}/cargo-line/photos/{img.id}-{filename}"
                    if not _zip_file_if_exists(zf, img.file_path, arcname):
                        missing_files.append({"kind": "image", "id": img.id, "path": img.file_path})
            if missing_files:
                _zip_json(zf, f"{archive_root}/missing-files.json", missing_files)
    except Exception:
        if os.path.isfile(zip_path):
            os.remove(zip_path)
        raise

    def cleanup_zip() -> None:
        if os.path.isfile(zip_path):
            os.remove(zip_path)

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{archive_root}-clearance-package.zip",
        background=BackgroundTask(cleanup_zip),
    )
