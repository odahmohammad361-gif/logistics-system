from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class CompanySettings(Base):
    """Seller / company info used on all invoices"""
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Identity
    name = Column(String(300), nullable=False)
    name_ar = Column(String(300), nullable=True)
    tagline = Column(String(300), nullable=True)
    tagline_ar = Column(String(300), nullable=True)

    # Contact
    address = Column(Text, nullable=True)
    address_ar = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)

    # Bank details (default — can be overridden per invoice)
    bank_account_name = Column(String(200), nullable=True)
    bank_account_no = Column(String(100), nullable=True)
    bank_swift = Column(String(20), nullable=True)
    bank_name = Column(String(200), nullable=True)
    bank_address = Column(Text, nullable=True)

    # Assets
    logo_path = Column(String(500), nullable=True)       # company logo PNG
    stamp_path = Column(String(500), nullable=True)      # default stamp/signature PNG

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
