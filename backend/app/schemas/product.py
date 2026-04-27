from __future__ import annotations
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ProductPhotoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    file_path: str
    is_main: bool
    sort_order: int


class SupplierShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    market_location: Optional[str] = None


class ProductCreate(BaseModel):
    code: str
    name: str
    name_ar: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    supplier_id: Optional[int] = None
    price_cny: Decimal
    price_usd: Optional[Decimal] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    customs_category: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    customs_notes: Optional[str] = None
    pcs_per_carton: int = 250
    cbm_per_carton: Decimal = Decimal("0.20")
    min_order_cartons: int = 1
    gross_weight_kg_per_carton: Optional[Decimal] = None
    net_weight_kg_per_carton: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    is_active: bool = True
    is_featured: bool = False


class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    supplier_id: Optional[int] = None
    price_cny: Optional[Decimal] = None
    price_usd: Optional[Decimal] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    customs_category: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    customs_notes: Optional[str] = None
    pcs_per_carton: Optional[int] = None
    cbm_per_carton: Optional[Decimal] = None
    min_order_cartons: Optional[int] = None
    gross_weight_kg_per_carton: Optional[Decimal] = None
    net_weight_kg_per_carton: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    name_ar: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    supplier: Optional[SupplierShort] = None
    price_cny: Decimal
    price_usd: Optional[Decimal] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    customs_category: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    customs_notes: Optional[str] = None
    pcs_per_carton: int
    cbm_per_carton: Decimal
    min_order_cartons: int
    gross_weight_kg_per_carton: Optional[Decimal] = None
    net_weight_kg_per_carton: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    is_active: bool
    is_featured: bool
    photos: list[ProductPhotoResponse] = []
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ProductResponse]
