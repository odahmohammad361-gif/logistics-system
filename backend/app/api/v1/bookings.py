import os
import re
import uuid
import json
import shutil
import zipfile
import subprocess
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask
from PIL import Image
import pytesseract

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.booking import Booking, BookingCargoLine, BookingCargoImage, BookingCargoDocument, BookingLoadingPhoto, CONTAINER_CBM
from app.models.company_warehouse import CompanyWarehouse
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.shipping_agent import AgentCarrierRate
from app.models.clearance_agent import ClearanceAgent, ClearanceAgentRate
from app.schemas.booking import (
    BookingCreate, BookingUpdate, BookingResponse, BookingListResponse, BookingListItem,
    BookingCargoLineCreate, BookingCargoLineUpdate, BookingCargoLineResponse,
    BookingCargoImageResponse, BookingCargoDocumentResponse, AgentShort, BranchShort, ClientShort,
)

router = APIRouter()

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "bookings",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

_AIR_DIVISOR = Decimal("6000")
DOCUMENT_TYPES = {
    "pi", "ci", "pl", "sc", "co", "bl_copy",
    "security_approval", "goods_invoice", "invoice", "other",
}
GOODS_SOURCES = {"company_buying_service", "client_ready_goods"}


# ── Destination helpers ───────────────────────────────────────────────────────

JORDAN_KEYWORDS = ['jordan', 'aqaba', 'amman', 'zarqa', 'irbid']
IRAQ_KEYWORDS   = ['iraq', 'basra', 'umm qasr', 'baghdad', 'erbil', 'mosul', 'basrah', 'umm_qasr']


def _port_to_destination(port: str | None) -> str | None:
    """Detect destination from port name. Returns 'jordan', 'iraq', or None."""
    if not port:
        return None
    p = port.lower()
    if any(kw in p for kw in JORDAN_KEYWORDS):
        return 'jordan'
    if any(kw in p for kw in IRAQ_KEYWORDS):
        return 'iraq'
    return None


def _margin_pct(buy: Decimal | None, sell: Decimal | None) -> Decimal:
    if not buy or not sell or buy <= 0:
        return Decimal("0")
    return ((sell - buy) / buy * Decimal("100")).quantize(Decimal("0.01"))


def _rate_snapshot_values(rate: AgentCarrierRate, mode: str, container_size: str | None) -> dict:
    """Return the immutable booking pricing/routing values from a forwarder rate."""
    size = (container_size or "").upper()
    if mode == "AIR":
        return {
            "carrier_name": rate.carrier_name,
            "port_of_loading": rate.pol,
            "port_of_discharge": rate.pod,
            "freight_cost": rate.buy_air_kg,
            "sell_freight_cost": rate.sell_air_kg,
            "max_cbm": None,
            "markup_pct": _margin_pct(rate.buy_air_kg, rate.sell_air_kg),
            "container_size": None,
            "etd": rate.vessel_day,
            "loading_warehouse_id": rate.loading_warehouse_id,
        }

    if mode == "LCL":
        lcl = {
            "20GP": (rate.buy_lcl_20gp or rate.buy_lcl_cbm, rate.sell_lcl_20gp or rate.sell_lcl_cbm, rate.cbm_20gp or Decimal("28")),
            "40GP": (rate.buy_lcl_40ft or rate.buy_lcl_cbm, rate.sell_lcl_40ft or rate.sell_lcl_cbm, rate.cbm_40ft or Decimal("67")),
            "40HQ": (rate.buy_lcl_40hq or rate.buy_lcl_cbm, rate.sell_lcl_40hq or rate.sell_lcl_cbm, rate.cbm_40hq or Decimal("76")),
        }
        buy, sell, cap = lcl.get(size, (None, None, None))
        return {
            "carrier_name": rate.carrier_name,
            "port_of_loading": rate.pol,
            "port_of_discharge": rate.pod,
            "freight_cost": buy,
            "sell_freight_cost": sell,
            "max_cbm": cap,
            "markup_pct": _margin_pct(buy, sell),
            "container_size": size or None,
            "etd": rate.vessel_day,
            "loading_warehouse_id": rate.loading_warehouse_id,
        }

    fcl = {
        "20GP": (rate.buy_20gp, rate.sell_20gp, rate.cbm_20gp or Decimal("28")),
        "40GP": (rate.buy_40ft, rate.sell_40ft, rate.cbm_40ft or Decimal("67")),
        "40HQ": (rate.buy_40hq, rate.sell_40hq, rate.cbm_40hq or Decimal("76")),
    }
    buy, sell, cap = fcl.get(size, (None, None, None))
    return {
        "carrier_name": rate.carrier_name,
        "port_of_loading": rate.pol,
        "port_of_discharge": rate.pod,
        "freight_cost": buy,
        "sell_freight_cost": sell,
        "max_cbm": cap,
        "markup_pct": _margin_pct(buy, sell),
        "container_size": size or None,
        "etd": rate.vessel_day,
        "loading_warehouse_id": rate.loading_warehouse_id,
    }


def _client_destination(client: Client) -> str | None:
    """
    Derive a client's effective destination from:
    1. country field
    2. client_code prefix (JO- = Jordan, IQ- = Iraq)
    3. phone country code (+962 = Jordan, +964 = Iraq)
    Returns None if unknown → allowed in any booking.
    """
    if client.country:
        c = client.country.lower()
        if 'jordan' in c or c in ('jo',):
            return 'jordan'
        if 'iraq' in c or c in ('iq',):
            return 'iraq'

    if client.client_code:
        code = client.client_code.upper()
        if code.startswith('JO-'):
            return 'jordan'
        if code.startswith('IQ-'):
            return 'iraq'

    if client.phone:
        p = client.phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if p.startswith('+962') or p.startswith('00962'):
            return 'jordan'
        if p.startswith('+964') or p.startswith('00964'):
            return 'iraq'

    return None   # unknown → unrestricted


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_booking_number(db: Session, mode: str) -> str:
    year = datetime.now().year
    prefix = mode.upper()
    pattern = f"{prefix}-{year}-%"
    rows = db.query(Booking.booking_number).filter(Booking.booking_number.like(pattern)).all()
    max_seq = 0
    for (booking_number,) in rows:
        try:
            max_seq = max(max_seq, int(str(booking_number).rsplit("-", 1)[-1]))
        except (TypeError, ValueError):
            continue
    return f"{prefix}-{year}-{str(max_seq + 1).zfill(4)}"


def _compute_air_weights(line: BookingCargoLine) -> None:
    """Recalculate volumetric & chargeable weight for air cargo lines."""
    if (line.carton_length_cm and line.carton_width_cm and
            line.carton_height_cm and line.cartons):
        vol = (Decimal(str(line.carton_length_cm)) *
               Decimal(str(line.carton_width_cm)) *
               Decimal(str(line.carton_height_cm)) *
               Decimal(str(line.cartons))) / _AIR_DIVISOR
        line.volumetric_weight_kg = round(vol, 3)
        actual = Decimal(str(line.gross_weight_kg)) if line.gross_weight_kg else Decimal("0")
        line.chargeable_weight_kg = round(max(actual, vol), 3)
    else:
        line.volumetric_weight_kg = None
        line.chargeable_weight_kg = None


LOCKED_STATUSES = {"confirmed", "in_transit", "arrived", "delivered", "cancelled"}

def _assert_cargo_editable(b: Booking) -> None:
    """Raise 423 if the booking is sealed and cargo lines cannot be changed."""
    if b.status in LOCKED_STATUSES:
        raise HTTPException(
            status_code=423,
            detail=f"Container is {b.status} — cargo lines are locked and cannot be modified.",
        )


def _norm_key(value: str | None) -> str:
    return (value or "").strip().lower().replace(" ", "").replace("-", "").replace("_", "")


def _canonical_container_size(value: str | None) -> str:
    v = _norm_key(value)
    if not v:
        return ""
    if "40hq" in v or "40hc" in v or "40highcube" in v:
        return "40HQ"
    if "20" in v:
        return "20GP"
    if "40" in v:
        return "40GP"
    return v.upper()


def _container_size_matches(rate_size: str | None, booking_size: str | None) -> bool:
    rate = _canonical_container_size(rate_size)
    booking = _canonical_container_size(booking_size)
    if not rate or not booking:
        return True
    return rate == booking or _loose_key_match(rate_size, booking_size)


def _loose_key_match(left: str | None, right: str | None) -> bool:
    a = _norm_key(left)
    b = _norm_key(right)
    return bool(a and b and (a == b or a in b or b in a))


def _country_to_destination(country: str | None) -> str | None:
    if not country:
        return None
    c = country.lower()
    if "jordan" in c or "الأردن" in c or c == "jo":
        return "jordan"
    if "iraq" in c or "العراق" in c or c == "iq":
        return "iraq"
    return None


