from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.shipping_quote import QuoteServiceMode, QuoteStatus, Incoterm


class CarrierRateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    carrier_name: str
    pol: Optional[str] = None
    pod: Optional[str] = None
    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    buy_20gp: Optional[Decimal] = None;  sell_20gp: Optional[Decimal] = None;  cbm_20gp: Optional[Decimal] = None
    buy_40ft: Optional[Decimal] = None;  sell_40ft: Optional[Decimal] = None;  cbm_40ft: Optional[Decimal] = None
    buy_40hq: Optional[Decimal] = None;  sell_40hq: Optional[Decimal] = None;  cbm_40hq: Optional[Decimal] = None
    buy_lcl_cbm: Optional[Decimal] = None; sell_lcl_cbm: Optional[Decimal] = None
    transit_sea_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool


# ── Shipping Agent schemas ────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    wechat_id: Optional[str] = None
    email: Optional[str] = None

    warehouse_address: Optional[str] = None
    warehouse_city: Optional[str] = None

    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None

    # Quick reference prices
    price_20gp: Optional[Decimal] = None
    price_40ft: Optional[Decimal] = None
    price_40hq: Optional[Decimal] = None
    price_air_kg: Optional[Decimal] = None
    transit_sea_days: Optional[int] = None
    transit_air_days: Optional[int] = None

    serves_sea: bool = True
    serves_air: bool = False
    notes: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    wechat_id: Optional[str] = None
    email: Optional[str] = None
    warehouse_address: Optional[str] = None
    warehouse_city: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    price_20gp: Optional[Decimal] = None
    price_40ft: Optional[Decimal] = None
    price_40hq: Optional[Decimal] = None
    price_air_kg: Optional[Decimal] = None
    transit_sea_days: Optional[int] = None
    transit_air_days: Optional[int] = None
    serves_sea: Optional[bool] = None
    serves_air: Optional[bool] = None
    notes: Optional[str] = None


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    name_ar: Optional[str] = None
    country: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    wechat_id: Optional[str] = None
    email: Optional[str] = None
    warehouse_address: Optional[str] = None
    warehouse_city: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    price_20gp: Optional[Decimal] = None
    price_40ft: Optional[Decimal] = None
    price_40hq: Optional[Decimal] = None
    price_air_kg: Optional[Decimal] = None
    transit_sea_days: Optional[int] = None
    transit_air_days: Optional[int] = None
    serves_sea: bool = True
    serves_air: bool = False
    offer_valid_from: Optional[date] = None
    offer_valid_to: Optional[date] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    carrier_rates: list[CarrierRateResponse] = []


class AgentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[AgentResponse]


# ── Shipping Quote schemas ─────────────────────────────────────────────────────

class QuoteCreate(BaseModel):
    service_mode: QuoteServiceMode
    carrier: Optional[str] = None            # Shipping line: CMA CGM, MSC, PIL, Evergreen …
    container_type: Optional[str] = None     # 20GP / 40FT / 40HQ (for SEA_FCL)
    incoterm: Optional[Incoterm] = None
    incoterm_point: Optional[str] = None     # e.g. "Guangzhou"
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None

    validity_from: Optional[datetime] = None
    validity_to: Optional[datetime] = None
    status: QuoteStatus = QuoteStatus.DRAFT
    currency: str = "USD"
    client_id: Optional[int] = None          # If this quote is for a specific client

    # Freight
    ocean_freight: Optional[Decimal] = None
    air_freight_per_kg: Optional[Decimal] = None
    min_chargeable_weight_kg: Optional[Decimal] = None
    min_chargeable_cbm: Optional[Decimal] = None

    # Surcharges
    baf: Optional[Decimal] = None
    eca_surcharge: Optional[Decimal] = None
    war_risk_surcharge: Optional[Decimal] = None
    other_surcharges: Optional[Decimal] = None

    # Origin charges
    thc_origin: Optional[Decimal] = None
    bl_fee: Optional[Decimal] = None
    doc_fee: Optional[Decimal] = None
    sealing_fee: Optional[Decimal] = None
    inspection_fee: Optional[Decimal] = None
    trucking_origin: Optional[Decimal] = None
    stuffing_fee: Optional[Decimal] = None
    warehouse_handling: Optional[Decimal] = None

    # Destination charges
    thc_destination: Optional[Decimal] = None
    customs_destination: Optional[Decimal] = None
    brokerage_destination: Optional[Decimal] = None
    trucking_destination: Optional[Decimal] = None

    # Timing
    transit_days: Optional[int] = None
    free_days_origin: Optional[int] = None
    free_days_destination: Optional[int] = None
    cut_off_days: Optional[int] = None
    stuffing_days: Optional[int] = None

    notes: Optional[str] = None


