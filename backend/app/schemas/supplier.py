from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SupplierCreate(BaseModel):
    code: str
    name: str
    name_ar: Optional[str] = None
    market_location: Optional[str] = None
    wechat_id: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    market_location: Optional[str] = None
    wechat_id: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    name_ar: Optional[str] = None
    market_location: Optional[str] = None
    wechat_id: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime


class SupplierListResponse(BaseModel):
    total: int
    results: list[SupplierResponse]
