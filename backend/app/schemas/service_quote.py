from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.service_quote import ServiceQuoteMode, ServiceQuoteScope, ServiceQuoteStatus


class ServiceQuoteBase(BaseModel):
    client_id: int
    mode: ServiceQuoteMode
    service_scope: ServiceQuoteScope = ServiceQuoteScope.WAREHOUSE_TO_PORT
    cargo_source: str = "outside_supplier"
    origin_country: Optional[str] = "China"
    origin_city: Optional[str] = None
    pickup_address: Optional[str] = None
    loading_warehouse_id: Optional[int] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    destination_country: Optional[str] = None
    destination_city: Optional[str] = None
    final_address: Optional[str] = None
    container_size: Optional[str] = None
    cbm: Optional[Decimal] = Field(default=None, ge=0)
    gross_weight_kg: Optional[Decimal] = Field(default=None, ge=0)
    chargeable_weight_kg: Optional[Decimal] = Field(default=None, ge=0)
    cartons: Optional[int] = Field(default=None, ge=0)
    goods_description: Optional[str] = None
    hs_code_ref_id: Optional[int] = None
    hs_code: Optional[str] = None
    clearance_through_us: bool = False
    delivery_through_us: bool = False
    clearance_agent_id: Optional[int] = None
    clearance_agent_rate_id: Optional[int] = None
    customs_value_usd: Optional[Decimal] = Field(default=None, ge=0)
    shipping_agent_id: Optional[int] = None
    agent_carrier_rate_id: Optional[int] = None
    agent_quote_id: Optional[int] = None
    city_fee_id: Optional[int] = None
    carrier_name: Optional[str] = None
    currency: str = "USD"
    manual_sell_rate: Optional[Decimal] = Field(default=None, ge=0)
    manual_buy_rate: Optional[Decimal] = Field(default=None, ge=0)
    origin_fees_sell: Optional[Decimal] = Field(default=None, ge=0)
    origin_fees_buy: Optional[Decimal] = Field(default=None, ge=0)
    destination_fees_sell: Optional[Decimal] = Field(default=None, ge=0)
    destination_fees_buy: Optional[Decimal] = Field(default=None, ge=0)
    other_fees_sell: Optional[Decimal] = Field(default=None, ge=0)
    other_fees_buy: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None

    @field_validator("currency", "cargo_source")
    @classmethod
    def clean_required_text(cls, value: str) -> str:
        text = (value or "").strip()
        if not text:
            raise ValueError("This field is required")
        return text

    @field_validator("cargo_source")
    @classmethod
    def validate_cargo_source(cls, value: str) -> str:
        text = (value or "").strip()
        if text not in {"outside_supplier", "client_ready_goods"}:
            raise ValueError("Cargo source must be outside_supplier or client_ready_goods")
        return text


class ServiceQuoteCreate(ServiceQuoteBase):
    pass


class ServiceQuoteUpdate(BaseModel):
    status: Optional[ServiceQuoteStatus] = None
    notes: Optional[str] = None
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    booking_cargo_line_id: Optional[int] = None


class ServiceQuoteFromCargoLineCreate(BaseModel):
    service_scope: ServiceQuoteScope = ServiceQuoteScope.WAREHOUSE_TO_PORT
    cargo_source: str = "client_ready_goods"
    origin_country: Optional[str] = "China"
    origin_city: Optional[str] = None
    pickup_address: Optional[str] = None
    destination_city: Optional[str] = None
    final_address: Optional[str] = None
    clearance_through_us: Optional[bool] = None
    delivery_through_us: bool = False
    clearance_agent_id: Optional[int] = None
    clearance_agent_rate_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    hs_code: Optional[str] = None
    customs_value_usd: Optional[Decimal] = Field(default=None, ge=0)
    city_fee_id: Optional[int] = None
    manual_sell_rate: Optional[Decimal] = Field(default=None, ge=0)
    manual_buy_rate: Optional[Decimal] = Field(default=None, ge=0)
    origin_fees_sell: Optional[Decimal] = Field(default=None, ge=0)
    origin_fees_buy: Optional[Decimal] = Field(default=None, ge=0)
    destination_fees_sell: Optional[Decimal] = Field(default=None, ge=0)
    destination_fees_buy: Optional[Decimal] = Field(default=None, ge=0)
    other_fees_sell: Optional[Decimal] = Field(default=None, ge=0)
    other_fees_buy: Optional[Decimal] = Field(default=None, ge=0)
    extract_documents: bool = False
    notes: Optional[str] = None


