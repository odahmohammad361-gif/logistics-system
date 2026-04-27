from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.customs_calculator import (
    CustomsCalculatorItemInput,
    CustomsCalculatorItemResult,
    CustomsCalculatorRequest,
    CustomsCalculatorResponse,
    CustomsCalculatorTotals,
)

router = APIRouter()

ZERO = Decimal("0")
MONEY = Decimal("0.01")
QTY = Decimal("0.001")


def _d(value, default: Decimal = ZERO) -> Decimal:
    if value is None or value == "":
        return default
    return Decimal(str(value))


def _q(value: Decimal, places: Decimal = MONEY) -> Decimal:
    return value.quantize(places, rounding=ROUND_HALF_UP)


def _first_decimal(*values, default: Decimal = ZERO) -> Decimal:
    for value in values:
        if value is not None and value != "":
            return _d(value)
    return default


def _resolve_units(unit_basis: str, total_pieces: Decimal, cartons: Decimal, gross_weight_kg: Decimal) -> Decimal:
    basis = unit_basis.lower()
    if basis == "dozen":
        return total_pieces / Decimal("12") if total_pieces else ZERO
    if basis == "piece":
        return total_pieces
    if basis == "kg":
        return gross_weight_kg
    if basis == "carton":
        return cartons
    return total_pieces / Decimal("12") if total_pieces else ZERO


def _calculate_item(row: CustomsCalculatorItemInput, product: Product | None) -> CustomsCalculatorItemResult:
    unit_basis = (row.unit_basis or (product.customs_unit_basis if product else None) or "dozen").lower()
    cartons = _first_decimal(row.cartons)
    pieces_per_carton = _first_decimal(row.pieces_per_carton, product.pcs_per_carton if product else None)
    total_pieces = _first_decimal(row.quantity_pieces)
    if not total_pieces and cartons and pieces_per_carton:
        total_pieces = cartons * pieces_per_carton

    gross_weight_kg = _first_decimal(row.gross_weight_kg)
    units = _resolve_units(unit_basis, total_pieces, cartons, gross_weight_kg)

    estimated_value = _first_decimal(
        row.estimated_value_usd,
        product.customs_estimated_value_usd if product else None,
        product.price_usd if product else None,
    )

    shipping_total = _first_decimal(row.shipping_cost_total_usd)
    shipping_per_unit = _first_decimal(row.shipping_cost_per_unit_usd)
    if shipping_total and units:
        shipping_per_unit = shipping_total / units
    elif shipping_per_unit and units:
        shipping_total = shipping_per_unit * units

    product_value = estimated_value * units
    customs_base = product_value + shipping_total

    duty_pct = _first_decimal(row.customs_duty_pct, product.customs_duty_pct if product else None)
    sales_pct = _first_decimal(row.sales_tax_pct, product.sales_tax_pct if product else None)
    other_pct = _first_decimal(row.other_tax_pct, product.other_tax_pct if product else None)

    duty = customs_base * duty_pct / Decimal("100")
    sales = customs_base * sales_pct / Decimal("100")
    other = customs_base * other_pct / Decimal("100")
    taxes = duty + sales + other
    landed = customs_base + taxes

    warnings: list[str] = []
    if not product and row.product_id:
        warnings.append("Product not found; manual values were used.")
    if not units:
        warnings.append("No customs units calculated. Add pieces, cartons, or kg.")
    if not estimated_value:
        warnings.append("Estimated customs value is missing.")
    if not (duty_pct or sales_pct or other_pct):
        warnings.append("Tax percentages are all zero.")

    description = (
        row.description
        or (product.name if product else None)
        or row.customs_category
        or "Manual item"
    )

    return CustomsCalculatorItemResult(
        product_id=row.product_id,
        description=description,
        description_ar=row.description_ar or (product.name_ar if product else None),
        hs_code=row.hs_code or (product.hs_code if product else None),
        customs_category=row.customs_category or (product.customs_category if product else None),
        unit_basis=unit_basis,
        cartons=_q(cartons, QTY),
        pieces_per_carton=_q(pieces_per_carton, QTY),
        total_pieces=_q(total_pieces, QTY),
        gross_weight_kg=_q(gross_weight_kg, QTY),
        customs_units=_q(units, QTY),
        estimated_value_per_unit_usd=_q(estimated_value),
        shipping_cost_per_unit_usd=_q(shipping_per_unit),
        shipping_cost_total_usd=_q(shipping_total),
        product_value_usd=_q(product_value),
        customs_base_usd=_q(customs_base),
        customs_duty_pct=_q(duty_pct),
        sales_tax_pct=_q(sales_pct),
        other_tax_pct=_q(other_pct),
        total_tax_pct=_q(duty_pct + sales_pct + other_pct),
        customs_duty_usd=_q(duty),
        sales_tax_usd=_q(sales),
        other_tax_usd=_q(other),
        total_taxes_usd=_q(taxes),
        landed_estimate_usd=_q(landed),
        warnings=warnings,
    )


@router.post("/calculate", response_model=CustomsCalculatorResponse)
def calculate_customs(
    payload: CustomsCalculatorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product_ids = [item.product_id for item in payload.items if item.product_id]
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.id.in_(product_ids)).all()
    } if product_ids else {}

    items = [
        _calculate_item(item, products.get(item.product_id) if item.product_id else None)
        for item in payload.items
    ]

    totals = CustomsCalculatorTotals(
        product_value_usd=_q(sum((i.product_value_usd for i in items), ZERO)),
        shipping_cost_usd=_q(sum((i.shipping_cost_total_usd for i in items), ZERO)),
        customs_base_usd=_q(sum((i.customs_base_usd for i in items), ZERO)),
        customs_duty_usd=_q(sum((i.customs_duty_usd for i in items), ZERO)),
        sales_tax_usd=_q(sum((i.sales_tax_usd for i in items), ZERO)),
        other_tax_usd=_q(sum((i.other_tax_usd for i in items), ZERO)),
        total_taxes_usd=_q(sum((i.total_taxes_usd for i in items), ZERO)),
        landed_estimate_usd=_q(sum((i.landed_estimate_usd for i in items), ZERO)),
    )
    return CustomsCalculatorResponse(
        country=payload.country,
        currency=payload.currency,
        items=items,
        totals=totals,
    )
