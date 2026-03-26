import re
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.container import Container, ContainerType, ContainerStatus
from app.models.container_client import ContainerClient
from app.models.client import Client
from app.models.shipping_agent import ShippingAgent
from app.schemas.container import (
    ContainerCreate, ContainerUpdate, ContainerStatusUpdate,
    ContainerResponse, ContainerListResponse, ContainerCapacity,
    ContainerClientResponse,
)
from app.utils.constants import CONTAINER_LIMITS

router = APIRouter()

_SEA_TYPES = {ContainerType.GP20, ContainerType.FT40, ContainerType.HQ40}


def _booking_number(db: Session, container_type: ContainerType) -> str:
    year = datetime.now(timezone.utc).year
    prefix = "AIR" if container_type == ContainerType.AIR else "SEA"
    count = db.query(Container).filter(
        Container.booking_number.like(f"{prefix}-{year}-%")
    ).count()
    return f"{prefix}-{year}-{str(count + 1).zfill(4)}"


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=ContainerResponse, status_code=status.HTTP_201_CREATED)
def create_container(
    payload: ContainerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    client = db.query(Client).filter(Client.id == payload.client_id, Client.is_active == True).first()
    if not client:
        raise HTTPException(404, "Client not found")

    if payload.shipping_agent_id:
        agent = db.query(ShippingAgent).filter(
            ShippingAgent.id == payload.shipping_agent_id,
            ShippingAgent.is_active == True,
        ).first()
        if not agent:
            raise HTTPException(404, "Shipping agent not found")

    booking_number = _booking_number(db, payload.container_type)

    # Auto-set cargo_mode if not provided
    cargo_mode = payload.cargo_mode
    if not cargo_mode:
        if payload.container_type == ContainerType.AIR:
            cargo_mode = "AIR"
        elif payload.is_lcl:
            cargo_mode = "LCL"
        else:
            cargo_mode = "FCL"

    container = Container(
        booking_number=booking_number,
        container_type=payload.container_type,
        container_number=payload.container_number,
        status=ContainerStatus.BOOKING,
        client_id=payload.client_id,
        shipping_agent_id=payload.shipping_agent_id,
        seal_no=payload.seal_no,
        bl_number=payload.bl_number,
        is_lcl=payload.is_lcl,
        cargo_mode=cargo_mode,
        shipping_term=payload.shipping_term,
        payment_terms=payload.payment_terms,
        cbm=payload.cbm,
        cartons=payload.cartons,
        net_weight=payload.net_weight,
        gross_weight=payload.gross_weight,
        port_of_loading=payload.port_of_loading,
        port_of_discharge=payload.port_of_discharge,
        etd=payload.etd,
        eta=payload.eta,
        freight_cost=payload.freight_cost,
        currency=payload.currency,
        goods_description=payload.goods_description,
        goods_description_ar=payload.goods_description_ar,
        notes=payload.notes,
        branch_id=payload.branch_id,
        created_by_id=current_user.id,
    )
    db.add(container)
    db.flush()

    # Add LCL clients if provided
    for lc in payload.lcl_clients:
        cc = ContainerClient(
            container_id=container.id,
            client_id=lc.client_id,
            cbm=lc.cbm,
            cartons=lc.cartons,
            net_weight=lc.net_weight,
            gross_weight=lc.gross_weight,
            freight_share=lc.freight_share,
            notes=lc.notes,
        )
        db.add(cc)

    db.commit()
    db.refresh(container)
    return container


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=ContainerListResponse)
def list_containers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    client_id: int = Query(None),
    container_type: ContainerType = Query(None),
    status_filter: ContainerStatus = Query(None, alias="status"),
    search: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Container).filter(Container.is_active == True)

    if client_id:
        q = q.filter(Container.client_id == client_id)
    if container_type:
        q = q.filter(Container.container_type == container_type)
    if status_filter:
        q = q.filter(Container.status == status_filter)
    if search:
        q = q.filter(Container.booking_number.ilike(f"%{search}%"))

    total = q.count()
    results = q.order_by(Container.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ContainerListResponse(total=total, page=page, page_size=page_size, results=results)


# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/{container_id}", response_model=ContainerResponse)
def get_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.is_active == True,
    ).first()
    if not container:
        raise HTTPException(404, "Container booking not found")
    return container


# ── Capacity ──────────────────────────────────────────────────────────────────

