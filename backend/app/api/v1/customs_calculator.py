from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.booking import Booking, BookingCargoLine
from app.models.client import Client
from app.models.customs_calculator import CustomsEstimate, CustomsEstimateLine
from app.models.invoice import Invoice
from app.models.product import HSCodeReference, Product
from app.models.user import User, UserRole
from app.schemas.customs_calculator import (
    CustomsCalculatorItemInput,
    CustomsCalculatorItemResult,
    CustomsCalculatorRequest,
    CustomsCalculatorResponse,
    CustomsCalculatorTotals,
    CustomsEstimateCreate,
    CustomsEstimateListResponse,
    CustomsEstimateResponse,
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


def _resolve_units(
    unit_basis: str,
    total_pieces: Decimal,
    cartons: Decimal,
    gross_weight_kg: Decimal,
    unit_quantity: Decimal,
) -> Decimal:
    basis = unit_basis.lower()
    if basis == "dozen":
        divisor = unit_quantity or Decimal("12")
        return total_pieces / divisor if total_pieces else ZERO
    if basis == "piece":
        return total_pieces
    if basis == "kg":
        return gross_weight_kg
    if basis == "carton":
        if cartons:
            return cartons
        return total_pieces / unit_quantity if total_pieces and unit_quantity else ZERO
    divisor = unit_quantity or Decimal("12")
    return total_pieces / divisor if total_pieces else ZERO


def _calculate_item(
    row: CustomsCalculatorItemInput,
    product: Product | None,
    hs_ref: HSCodeReference | None,
) -> CustomsCalculatorItemResult:
    unit_basis = (
        row.unit_basis
        or (hs_ref.customs_unit_basis if hs_ref else None)
        or (product.customs_unit_basis if product else None)
        or "dozen"
    ).lower()
    cartons = _first_decimal(row.cartons)
    pieces_per_carton = _first_decimal(row.pieces_per_carton, product.pcs_per_carton if product else None)
    total_pieces = _first_decimal(row.quantity_pieces)
    if not total_pieces and cartons and pieces_per_carton:
        total_pieces = cartons * pieces_per_carton

    gross_weight_kg = _first_decimal(row.gross_weight_kg)
    unit_quantity = _first_decimal(
        hs_ref.customs_unit_quantity if hs_ref else None,
        Decimal("12") if unit_basis == "dozen" else Decimal("1") if unit_basis == "piece" else None,
    )
    units = _resolve_units(unit_basis, total_pieces, cartons, gross_weight_kg, unit_quantity)

    estimated_value = _first_decimal(
        row.estimated_value_usd,
        hs_ref.customs_estimated_value_usd if hs_ref else None,
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

    duty_pct = _first_decimal(
        row.customs_duty_pct,
        hs_ref.customs_duty_pct if hs_ref else None,
        product.customs_duty_pct if product else None,
    )
    sales_pct = _first_decimal(
        row.sales_tax_pct,
        hs_ref.sales_tax_pct if hs_ref else None,
        product.sales_tax_pct if product else None,
    )
    other_pct = _first_decimal(
        row.other_tax_pct,
        hs_ref.other_tax_pct if hs_ref else None,
        product.other_tax_pct if product else None,
    )

    duty = customs_base * duty_pct / Decimal("100")
    sales = customs_base * sales_pct / Decimal("100")
    other = customs_base * other_pct / Decimal("100")
    taxes = duty + sales + other
    landed = customs_base + taxes

    warnings: list[str] = []
    if not product and row.product_id:
        warnings.append("Product not found; manual values were used.")
    if not product and not hs_ref and row.hs_code:
        warnings.append("No matching HS reference found for this country.")
    if hs_ref and not hs_ref.import_allowed:
        warnings.append("HS reference is marked as not allowed for import.")
    if not units:
        warnings.append("No customs units calculated. Add pieces, cartons, or kg.")
    if not estimated_value:
        warnings.append("Estimated customs value is missing.")
    if not (duty_pct or sales_pct or other_pct):
        warnings.append("Tax percentages are all zero.")

    description = (
        row.description
        or (product.name if product else None)
        or (hs_ref.description if hs_ref else None)
        or row.customs_category
        or "Manual item"
    )

    return CustomsCalculatorItemResult(
        product_id=row.product_id,
        description=description,
        description_ar=row.description_ar or (product.name_ar if product else None) or (hs_ref.description_ar if hs_ref else None),
        hs_code=row.hs_code or (hs_ref.hs_code if hs_ref else None) or (product.hs_code if product else None),
        customs_category=row.customs_category or (hs_ref.description if hs_ref else None) or (product.customs_category if product else None) or (product.category if product else None),
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


def _calculate_payload(payload: CustomsCalculatorRequest, db: Session) -> CustomsCalculatorResponse:
    product_ids = [item.product_id for item in payload.items if item.product_id]
    products = {
        p.id: p
        for p in db.query(Product).filter(Product.id.in_(product_ids)).all()
    } if product_ids else {}

    hs_refs = db.query(HSCodeReference).filter(
        HSCodeReference.country == payload.country,
        HSCodeReference.is_active == True,  # noqa: E712
    ).order_by(HSCodeReference.id).all()
    hs_refs_by_code: dict[str, HSCodeReference] = {}
    for ref in hs_refs:
        hs_refs_by_code.setdefault(ref.hs_code.strip().lower(), ref)

    def match_hs_reference(item: CustomsCalculatorItemInput, product: Product | None) -> HSCodeReference | None:
        hs_code = str(item.hs_code or (product.hs_code if product else "") or "").strip().lower()
        if hs_code and hs_code in hs_refs_by_code:
            return hs_refs_by_code[hs_code]

        product_ref = product.hs_code_ref if product and product.hs_code_ref else None
        if product_ref and product_ref.country == payload.country and product_ref.is_active:
            return product_ref

        text = " ".join(
            str(value or "").strip().lower()
            for value in [item.customs_category, item.description, item.description_ar]
            if value
        )
        if len(text) < 4:
            return None
        for ref in hs_refs:
            candidates = [ref.description, ref.description_ar, ref.hs_code]
            for candidate in candidates:
                candidate_text = str(candidate or "").strip().lower()
                if len(candidate_text) >= 4 and (candidate_text in text or text in candidate_text):
                    return ref
        return None

    items = []
    for item in payload.items:
        product = products.get(item.product_id) if item.product_id else None
        items.append(_calculate_item(item, product, match_hs_reference(item, product)))

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


def _generate_estimate_number(db: Session) -> str:
    year = datetime.utcnow().year
    pattern = f"CUST-{year}-%"
    count = db.query(CustomsEstimate).filter(CustomsEstimate.estimate_number.like(pattern)).count()
    return f"CUST-{year}-{str(count + 1).zfill(5)}"


def _serialize_line(line: CustomsEstimateLine) -> dict:
    warnings = []
    if line.warnings_json:
        try:
            warnings = json.loads(line.warnings_json)
        except json.JSONDecodeError:
            warnings = []
    return {
        "id": line.id,
        "sort_order": line.sort_order,
        "product_id": line.product_id,
        "description": line.description,
        "description_ar": line.description_ar,
        "hs_code": line.hs_code,
        "customs_category": line.customs_category,
        "unit_basis": line.unit_basis,
        "cartons": line.cartons,
        "pieces_per_carton": line.pieces_per_carton,
        "total_pieces": line.total_pieces,
        "gross_weight_kg": line.gross_weight_kg,
        "customs_units": line.customs_units,
        "estimated_value_per_unit_usd": line.estimated_value_per_unit_usd,
        "shipping_cost_per_unit_usd": line.shipping_cost_per_unit_usd,
        "shipping_cost_total_usd": line.shipping_cost_total_usd,
        "product_value_usd": line.product_value_usd,
        "customs_base_usd": line.customs_base_usd,
        "customs_duty_pct": line.customs_duty_pct,
        "sales_tax_pct": line.sales_tax_pct,
        "other_tax_pct": line.other_tax_pct,
        "total_tax_pct": line.total_tax_pct,
        "customs_duty_usd": line.customs_duty_usd,
        "sales_tax_usd": line.sales_tax_usd,
        "other_tax_usd": line.other_tax_usd,
        "total_taxes_usd": line.total_taxes_usd,
        "landed_estimate_usd": line.landed_estimate_usd,
        "warnings": warnings,
    }


def _serialize_estimate(estimate: CustomsEstimate) -> dict:
    cargo_line = estimate.cargo_line
    return {
        "id": estimate.id,
        "estimate_number": estimate.estimate_number,
        "title": estimate.title,
        "country": estimate.country,
        "currency": estimate.currency,
        "status": estimate.status,
        "notes": estimate.notes,
        "client_id": estimate.client_id,
        "invoice_id": estimate.invoice_id,
        "booking_id": estimate.booking_id,
        "booking_cargo_line_id": estimate.booking_cargo_line_id,
        "client": estimate.client,
        "invoice": estimate.invoice,
        "booking": estimate.booking,
        "cargo_line": {
            "id": cargo_line.id,
            "booking_id": cargo_line.booking_id,
            "client_id": cargo_line.client_id,
            "client_code": cargo_line.client.client_code if cargo_line.client else None,
            "client_name": cargo_line.client.name if cargo_line.client else None,
            "cartons": cargo_line.cartons,
            "cbm": cargo_line.cbm,
        } if cargo_line else None,
        "product_value_usd": estimate.product_value_usd,
        "shipping_cost_usd": estimate.shipping_cost_usd,
        "customs_base_usd": estimate.customs_base_usd,
        "customs_duty_usd": estimate.customs_duty_usd,
        "sales_tax_usd": estimate.sales_tax_usd,
        "other_tax_usd": estimate.other_tax_usd,
        "total_taxes_usd": estimate.total_taxes_usd,
        "landed_estimate_usd": estimate.landed_estimate_usd,
        "created_at": estimate.created_at,
        "updated_at": estimate.updated_at,
        "lines": [_serialize_line(line) for line in estimate.lines],
    }


def _get_estimate(db: Session, estimate_id: int) -> CustomsEstimate:
    estimate = db.query(CustomsEstimate).filter(
        CustomsEstimate.id == estimate_id,
        CustomsEstimate.is_archived == False,
    ).first()
    if not estimate:
        raise HTTPException(404, "Customs estimate not found")
    return estimate


def _ensure_linked_records_exist(db: Session, payload: CustomsEstimateCreate) -> BookingCargoLine | None:
    checks = (
        ("client_id", Client, "Client"),
        ("invoice_id", Invoice, "Invoice"),
        ("booking_id", Booking, "Container"),
    )
    for field, model, label in checks:
        value = getattr(payload, field, None)
        if value is None:
            continue
        if not db.query(model).filter(model.id == value).first():
            raise HTTPException(404, f"{label} not found")
    if payload.booking_cargo_line_id is None:
        return None
    cargo_line = db.query(BookingCargoLine).filter(BookingCargoLine.id == payload.booking_cargo_line_id).first()
    if not cargo_line:
        raise HTTPException(404, "Container cargo line not found")
    if payload.booking_id and cargo_line.booking_id != payload.booking_id:
        raise HTTPException(400, "Selected cargo line does not belong to the selected container")
    if payload.client_id and cargo_line.client_id != payload.client_id:
        raise HTTPException(400, "Selected cargo line belongs to a different client")
    if payload.invoice_id and cargo_line.invoice_id and cargo_line.invoice_id != payload.invoice_id:
        raise HTTPException(400, "Selected cargo line is linked to a different invoice")
    if payload.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == payload.invoice_id).first()
        if invoice and invoice.client_id and invoice.client_id != cargo_line.client_id:
            raise HTTPException(400, "Selected invoice belongs to a different cargo-line client")
    return cargo_line


@router.get("/estimates", response_model=CustomsEstimateListResponse)
def list_estimates(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = "",
    country: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CustomsEstimate).filter(CustomsEstimate.is_archived == False)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(CustomsEstimate.estimate_number.ilike(like), CustomsEstimate.title.ilike(like)))
    if country:
        q = q.filter(CustomsEstimate.country == country)
    total = q.count()
    estimates = (
        q.order_by(CustomsEstimate.created_at.desc(), CustomsEstimate.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": [_serialize_estimate(estimate) for estimate in estimates],
    }


@router.post("/estimates", response_model=CustomsEstimateResponse, status_code=status.HTTP_201_CREATED)
def create_estimate(
    payload: CustomsEstimateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    linked_cargo_line = _ensure_linked_records_exist(db, payload)
    result = _calculate_payload(payload, db)
    client_id = payload.client_id or (linked_cargo_line.client_id if linked_cargo_line else None)
    invoice_id = payload.invoice_id or (linked_cargo_line.invoice_id if linked_cargo_line else None)
    booking_id = payload.booking_id or (linked_cargo_line.booking_id if linked_cargo_line else None)
    estimate = CustomsEstimate(
        estimate_number=_generate_estimate_number(db),
        title=payload.title or None,
        country=result.country,
        currency=result.currency,
        status="estimated",
        notes=payload.notes or None,
        client_id=client_id,
        invoice_id=invoice_id,
        booking_id=booking_id,
        booking_cargo_line_id=payload.booking_cargo_line_id,
        product_value_usd=result.totals.product_value_usd,
        shipping_cost_usd=result.totals.shipping_cost_usd,
        customs_base_usd=result.totals.customs_base_usd,
        customs_duty_usd=result.totals.customs_duty_usd,
        sales_tax_usd=result.totals.sales_tax_usd,
        other_tax_usd=result.totals.other_tax_usd,
        total_taxes_usd=result.totals.total_taxes_usd,
        landed_estimate_usd=result.totals.landed_estimate_usd,
        created_by_id=current_user.id,
    )
    db.add(estimate)
    db.flush()

    for index, item in enumerate(result.items):
        db.add(CustomsEstimateLine(
            estimate_id=estimate.id,
            sort_order=index,
            product_id=item.product_id,
            description=item.description,
            description_ar=item.description_ar,
            hs_code=item.hs_code,
            customs_category=item.customs_category,
            unit_basis=item.unit_basis,
            cartons=item.cartons,
            pieces_per_carton=item.pieces_per_carton,
            total_pieces=item.total_pieces,
            gross_weight_kg=item.gross_weight_kg,
            customs_units=item.customs_units,
            estimated_value_per_unit_usd=item.estimated_value_per_unit_usd,
            shipping_cost_per_unit_usd=item.shipping_cost_per_unit_usd,
            shipping_cost_total_usd=item.shipping_cost_total_usd,
            product_value_usd=item.product_value_usd,
            customs_base_usd=item.customs_base_usd,
            customs_duty_pct=item.customs_duty_pct,
            sales_tax_pct=item.sales_tax_pct,
            other_tax_pct=item.other_tax_pct,
            total_tax_pct=item.total_tax_pct,
            customs_duty_usd=item.customs_duty_usd,
            sales_tax_usd=item.sales_tax_usd,
            other_tax_usd=item.other_tax_usd,
            total_taxes_usd=item.total_taxes_usd,
            landed_estimate_usd=item.landed_estimate_usd,
            warnings_json=json.dumps(item.warnings, ensure_ascii=False),
        ))

    db.commit()
    db.refresh(estimate)
    return _serialize_estimate(estimate)


@router.get("/estimates/{estimate_id}", response_model=CustomsEstimateResponse)
def get_estimate(
    estimate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize_estimate(_get_estimate(db, estimate_id))


@router.delete("/estimates/{estimate_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_estimate(
    estimate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    estimate = _get_estimate(db, estimate_id)
    estimate.is_archived = True
    db.commit()


@router.post("/calculate", response_model=CustomsCalculatorResponse)
def calculate_customs(
    payload: CustomsCalculatorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _calculate_payload(payload, db)
