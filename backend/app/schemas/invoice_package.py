from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.invoice import ClientShort


class InvoicePackageItemBase(BaseModel):
    product_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    description: str
    description_ar: Optional[str] = None
    details: Optional[str] = None
    details_ar: Optional[str] = None
    product_image_path: Optional[str] = None
    hs_code: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_unit_quantity: Optional[Decimal] = None
    quantity: Decimal = Decimal("0")
    unit: Optional[str] = None
    unit_price: Decimal = Decimal("0")
    cartons: Optional[Decimal] = None
    pcs_per_carton: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None
    net_weight: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    source_product_snapshot_json: Optional[str] = None
    sort_order: int = 0


class InvoicePackageItemCreate(InvoicePackageItemBase):
    pass


class InvoicePackageItemUpdate(BaseModel):
    product_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    details: Optional[str] = None
    details_ar: Optional[str] = None
    product_image_path: Optional[str] = None
    hs_code: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_unit_quantity: Optional[Decimal] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    cartons: Optional[Decimal] = None
    pcs_per_carton: Optional[Decimal] = None
    gross_weight: Optional[Decimal] = None
    net_weight: Optional[Decimal] = None
    cbm: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    source_product_snapshot_json: Optional[str] = None
    sort_order: Optional[int] = None


class InvoicePackageItemResponse(InvoicePackageItemBase):
    id: int
    total_price: Decimal
    volumetric_weight_kg: Optional[Decimal]
    chargeable_weight_kg: Optional[Decimal]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceDocumentCreate(BaseModel):
    document_type: str
    language: str = "en"
    status: str = "draft"
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class InvoiceDocumentResponse(BaseModel):
    id: int
    package_id: int
    legacy_invoice_id: Optional[int]
    document_type: str
    document_number: str
    language: str
    status: str
    issue_date: Optional[date]
    due_date: Optional[date]
    pdf_path: Optional[str]
    notes: Optional[str]
    created_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceFileResponse(BaseModel):
    id: int
    package_id: int
    document_id: Optional[int]
    document_type: str
    custom_file_type: Optional[str]
    file_path: str
    original_filename: Optional[str]
    content_type: Optional[str]
    file_size: Optional[int]
    extraction_status: str
    extraction_json: Optional[str]
    uploaded_by_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceActivityLogResponse(BaseModel):
    id: int
    package_id: int
    action: str
    summary: Optional[str]
    changed_by_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoicePackageBase(BaseModel):
    source_type: str = "manual"
    status: str = "draft"
    title: Optional[str] = None
    client_id: Optional[int] = None
    buyer_name: Optional[str] = None
    booking_id: Optional[int] = None
    booking_cargo_line_id: Optional[int] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    shipping_term: Optional[str] = None
    payment_terms: Optional[str] = None
    shipping_marks: Optional[str] = None
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    awb_number: Optional[str] = None
    flight_number: Optional[str] = None
    currency: str = "USD"
    discount: Decimal = Decimal("0")
    notes: Optional[str] = None
    notes_ar: Optional[str] = None
    branch_id: Optional[int] = None


class InvoicePackageCreate(InvoicePackageBase):
    items: list[InvoicePackageItemCreate] = Field(default_factory=list)


class InvoicePackageUpdate(BaseModel):
    source_type: Optional[str] = None
    status: Optional[str] = None
    title: Optional[str] = None
    client_id: Optional[int] = None
    buyer_name: Optional[str] = None
    booking_id: Optional[int] = None
    booking_cargo_line_id: Optional[int] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    shipping_term: Optional[str] = None
    payment_terms: Optional[str] = None
    shipping_marks: Optional[str] = None
    container_no: Optional[str] = None
    seal_no: Optional[str] = None
    bl_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    awb_number: Optional[str] = None
    flight_number: Optional[str] = None
    currency: Optional[str] = None
    discount: Optional[Decimal] = None
    notes: Optional[str] = None
    notes_ar: Optional[str] = None
    branch_id: Optional[int] = None


class InvoicePackageResponse(InvoicePackageBase):
    id: int
    package_number: str
    client: Optional[ClientShort]
    subtotal: Decimal
    total: Decimal
    is_active: bool
    created_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    items: list[InvoicePackageItemResponse] = Field(default_factory=list)
    documents: list[InvoiceDocumentResponse] = Field(default_factory=list)
    files: list[InvoiceFileResponse] = Field(default_factory=list)
    activity_log: list[InvoiceActivityLogResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class InvoicePackageListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[InvoicePackageResponse]
