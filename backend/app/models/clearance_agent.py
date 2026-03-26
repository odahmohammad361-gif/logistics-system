from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text
from sqlalchemy.sql import func
from app.database import Base


class ClearanceAgent(Base):
    __tablename__ = "clearance_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    name_ar = Column(String(200), nullable=True)

    # Location
    country = Column(String(100), nullable=True)   # e.g. Jordan, Iraq
    city = Column(String(100), nullable=True)       # e.g. Aqaba, Amman, Umm Qasr, Baghdad
    address = Column(Text, nullable=True)

    # Contact
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    whatsapp = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    # Official
    license_number = Column(String(100), nullable=True)   # Customs broker license

    # Bank details (for paying their fees)
    bank_name = Column(String(200), nullable=True)
    bank_account = Column(String(100), nullable=True)
    bank_swift = Column(String(20), nullable=True)

    # Fees (USD, per shipment unless noted)
    clearance_fee = Column(Numeric(10, 2), nullable=True)       # Base customs clearance fee
    service_fee = Column(Numeric(10, 2), nullable=True)         # Brokerage / service charge
    transport_fee = Column(Numeric(10, 2), nullable=True)       # Port → final warehouse
    handling_fee = Column(Numeric(10, 2), nullable=True)        # Per-shipment handling
    storage_fee_per_day = Column(Numeric(10, 2), nullable=True) # Storage per day at port

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
