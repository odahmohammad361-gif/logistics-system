from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class ShopOrderItemCreate(BaseModel):
    product_id: int
    cartons: Decimal = Field(gt=0)
    notes: Optional[str] = None


class ShopOrderCreate(BaseModel):
    destination: str
    notes: Optional[str] = None
    items: list[ShopOrderItemCreate] = Field(min_length=1)


class ShopOrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int]
    product_code: Optional[str]
    product_name: str
    product_name_ar: Optional[str]
    hs_code: Optional[str]
    cartons: Decimal
    pcs_per_carton: Optional[Decimal]
    quantity: Decimal
    unit_price_usd: Decimal
    total_price_usd: Decimal
    cbm: Optional[Decimal]
    gross_weight_kg: Optional[Decimal]
    net_weight_kg: Optional[Decimal]
    notes: Optional[str]
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ShopOrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int
    client_id: Optional[int]
    invoice_package_id: Optional[int]
    invoice_package_number: Optional[str] = None
    status: str
    destination: Optional[str]
    currency: str
    subtotal_usd: Decimal
    total_cartons: Decimal
    total_pieces: Decimal
    total_cbm: Decimal
    total_gross_weight_kg: Optional[Decimal]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    items: list[ShopOrderItemResponse] = []

    model_config = {"from_attributes": True}


class ShopOrderListResponse(BaseModel):
    total: int
    results: list[ShopOrderResponse]
