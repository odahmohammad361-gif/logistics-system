from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.container import ContainerType, ContainerStatus


# ── Nested short schemas ──────────────────────────────────────────────────────

class ClientShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    name_ar: Optional[str] = None
    client_code: str


class AgentShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    name_ar: Optional[str] = None
    country: Optional[str] = None
    price_20gp: Optional[Decimal] = None
    price_40ft: Optional[Decimal] = None
    price_40hq: Optional[Decimal] = None
    price_air_kg: Optional[Decimal] = None


class ContainerClientCreate(BaseModel):
    client_id: int
    cbm: Optional[Decimal] = None
    cartons: Optional[int] = None
    net_weight: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None
    freight_share: Optional[Decimal] = None
    notes: Optional[str] = None


class ContainerClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    client: Optional[ClientShort] = None
    cbm: Optional[Decimal] = None
    cartons: Optional[int] = None
    net_weight: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None
    freight_share: Optional[Decimal] = None
    notes: Optional[str] = None


# ── Request schemas ───────────────────────────────────────────────────────────

class ContainerCreate(BaseModel):
    client_id: int
    container_type: ContainerType
    shipping_agent_id: Optional[int] = None
    container_number: Optional[str] = None

    # B/L and seal
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None

    # LCL mode
    is_lcl: bool = False
    cargo_mode: Optional[str] = None  # FCL, LCL

    # Shipping / payment terms
    shipping_term: Optional[str] = None
    payment_terms: Optional[str] = None

    # Cargo
    cbm: Optional[Decimal] = None
    cartons: Optional[int] = None
    net_weight: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None

    # Route
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[datetime] = None
    eta: Optional[datetime] = None

    # Financials
    freight_cost: Optional[Decimal] = None
    currency: str = "USD"

    # Goods
    goods_description: Optional[str] = None
    goods_description_ar: Optional[str] = None
    notes: Optional[str] = None

    branch_id: Optional[int] = None

    # LCL clients list
    lcl_clients: list[ContainerClientCreate] = []


class ContainerUpdate(BaseModel):
    shipping_agent_id: Optional[int] = None
    container_number: Optional[str] = None
    status: Optional[ContainerStatus] = None

    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    is_lcl: Optional[bool] = None
    cargo_mode: Optional[str] = None
    shipping_term: Optional[str] = None
    payment_terms: Optional[str] = None

    cbm: Optional[Decimal] = None
    cartons: Optional[int] = None
    net_weight: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None

    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[datetime] = None
    eta: Optional[datetime] = None

    freight_cost: Optional[Decimal] = None
    currency: Optional[str] = None

    goods_description: Optional[str] = None
    goods_description_ar: Optional[str] = None
    notes: Optional[str] = None

    lcl_clients: Optional[list[ContainerClientCreate]] = None


class ContainerStatusUpdate(BaseModel):
    status: ContainerStatus


# ── Response schemas ──────────────────────────────────────────────────────────

class ContainerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_number: str
    container_number: Optional[str] = None
    container_type: ContainerType
    status: ContainerStatus

    client_id: int
    client: Optional[ClientShort] = None

    shipping_agent_id: Optional[int] = None
    shipping_agent: Optional[AgentShort] = None

    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    is_lcl: bool = False
    cargo_mode: Optional[str] = None
    shipping_term: Optional[str] = None
    payment_terms: Optional[str] = None

    cbm: Optional[Decimal] = None
    cartons: Optional[int] = None
    net_weight: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None

    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[datetime] = None
    eta: Optional[datetime] = None

    freight_cost: Optional[Decimal] = None
    currency: str

    goods_description: Optional[str] = None
    goods_description_ar: Optional[str] = None
    notes: Optional[str] = None

    lcl_clients: list[ContainerClientResponse] = []

    branch_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class ContainerListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ContainerResponse]


# ── Capacity response ─────────────────────────────────────────────────────────

class ContainerCapacity(BaseModel):
    container_type: str
    max_cbm: Optional[float]
    max_weight_tons: Optional[float]
    used_cbm: float
    used_weight_tons: float
    cbm_pct: float
    weight_pct: float
    agent_price: Optional[Decimal] = None
    lcl_clients: list[ContainerClientResponse] = []
