"""
Reference data API: ports, container limits, shipping/payment terms.
These are static lookup values used to populate dropdowns in the frontend.
"""
from fastapi import APIRouter
from app.utils.constants import PORTS, CONTAINER_LIMITS, SHIPPING_TERMS, PAYMENT_TERMS, STAMP_POSITIONS

router = APIRouter()


@router.get("/ports")
def get_ports():
    """Return known ports and airports grouped by country and mode (sea/air)."""
    return {"ports": PORTS}


@router.get("/container-limits")
def get_container_limits():
    """Return max weight (tons) and CBM limits per container type."""
    return {"limits": CONTAINER_LIMITS}


@router.get("/shipping-terms")
def get_shipping_terms():
    return {"shipping_terms": SHIPPING_TERMS}


@router.get("/payment-terms")
def get_payment_terms():
    return {"payment_terms": PAYMENT_TERMS}


@router.get("/stamp-positions")
def get_stamp_positions():
    return {"stamp_positions": STAMP_POSITIONS}
