from __future__ import annotations

from decimal import Decimal
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
