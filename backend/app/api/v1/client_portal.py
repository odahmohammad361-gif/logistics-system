"""
Client portal — main clients (admin-added) can log in with their client code + password
to view their profile, invoices, and container shipments.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt

from app.config import settings
from app.core.security import verify_password
from app.database import get_db
from app.models.client import Client
from app.models.booking import Booking, BookingCargoLine
from app.models.invoice import Invoice

router = APIRouter()


# ── Auth helpers ───────────────────────────────────────────────────────────────

class ClientLoginRequest(BaseModel):
    client_code: str
    password: str


def _make_token(client_id: int) -> str:
    return jwt.encode(
        {"sub": str(client_id), "type": "client"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def _get_client(token: str, db: Session) -> Client:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "client":
            raise HTTPException(401, "Invalid token")
        c = db.query(Client).filter(Client.id == int(payload["sub"]), Client.is_active == True).first()
        if not c:
            raise HTTPException(401, "Client not found")
        return c
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Invalid token")


def _serialize_client(c: Client) -> dict:
    return {
        "id":              c.id,
        "name":            c.name,
        "name_ar":         c.name_ar,
        "client_code":     c.client_code,
        "email":           c.email,
        "phone":           c.phone,
        "country":         c.country,
        "city":            c.city,
        "address":         c.address,
        "company_name":    c.company_name,
        "company_name_ar": c.company_name_ar,
        "branch":          {"id": c.branch.id, "name": c.branch.name, "name_ar": c.branch.name_ar, "code": c.branch.code} if c.branch else None,
        "has_portal_access": c.portal_password_hash is not None,
    }


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(payload: ClientLoginRequest, db: Session = Depends(get_db)):
    c = db.query(Client).filter(
        Client.client_code == payload.client_code.strip().upper(),
        Client.is_active == True,
    ).first()
    if not c or not c.portal_password_hash:
        raise HTTPException(401, "Invalid client code or password")
    if not verify_password(payload.password, c.portal_password_hash):
        raise HTTPException(401, "Invalid client code or password")

    return {"access_token": _make_token(c.id), "client": _serialize_client(c)}


# ── Me ─────────────────────────────────────────────────────────────────────────

@router.get("/me")
def get_me(token: str = Query(...), db: Session = Depends(get_db)):
    return _serialize_client(_get_client(token, db))


# ── Invoices ───────────────────────────────────────────────────────────────────

@router.get("/invoices")
def get_invoices(token: str = Query(...), db: Session = Depends(get_db)):
    c = _get_client(token, db)
    rows = (
        db.query(Invoice)
        .filter(Invoice.client_id == c.id)
        .order_by(Invoice.issue_date.desc())
        .all()
    )
    return {"results": [_serialize_invoice(inv) for inv in rows]}


def _serialize_invoice(inv: Invoice) -> dict:
    return {
        "id":             inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_type":   inv.invoice_type,
        "status":         inv.status,
        "issue_date":     inv.issue_date.isoformat() if inv.issue_date else None,
        "due_date":       inv.due_date.isoformat()   if inv.due_date   else None,
        "total":          float(inv.total),
        "currency":       inv.currency,
        "port_of_loading":   inv.port_of_loading,
        "port_of_discharge": inv.port_of_discharge,
        "container_no":   inv.container_no,
        "bl_number":      inv.bl_number,
        "vessel_name":    inv.vessel_name,
        "notes":          inv.notes,
    }


# ── Shipments ──────────────────────────────────────────────────────────────────

@router.get("/shipments")
def get_shipments(token: str = Query(...), db: Session = Depends(get_db)):
    c = _get_client(token, db)

    lines = (
        db.query(BookingCargoLine)
        .filter(BookingCargoLine.client_id == c.id)
        .join(BookingCargoLine.booking)
        .order_by(Booking.created_at.desc())
        .all()
    )

    results = []
    for line in lines:
        bk = line.booking
        # Compute total CBM used across all cargo lines in this booking
        total_used = sum(float(cl.cbm or 0) for cl in bk.cargo_lines)
        max_cbm    = float(bk.max_cbm) if bk.max_cbm else None
        my_cbm     = float(line.cbm) if line.cbm else None
        fill_pct   = round((total_used / max_cbm * 100), 1) if max_cbm else None
        my_pct     = round((my_cbm / max_cbm * 100), 1)     if max_cbm and my_cbm else None

        results.append({
            "booking_id":          bk.id,
            "booking_number":      bk.booking_number,
            "mode":                bk.mode,
            "status":              bk.status,
            "container_size":      bk.container_size,
            "carrier_name":        bk.carrier_name,
            "port_of_loading":     bk.port_of_loading,
            "port_of_discharge":   bk.port_of_discharge,
            "etd":                 bk.etd.isoformat() if bk.etd else None,
            "eta":                 bk.eta.isoformat() if bk.eta else None,
            "container_no":        bk.container_no,
            "seal_no":             bk.seal_no,
            "bl_number":           bk.bl_number,
            "vessel_name":         bk.vessel_name,
            "voyage_number":       bk.voyage_number,
            "incoterm":            bk.incoterm,
            # Client's cargo
            "my_cbm":              my_cbm,
            "my_cartons":          line.cartons,
            "my_description":      line.description,
            "my_description_ar":   line.description_ar,
            "my_gross_weight_kg":  float(line.gross_weight_kg) if line.gross_weight_kg else None,
            "my_freight_share":    float(line.freight_share)   if line.freight_share   else None,
            "notes":               line.notes,
            # Container capacity
            "max_cbm":             max_cbm,
            "total_cbm_used":      round(total_used, 3),
            "fill_pct":            fill_pct,
            "my_pct":              my_pct,
        })

    return {"results": results}