def _booking_capacity(booking: Booking) -> Decimal | None:
    if booking.max_cbm is not None:
        return Decimal(str(booking.max_cbm))
    if booking.container_size and booking.container_size in CONTAINER_CBM:
        return Decimal(str(CONTAINER_CBM[booking.container_size]))
    return None


def _cargo_cbm_total(booking: Booking, exclude_line_id: int | None = None) -> Decimal:
    total = Decimal("0")
    for line in booking.cargo_lines:
        if exclude_line_id is not None and line.id == exclude_line_id:
            continue
        if line.cbm:
            total += Decimal(str(line.cbm))
    return total


def _money(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _booking_sell_freight(booking: Booking) -> Decimal | None:
    sell = _money(getattr(booking, "sell_freight_cost", None))
    if sell is not None:
        return sell
    buy = _money(booking.freight_cost)
    if buy is None:
        return None
    markup = _money(booking.markup_pct) or Decimal("0")
    return (buy * (Decimal("1") + (markup / Decimal("100")))).quantize(Decimal("0.01"))


def _recalculate_freight_shares(db: Session, booking: Booking) -> None:
    sell_freight = _booking_sell_freight(booking)
    lines = db.query(BookingCargoLine).filter(
        BookingCargoLine.booking_id == booking.id
    ).order_by(BookingCargoLine.sort_order, BookingCargoLine.id).all()
    if sell_freight is None:
        for line in lines:
            line.freight_share = None
        return

    mode = (booking.mode or "").upper()
    if mode == "LCL":
        for line in lines:
            cbm = _money(line.cbm) or Decimal("0")
            line.freight_share = (sell_freight * cbm).quantize(Decimal("0.01"))
        return

    if mode == "AIR":
        for line in lines:
            kg = _money(line.chargeable_weight_kg) or _money(line.gross_weight_kg) or Decimal("0")
            line.freight_share = (sell_freight * kg).quantize(Decimal("0.01"))
        return

    if not lines:
        return
    if len(lines) == 1 or any(line.is_full_container_client for line in lines):
        for line in lines:
            line.freight_share = sell_freight if line.is_full_container_client or len(lines) == 1 else Decimal("0.00")
        return

    total_cbm = sum((_money(line.cbm) or Decimal("0")) for line in lines)
    if total_cbm > 0:
        assigned = Decimal("0.00")
        for index, line in enumerate(lines):
            if index == len(lines) - 1:
                line.freight_share = sell_freight - assigned
            else:
                cbm = _money(line.cbm) or Decimal("0")
                share = (sell_freight * cbm / total_cbm).quantize(Decimal("0.01"))
                line.freight_share = share
                assigned += share
    else:
        equal = (sell_freight / Decimal(len(lines))).quantize(Decimal("0.01"))
        assigned = Decimal("0.00")
        for index, line in enumerate(lines):
            if index == len(lines) - 1:
                line.freight_share = sell_freight - assigned
            else:
                line.freight_share = equal
                assigned += equal


def _refresh_booking_rate_snapshot(db: Session, booking: Booking) -> None:
    if not booking.agent_carrier_rate_id:
        return
    rate = db.query(AgentCarrierRate).filter(
        AgentCarrierRate.id == booking.agent_carrier_rate_id,
        AgentCarrierRate.is_active == True,  # noqa: E712
    ).first()
    if not rate:
        return
    snapshot = _rate_snapshot_values(rate, booking.mode, booking.container_size)
    if snapshot.get("freight_cost") is not None:
        booking.freight_cost = snapshot.get("freight_cost")
    if snapshot.get("sell_freight_cost") is not None:
        booking.sell_freight_cost = snapshot.get("sell_freight_cost")
    if snapshot.get("max_cbm") is not None:
        booking.max_cbm = snapshot.get("max_cbm")
    booking.markup_pct = snapshot.get("markup_pct")


def _assert_cargo_capacity(booking: Booking, new_cbm, exclude_line_id: int | None = None) -> None:
    if booking.mode != "LCL":
        return
    capacity = _booking_capacity(booking)
    if capacity is None:
        return
    cbm = Decimal(str(new_cbm or 0))
    used = _cargo_cbm_total(booking, exclude_line_id=exclude_line_id)
    remaining = max(capacity - used, Decimal("0"))
    if cbm > remaining:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Not enough CBM in this LCL container. Remaining capacity is "
                f"{remaining.quantize(Decimal('0.001'))} CBM, but this cargo needs "
                f"{cbm.quantize(Decimal('0.001'))} CBM."
            ),
        )


def _assert_full_container_rules(booking: Booking, full_client: bool | None, exclude_line_id: int | None = None) -> None:
    existing_full = any(
        line.is_full_container_client
        for line in booking.cargo_lines
        if exclude_line_id is None or line.id != exclude_line_id
    )
    other_lines = [
        line for line in booking.cargo_lines
        if exclude_line_id is None or line.id != exclude_line_id
    ]
    if existing_full:
        raise HTTPException(
            status_code=400,
            detail="This container is already assigned as a full container for one client. No additional clients can be added.",
        )
    if full_client and other_lines:
        raise HTTPException(
            status_code=400,
            detail="A full-container client must be the only client in the container. Remove other clients first.",
        )


def _promote_lcl_to_fcl_if_needed(db: Session, booking: Booking, full_client: bool | None) -> None:
    if full_client and booking.mode == "LCL":
        booking.mode = "FCL"
        if not str(booking.booking_number or "").upper().startswith("FCL-"):
            booking.booking_number = _generate_booking_number(db, "FCL")


def _validate_clearance_selection(db: Session, line_data, booking: Booking | None = None) -> None:
    def val(name: str):
        return line_data.get(name) if isinstance(line_data, dict) else getattr(line_data, name, None)

    if val("clearance_through_us") is True:
        if not val("clearance_agent_id"):
            raise HTTPException(400, "Clearance agent is required when clearance is through us")
        agent = db.query(ClearanceAgent).filter(
            ClearanceAgent.id == val("clearance_agent_id"),
            ClearanceAgent.is_active == True,  # noqa: E712
        ).first()
        if not agent:
            raise HTTPException(404, "Clearance agent not found")
        if val("clearance_agent_rate_id"):
            rate = db.query(ClearanceAgentRate).filter(
                ClearanceAgentRate.id == val("clearance_agent_rate_id"),
                ClearanceAgentRate.agent_id == val("clearance_agent_id"),
                ClearanceAgentRate.is_active == True,  # noqa: E712
            ).first()
            if not rate:
                raise HTTPException(404, "Clearance agent rate not found")
            if booking:
                expected_mode = "air" if booking.mode == "AIR" else "sea"
                if rate.service_mode and rate.service_mode != expected_mode:
                    raise HTTPException(400, f"Selected clearance rate is for {rate.service_mode}, but this container needs {expected_mode} clearance")
                if expected_mode == "sea" and rate.container_size and booking.container_size:
                    if not _container_size_matches(rate.container_size, booking.container_size):
                        raise HTTPException(400, f"Selected clearance rate is for {rate.container_size}, but this container is {booking.container_size}")
                booking_dest = _port_to_destination(booking.port_of_discharge) or booking.destination
                rate_dest = _country_to_destination(rate.country)
                if booking_dest and rate_dest and booking_dest != rate_dest:
                    raise HTTPException(400, f"Selected clearance rate is for {rate.country}, but this container is going to {booking_dest}")


def _validate_invoice_selection(db: Session, invoice_id: int | None, client_id: int | None) -> Invoice | None:
    if not invoice_id:
        return None
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.client_id and client_id and invoice.client_id != client_id:
        raise HTTPException(400, "Selected invoice belongs to a different client")
    return invoice


def _validate_goods_source(source: str | None) -> str | None:
    if not source:
        return None
    normalized = source.strip().lower()
    if normalized not in GOODS_SOURCES:
        raise HTTPException(400, "goods_source must be company_buying_service or client_ready_goods")
    return normalized


def _safe_filename(value: str | None, fallback: str = "file") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", (value or fallback).strip()).strip("-._")
    return cleaned or fallback


def _json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _zip_json(zf: zipfile.ZipFile, arcname: str, payload: dict | list) -> None:
    zf.writestr(
        arcname,
        json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default),
    )


def _zip_file_if_exists(zf: zipfile.ZipFile, uploads_root: str, file_path: str | None, arcname: str) -> bool:
    if not file_path:
        return False
    full_path = os.path.abspath(os.path.join(uploads_root, file_path))
    if not full_path.startswith(os.path.abspath(uploads_root) + os.sep):
        return False
    if not os.path.isfile(full_path):
        return False
    zf.write(full_path, arcname)
    return True


