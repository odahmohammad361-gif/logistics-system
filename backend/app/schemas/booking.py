from __future__ import annotations
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel


class ClientShort(BaseModel):
    id: int
    name: str
    name_ar: Optional[str] = None
    client_code: str

    class Config:
        from_attributes = True


class AgentShort(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class BranchShort(BaseModel):
    id: int
    name: str
    name_ar: Optional[str] = None
    code: str

    class Config:
        from_attributes = True


# ── Image ─────────────────────────────────────────────────────────────────────

class BookingCargoImageResponse(BaseModel):
    id: int
    file_path: str
    original_filename: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class BookingCargoDocumentResponse(BaseModel):
    id: int
    document_type: str
    custom_file_type: Optional[str] = None
    file_path: str
    original_filename: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ── Cargo Line ────────────────────────────────────────────────────────────────

class BookingCargoLineCreate(BaseModel):
    client_id: int
    invoice_id: Optional[int] = None
    sort_order: int = 0
    goods_source: Optional[str] = None
    is_full_container_client: bool = False
    description: Optional[str] = None
    description_ar: Optional[str] = None
    hs_code: Optional[str] = None
    shipping_marks: Optional[str] = None
    cartons: Optional[int] = None
    gross_weight_kg: Optional[Decimal] = None
    net_weight_kg: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    freight_share: Optional[Decimal] = None
    notes: Optional[str] = None
    extracted_goods: Optional[dict] = None
    clearance_through_us: Optional[bool] = None
    clearance_agent_id: Optional[int] = None
    clearance_agent_rate_id: Optional[int] = None
    manual_clearance_agent_name: Optional[str] = None
    manual_clearance_agent_phone: Optional[str] = None
    manual_clearance_agent_notes: Optional[str] = None


class BookingCargoLineUpdate(BaseModel):
    invoice_id: Optional[int] = None
    sort_order: Optional[int] = None
    goods_source: Optional[str] = None
    is_full_container_client: Optional[bool] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    hs_code: Optional[str] = None
    shipping_marks: Optional[str] = None
    cartons: Optional[int] = None
    gross_weight_kg: Optional[Decimal] = None
    net_weight_kg: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    freight_share: Optional[Decimal] = None
    notes: Optional[str] = None
    extracted_goods: Optional[dict] = None
    clearance_through_us: Optional[bool] = None
    clearance_agent_id: Optional[int] = None
    clearance_agent_rate_id: Optional[int] = None
    manual_clearance_agent_name: Optional[str] = None
    manual_clearance_agent_phone: Optional[str] = None
    manual_clearance_agent_notes: Optional[str] = None


class BookingCargoLineResponse(BaseModel):
    id: int
    booking_id: int
    client: ClientShort
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    sort_order: int
    goods_source: Optional[str] = None
    is_full_container_client: bool = False
    description: Optional[str] = None
    description_ar: Optional[str] = None
    hs_code: Optional[str] = None
    shipping_marks: Optional[str] = None
    cartons: Optional[int] = None
    gross_weight_kg: Optional[Decimal] = None
    net_weight_kg: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    volumetric_weight_kg: Optional[Decimal] = None
    chargeable_weight_kg: Optional[Decimal] = None
    freight_share: Optional[Decimal] = None
    notes: Optional[str] = None
    extracted_goods: Optional[dict] = None
    clearance_through_us: Optional[bool] = None
    clearance_agent_id: Optional[int] = None
    clearance_agent_name: Optional[str] = None
    clearance_agent_rate_id: Optional[int] = None
    manual_clearance_agent_name: Optional[str] = None
    manual_clearance_agent_phone: Optional[str] = None
    manual_clearance_agent_notes: Optional[str] = None
    images: List[BookingCargoImageResponse] = []
    documents: List[BookingCargoDocumentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Booking ───────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    mode: str                             # LCL | FCL | AIR
    shipping_agent_id: Optional[int] = None
    agent_carrier_rate_id: Optional[int] = None
    branch_id: Optional[int] = None
    container_size: Optional[str] = None  # 20GP | 40GP | 40HQ
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    awb_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    flight_number: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[date] = None
    eta: Optional[date] = None
    incoterm: Optional[str] = None
    freight_cost: Optional[Decimal] = None
    sell_freight_cost: Optional[Decimal] = None
    currency: str = "USD"
    notes: Optional[str] = None
    is_direct_booking: bool = False
    carrier_name: Optional[str] = None
    max_cbm: Optional[Decimal] = None
    markup_pct: Optional[Decimal] = None
    cargo_lines: List[BookingCargoLineCreate] = []


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    shipping_agent_id: Optional[int] = None
    branch_id: Optional[int] = None
    container_size: Optional[str] = None
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    awb_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    flight_number: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[date] = None
    eta: Optional[date] = None
    incoterm: Optional[str] = None
    freight_cost: Optional[Decimal] = None
    sell_freight_cost: Optional[Decimal] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    is_direct_booking: Optional[bool] = None
    carrier_name: Optional[str] = None
    max_cbm: Optional[Decimal] = None
    markup_pct: Optional[Decimal] = None


class BookingResponse(BaseModel):
    id: int
    booking_number: str
    mode: str
    status: str
    container_size: Optional[str] = None
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    awb_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    flight_number: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[date] = None
    eta: Optional[date] = None
    incoterm: Optional[str] = None
    freight_cost: Optional[Decimal] = None
    sell_freight_cost: Optional[Decimal] = None
    currency: str
    notes: Optional[str] = None
    is_direct_booking: bool = False
    carrier_name: Optional[str] = None
    agent_carrier_rate_id: Optional[int] = None
    is_agent_snapshot: bool = False
    agent: Optional[AgentShort] = None
    branch: Optional[BranchShort] = None
    cargo_lines: List[BookingCargoLineResponse] = []
    max_cbm: Optional[Decimal] = None
    markup_pct: Optional[Decimal] = None
    destination: Optional[str] = None
    # Computed capacity fields
    total_cbm_used: Optional[Decimal] = None
    container_cbm_capacity: Optional[float] = None
    fill_percent: Optional[float] = None
    # Loading info
    loading_warehouse_id:   Optional[int]      = None
    loading_warehouse_name: Optional[str]      = None
    loading_warehouse_city: Optional[str]      = None
    loading_date:           Optional[datetime] = None
    loading_notes:          Optional[str]      = None
    loading_photos:         List[dict]         = []
    is_locked:              bool               = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookingListItem(BaseModel):
    id: int
    booking_number: str
    mode: str
    status: str
    container_size: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[date] = None
    eta: Optional[date] = None
    client_count: int
    total_cbm_used: Optional[Decimal] = None
    fill_percent: Optional[float] = None
    agent_name: Optional[str] = None
    freight_cost: Optional[Decimal] = None
    sell_freight_cost: Optional[Decimal] = None
    max_cbm: Optional[Decimal] = None
    markup_pct: Optional[Decimal] = None
    container_no: Optional[str] = None
    bl_number: Optional[str] = None
    vessel_name: Optional[str] = None
    destination: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BookingListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[BookingListItem]
