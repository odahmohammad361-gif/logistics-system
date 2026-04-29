from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from app.schemas.contact_validators import (
    clean_arabic_name,
    clean_optional_email,
    clean_optional_phone,
    clean_required_english_name,
    clean_english_name,
)


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
        return clean_required_english_name(v)

    @field_validator("name_ar", mode="before")
    @classmethod
    def valid_arabic_name(cls, v):
        return clean_arabic_name(v)

    @field_validator("phone", "whatsapp", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, v):
        return clean_optional_email(v)


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

    @field_validator("name", mode="before")
    @classmethod
    def valid_english_name(cls, v):
        return clean_english_name(v)

    @field_validator("name_ar", mode="before")
    @classmethod
    def valid_arabic_name(cls, v):
        return clean_arabic_name(v)

    @field_validator("phone", "whatsapp", mode="before")
    @classmethod
    def valid_phone(cls, v):
        return clean_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def valid_email(cls, v):
        return clean_optional_email(v)


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