def _enum_value(value):
    return getattr(value, "value", value)


def _product_snapshot(product) -> dict | None:
    if not product:
        return None
    return {
        "id": product.id,
        "code": product.code,
        "name": product.name,
        "name_ar": product.name_ar,
        "category": product.category,
        "hs_code": product.hs_code,
        "customs_unit_basis": product.customs_unit_basis,
        "customs_estimated_value_usd": product.customs_estimated_value_usd,
        "customs_duty_pct": product.customs_duty_pct,
        "sales_tax_pct": product.sales_tax_pct,
        "other_tax_pct": product.other_tax_pct,
    }


def _invoice_item_snapshot(item) -> dict:
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product": _product_snapshot(item.product),
        "description": item.description,
        "description_ar": item.description_ar,
        "details": item.details,
        "details_ar": item.details_ar,
        "hs_code": item.hs_code,
        "quantity": item.quantity,
        "unit": item.unit,
        "unit_price": item.unit_price,
        "total_price": item.total_price,
        "cartons": item.cartons,
        "gross_weight": item.gross_weight,
        "net_weight": item.net_weight,
        "cbm": item.cbm,
        "sort_order": item.sort_order,
    }


def _invoice_snapshot(invoice: Invoice | None) -> dict | None:
    if not invoice:
        return None
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_type": _enum_value(invoice.invoice_type),
        "status": _enum_value(invoice.status),
        "client_id": invoice.client_id,
        "buyer_name": invoice.buyer_name,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "origin": invoice.origin,
        "shipping_term": invoice.shipping_term,
        "port_of_loading": invoice.port_of_loading,
        "port_of_discharge": invoice.port_of_discharge,
        "shipping_marks": invoice.shipping_marks,
        "container_no": invoice.container_no,
        "seal_no": invoice.seal_no,
        "bl_number": invoice.bl_number,
        "vessel_name": invoice.vessel_name,
        "voyage_number": invoice.voyage_number,
        "subtotal": invoice.subtotal,
        "discount": invoice.discount,
        "total": invoice.total,
        "currency": invoice.currency,
        "items": [_invoice_item_snapshot(item) for item in invoice.items],
    }


def _cargo_goods_payload(line: BookingCargoLine) -> dict:
    extracted = line.extracted_goods if isinstance(line.extracted_goods, dict) else {}
    goods = extracted.get("goods") if isinstance(extracted.get("goods"), list) else []
    return {
        "source": "cargo_line.extracted_goods",
        "client": {
            "id": line.client.id if line.client else None,
            "name": line.client.name if line.client else None,
            "name_ar": line.client.name_ar if line.client else None,
            "client_code": line.client.client_code if line.client else None,
        },
        "linked_invoice": {
            "invoice_id": line.invoice_id or extracted.get("invoice_id"),
            "invoice_number": line.invoice.invoice_number if line.invoice else extracted.get("invoice_number") or extracted.get("invoice_no"),
        },
        "summary": {
            "description": line.description,
            "description_ar": line.description_ar,
            "hs_code": line.hs_code,
            "cartons": line.cartons,
            "gross_weight_kg": line.gross_weight_kg,
            "net_weight_kg": line.net_weight_kg,
            "cbm": line.cbm,
            "shipping_marks": line.shipping_marks,
        },
        "goods": goods,
        "source_documents": extracted.get("source_documents", []),
        "confidence": extracted.get("confidence"),
        "raw_extracted_goods": line.extracted_goods,
    }


def _doc_full_path(file_path: str) -> str:
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.abspath(os.path.join(uploads_root, file_path))
    if not full_path.startswith(os.path.abspath(uploads_root) + os.sep):
        raise HTTPException(400, "Invalid file path")
    return full_path


def _read_document_text(full_path: str) -> str:
    ext = os.path.splitext(full_path)[1].lower()
    if ext == ".pdf":
        try:
            result = subprocess.run(
                ["pdftotext", "-layout", full_path, "-"],
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.stdout.strip():
                return result.stdout
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return ""
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}:
        try:
            with Image.open(full_path) as img:
                return pytesseract.image_to_string(img, lang="eng+ara")
        except Exception:
            return ""
    if ext in {".txt", ".csv"}:
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                return fh.read()
        except OSError:
            return ""
    return ""


def _money_or_number(value: str | None) -> Decimal | None:
    if not value:
        return None
    cleaned = re.sub(r"[^0-9.]", "", value)
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except Exception:
        return None


def _first_match(pattern: str, text: str, flags: int = re.I) -> str | None:
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else None


def _best_hs_code(text: str) -> str | None:
    codes = []
    for code in re.findall(r"\b\d{6,10}\b", text):
        if code.startswith(("19", "20")):
            continue
        codes.append(code)
    if not codes:
        return None
    return max(set(codes), key=codes.count)


def _parse_pl_goods(text: str, hs_code: str | None) -> list[dict]:
    goods: list[dict] = []
    row_re = re.compile(
        r"^\s*(?:N/M\s+)?([A-Za-z][A-Za-z0-9’' /,&().-]{2,}?)\s{2,}(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)(?:\s+(\d+(?:\.\d+)?))?\s*$",
        re.M,
    )
    for m in row_re.finditer(text):
        description = " ".join(m.group(1).split())
        if description.upper() in {"TOTAL", "MARK", "NUMBERS"} or "TOTAL" in description.upper():
            continue
        goods.append({
            "description": description,
            "cartons": int(m.group(2)),
            "quantity": int(m.group(3)),
            "gross_weight_kg": float(m.group(4)),
            "cbm": float(m.group(5)) if m.group(5) else None,
            "hs_code": hs_code,
            "source": "packing_list",
        })
    return goods


def _parse_cargo_documents(text_by_type: dict[str, str]) -> dict:
    combined = "\n".join(text_by_type.values())
    pl_text = text_by_type.get("pl", "")
    hs_code = _best_hs_code(combined)
    goods = _parse_pl_goods(pl_text or combined, hs_code)

    cartons = gross_weight = cbm = None
    total_match = re.search(
        r"^\s*TOTAL\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$",
        pl_text or combined,
        re.I | re.M,
    )
    if total_match:
        cartons = int(total_match.group(1))
        gross_weight = _money_or_number(total_match.group(3))
        cbm = _money_or_number(total_match.group(4))
    elif goods:
        cartons = sum(int(g.get("cartons") or 0) for g in goods)
        gross_weight = sum(Decimal(str(g.get("gross_weight_kg") or 0)) for g in goods)

    if not goods:
        short_desc = _first_match(r"7\.Number and kind of packages;description of goods\s+.*?\n\s*(.+?);", combined, re.I | re.S)
        if short_desc:
            goods.append({"description": " ".join(short_desc.split()), "hs_code": hs_code, "source": "document_text"})

    marks = "N/M" if re.search(r"\bN/M\b", combined, re.I) else None

    return {
        "fields": {
            "description": None,
            "description_ar": None,
            "hs_code": hs_code,
            "shipping_marks": marks,
            "cartons": cartons,
            "gross_weight_kg": float(gross_weight) if gross_weight is not None else None,
            "net_weight_kg": None,
            "cbm": float(cbm) if cbm is not None else None,
        },
        "booking_fields": {
            "container_no": _first_match(r"CONTAINER NO\.?\s*:\s*([A-Z0-9-]+)", combined),
            "seal_no": _first_match(r"SEAL NO\.?\s*:\s*([A-Z0-9-]+)", combined),
            "bl_number": _first_match(r"B/L NO\.?\s*:\s*([A-Z0-9-]+)", combined),
        },
        "goods": goods,
        "invoice_no": _first_match(r"INVOICE NO\.?\s*:\s*([A-Z0-9/-]+)", combined),
        "confidence": "high" if goods and cartons and gross_weight else "medium" if goods else "low",
    }


def _fill_stats(booking: Booking) -> tuple[Decimal, float | None, float | None]:
    used = sum(Decimal(str(ln.cbm)) for ln in booking.cargo_lines if ln.cbm)
    capacity = CONTAINER_CBM.get(booking.container_size) if booking.container_size else None
    pct = round(float(used) / capacity * 100, 1) if capacity and capacity > 0 else None
    return used, capacity, pct


