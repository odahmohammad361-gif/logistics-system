from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text
from sqlalchemy.sql import func
from app.database import Base


class ClearanceAgent(Base):
    __tablename__ = "clearance_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    name_ar = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True)   # Jordan, Iraq, etc.
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    whatsapp = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    # Fees (USD)
    clearance_fee = Column(Numeric(10, 2), nullable=True)
    storage_fee_per_day = Column(Numeric(10, 2), nullable=True)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
