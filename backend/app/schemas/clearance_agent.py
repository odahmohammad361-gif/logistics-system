from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from app.schemas.contact_validators import clean_optional_email, clean_optional_phone


class ClearanceAgentCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    license_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    clearance_fee: Optional[Decimal] = None
    service_fee: Optional[Decimal] = None
    transport_fee: Optional[Decimal] = None
    handling_fee: Optional[Decimal] = None
    storage_fee_per_day: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("phone", "whatsapp", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, v):
        return clean_optional_email(v)


class ClearanceAgentUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    license_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    clearance_fee: Optional[Decimal] = None
    service_fee: Optional[Decimal] = None
    transport_fee: Optional[Decimal] = None
    handling_fee: Optional[Decimal] = None
    storage_fee_per_day: Optional[Decimal] = None
    notes: Optional[str] = None

    @field_validator("phone", "whatsapp", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, v):
        return clean_optional_email(v)


class ClearanceAgentRateBase(BaseModel):
    service_mode: str = "sea"
    country: Optional[str] = None
    port: Optional[str] = None
    route: Optional[str] = None
    container_size: Optional[str] = None
    carrier_name: Optional[str] = None
    buy_clearance_fee: Optional[Decimal] = None
    sell_clearance_fee: Optional[Decimal] = None
    buy_transportation: Optional[Decimal] = None
    sell_transportation: Optional[Decimal] = None
    buy_delivery_authorization: Optional[Decimal] = None
    sell_delivery_authorization: Optional[Decimal] = None
    buy_inspection_ramp: Optional[Decimal] = None
    sell_inspection_ramp: Optional[Decimal] = None
    buy_port_inspection: Optional[Decimal] = None
    sell_port_inspection: Optional[Decimal] = None
    buy_import_export_card_pct: Optional[Decimal] = None
    sell_import_export_card_pct: Optional[Decimal] = None
    notes: Optional[str] = None


class ClearanceAgentRateCreate(ClearanceAgentRateBase):
    pass


class ClearanceAgentRateUpdate(BaseModel):
    service_mode: Optional[str] = None
    country: Optional[str] = None
    port: Optional[str] = None
    route: Optional[str] = None
    container_size: Optional[str] = None
    carrier_name: Optional[str] = None
    buy_clearance_fee: Optional[Decimal] = None
    sell_clearance_fee: Optional[Decimal] = None
    buy_transportation: Optional[Decimal] = None
    sell_transportation: Optional[Decimal] = None
    buy_delivery_authorization: Optional[Decimal] = None
    sell_delivery_authorization: Optional[Decimal] = None
    buy_inspection_ramp: Optional[Decimal] = None
    sell_inspection_ramp: Optional[Decimal] = None
    buy_port_inspection: Optional[Decimal] = None
    sell_port_inspection: Optional[Decimal] = None
    buy_import_export_card_pct: Optional[Decimal] = None
    sell_import_export_card_pct: Optional[Decimal] = None
    notes: Optional[str] = None


class ClearanceAgentRateResponse(ClearanceAgentRateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ClearanceAgentEditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    summary: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime


class ClearanceAgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    name_ar: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    license_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    clearance_fee: Optional[Decimal] = None
    service_fee: Optional[Decimal] = None
    transport_fee: Optional[Decimal] = None
    handling_fee: Optional[Decimal] = None
    storage_fee_per_day: Optional[Decimal] = None
    # Computed: total per-shipment fees (excludes storage, which is variable)
    total_fixed_fees: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    rates: list[ClearanceAgentRateResponse] = []
    edit_log: list[ClearanceAgentEditLogResponse] = []


class ClearanceAgentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ClearanceAgentResponse]