def _serialize_line(line: BookingCargoLine) -> BookingCargoLineResponse:
    return BookingCargoLineResponse(
        id=line.id,
        booking_id=line.booking_id,
        client=ClientShort(
            id=line.client.id,
            name=line.client.name,
            name_ar=line.client.name_ar,
            client_code=line.client.client_code,
        ),
        invoice_id=line.invoice_id,
        invoice_number=line.invoice.invoice_number if line.invoice else None,
        sort_order=line.sort_order,
        goods_source=line.goods_source,
        is_full_container_client=bool(line.is_full_container_client),
        description=line.description,
        description_ar=line.description_ar,
        hs_code=line.hs_code,
        shipping_marks=line.shipping_marks,
        cartons=line.cartons,
        gross_weight_kg=line.gross_weight_kg,
        net_weight_kg=line.net_weight_kg,
        cbm=line.cbm,
        carton_length_cm=line.carton_length_cm,
        carton_width_cm=line.carton_width_cm,
        carton_height_cm=line.carton_height_cm,
        volumetric_weight_kg=line.volumetric_weight_kg,
        chargeable_weight_kg=line.chargeable_weight_kg,
        freight_share=line.freight_share,
        notes=line.notes,
        extracted_goods=line.extracted_goods,
        clearance_through_us=line.clearance_through_us,
        clearance_agent_id=line.clearance_agent_id,
        clearance_agent_name=line.clearance_agent.name if line.clearance_agent else None,
        clearance_agent_rate_id=line.clearance_agent_rate_id,
        manual_clearance_agent_name=line.manual_clearance_agent_name,
        manual_clearance_agent_phone=line.manual_clearance_agent_phone,
        manual_clearance_agent_notes=line.manual_clearance_agent_notes,
        images=[
            BookingCargoImageResponse(
                id=img.id,
                file_path=img.file_path,
                original_filename=img.original_filename,
                uploaded_at=img.uploaded_at,
            )
            for img in line.images
        ],
        documents=[
            BookingCargoDocumentResponse(
                id=doc.id,
                document_type=doc.document_type,
                custom_file_type=doc.custom_file_type,
                file_path=doc.file_path,
                original_filename=doc.original_filename,
                uploaded_at=doc.uploaded_at,
            )
            for doc in line.documents
        ],
        created_at=line.created_at,
    )


