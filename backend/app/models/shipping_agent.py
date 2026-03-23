from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ShippingAgent(Base):
    __tablename__ = "shipping_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    name_ar = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True)   # e.g. China
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    whatsapp = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    # Sea cargo prices (USD)
    price_20gp = Column(Numeric(10, 2), nullable=True)   # 20GP container
    price_40ft = Column(Numeric(10, 2), nullable=True)   # 40FT container
    price_40hq = Column(Numeric(10, 2), nullable=True)   # 40HQ container

    # Air cargo (USD per KG)
    price_air_kg = Column(Numeric(10, 2), nullable=True)

    # Transit time (days)
    transit_sea_days = Column(Integer, nullable=True)
    transit_air_days = Column(Integer, nullable=True)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    containers = relationship("Container", back_populates="shipping_agent")
