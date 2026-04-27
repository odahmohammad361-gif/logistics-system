from __future__ import annotations

from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CustomsCalculatorItemInput(BaseModel):
    product_id: Optional[int] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    hs_code: Optional[str] = None
    customs_category: Optional[str] = None
    unit_basis: Optional[str] = None
    cartons: Optional[Decimal] = None
    pieces_per_carton: Optional[Decimal] = None
    quantity_pieces: Optional[Decimal] = None
    gross_weight_kg: Optional[Decimal] = None
    estimated_value_usd: Optional[Decimal] = None
    shipping_cost_per_unit_usd: Optional[Decimal] = None
    shipping_cost_total_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    notes: Optional[str] = None


class CustomsCalculatorRequest(BaseModel):
    country: str = "Jordan"
    currency: str = "USD"
    items: list[CustomsCalculatorItemInput]


class CustomsCalculatorItemResult(BaseModel):
    product_id: Optional[int] = None
    description: str
    description_ar: Optional[str] = None
    hs_code: Optional[str] = None
    customs_category: Optional[str] = None
    unit_basis: str
    cartons: Decimal
    pieces_per_carton: Decimal
    total_pieces: Decimal
    gross_weight_kg: Decimal
    customs_units: Decimal
    estimated_value_per_unit_usd: Decimal
    shipping_cost_per_unit_usd: Decimal
    shipping_cost_total_usd: Decimal
    product_value_usd: Decimal
    customs_base_usd: Decimal
    customs_duty_pct: Decimal
    sales_tax_pct: Decimal
    other_tax_pct: Decimal
    total_tax_pct: Decimal
    customs_duty_usd: Decimal
    sales_tax_usd: Decimal
    other_tax_usd: Decimal
    total_taxes_usd: Decimal
    landed_estimate_usd: Decimal
    warnings: list[str] = []


class CustomsCalculatorTotals(BaseModel):
    product_value_usd: Decimal
    shipping_cost_usd: Decimal
    customs_base_usd: Decimal
    customs_duty_usd: Decimal
    sales_tax_usd: Decimal
    other_tax_usd: Decimal
    total_taxes_usd: Decimal
    landed_estimate_usd: Decimal


class CustomsCalculatorResponse(BaseModel):
    country: str
    currency: str
    items: list[CustomsCalculatorItemResult]
    totals: CustomsCalculatorTotals


class CustomsEstimateCreate(CustomsCalculatorRequest):
    title: Optional[str] = None
    notes: Optional[str] = None
    client_id: Optional[int] = None
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    booking_cargo_line_id: Optional[int] = None


class CustomsEstimateLineResponse(CustomsCalculatorItemResult):
    id: int
    sort_order: int

    model_config = {"from_attributes": True}


class CustomsEstimateClientShort(BaseModel):
    id: int
    client_code: str
    name: str
    name_ar: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomsEstimateInvoiceShort(BaseModel):
    id: int
    invoice_number: str
    invoice_type: str
    total: Decimal
    currency: str

    model_config = {"from_attributes": True}


class CustomsEstimateBookingShort(BaseModel):
    id: int
    booking_number: str
    mode: str
    container_size: Optional[str] = None
    container_no: Optional[str] = None

    model_config = {"from_attributes": True}


class CustomsEstimateCargoLineShort(BaseModel):
    id: int
    booking_id: int
    client_id: int
    client_code: Optional[str] = None
    client_name: Optional[str] = None
    cartons: Optional[Decimal] = None
    cbm: Optional[Decimal] = None


class CustomsEstimateResponse(BaseModel):
    id: int
    estimate_number: str
    title: Optional[str] = None
    country: str
    currency: str
    status: str
    notes: Optional[str] = None
    client_id: Optional[int] = None
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    booking_cargo_line_id: Optional[int] = None
    client: Optional[CustomsEstimateClientShort] = None
    invoice: Optional[CustomsEstimateInvoiceShort] = None
    booking: Optional[CustomsEstimateBookingShort] = None
    cargo_line: Optional[CustomsEstimateCargoLineShort] = None
    product_value_usd: Decimal
    shipping_cost_usd: Decimal
    customs_base_usd: Decimal
    customs_duty_usd: Decimal
    sales_tax_usd: Decimal
    other_tax_usd: Decimal
    total_taxes_usd: Decimal
    landed_estimate_usd: Decimal
    created_at: datetime
    updated_at: datetime
    lines: list[CustomsEstimateLineResponse] = []

    model_config = {"from_attributes": True}


class CustomsEstimateListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[CustomsEstimateResponse]
