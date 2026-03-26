from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.client import Client
from app.models.branch import Branch
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientListResponse

router = APIRouter()


def _generate_client_code(db: Session, branch_code: str) -> str:
    """Generate sequential client code like JO-0001, CN-0042"""
    prefix = f"{branch_code}-"
    count = db.query(Client).filter(Client.client_code.like(f"{prefix}%")).count()
    return f"{prefix}{str(count + 1).zfill(4)}"


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.STAFF)),
):
    # Resolve branch
    branch_code = "JO"  # default
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


@router.get("", response_model=ClientListResponse)
def list_clients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str = Query("", description="Search by name or code"),
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


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    # Soft delete
    client.is_active = False
    db.commit()
