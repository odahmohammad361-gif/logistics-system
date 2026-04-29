from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from app.schemas.contact_validators import clean_optional_phone


class WarehouseCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    warehouse_type: str = "loading"   # "loading" | "unloading"
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[int] = None

    @field_validator("phone", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    warehouse_type: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    branch_id: Optional[int] = None

    @field_validator("phone", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)


class WarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    name_ar: Optional[str] = None
    warehouse_type: str
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    branch_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class WarehouseListResponse(BaseModel):
    total: int
    results: list[WarehouseResponse]
