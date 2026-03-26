from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class RateEntry(BaseModel):
    currency: str
    rate: float                     # 1 USD = X currency
    inverse: float                  # 1 unit = X USD (useful for display)


class RatesSnapshot(BaseModel):
    base: str = "USD"
    rates: list[RateEntry]
    fetched_at: Optional[datetime] = None
    is_stale: bool = False          # True if older than CACHE_MINUTES


class TopClientEntry(BaseModel):
    rank: int
    client_id: int
    name: str
    name_ar: Optional[str] = None
    client_code: str
    value: Decimal                  # total amount (USD) or count
    label: str                      # "USD 125,000" or "8 shipments"


class AgentRateEntry(BaseModel):
    agent_id: int
    agent_name: str
    agent_wechat: Optional[str] = None
    quote_number: str
    route: str                      # "Guangzhou → Aqaba"
    container_type: Optional[str] = None
    incoterm: Optional[str] = None
    transit_days: Optional[int] = None
    total_usd: Optional[Decimal] = None
    ocean_freight: Optional[Decimal] = None
    validity_to: Optional[datetime] = None


class AgentQuickPrice(BaseModel):
    agent_id: int
    agent_name: str
    agent_wechat: Optional[str] = None
    warehouse_city: Optional[str] = None
    country: Optional[str] = None
    price_20gp: Optional[Decimal] = None
    price_40ft: Optional[Decimal] = None
    price_40hq: Optional[Decimal] = None
    price_air_kg: Optional[Decimal] = None
    transit_sea_days: Optional[int] = None
    transit_air_days: Optional[int] = None


class BoardResponse(BaseModel):
    """Single endpoint that returns everything the TV board needs."""
    rates: RatesSnapshot
    top_clients_by_revenue: list[TopClientEntry]   # sorted by invoice total (USD)
    top_clients_by_shipments: list[TopClientEntry] # sorted by container count
    agent_rates: list[AgentRateEntry]              # latest active quotes, cheapest first
    agent_quick_prices: list[AgentQuickPrice]      # quick reference prices per agent
    generated_at: datetime