class ServiceQuoteSuggestion(BaseModel):
    agent_id: int
    agent_name: str
    agent_name_ar: Optional[str] = None
    agent_carrier_rate_id: Optional[int] = None
    agent_quote_id: Optional[int] = None
    carrier_name: Optional[str] = None
    rate_basis: str
    buy_rate: Decimal
    sell_rate: Decimal
    chargeable_quantity: Decimal
    freight_buy: Decimal
    freight_sell: Decimal
    origin_fees_buy: Decimal
    origin_fees_sell: Decimal
    total_buy: Decimal
    total_sell: Decimal
    profit: Decimal
    margin_pct: Optional[Decimal] = None
    currency: str = "USD"
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    transit_days: Optional[int] = None
    vessel_day: Optional[date] = None
    notes: Optional[str] = None
    snapshot: dict[str, Any]


class ServiceQuoteSuggestionQuery(BaseModel):
    mode: ServiceQuoteMode
    service_scope: ServiceQuoteScope = ServiceQuoteScope.WAREHOUSE_TO_PORT
    container_size: Optional[str] = None
    cbm: Optional[Decimal] = Field(default=None, ge=0)
    gross_weight_kg: Optional[Decimal] = Field(default=None, ge=0)
    chargeable_weight_kg: Optional[Decimal] = Field(default=None, ge=0)
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    loading_warehouse_id: Optional[int] = None
    destination_country: Optional[str] = None


class ServiceQuoteResponse(BaseModel):
    id: int
    quote_number: str
    client_id: int
    invoice_id: Optional[int]
    booking_id: Optional[int]
    booking_cargo_line_id: Optional[int]
    mode: str
    status: str
    service_scope: str
    cargo_source: str
    origin_country: Optional[str]
    origin_city: Optional[str]
    pickup_address: Optional[str]
    loading_warehouse_id: Optional[int]
    port_of_loading: Optional[str]
    port_of_discharge: Optional[str]
    destination_country: Optional[str]
    destination_city: Optional[str]
    final_address: Optional[str]
    container_size: Optional[str]
    cbm: Optional[Decimal]
    gross_weight_kg: Optional[Decimal]
    chargeable_weight_kg: Optional[Decimal]
    cartons: Optional[int]
    goods_description: Optional[str]
    hs_code_ref_id: Optional[int]
    hs_code: Optional[str]
    clearance_through_us: bool
    delivery_through_us: bool
    clearance_agent_id: Optional[int]
    clearance_agent_rate_id: Optional[int]
    customs_value_usd: Optional[Decimal]
    shipping_agent_id: Optional[int]
    agent_carrier_rate_id: Optional[int]
    agent_quote_id: Optional[int]
    city_fee_id: Optional[int]
    carrier_name: Optional[str]
    currency: str
    rate_basis: Optional[str]
    buy_rate: Optional[Decimal]
    sell_rate: Optional[Decimal]
    chargeable_quantity: Optional[Decimal]
    freight_buy: Decimal
    freight_sell: Decimal
    origin_fees_buy: Decimal
    origin_fees_sell: Decimal
    destination_fees_buy: Decimal
    destination_fees_sell: Decimal
    other_fees_buy: Decimal
    other_fees_sell: Decimal
    total_buy: Decimal
    total_sell: Decimal
    profit: Decimal
    margin_pct: Optional[Decimal]
    rate_snapshot: Optional[dict[str, Any]]
    calculation_notes: Optional[str]
    notes: Optional[str]
    created_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceQuoteListResponse(BaseModel):
    total: int
    results: list[ServiceQuoteResponse]


class ServiceQuoteCityFeeCreate(BaseModel):
    origin_country: Optional[str] = "China"
    origin_city: str
    port_of_loading: Optional[str] = None
    service_scope: Optional[ServiceQuoteScope] = None
    buy_trucking: Decimal = Field(default=Decimal("0"), ge=0)
    sell_trucking: Decimal = Field(default=Decimal("0"), ge=0)
    buy_handling: Decimal = Field(default=Decimal("0"), ge=0)
    sell_handling: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = None
    is_active: bool = True


class ServiceQuoteCityFeeResponse(BaseModel):
    id: int
    origin_country: Optional[str]
    origin_city: str
    port_of_loading: Optional[str]
    service_scope: Optional[str]
    buy_trucking: Decimal
    sell_trucking: Decimal
    buy_handling: Decimal
    sell_handling: Decimal
    notes: Optional[str]
    is_active: bool
    created_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
