from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class CustomerSignup(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    telegram: Optional[str] = None
    country: str
    password: str


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
    telegram: Optional[str] = None
    country: str
    is_verified: bool
    created_at: datetime


class CustomerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerResponse
