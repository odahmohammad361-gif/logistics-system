from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.invoice import InvoiceType, InvoiceStatus


# ── Invoice Item ────────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
    description: str
    description_ar: Optional[str] = None
    details: Optional[str] = None
    details_ar: Optional[str] = None
    hs_code: Optional[str] = None
    quantity: Decimal = Decimal("0")
    unit: Optional[str] = None
    unit_price: Decimal = Decimal("0")
    cartons: Optional[int] = None
    gross_weight: Optional[Decimal] = None
    net_weight: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    # Air cargo dimensions
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    sort_order: int = 0


class InvoiceItemUpdate(BaseModel):
    description: Optional[str] = None
    description_ar: Optional[str] = None
    details: Optional[str] = None
    details_ar: Optional[str] = None
    hs_code: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    cartons: Optional[int] = None
    gross_weight: Optional[Decimal] = None
    net_weight: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    sort_order: Optional[int] = None


class InvoiceItemResponse(BaseModel):
    id: int
    description: str
    description_ar: Optional[str]
    details: Optional[str]
    details_ar: Optional[str]
    product_image_path: Optional[str]
    hs_code: Optional[str]
    quantity: Decimal
    unit: Optional[str]
    unit_price: Decimal
    total_price: Decimal
    cartons: Optional[int]
    gross_weight: Optional[Decimal]
    net_weight: Optional[Decimal]
    cbm: Optional[Decimal]
    carton_length_cm: Optional[Decimal]
    carton_width_cm: Optional[Decimal]
    carton_height_cm: Optional[Decimal]
    volumetric_weight_kg: Optional[Decimal]
    chargeable_weight_kg: Optional[Decimal]
    sort_order: int

    model_config = {"from_attributes": True}


# ── Invoice ─────────────────────────────────────────────────────────────────

class InvoiceCreate(BaseModel):
    invoice_type: InvoiceType
    client_id: Optional[int] = None     # None for dummy/manual invoices
    buyer_name: Optional[str] = None    # manual buyer name (dummy invoices)
    issue_date: date
    due_date: Optional[date] = None

    origin: Optional[str] = None
    payment_terms: Optional[str] = None
    shipping_term: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    shipping_marks: Optional[str] = None
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None

    # Stamp
    stamp_position: Optional[str] = "bottom-right"

    bank_account_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_name: Optional[str] = None
    bank_address: Optional[str] = None

    discount: Decimal = Decimal("0")
    currency: str = "USD"
    notes: Optional[str] = None
    notes_ar: Optional[str] = None
    branch_id: Optional[int] = None

    items: list[InvoiceItemCreate] = []


class InvoiceUpdate(BaseModel):
    invoice_type: Optional[InvoiceType] = None
    status: Optional[InvoiceStatus] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: Optional[str] = None
    origin: Optional[str] = None
    payment_terms: Optional[str] = None
    shipping_term: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    shipping_marks: Optional[str] = None
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    stamp_position: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_name: Optional[str] = None
    bank_address: Optional[str] = None
    discount: Optional[Decimal] = None
    notes: Optional[str] = None
    notes_ar: Optional[str] = None


class ClientShort(BaseModel):
    id: int
    client_code: str
    name: str
    name_ar: Optional[str]
    company_name: Optional[str]
    company_name_ar: Optional[str]
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    model_config = {"from_attributes": True}



class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    invoice_type: InvoiceType
    status: InvoiceStatus
    client: Optional[ClientShort] = None
    buyer_name: Optional[str] = None
    issue_date: datetime
    due_date: Optional[datetime]
    origin: Optional[str]
    payment_terms: Optional[str]
    shipping_term: Optional[str]
    port_of_loading: Optional[str]
    port_of_discharge: Optional[str]
    shipping_marks: Optional[str]
    container_no: Optional[str]
    seal_no: Optional[str]
    bl_number: Optional[str]
    vessel_name: Optional[str]
    voyage_number: Optional[str]
    bank_account_name: Optional[str]
    bank_account_no: Optional[str]
    bank_swift: Optional[str]
    bank_name: Optional[str]
    bank_address: Optional[str]
    stamp_image_path: Optional[str]
    stamp_position: Optional[str]
    document_background_path: Optional[str]
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    currency: str
    notes: Optional[str]
    notes_ar: Optional[str]
    items: list[InvoiceItemResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[InvoiceResponse]


# ── Company Settings ─────────────────────────────────────────────────────────

class CompanySettingsUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    tagline: Optional[str] = None
    tagline_ar: Optional[str] = None
    address: Optional[str] = None
    address_ar: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_swift: Optional[str] = None
    bank_name: Optional[str] = None
    bank_address: Optional[str] = None


class CompanySettingsResponse(BaseModel):
    id: int
    name: str
    name_ar: Optional[str]
    tagline: Optional[str]
    tagline_ar: Optional[str]
    address: Optional[str]
    address_ar: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    website: Optional[str]
    bank_account_name: Optional[str]
    bank_account_no: Optional[str]
    bank_swift: Optional[str]
    bank_name: Optional[str]
    bank_address: Optional[str]
    logo_path: Optional[str]
    stamp_path: Optional[str]

    model_config = {"from_attributes": True}
