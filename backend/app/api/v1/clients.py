import io
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.client import Client
from app.models.branch import Branch
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientListResponse

router = APIRouter()


def _generate_client_code(db: Session, branch_code: str) -> str:
    """
    Generate sequential client code like JO-0001, JO-0042.
    Uses the last existing code (by ID) to avoid gaps from soft-deletes.
    """
    prefix = f"{branch_code}-"
    last = (
        db.query(Client)
        .filter(Client.client_code.like(f"{prefix}%"))
        .order_by(Client.id.desc())
        .first()
    )
    if last:
        try:
            last_num = int(last.client_code.rsplit("-", 1)[-1])
        except (ValueError, IndexError):
            last_num = 0
    else:
        last_num = 0
    return f"{prefix}{str(last_num + 1).zfill(4)}"


# ── Create ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    branch_code = "JO"  # default branch
    if payload.branch_id:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        branch_code = branch.code

    client_code = _generate_client_code(db, branch_code)

    client = Client(
        **payload.model_dump(),
        client_code=client_code,
        created_by_id=current_user.id,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


# ── List ───────────────────────────────────────────────────────────────────────
@router.get("", response_model=ClientListResponse)
def list_clients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str = Query("", description="Search by name, code, phone"),
    branch_id: int = Query(None),
    is_active: bool = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Client)

    if search:
        term = f"%{search}%"
        q = q.filter(
            Client.name.ilike(term)
            | Client.name_ar.ilike(term)
            | Client.client_code.ilike(term)
            | Client.company_name.ilike(term)
            | Client.phone.ilike(term)
        )
    if branch_id is not None:
        q = q.filter(Client.branch_id == branch_id)
    if is_active is not None:
        q = q.filter(Client.is_active == is_active)

    total = q.count()
    results = q.order_by(Client.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ClientListResponse(total=total, page=page, page_size=page_size, results=results)


# ── Get one ────────────────────────────────────────────────────────────────────
@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


# ── Barcode (SVG) ──────────────────────────────────────────────────────────────
@router.get("/{client_id}/barcode")
def get_client_barcode(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a Code128 barcode SVG for the given client.
    The barcode encodes the client_code (e.g. JO-0001).
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    try:
        from barcode import Code128          # type: ignore[import]
        from barcode.writer import SVGWriter  # type: ignore[import]
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Barcode library not installed. Run: pip install python-barcode",
        )

    buffer = io.BytesIO()
    barcode = Code128(client.client_code, writer=SVGWriter())
    barcode.write(
        buffer,
        options={
            "module_height": 12.0,
            "module_width": 0.35,
            "quiet_zone": 6.0,
            "font_size": 8,
            "text_distance": 4.0,
            "background": "#ffffff",
            "foreground": "#000000",
            "write_text": True,
        },
    )
    buffer.seek(0)
    return Response(
        content=buffer.read(),
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'inline; filename="{client.client_code}.svg"'},
    )


# ── Update ─────────────────────────────────────────────────────────────────────
@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if payload.branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


# ── Set portal password ────────────────────────────────────────────────────────

class SetPortalPasswordRequest(BaseModel):
    password: Optional[str] = None
    generate: bool = False


@router.post("/{client_id}/set-portal-password")
def set_portal_password(
    client_id: int,
    payload: SetPortalPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if payload.generate or not payload.password:
        password = secrets.token_urlsafe(8)
    else:
        password = payload.password

    client.portal_password_hash = hash_password(password)
    db.commit()
    return {"password": password, "client_code": client.client_code, "name": client.name}


# ── Delete (soft) ──────────────────────────────────────────────────────────────
@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.is_active = False
    db.commit()
