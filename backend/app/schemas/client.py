from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class BranchShort(BaseModel):
    id: int
    name: str
    name_ar: str
    code: str

    model_config = {"from_attributes": True}


class ClientCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    company_name_ar: Optional[str] = None
    tax_number: Optional[str] = None
    branch_id: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Client name cannot be empty")
        return v.strip()


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    company_name_ar: Optional[str] = None
    tax_number: Optional[str] = None
    branch_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    id: int
    client_code: str
    name: str
    name_ar: Optional[str]
    phone: Optional[str]
    whatsapp: Optional[str]
    email: Optional[str]
    country: Optional[str]
    city: Optional[str]
    address: Optional[str]
    company_name: Optional[str]
    company_name_ar: Optional[str]
    tax_number: Optional[str]
    is_active: bool
    notes: Optional[str]
    branch: Optional[BranchShort]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ClientResponse]