@router.get("/{container_id}/capacity", response_model=ContainerCapacity)
def get_container_capacity(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return capacity utilization for a container."""
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.is_active == True,
    ).first()
    if not container:
        raise HTTPException(404, "Container booking not found")

    ctype = container.container_type.value if hasattr(container.container_type, "value") else container.container_type
    limits = CONTAINER_LIMITS.get(ctype, {"max_weight_tons": None, "max_cbm": None})

    used_cbm = float(container.cbm or 0)
    used_weight_tons = float(container.gross_weight or 0) / 1000.0  # kg → tons

    max_cbm = limits["max_cbm"]
    max_weight = limits["max_weight_tons"]

    cbm_pct = round((used_cbm / max_cbm * 100), 1) if max_cbm else 0.0
    weight_pct = round((used_weight_tons / max_weight * 100), 1) if max_weight else 0.0

    # Agent price for this container type
    agent_price = None
    if container.shipping_agent:
        price_map = {
            "20GP": container.shipping_agent.price_20gp,
            "40FT": container.shipping_agent.price_40ft,
            "40HQ": container.shipping_agent.price_40hq,
            "AIR": container.shipping_agent.price_air_kg,
        }
        agent_price = price_map.get(ctype)

    return ContainerCapacity(
        container_type=ctype,
        max_cbm=max_cbm,
        max_weight_tons=max_weight,
        used_cbm=used_cbm,
        used_weight_tons=used_weight_tons,
        cbm_pct=cbm_pct,
        weight_pct=weight_pct,
        agent_price=agent_price,
        lcl_clients=[ContainerClientResponse.model_validate(cc) for cc in container.lcl_clients],
    )


# ── OCR ───────────────────────────────────────────────────────────────────────

@router.post("/ocr")
def ocr_container_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    """
    Extract B/L number, seal number, container number, and cargo mode
    from an uploaded container document image using OCR.
    Returns extracted fields for user review before saving.
    """
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance
    except ImportError:
        raise HTTPException(500, "OCR dependencies not installed (pytesseract, pillow)")

    content = file.file.read()
    try:
        image = Image.open(io.BytesIO(content))
        # Pre-process for better OCR accuracy
        image = image.convert("L")  # grayscale
        image = image.filter(ImageFilter.SHARPEN)
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
    except Exception:
        raise HTTPException(400, "Invalid image file")

    try:
        raw_text = pytesseract.image_to_string(image, lang="eng")
    except Exception as e:
        raise HTTPException(500, f"OCR failed: {str(e)}")

    text_upper = raw_text.upper()

    # Extract B/L number
    bl_number = None
    bl_patterns = [
        r'B[/\\]L\s*(?:NO\.?|NUMBER|#)?\s*:?\s*([A-Z0-9\-]{6,20})',
        r'BILL\s+OF\s+LADING\s*(?:NO\.?|#)?\s*:?\s*([A-Z0-9\-]{6,20})',
        r'BL\s*(?:NO\.?|#)?\s*:?\s*([A-Z0-9\-]{6,20})',
    ]
    for pat in bl_patterns:
        m = re.search(pat, text_upper)
        if m:
            bl_number = m.group(1).strip()
            break

    # Extract seal number
    seal_no = None
    seal_patterns = [
        r'SEAL\s*(?:NO\.?|NUMBER|#)?\s*:?\s*([A-Z0-9]{4,15})',
        r'SEAL\s*:?\s*([A-Z0-9]{4,15})',
        r'S/N\s*:?\s*([A-Z0-9]{4,15})',
    ]
    for pat in seal_patterns:
        m = re.search(pat, text_upper)
        if m:
            seal_no = m.group(1).strip()
            break

    # Extract container number (ISO format: 4 letters + 7 digits)
    container_number = None
    cntr_patterns = [
        r'CNTR\s*(?:NO\.?|NUMBER|#)?\s*:?\s*([A-Z]{4}\d{7})',
        r'CONTAINER\s*(?:NO\.?|NUMBER|#)?\s*:?\s*([A-Z]{4}\d{7})',
        r'(?<![A-Z])([A-Z]{4}\d{7})(?![A-Z\d])',
    ]
    for pat in cntr_patterns:
        m = re.search(pat, text_upper)
        if m:
            container_number = m.group(1).strip()
            break

    # Detect FCL vs LCL
    cargo_mode = "unknown"
    if "FCL" in text_upper or "FULL CONTAINER" in text_upper:
        cargo_mode = "FCL"
    elif "LCL" in text_upper or "LESS THAN CONTAINER" in text_upper:
        cargo_mode = "LCL"

    return {
        "bl_number": bl_number,
        "seal_no": seal_no,
        "container_number": container_number,
        "cargo_mode": cargo_mode,
        "raw_text": raw_text[:2000],  # limit response size
    }


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{container_id}", response_model=ContainerResponse)
def update_container(
    container_id: int,
    payload: ContainerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.is_active == True,
    ).first()
    if not container:
        raise HTTPException(404, "Container booking not found")

    if payload.shipping_agent_id is not None:
        agent = db.query(ShippingAgent).filter(
            ShippingAgent.id == payload.shipping_agent_id,
            ShippingAgent.is_active == True,
        ).first()
        if not agent:
            raise HTTPException(404, "Shipping agent not found")

    # Handle LCL clients update separately
    lcl_clients_data = None
    update_data = payload.model_dump(exclude_unset=True)
    if "lcl_clients" in update_data:
        lcl_clients_data = update_data.pop("lcl_clients")

    for field, value in update_data.items():
        setattr(container, field, value)

    if lcl_clients_data is not None:
        # Replace all LCL client entries
        for cc in container.lcl_clients:
            db.delete(cc)
        db.flush()
        for lc in lcl_clients_data:
            cc = ContainerClient(
                container_id=container.id,
                client_id=lc["client_id"],
                cbm=lc.get("cbm"),
                cartons=lc.get("cartons"),
                net_weight=lc.get("net_weight"),
                gross_weight=lc.get("gross_weight"),
                freight_share=lc.get("freight_share"),
                notes=lc.get("notes"),
            )
            db.add(cc)

    db.commit()
    db.refresh(container)
    return container


# ── Status transition ─────────────────────────────────────────────────────────

@router.patch("/{container_id}/status", response_model=ContainerResponse)
def update_status(
    container_id: int,
    payload: ContainerStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.is_active == True,
    ).first()
    if not container:
        raise HTTPException(404, "Container booking not found")

    container.status = payload.status
    db.commit()
    db.refresh(container)
    return container


# ── Delete (soft) ─────────────────────────────────────────────────────────────

@router.delete("/{container_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_container(
    container_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.is_active == True,
    ).first()
    if not container:
        raise HTTPException(404, "Container booking not found")

    container.is_active = False
    db.commit()
