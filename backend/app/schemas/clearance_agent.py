from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


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

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        # Compute total fixed fees
        fees = [
            obj.clearance_fee, obj.service_fee,
            obj.transport_fee, obj.handling_fee,
        ]
        total = sum(Decimal(str(f)) for f in fees if f is not None)
        instance.total_fixed_fees = total if total > 0 else None
        return instance


class ClearanceAgentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ClearanceAgentResponse]