class QuoteUpdate(QuoteCreate):
    service_mode: Optional[QuoteServiceMode] = None  # type: ignore[assignment]
    status: Optional[QuoteStatus] = None              # type: ignore[assignment]
    currency: Optional[str] = None                    # type: ignore[assignment]


class AgentShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    name_ar: Optional[str] = None
    country: Optional[str] = None
    wechat_id: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None


class QuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    quote_number: str
    agent_id: int
    agent: Optional[AgentShort] = None
    client_id: Optional[int] = None

    service_mode: QuoteServiceMode
    carrier: Optional[str] = None
    container_type: Optional[str] = None
    incoterm: Optional[Incoterm] = None
    incoterm_point: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None

    validity_from: Optional[datetime] = None
    validity_to: Optional[datetime] = None
    status: QuoteStatus
    currency: str

    ocean_freight: Optional[Decimal] = None
    air_freight_per_kg: Optional[Decimal] = None
    min_chargeable_weight_kg: Optional[Decimal] = None
    min_chargeable_cbm: Optional[Decimal] = None

    baf: Optional[Decimal] = None
    eca_surcharge: Optional[Decimal] = None
    war_risk_surcharge: Optional[Decimal] = None
    other_surcharges: Optional[Decimal] = None

    thc_origin: Optional[Decimal] = None
    bl_fee: Optional[Decimal] = None
    doc_fee: Optional[Decimal] = None
    sealing_fee: Optional[Decimal] = None
    inspection_fee: Optional[Decimal] = None
    trucking_origin: Optional[Decimal] = None
    stuffing_fee: Optional[Decimal] = None
    warehouse_handling: Optional[Decimal] = None

    thc_destination: Optional[Decimal] = None
    customs_destination: Optional[Decimal] = None
    brokerage_destination: Optional[Decimal] = None
    trucking_destination: Optional[Decimal] = None

    transit_days: Optional[int] = None
    free_days_origin: Optional[int] = None
    free_days_destination: Optional[int] = None
    cut_off_days: Optional[int] = None
    stuffing_days: Optional[int] = None

    total_origin: Optional[Decimal] = None
    total_destination: Optional[Decimal] = None
    total_surcharges: Optional[Decimal] = None
    total_all: Optional[Decimal] = None

    notes: Optional[str] = None
    document_path: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class QuoteListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[QuoteResponse]


# ── Compare result ─────────────────────────────────────────────────────────────

class CompareEntry(BaseModel):
    agent_id: int
    agent_name: str
    agent_wechat: Optional[str] = None
    quote_id: int
    quote_number: str
    service_mode: QuoteServiceMode
    container_type: Optional[str] = None
    incoterm: Optional[str] = None
    transit_days: Optional[int] = None
    total_origin: Optional[Decimal] = None
    total_destination: Optional[Decimal] = None
    total_surcharges: Optional[Decimal] = None
    total_all: Optional[Decimal] = None
    ocean_freight: Optional[Decimal] = None
    validity_to: Optional[datetime] = None
    status: QuoteStatus


class CompareResponse(BaseModel):
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    service_mode: Optional[str] = None
    container_type: Optional[str] = None
    count: int
    results: list[CompareEntry]   # sorted cheapest first