def _serialize_booking(b: Booking) -> BookingResponse:
    used, capacity, pct = _fill_stats(b)
    return BookingResponse(
        id=b.id,
        booking_number=b.booking_number,
        mode=b.mode,
        status=b.status,
        container_size=b.container_size,
        container_no=b.container_no,
        seal_no=b.seal_no,
        bl_number=b.bl_number,
        awb_number=b.awb_number,
        vessel_name=b.vessel_name,
        voyage_number=b.voyage_number,
        flight_number=b.flight_number,
        port_of_loading=b.port_of_loading,
        port_of_discharge=b.port_of_discharge,
        etd=b.etd,
        eta=b.eta,
        incoterm=b.incoterm,
        freight_cost=b.freight_cost,
        sell_freight_cost=b.sell_freight_cost,
        currency=b.currency or "USD",
        notes=b.notes,
        is_direct_booking=(b.is_direct_booking == "1"),
        carrier_name=b.carrier_name,
        agent_carrier_rate_id=b.agent_carrier_rate_id,
        is_agent_snapshot=bool(getattr(b, 'is_agent_snapshot', False)),
        agent=AgentShort(id=b.agent.id, name=b.agent.name) if b.agent else None,
        branch=BranchShort(
            id=b.branch.id, name=b.branch.name,
            name_ar=getattr(b.branch, "name_ar", None),
            code=b.branch.code,
        ) if b.branch else None,
        cargo_lines=[_serialize_line(ln) for ln in b.cargo_lines],
        max_cbm=b.max_cbm,
        markup_pct=b.markup_pct,
        total_cbm_used=used,
        container_cbm_capacity=capacity,
        fill_percent=pct,
        destination=b.destination,
        # Loading info
        loading_warehouse_id=b.loading_warehouse_id,
        loading_warehouse_name=b.loading_warehouse.name if b.loading_warehouse else None,
        loading_warehouse_city=b.loading_warehouse.city if b.loading_warehouse else None,
        loading_date=b.loading_date,
        loading_notes=b.loading_notes,
        loading_photos=[
            {"id": p.id, "file_path": p.file_path, "original_filename": p.original_filename,
             "caption": p.caption, "uploaded_at": p.uploaded_at}
            for p in b.loading_photos
        ],
        is_locked=(b.status in LOCKED_STATUSES),
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


# ── Ports lookup ─────────────────────────────────────────────────────────────

@router.get("/ports")
def get_ports(
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    """Return distinct ports from shipping quotes + existing bookings for dropdown."""
    from app.models.shipping_quote import ShippingQuote
    from sqlalchemy import union, select, literal_column

    sq_load = db.query(ShippingQuote.port_of_loading).filter(ShippingQuote.port_of_loading.isnot(None))
    bk_load = db.query(Booking.port_of_loading).filter(Booking.port_of_loading.isnot(None))
    loading = sorted({r[0] for r in sq_load.union(bk_load).all() if r[0]})

    sq_disch = db.query(ShippingQuote.port_of_discharge).filter(ShippingQuote.port_of_discharge.isnot(None))
    bk_disch = db.query(Booking.port_of_discharge).filter(Booking.port_of_discharge.isnot(None))
    discharge = sorted({r[0] for r in sq_disch.union(bk_disch).all() if r[0]})

    return {"loading": loading, "discharge": discharge}


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=BookingListResponse)
def list_bookings(
    mode:        str | None = Query(None),
    status:      str | None = Query(None),
    destination: str | None = Query(None),
    agent_id:    int | None = Query(None),
    client_id:   int | None = Query(None),
    search:      str | None = Query(None),
    page:        int        = Query(1, ge=1),
    page_size:   int        = Query(20, ge=1, le=100),
    db:          Session    = Depends(get_db),
    _:           User       = Depends(get_current_user),
):
    q = db.query(Booking)
    if mode:
        q = q.filter(Booking.mode == mode.upper())
    if status:
        q = q.filter(Booking.status == status)
    if destination:
        q = q.filter(Booking.destination == destination.lower())
    if agent_id:
        q = q.filter(Booking.shipping_agent_id == agent_id)
    if client_id:
        q = q.join(BookingCargoLine, BookingCargoLine.booking_id == Booking.id)\
             .filter(BookingCargoLine.client_id == client_id)
    if search:
        pattern = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(or_(
            Booking.booking_number.ilike(pattern),
            Booking.bl_number.ilike(pattern),
            Booking.awb_number.ilike(pattern),
            Booking.vessel_name.ilike(pattern),
            Booking.flight_number.ilike(pattern),
            Booking.port_of_loading.ilike(pattern),
            Booking.port_of_discharge.ilike(pattern),
        ))

    total = q.count()
    bookings = q.order_by(Booking.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items: list[BookingListItem] = []
    for b in bookings:
        used, capacity, pct = _fill_stats(b)
        items.append(BookingListItem(
            id=b.id,
            booking_number=b.booking_number,
            mode=b.mode,
            status=b.status,
            container_size=b.container_size,
            port_of_loading=b.port_of_loading,
            port_of_discharge=b.port_of_discharge,
            etd=b.etd,
            eta=b.eta,
            client_count=len(b.cargo_lines),
            total_cbm_used=used,
            fill_percent=pct,
            agent_name=b.agent.name if b.agent else None,
            freight_cost=b.freight_cost,
            sell_freight_cost=b.sell_freight_cost,
            max_cbm=b.max_cbm,
            markup_pct=b.markup_pct,
            container_no=b.container_no,
            bl_number=b.bl_number,
            vessel_name=b.vessel_name,
            destination=b.destination,
            created_at=b.created_at,
        ))

    return BookingListResponse(total=total, page=page, page_size=page_size, results=items)


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    mode = payload.mode.upper()
    if mode not in ("LCL", "FCL", "AIR"):
        raise HTTPException(400, "mode must be LCL, FCL or AIR")

    rate_snapshot = None
    if payload.agent_carrier_rate_id:
        rate = db.query(AgentCarrierRate).filter(
            AgentCarrierRate.id == payload.agent_carrier_rate_id,
            AgentCarrierRate.is_active == True,  # noqa: E712
        ).first()
        if not rate:
            raise HTTPException(404, "Agent carrier rate not found")
        if payload.shipping_agent_id and rate.agent_id != payload.shipping_agent_id:
            raise HTTPException(400, "Selected carrier rate does not belong to this shipping agent")
        rate_snapshot = _rate_snapshot_values(rate, mode, payload.container_size)
        payload.shipping_agent_id = rate.agent_id

    booking = Booking(
        booking_number=_generate_booking_number(db, mode),
        mode=mode,
        status="draft",
        shipping_agent_id=payload.shipping_agent_id,
        agent_carrier_rate_id=payload.agent_carrier_rate_id,
        branch_id=payload.branch_id,
        container_size=(rate_snapshot["container_size"] if rate_snapshot else payload.container_size),
        container_no=payload.container_no or None,
        seal_no=payload.seal_no or None,
        bl_number=payload.bl_number or None,
        awb_number=payload.awb_number or None,
        vessel_name=payload.vessel_name or None,
        voyage_number=payload.voyage_number or None,
        flight_number=payload.flight_number or None,
        port_of_loading=(rate_snapshot["port_of_loading"] if rate_snapshot and rate_snapshot["port_of_loading"] else payload.port_of_loading) or None,
        port_of_discharge=(rate_snapshot["port_of_discharge"] if rate_snapshot and rate_snapshot["port_of_discharge"] else payload.port_of_discharge) or None,
        etd=(rate_snapshot["etd"] if rate_snapshot and rate_snapshot["etd"] else payload.etd),
        eta=payload.eta,
        incoterm=payload.incoterm or None,
        freight_cost=(rate_snapshot["freight_cost"] if rate_snapshot else payload.freight_cost),
        sell_freight_cost=(rate_snapshot["sell_freight_cost"] if rate_snapshot else payload.sell_freight_cost),
        currency="USD",
        notes=payload.notes or None,
        is_direct_booking="1" if payload.is_direct_booking else "0",
        carrier_name=(rate_snapshot["carrier_name"] if rate_snapshot else payload.carrier_name) or None,
        max_cbm=(rate_snapshot["max_cbm"] if rate_snapshot else payload.max_cbm),
        markup_pct=(rate_snapshot["markup_pct"] if rate_snapshot else payload.markup_pct),
        destination=_port_to_destination((rate_snapshot["port_of_discharge"] if rate_snapshot and rate_snapshot["port_of_discharge"] else payload.port_of_discharge)),
        loading_warehouse_id=(rate_snapshot["loading_warehouse_id"] if rate_snapshot else None),
    )
    # Mark snapshot if created from an agent carrier rate
    if payload.agent_carrier_rate_id:
        booking.is_agent_snapshot = True
    db.add(booking)
    db.flush()

    full_container_lines = [line for line in payload.cargo_lines if line.is_full_container_client]
    if full_container_lines and len(payload.cargo_lines) > 1:
        raise HTTPException(400, "A full-container client must be the only client in the container.")
    if booking.mode == "LCL":
        capacity = _booking_capacity(booking)
        if capacity is not None:
            total_cbm = sum((Decimal(str(line.cbm)) for line in payload.cargo_lines if line.cbm), Decimal("0"))
            if total_cbm > capacity:
                raise HTTPException(
                    400,
                    f"Not enough CBM in this LCL container. Capacity is {capacity.quantize(Decimal('0.001'))} CBM, but cargo totals {total_cbm.quantize(Decimal('0.001'))} CBM.",
                )

    for i, line_data in enumerate(payload.cargo_lines):
        client = db.query(Client).filter(Client.id == line_data.client_id).first()
        if not client:
            raise HTTPException(404, f"Client {line_data.client_id} not found")
        _validate_clearance_selection(db, line_data, booking)
        line = BookingCargoLine(
            booking_id=booking.id,
            client_id=line_data.client_id,
            sort_order=line_data.sort_order if line_data.sort_order else i,
            goods_source=_validate_goods_source(line_data.goods_source),
            is_full_container_client=line_data.is_full_container_client,
            description=line_data.description or None,
            description_ar=line_data.description_ar or None,
            hs_code=line_data.hs_code or None,
            shipping_marks=line_data.shipping_marks or None,
            cartons=line_data.cartons,
            gross_weight_kg=line_data.gross_weight_kg,
            net_weight_kg=line_data.net_weight_kg,
            cbm=line_data.cbm,
            carton_length_cm=line_data.carton_length_cm,
            carton_width_cm=line_data.carton_width_cm,
            carton_height_cm=line_data.carton_height_cm,
            notes=line_data.notes or None,
            extracted_goods=line_data.extracted_goods,
            clearance_through_us=line_data.clearance_through_us,
            clearance_agent_id=line_data.clearance_agent_id if line_data.clearance_through_us else None,
            clearance_agent_rate_id=line_data.clearance_agent_rate_id if line_data.clearance_through_us else None,
            manual_clearance_agent_name=None if line_data.clearance_through_us else line_data.manual_clearance_agent_name,
            manual_clearance_agent_phone=None if line_data.clearance_through_us else line_data.manual_clearance_agent_phone,
            manual_clearance_agent_notes=None if line_data.clearance_through_us else line_data.manual_clearance_agent_notes,
        )
        if mode == "AIR":
            _compute_air_weights(line)
        db.add(line)
        _promote_lcl_to_fcl_if_needed(db, booking, line_data.is_full_container_client)
        if line_data.is_full_container_client:
            _refresh_booking_rate_snapshot(db, booking)

    db.flush()
    _recalculate_freight_shares(db, booking)
    db.commit()
    db.refresh(booking)
    return _serialize_booking(booking)


# ── Get ───────────────────────────────────────────────────────────────────────

@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    return _serialize_booking(b)


@router.get("/{booking_id}/archive.zip")
def download_booking_archive_zip(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    archive_root = _safe_filename(b.booking_number or f"booking-{booking_id}", f"booking-{booking_id}")
    tmp_dir = os.path.join(UPLOAD_DIR, "_tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    zip_path = os.path.join(tmp_dir, f"{archive_root}-{uuid.uuid4().hex}.zip")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    used, capacity, pct = _fill_stats(b)

    container_summary = {
        "id": b.id,
        "booking_number": b.booking_number,
        "mode": b.mode,
        "status": b.status,
        "shipping_agent": b.agent.name if b.agent else None,
        "carrier_name": b.carrier_name,
        "agent_carrier_rate_id": b.agent_carrier_rate_id,
        "container_size": b.container_size,
        "container_no": b.container_no,
        "seal_no": b.seal_no,
        "bl_number": b.bl_number,
        "awb_number": b.awb_number,
        "vessel_name": b.vessel_name,
        "voyage_number": b.voyage_number,
        "flight_number": b.flight_number,
        "port_of_loading": b.port_of_loading,
        "port_of_discharge": b.port_of_discharge,
        "destination": b.destination,
        "etd": b.etd,
        "eta": b.eta,
        "incoterm": b.incoterm,
        "freight_cost": b.freight_cost,
        "sell_freight_cost": b.sell_freight_cost,
        "currency": b.currency or "USD",
        "markup_pct": b.markup_pct,
        "max_cbm": b.max_cbm,
        "total_cbm_used": used,
        "container_cbm_capacity": capacity,
        "fill_percent": pct,
        "branch": {
            "id": b.branch.id,
            "name": b.branch.name,
            "name_ar": getattr(b.branch, "name_ar", None),
            "code": b.branch.code,
        } if b.branch else None,
        "notes": b.notes,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }
    loading_summary = {
        "loading_warehouse_id": b.loading_warehouse_id,
        "loading_warehouse_name": b.loading_warehouse.name if b.loading_warehouse else None,
        "loading_warehouse_city": b.loading_warehouse.city if b.loading_warehouse else None,
        "loading_date": b.loading_date,
        "loading_notes": b.loading_notes,
        "photo_count": len(b.loading_photos),
    }
    cargo_summary = []
    missing_files: list[dict] = []
    readme = [
        f"Container archive: {b.booking_number}",
        f"Generated at: {datetime.utcnow().isoformat()}Z",
        "",
        "Folders:",
        "- 01-container-summary: booking data snapshot",
        "- 02-packing-list: cargo packing list JSON",
        "- 03-loading: loading warehouse/date data and loading photos",
        "- 04-clients: each client cargo line with its files grouped separately",
        "  - cargo-line.json: client cargo summary",
        "  - goods-list.json: detailed OCR/manual/invoice-imported goods list when available",
        "  - linked-invoice.json: invoice snapshot when the cargo line is connected to an invoice",
        "  - documents/photos: uploaded originals grouped by document type",
        "",
        "This export uses the current database values and uploaded originals at download time.",
    ]

    try:
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(f"{archive_root}/README.txt", "\n".join(readme))
            _zip_json(zf, f"{archive_root}/01-container-summary/container-summary.json", container_summary)
            _zip_json(zf, f"{archive_root}/02-packing-list/packing-list.json", get_packing_list(booking_id, db, _))
            _zip_json(zf, f"{archive_root}/03-loading/loading-info.json", loading_summary)

            for photo in b.loading_photos:
                filename = _safe_filename(photo.original_filename or os.path.basename(photo.file_path), f"loading-photo-{photo.id}")
                arcname = f"{archive_root}/03-loading/photos/{photo.id}-{filename}"
                if not _zip_file_if_exists(zf, uploads_root, photo.file_path, arcname):
                    missing_files.append({"kind": "loading_photo", "id": photo.id, "path": photo.file_path})

            for line_index, line in enumerate(b.cargo_lines, start=1):
                client_code = line.client.client_code if line.client else f"line-{line.id}"
                client_name = line.client.name if line.client else f"Cargo Line {line.id}"
                client_folder = f"{line_index:02d}-{_safe_filename(client_code, f'client-{line.id}')}-{_safe_filename(client_name, 'client')}"
                client_root = f"{archive_root}/04-clients/{client_folder}"
                line_summary = {
                    "id": line.id,
                    "client": {
                        "id": line.client.id if line.client else None,
                        "name": line.client.name if line.client else None,
                        "name_ar": line.client.name_ar if line.client else None,
                        "client_code": line.client.client_code if line.client else None,
                        "country": line.client.country if line.client else None,
                    },
                    "sort_order": line.sort_order,
                    "goods_source": line.goods_source,
                    "is_full_container_client": bool(line.is_full_container_client),
                    "description": line.description,
                    "description_ar": line.description_ar,
                    "hs_code": line.hs_code,
                    "shipping_marks": line.shipping_marks,
                    "cartons": line.cartons,
                    "gross_weight_kg": line.gross_weight_kg,
                    "net_weight_kg": line.net_weight_kg,
                    "cbm": line.cbm,
                    "carton_length_cm": line.carton_length_cm,
                    "carton_width_cm": line.carton_width_cm,
                    "carton_height_cm": line.carton_height_cm,
                    "volumetric_weight_kg": line.volumetric_weight_kg,
                    "chargeable_weight_kg": line.chargeable_weight_kg,
                    "freight_share": line.freight_share,
                    "extracted_goods": line.extracted_goods,
                    "goods_rows_count": len(line.extracted_goods.get("goods", [])) if isinstance(line.extracted_goods, dict) and isinstance(line.extracted_goods.get("goods"), list) else 0,
                    "linked_invoice": {
                        "invoice_id": line.invoice_id,
                        "invoice_number": line.invoice.invoice_number if line.invoice else None,
                    },
                    "clearance_through_us": line.clearance_through_us,
                    "clearance_agent_id": line.clearance_agent_id,
                    "clearance_agent_name": line.clearance_agent.name if line.clearance_agent else None,
                    "clearance_agent_rate_id": line.clearance_agent_rate_id,
                    "manual_clearance_agent_name": line.manual_clearance_agent_name,
                    "manual_clearance_agent_phone": line.manual_clearance_agent_phone,
                    "manual_clearance_agent_notes": line.manual_clearance_agent_notes,
                    "notes": line.notes,
                    "image_count": len(line.images),
                    "document_count": len(line.documents),
                    "created_at": line.created_at,
                }
                cargo_summary.append(line_summary)
                _zip_json(zf, f"{client_root}/cargo-line.json", line_summary)
                if line.extracted_goods:
                    _zip_json(zf, f"{client_root}/goods-list.json", _cargo_goods_payload(line))
                if line.invoice:
                    _zip_json(zf, f"{client_root}/linked-invoice.json", _invoice_snapshot(line.invoice))

                for img in line.images:
                    filename = _safe_filename(img.original_filename or os.path.basename(img.file_path), f"cargo-photo-{img.id}")
                    arcname = f"{client_root}/photos/{img.id}-{filename}"
                    if not _zip_file_if_exists(zf, uploads_root, img.file_path, arcname):
                        missing_files.append({"kind": "cargo_image", "id": img.id, "line_id": line.id, "path": img.file_path})

                for doc in line.documents:
                    doc_folder = _safe_filename(doc.custom_file_type if doc.document_type == "other" else doc.document_type, "document")
                    filename = _safe_filename(doc.original_filename or os.path.basename(doc.file_path), f"document-{doc.id}")
                    arcname = f"{client_root}/documents/{doc_folder}/{doc.id}-{filename}"
                    if not _zip_file_if_exists(zf, uploads_root, doc.file_path, arcname):
                        missing_files.append({"kind": "cargo_document", "id": doc.id, "line_id": line.id, "path": doc.file_path})

            _zip_json(zf, f"{archive_root}/04-clients/client-cargo-summary.json", cargo_summary)
            if missing_files:
                _zip_json(zf, f"{archive_root}/missing-files.json", missing_files)
    except Exception:
        if os.path.isfile(zip_path):
            os.remove(zip_path)
        raise

    def cleanup_zip() -> None:
        if os.path.isfile(zip_path):
            os.remove(zip_path)

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"{archive_root}-archive.zip",
        background=BackgroundTask(cleanup_zip),
    )


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    data = payload.model_dump(exclude_unset=True)
    # is_direct_booking stored as string "1"/"0"
    if "is_direct_booking" in data:
        data["is_direct_booking"] = "1" if data["is_direct_booking"] else "0"
    # If this booking was created from an agent snapshot, certain fields are immutable
    locked_fields = {"carrier_name", "container_size", "max_cbm", "port_of_loading", "port_of_discharge", "freight_cost", "sell_freight_cost"}
    if getattr(b, 'is_agent_snapshot', False):
        for k in list(data.keys()):
            if k in locked_fields:
                data.pop(k, None)
    for field, value in data.items():
        setattr(b, field, value)
    # Auto-update destination when port_of_discharge changes
    if "port_of_discharge" in data:
        new_dest = _port_to_destination(data["port_of_discharge"])
        if new_dest:   # only override if we can detect — don't clear existing
            b.destination = new_dest

    if {"freight_cost", "sell_freight_cost", "markup_pct", "container_size", "mode"} & set(data.keys()):
        db.flush()
        _recalculate_freight_shares(db, b)

    db.commit()
    db.refresh(b)
    return _serialize_booking(b)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.ADMIN)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    # Clean up uploaded images
    img_dir = os.path.join(UPLOAD_DIR, str(booking_id))
    if os.path.isdir(img_dir):
        shutil.rmtree(img_dir, ignore_errors=True)
    db.delete(b)
    db.commit()


# ── Eligible clients for a booking ───────────────────────────────────────────

@router.get("/{booking_id}/eligible-clients")
def get_eligible_clients(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    """
    Returns clients eligible to be added to this booking.
    Filtered by the booking's destination (jordan / iraq).
    Clients with no determinable destination are always included.
    """
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    all_clients = db.query(Client).filter(Client.is_active == True).all()
    destination = b.destination  # 'jordan' | 'iraq' | None

    results = []
    for c in all_clients:
        client_dest = _client_destination(c)
        # Include if: no booking destination, unknown client destination, or destinations match
        if not destination or client_dest is None or client_dest == destination:
            results.append({
                "id":          c.id,
                "name":        c.name,
                "name_ar":     c.name_ar,
                "client_code": c.client_code,
                "country":     c.country,
                "phone":       c.phone,
                "destination": client_dest,
            })

    # Sort: matching destination first, then unknowns
    if destination:
        results.sort(key=lambda x: (0 if x["destination"] == destination else 1, x["name"]))
    else:
        results.sort(key=lambda x: x["name"])

    return {
        "booking_destination": destination,
        "total": len(results),
        "results": results,
    }


# ── Cargo Lines ───────────────────────────────────────────────────────────────

@router.post("/{booking_id}/cargo-lines", response_model=BookingCargoLineResponse, status_code=status.HTTP_201_CREATED)
def add_cargo_line(
    booking_id: int,
    payload: BookingCargoLineCreate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    _assert_cargo_editable(b)
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    # Destination validation
    if b.destination:
        client_dest = _client_destination(client)
        if client_dest is not None and client_dest != b.destination:
            dest_label = {'jordan': 'Jordan 🇯🇴', 'iraq': 'Iraq 🇮🇶'}.get(b.destination, b.destination)
            raise HTTPException(
                status_code=400,
                detail=f"This container is going to {dest_label}. "
                       f"Client '{client.name}' ({client.client_code}) appears to be from {client_dest.title()}. "
                       f"Only {dest_label} clients can be added to this container.",
            )
    _assert_full_container_rules(b, payload.is_full_container_client)
    _assert_cargo_capacity(b, payload.cbm)
    _validate_invoice_selection(db, payload.invoice_id, payload.client_id)
    _validate_clearance_selection(db, payload, b)

    line = BookingCargoLine(
        booking_id=booking_id,
        client_id=payload.client_id,
        invoice_id=payload.invoice_id,
        sort_order=payload.sort_order,
        goods_source=_validate_goods_source(payload.goods_source),
        is_full_container_client=payload.is_full_container_client,
        description=payload.description or None,
        description_ar=payload.description_ar or None,
        hs_code=payload.hs_code or None,
        shipping_marks=payload.shipping_marks or None,
        cartons=payload.cartons,
        gross_weight_kg=payload.gross_weight_kg,
        net_weight_kg=payload.net_weight_kg,
        cbm=payload.cbm,
        carton_length_cm=payload.carton_length_cm,
        carton_width_cm=payload.carton_width_cm,
        carton_height_cm=payload.carton_height_cm,
        notes=payload.notes or None,
        clearance_through_us=payload.clearance_through_us,
        clearance_agent_id=payload.clearance_agent_id if payload.clearance_through_us else None,
        clearance_agent_rate_id=payload.clearance_agent_rate_id if payload.clearance_through_us else None,
        manual_clearance_agent_name=None if payload.clearance_through_us else payload.manual_clearance_agent_name,
        manual_clearance_agent_phone=None if payload.clearance_through_us else payload.manual_clearance_agent_phone,
        manual_clearance_agent_notes=None if payload.clearance_through_us else payload.manual_clearance_agent_notes,
        extracted_goods=payload.extracted_goods,
    )
    if b.mode == "AIR":
        _compute_air_weights(line)
    db.add(line)
    _promote_lcl_to_fcl_if_needed(db, b, payload.is_full_container_client)
    if payload.is_full_container_client:
        _refresh_booking_rate_snapshot(db, b)
    db.flush()
    _recalculate_freight_shares(db, b)
    db.commit()
    db.refresh(line)
    return _serialize_line(line)


@router.patch("/{booking_id}/cargo-lines/{line_id}", response_model=BookingCargoLineResponse)
def update_cargo_line(
    booking_id: int,
    line_id: int,
    payload: BookingCargoLineUpdate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")

    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if b:
        _assert_cargo_editable(b)

    data = payload.model_dump(exclude_unset=True)
    data.pop("freight_share", None)
    if "goods_source" in data:
        data["goods_source"] = _validate_goods_source(data["goods_source"])
    effective_invoice_id = data.get("invoice_id", line.invoice_id)
    _validate_invoice_selection(db, effective_invoice_id, line.client_id)
    merged = {
        "clearance_through_us": line.clearance_through_us,
        "clearance_agent_id": line.clearance_agent_id,
        "clearance_agent_rate_id": line.clearance_agent_rate_id,
    }
    merged.update({k: v for k, v in data.items() if k in merged})
    effective_full_client = data.get("is_full_container_client", line.is_full_container_client)
    effective_cbm = data.get("cbm", line.cbm)
    if b:
        _assert_full_container_rules(b, effective_full_client, exclude_line_id=line.id)
        _assert_cargo_capacity(b, effective_cbm, exclude_line_id=line.id)
    _validate_clearance_selection(db, merged, b)
    if merged.get("clearance_through_us") is True:
        data["manual_clearance_agent_name"] = None
        data["manual_clearance_agent_phone"] = None
        data["manual_clearance_agent_notes"] = None
    elif merged.get("clearance_through_us") is False:
        data["clearance_agent_id"] = None
        data["clearance_agent_rate_id"] = None
    for field, value in data.items():
        setattr(line, field, value)

    if b and b.mode == "AIR":
        _compute_air_weights(line)
    if b:
        _promote_lcl_to_fcl_if_needed(db, b, effective_full_client)
        if effective_full_client:
            _refresh_booking_rate_snapshot(db, b)
        db.flush()
        _recalculate_freight_shares(db, b)

    db.commit()
    db.refresh(line)
    return _serialize_line(line)


@router.delete("/{booking_id}/cargo-lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_line(
    booking_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if b:
        _assert_cargo_editable(b)
    db.delete(line)
    if b:
        db.flush()
        _recalculate_freight_shares(db, b)
    db.commit()


# ── Images ────────────────────────────────────────────────────────────────────

@router.post("/{booking_id}/cargo-lines/{line_id}/images", response_model=list[BookingCargoImageResponse])
async def upload_cargo_images(
    booking_id: int,
    line_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")

    img_dir = os.path.join(UPLOAD_DIR, str(booking_id), str(line_id))
    os.makedirs(img_dir, exist_ok=True)

    created: list[BookingCargoImage] = []
    for f in files:
        ext = os.path.splitext(f.filename or "img.jpg")[1].lower() or ".jpg"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(img_dir, fname)
        with open(fpath, "wb") as fp:
            fp.write(await f.read())
        img = BookingCargoImage(
            cargo_line_id=line_id,
            file_path=f"bookings/{booking_id}/{line_id}/{fname}",
            original_filename=f.filename,
        )
        db.add(img)
        created.append(img)

    db.commit()
    for img in created:
        db.refresh(img)

    return [
        BookingCargoImageResponse(
            id=img.id,
            file_path=img.file_path,
            original_filename=img.original_filename,
            uploaded_at=img.uploaded_at,
        )
        for img in created
    ]


@router.get("/{booking_id}/cargo-lines/{line_id}/images/{img_id}")
def serve_cargo_image(
    booking_id: int,
    line_id: int,
    img_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    img = db.query(BookingCargoImage).filter(
        BookingCargoImage.id == img_id,
        BookingCargoImage.cargo_line_id == line_id,
    ).first()
    if not img:
        raise HTTPException(404, "Image not found")

    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, img.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Image file not found on disk")

    return FileResponse(full_path)


@router.delete("/{booking_id}/cargo-lines/{line_id}/images/{img_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_image(
    booking_id: int,
    line_id: int,
    img_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    img = db.query(BookingCargoImage).filter(
        BookingCargoImage.id == img_id,
        BookingCargoImage.cargo_line_id == line_id,
    ).first()
    if not img:
        raise HTTPException(404, "Image not found")

    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, img.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)

    db.delete(img)
    db.commit()


# ── Cargo Documents ──────────────────────────────────────────────────────────

@router.post("/{booking_id}/cargo-lines/{line_id}/documents/{document_type}", response_model=list[BookingCargoDocumentResponse])
async def upload_cargo_documents(
    booking_id: int,
    line_id: int,
    document_type: str,
    files: list[UploadFile] = File(...),
    custom_file_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    doc_type = document_type.strip().lower()
    if doc_type not in DOCUMENT_TYPES:
        raise HTTPException(400, "document_type must be pi, ci, pl, sc, co, bl_copy, security_approval, goods_invoice or other")
    if doc_type == "invoice":
        doc_type = "goods_invoice"
    if doc_type == "other" and not custom_file_type:
        raise HTTPException(400, "custom_file_type is required for other documents")
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")

    client_folder = (line.client.client_code if line.client else f"line-{line_id}").replace("/", "-")
    doc_dir = os.path.join(UPLOAD_DIR, str(booking_id), "clients", client_folder, "documents", doc_type)
    os.makedirs(doc_dir, exist_ok=True)

    created: list[BookingCargoDocument] = []
    for f in files:
        ext = os.path.splitext(f.filename or "file.bin")[1].lower() or ".bin"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(doc_dir, fname)
        with open(fpath, "wb") as fp:
            fp.write(await f.read())
        doc = BookingCargoDocument(
            cargo_line_id=line_id,
            document_type=doc_type,
            custom_file_type=custom_file_type if doc_type == "other" else None,
            file_path=f"bookings/{booking_id}/clients/{client_folder}/documents/{doc_type}/{fname}",
            original_filename=f.filename,
        )
        db.add(doc)
        created.append(doc)

    db.commit()
    for doc in created:
        db.refresh(doc)
    return [
        BookingCargoDocumentResponse(
            id=doc.id,
            document_type=doc.document_type,
            custom_file_type=doc.custom_file_type,
            file_path=doc.file_path,
            original_filename=doc.original_filename,
            uploaded_at=doc.uploaded_at,
        )
        for doc in created
    ]


@router.get("/{booking_id}/cargo-lines/{line_id}/documents/{doc_id}")
def serve_cargo_document(
    booking_id: int,
    line_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(BookingCargoDocument).filter(
        BookingCargoDocument.id == doc_id,
        BookingCargoDocument.cargo_line_id == line_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, doc.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Document file not found on disk")
    return FileResponse(full_path, filename=doc.original_filename)


@router.delete("/{booking_id}/cargo-lines/{line_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_document(
    booking_id: int,
    line_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    doc = db.query(BookingCargoDocument).filter(
        BookingCargoDocument.id == doc_id,
        BookingCargoDocument.cargo_line_id == line_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path = os.path.join(uploads_root, doc.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)
    db.delete(doc)
    db.commit()


@router.post("/{booking_id}/cargo-lines/{line_id}/extract-documents", response_model=BookingCargoLineResponse)
def extract_cargo_documents(
    booking_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STAFF)),
):
    line = db.query(BookingCargoLine).filter(
        BookingCargoLine.id == line_id,
        BookingCargoLine.booking_id == booking_id,
    ).first()
    if not line:
        raise HTTPException(404, "Cargo line not found")
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    _assert_cargo_editable(b)

    docs = [
        doc for doc in line.documents
        if doc.document_type in {"pl", "pi", "ci", "sc", "co", "bl_copy", "goods_invoice", "other"}
    ]
    if not docs:
        raise HTTPException(400, "Upload PI, PL, SC, CO, B/L or invoice files before extracting cargo data.")

    text_by_type: dict[str, str] = {}
    source_docs = []
    for doc in docs:
        full_path = _doc_full_path(doc.file_path)
        if not os.path.isfile(full_path):
            continue
        text = _read_document_text(full_path)
        if not text.strip():
            continue
        key = doc.document_type
        text_by_type[key] = f"{text_by_type.get(key, '')}\n{text}"
        source_docs.append({
            "id": doc.id,
            "type": doc.document_type,
            "filename": doc.original_filename,
            "characters": len(text),
        })

    if not text_by_type:
        raise HTTPException(400, "Could not extract readable text from the uploaded files.")

    parsed = _parse_cargo_documents(text_by_type)
    fields = parsed["fields"]
    if line.description and re.match(r"^\s*1\.\s+", line.description):
        line.description = None
    if line.description_ar and re.match(r"^\s*1\.\s+", line.description_ar):
        line.description_ar = None
    if fields.get("hs_code"):
        line.hs_code = fields["hs_code"]
    if fields.get("shipping_marks"):
        line.shipping_marks = fields["shipping_marks"]
    if fields.get("cartons") is not None:
        line.cartons = fields["cartons"]
    if fields.get("gross_weight_kg") is not None:
        line.gross_weight_kg = fields["gross_weight_kg"]
    if fields.get("net_weight_kg") is not None:
        line.net_weight_kg = fields["net_weight_kg"]
    if fields.get("cbm") is not None:
        _assert_cargo_capacity(b, fields["cbm"], exclude_line_id=line.id)
        line.cbm = fields["cbm"]

    booking_fields = parsed.get("booking_fields") or {}
    for field in ("container_no", "seal_no", "bl_number"):
        value = booking_fields.get(field)
        if value and not getattr(b, field):
            setattr(b, field, value)

    line.extracted_goods = {
        "version": 1,
        "extracted_at": datetime.utcnow().isoformat() + "Z",
        "confidence": parsed.get("confidence"),
        "invoice_no": parsed.get("invoice_no"),
        "source_documents": source_docs,
        "goods": parsed.get("goods") or [],
    }

    if b.mode == "AIR":
        _compute_air_weights(line)
    db.flush()
    _recalculate_freight_shares(db, b)
    db.commit()
    db.refresh(line)
    return _serialize_line(line)


# ── Loading Info ─────────────────────────────────────────────────────────────

class LoadingInfoUpdate(BaseModel):
    loading_warehouse_id: Optional[int] = None
    loading_date:         Optional[datetime] = None
    loading_notes:        Optional[str] = None


@router.patch("/{booking_id}/loading-info")
def update_loading_info(
    booking_id: int,
    payload: LoadingInfoUpdate,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if payload.loading_warehouse_id is not None:
        wh = db.query(CompanyWarehouse).filter(CompanyWarehouse.id == payload.loading_warehouse_id).first()
        if not wh:
            raise HTTPException(404, "Warehouse not found")
        b.loading_warehouse_id = payload.loading_warehouse_id
    if payload.loading_date is not None:
        b.loading_date = payload.loading_date
    if payload.loading_notes is not None:
        b.loading_notes = payload.loading_notes or None
    db.commit()
    db.refresh(b)
    return _serialize_booking(b)


# ── Loading Photos ────────────────────────────────────────────────────────────

@router.post("/{booking_id}/loading-photos")
async def upload_loading_photos(
    booking_id: int,
    files:   list[UploadFile] = File(...),
    caption: str | None       = None,
    db:      Session          = Depends(get_db),
    _:       User             = Depends(require_role(UserRole.STAFF)),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    photo_dir = os.path.join(UPLOAD_DIR, str(booking_id), "loading")
    os.makedirs(photo_dir, exist_ok=True)

    created = []
    for f in files:
        ext   = os.path.splitext(f.filename or "photo.jpg")[1].lower() or ".jpg"
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(photo_dir, fname)
        with open(fpath, "wb") as fp:
            fp.write(await f.read())
        photo = BookingLoadingPhoto(
            booking_id=booking_id,
            file_path=f"bookings/{booking_id}/loading/{fname}",
            original_filename=f.filename,
            caption=caption or None,
        )
        db.add(photo)
        created.append(photo)

    db.commit()
    for p in created:
        db.refresh(p)

    return [
        {"id": p.id, "file_path": p.file_path, "original_filename": p.original_filename,
         "caption": p.caption, "uploaded_at": p.uploaded_at}
        for p in created
    ]


@router.get("/{booking_id}/loading-photos/{photo_id}")
def serve_loading_photo(
    booking_id: int,
    photo_id:   int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    photo = db.query(BookingLoadingPhoto).filter(
        BookingLoadingPhoto.id == photo_id,
        BookingLoadingPhoto.booking_id == booking_id,
    ).first()
    if not photo:
        raise HTTPException(404, "Photo not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path    = os.path.join(uploads_root, photo.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "Photo file not found on disk")
    return FileResponse(full_path)


@router.delete("/{booking_id}/loading-photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loading_photo(
    booking_id: int,
    photo_id:   int,
    db: Session = Depends(get_db),
    _: User     = Depends(require_role(UserRole.STAFF)),
):
    photo = db.query(BookingLoadingPhoto).filter(
        BookingLoadingPhoto.id == photo_id,
        BookingLoadingPhoto.booking_id == booking_id,
    ).first()
    if not photo:
        raise HTTPException(404, "Photo not found")
    uploads_root = os.path.dirname(UPLOAD_DIR)
    full_path    = os.path.join(uploads_root, photo.file_path)
    if os.path.isfile(full_path):
        os.remove(full_path)
    db.delete(photo)
    db.commit()


# ── Packing List ──────────────────────────────────────────────────────────────

@router.get("/{booking_id}/packing-list")
def get_packing_list(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User     = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")

    lines_data = []
    totals = {"cartons": 0, "gross_weight_kg": Decimal("0"), "net_weight_kg": Decimal("0"), "cbm": Decimal("0")}

    for ln in b.cargo_lines:
        lines_data.append({
            "client_name": ln.client.name if ln.client else "",
            "client_name_ar": ln.client.name_ar if ln.client else "",
            "client_code": ln.client.client_code if ln.client else "",
            "goods_source": ln.goods_source,
            "is_full_container_client": bool(ln.is_full_container_client),
            "shipping_marks": ln.shipping_marks or "",
            "description": ln.description or "",
            "description_ar": ln.description_ar or "",
            "hs_code": ln.hs_code or "",
            "cartons": ln.cartons or 0,
            "gross_weight_kg": float(ln.gross_weight_kg) if ln.gross_weight_kg else 0,
            "net_weight_kg": float(ln.net_weight_kg) if ln.net_weight_kg else 0,
            "cbm": float(ln.cbm) if ln.cbm else 0,
            "chargeable_weight_kg": float(ln.chargeable_weight_kg) if ln.chargeable_weight_kg else None,
            "freight_share": float(ln.freight_share) if ln.freight_share else None,
            "extracted_goods": ln.extracted_goods,
        })
        totals["cartons"] += ln.cartons or 0
        totals["gross_weight_kg"] += Decimal(str(ln.gross_weight_kg)) if ln.gross_weight_kg else 0
        totals["net_weight_kg"]   += Decimal(str(ln.net_weight_kg))   if ln.net_weight_kg   else 0
        totals["cbm"]             += Decimal(str(ln.cbm))             if ln.cbm             else 0

    return {
        "booking_number": b.booking_number,
        "mode": b.mode,
        "container_size": b.container_size,
        "container_no": b.container_no,
        "seal_no": b.seal_no,
        "bl_number": b.bl_number,
        "awb_number": b.awb_number,
        "vessel_name": b.vessel_name,
        "flight_number": b.flight_number,
        "port_of_loading": b.port_of_loading,
        "port_of_discharge": b.port_of_discharge,
        "etd": str(b.etd) if b.etd else None,
        "eta": str(b.eta) if b.eta else None,
        "incoterm": b.incoterm,
        "agent_name": b.agent.name if b.agent else None,
        "lines": lines_data,
        "totals": {
            "cartons": totals["cartons"],
            "gross_weight_kg": float(totals["gross_weight_kg"]),
            "net_weight_kg": float(totals["net_weight_kg"]),
            "cbm": float(totals["cbm"]),
        },
    }
