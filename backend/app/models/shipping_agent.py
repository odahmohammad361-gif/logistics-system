from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ShippingAgent(Base):
    __tablename__ = "shipping_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    name_ar = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True)
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    whatsapp = Column(String(30), nullable=True)
    wechat_id = Column(String(100), nullable=True)        # WeChat contact ID
    email = Column(String(255), nullable=True)

    # Warehouse (origin — where they pick up cargo)
    warehouse_address = Column(Text, nullable=True)
    warehouse_city = Column(String(100), nullable=True)   # e.g. Guangzhou, Shenzhen

    # Bank details (for paying freight invoices)
    bank_name = Column(String(200), nullable=True)
    bank_account = Column(String(100), nullable=True)
    bank_swift = Column(String(20), nullable=True)

    # Quick reference prices (USD) — general ballpark; detailed quotes in shipping_quotes
    price_20gp = Column(Numeric(10, 2), nullable=True)
    price_40ft = Column(Numeric(10, 2), nullable=True)
    price_40hq = Column(Numeric(10, 2), nullable=True)
    price_air_kg = Column(Numeric(10, 2), nullable=True)
    transit_sea_days = Column(Integer, nullable=True)
    transit_air_days = Column(Integer, nullable=True)

    # Service modes offered by this agent
    serves_sea = Column(Boolean, default=True, nullable=False)
    serves_air = Column(Boolean, default=False, nullable=False)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    quotes = relationship("ShippingQuote", back_populates="agent")
