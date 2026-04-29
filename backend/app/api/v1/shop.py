"""
Public shop API — no admin auth required.
Customer signup / login / profile + shipping calculator.
"""
import secrets
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from jose import jwt

from app.database import get_db
from app.config import settings
from app.core.security import hash_password, verify_password
from app.models.customer import Customer
from app.models.client import Client
from app.models.shipping_quote import ShippingQuote
from app.models.clearance_agent import ClearanceAgent
from app.models.market_rate import MarketRate
from app.models.product import Product
from app.models.shop_order import ShopOrder, ShopOrderItem
from app.schemas.customer import CustomerSignup, CustomerLogin, CustomerResponse, CustomerTokenResponse
from app.schemas.shop_order import ShopOrderCreate, ShopOrderListResponse, ShopOrderResponse

router = APIRouter()

# Container CBM capacities
CONTAINER_CBM = {
    "20GP": 25.0,
    "40GP": 55.0,
    "40HQ": 76.0,
}

# Jordan / Iraq discharge port keywords to match quotes
DESTINATION_PORTS = {
    "jordan": ["aqaba", "jordan"],
    "iraq":   ["umm qasr", "iraq", "basra"],
}


def _make_customer_token(customer_id: int) -> str:
    return jwt.encode(
        {"sub": str(customer_id), "type": "customer"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def _get_customer_from_token(token: str, db: Session) -> Customer:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "customer":
            raise HTTPException(401, "Invalid token")
        customer = db.query(Customer).filter(Customer.id == int(payload["sub"])).first()
        if not customer or not customer.is_active:
            raise HTTPException(401, "Customer not found")
        return customer
    except Exception:
        raise HTTPException(401, "Invalid token")


def _d(value, default: Decimal = Decimal("0")) -> Decimal:
    if value is None or value == "":
        return default
    return Decimal(str(value))


def _generate_order_number(db: Session) -> str:
    from datetime import date

    year = date.today().year
    pattern = f"SHOP-{year}-%"
    count = db.query(ShopOrder).filter(ShopOrder.order_number.like(pattern)).count()
    return f"SHOP-{year}-{count + 1:04d}"


def _customer_client(db: Session, customer: Customer) -> Client | None:
    return db.query(Client).filter(
        Client.email == customer.email,
        Client.is_active == True,  # noqa: E712
    ).first()


def _serialize_order(order: ShopOrder) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "client_id": order.client_id,
        "status": order.status,
        "destination": order.destination,
        "currency": order.currency,
        "subtotal_usd": order.subtotal_usd,
        "total_cartons": order.total_cartons,
        "total_pieces": order.total_pieces,
        "total_cbm": order.total_cbm,
        "total_gross_weight_kg": order.total_gross_weight_kg,
        "notes": order.notes,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "items": order.items,
    }


def _build_shop_order_item(order_id: int, product: Product, cartons: Decimal, sort_order: int, notes: str | None) -> ShopOrderItem:
    pcs_per_carton = _d(product.pcs_per_carton)
    quantity = (cartons * pcs_per_carton).quantize(Decimal("0.001"))
    unit_price = _d(product.price_usd)
    total_price = (quantity * unit_price).quantize(Decimal("0.01"))
    cbm = (cartons * _d(product.cbm_per_carton)).quantize(Decimal("0.0001"))
    gross = None
    if product.gross_weight_kg_per_carton is not None:
        gross = (cartons * _d(product.gross_weight_kg_per_carton)).quantize(Decimal("0.001"))
    net = None
    if product.net_weight_kg_per_carton is not None:
        net = (cartons * _d(product.net_weight_kg_per_carton)).quantize(Decimal("0.001"))

    return ShopOrderItem(
        order_id=order_id,
        product_id=product.id,
        product_code=product.code,
        product_name=product.name,
        product_name_ar=product.name_ar,
        hs_code=product.hs_code_ref.hs_code if product.hs_code_ref else product.hs_code,
        cartons=cartons,
        pcs_per_carton=pcs_per_carton,
        quantity=quantity,
        unit_price_usd=unit_price,
        total_price_usd=total_price,
        cbm=cbm,
        gross_weight_kg=gross,
        net_weight_kg=net,
        notes=notes,
        sort_order=sort_order,
    )


# ── Customer auth ──────────────────────────────────────────────────────────────

@router.post("/signup", response_model=CustomerTokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: CustomerSignup, db: Session = Depends(get_db)):
    if db.query(Customer).filter(Customer.email == payload.email).first():
        raise HTTPException(400, "Email already registered")

    verification_token = secrets.token_urlsafe(32)
    customer = Customer(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        telegram=payload.telegram,
        country=payload.country,
        hashed_password=hash_password(payload.password),
        verification_token=verification_token,
        is_verified=False,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    # TODO: send verification email when SMTP is configured
    # For now account works immediately (is_verified can be checked later)

    token = _make_customer_token(customer.id)
    return {"access_token": token, "customer": customer}


@router.post("/login", response_model=CustomerTokenResponse)
def login(payload: CustomerLogin, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.email == payload.email).first()
    if not customer or not verify_password(payload.password, customer.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    if not customer.is_active:
        raise HTTPException(403, "Account disabled")
    token = _make_customer_token(customer.id)
    return {"access_token": token, "customer": customer}


@router.get("/me", response_model=CustomerResponse)
def get_me(
    token: str = Query(..., description="Customer JWT token"),
    db: Session = Depends(get_db),
):
    customer = _get_customer_from_token(token, db)
    return customer


# ── Shop orders ───────────────────────────────────────────────────────────────

@router.post("/orders", response_model=ShopOrderResponse, status_code=status.HTTP_201_CREATED)
def create_shop_order(
    payload: ShopOrderCreate,
    token: str = Query(..., description="Customer JWT token"),
    db: Session = Depends(get_db),
):
    customer = _get_customer_from_token(token, db)
    destination = payload.destination.strip().lower()
    if destination not in DESTINATION_PORTS:
        raise HTTPException(400, "Destination must be 'jordan' or 'iraq'")

    client = _customer_client(db, customer)
    order = ShopOrder(
        order_number=_generate_order_number(db),
        customer_id=customer.id,
        client_id=client.id if client else None,
        status="submitted",
        destination=destination,
        currency="USD",
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    subtotal = Decimal("0")
    total_cartons = Decimal("0")
    total_pieces = Decimal("0")
    total_cbm = Decimal("0")
    total_gross = Decimal("0")
    gross_seen = False

    for idx, row in enumerate(payload.items):
        product = db.query(Product).filter(Product.id == row.product_id, Product.is_active == True).first()  # noqa: E712
        if not product:
            raise HTTPException(404, f"Product {row.product_id} not found")
        if row.cartons < _d(product.min_order_cartons):
            raise HTTPException(400, f"{product.name} minimum order is {product.min_order_cartons} cartons")
        item = _build_shop_order_item(order.id, product, _d(row.cartons), idx, row.notes)
        db.add(item)
        subtotal += _d(item.total_price_usd)
        total_cartons += _d(item.cartons)
        total_pieces += _d(item.quantity)
        total_cbm += _d(item.cbm)
        if item.gross_weight_kg is not None:
            total_gross += _d(item.gross_weight_kg)
            gross_seen = True

    order.subtotal_usd = subtotal.quantize(Decimal("0.01"))
    order.total_cartons = total_cartons.quantize(Decimal("0.001"))
    order.total_pieces = total_pieces.quantize(Decimal("0.001"))
    order.total_cbm = total_cbm.quantize(Decimal("0.0001"))
    order.total_gross_weight_kg = total_gross.quantize(Decimal("0.001")) if gross_seen else None
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.get("/orders", response_model=ShopOrderListResponse)
def list_shop_orders(
    token: str = Query(..., description="Customer JWT token"),
    db: Session = Depends(get_db),
):
    customer = _get_customer_from_token(token, db)
    rows = db.query(ShopOrder).filter(ShopOrder.customer_id == customer.id).order_by(ShopOrder.id.desc()).all()
    return {"total": len(rows), "results": [_serialize_order(row) for row in rows]}


@router.get("/orders/{order_id}", response_model=ShopOrderResponse)
def get_shop_order(
    order_id: int,
    token: str = Query(..., description="Customer JWT token"),
    db: Session = Depends(get_db),
):
    customer = _get_customer_from_token(token, db)
    order = db.query(ShopOrder).filter(
        ShopOrder.id == order_id,
        ShopOrder.customer_id == customer.id,
    ).first()
    if not order:
        raise HTTPException(404, "Shop order not found")
    return _serialize_order(order)


# ── Shipping calculator ────────────────────────────────────────────────────────

@router.get("/calculate-shipping")
def calculate_shipping(
    total_cbm: float = Query(..., gt=0, description="Total CBM of the order"),
    destination: str = Query(..., description="jordan or iraq"),
    db: Session = Depends(get_db),
):
    destination = destination.lower()
    if destination not in DESTINATION_PORTS:
        raise HTTPException(400, "Destination must be 'jordan' or 'iraq'")

    port_keywords = DESTINATION_PORTS[destination]

    # Get CNY/USD rate from market rates
    cny_rate = db.query(MarketRate).filter(MarketRate.currency == "CNY").order_by(MarketRate.fetched_at.desc()).first()
    usd_to_cny = float(cny_rate.rate) if cny_rate else 7.2  # fallback

    # Find best FCL quotes for this destination
    results = []
    for container_type, capacity_cbm in CONTAINER_CBM.items():
        # How many containers needed
        import math
        containers_needed = math.ceil(total_cbm / capacity_cbm)
        cbm_used_percent = min((total_cbm / (containers_needed * capacity_cbm)) * 100, 100)

        # Find cheapest active FCL quote for this container type + destination
        quote_q = db.query(ShippingQuote).filter(
            ShippingQuote.container_type == container_type,
            ShippingQuote.is_active == True,
        )
        # Filter by destination port
        port_filter = or_(*[
            ShippingQuote.port_of_discharge.ilike(f"%{kw}%")
            for kw in port_keywords
        ])
        quote_q = quote_q.filter(port_filter)
        quote = quote_q.order_by(ShippingQuote.ocean_freight).first()

        if not quote:
            # Try without port filter — use any active quote of this type
            quote = db.query(ShippingQuote).filter(
                ShippingQuote.container_type == container_type,
                ShippingQuote.is_active == True,
            ).order_by(ShippingQuote.ocean_freight).first()

        freight_per_container = float(quote.ocean_freight or 0) if quote else 0
        total_freight_usd = freight_per_container * containers_needed

        # Clearance agent fees for destination
        clearance_q = db.query(ClearanceAgent).filter(ClearanceAgent.is_active == True)
        if destination == "jordan":
            clearance_q = clearance_q.filter(
                or_(ClearanceAgent.country.ilike("%jordan%"), ClearanceAgent.country.ilike("%JO%"))
            )
        else:
            clearance_q = clearance_q.filter(
                or_(ClearanceAgent.country.ilike("%iraq%"), ClearanceAgent.country.ilike("%IQ%"))
            )
        clearance = clearance_q.order_by(ClearanceAgent.clearance_fee).first()

        clearance_fee = 0.0
        if clearance:
            clearance_fee = float(
                (clearance.clearance_fee or 0) +
                (clearance.service_fee or 0) +
                (clearance.transport_fee or 0) +
                (clearance.handling_fee or 0)
            ) * containers_needed

        total_cost_usd = total_freight_usd + clearance_fee
        cost_per_cbm_usd = total_cost_usd / total_cbm if total_cbm > 0 else 0

        results.append({
            "container_type": container_type,
            "capacity_cbm": capacity_cbm,
            "containers_needed": containers_needed,
            "cbm_used_percent": round(cbm_used_percent, 1),
            "freight_per_container_usd": freight_per_container,
            "total_freight_usd": round(total_freight_usd, 2),
            "clearance_fees_usd": round(clearance_fee, 2),
            "total_cost_usd": round(total_cost_usd, 2),
            "cost_per_cbm_usd": round(cost_per_cbm_usd, 2),
            "agent_name": quote.agent.name if quote and quote.agent else None,
            "clearance_agent": clearance.name if clearance else None,
            "transit_days": quote.transit_days if quote else None,
        })

    return {
        "destination": destination,
        "total_cbm": total_cbm,
        "usd_to_cny_rate": usd_to_cny,
        "options": results,
    }


# ── Public rates endpoint ──────────────────────────────────────────────────────

@router.get("/rates")
def get_rates(db: Session = Depends(get_db)):
    """Return latest USD-based market rates for currency conversion in the shop."""
    from app.api.v1.market import _get_cached_rates
    from app.utils.currency import FALLBACK_RATES
    rates, fetched_at = _get_cached_rates(db)
    if not rates:
        rates = FALLBACK_RATES.copy()
    rates["USD"] = 1.0
    return {
        "rates": rates,
        "fetched_at": fetched_at.isoformat() if fetched_at else None,
    }
