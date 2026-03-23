from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ContainerType(str, enum.Enum):
    GP20 = "20GP"
    FT40 = "40FT"
    HQ40 = "40HQ"
    AIR = "AIR"


class ContainerStatus(str, enum.Enum):
    BOOKING = "booking"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    CLEARED = "cleared"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Container(Base):
    __tablename__ = "containers"

    id = Column(Integer, primary_key=True, index=True)
    booking_number = Column(String(60), unique=True, nullable=False, index=True)
    container_number = Column(String(30), nullable=True)
    container_type = Column(Enum(ContainerType), nullable=False)
    status = Column(Enum(ContainerStatus), nullable=False, default=ContainerStatus.BOOKING)

    # Client link (CORE dependency)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    # Shipping agent link
    shipping_agent_id = Column(Integer, ForeignKey("shipping_agents.id"), nullable=True)

    # Cargo details
    cbm = Column(Numeric(10, 4), nullable=True)        # Cubic meters
    cartons = Column(Integer, nullable=True)            # CTN count
    net_weight = Column(Numeric(10, 3), nullable=True)  # KG
    gross_weight = Column(Numeric(10, 3), nullable=True) # KG

    # Route
    port_of_loading = Column(String(100), nullable=True)   # e.g. Guangzhou
    port_of_discharge = Column(String(100), nullable=True) # e.g. Aqaba
    etd = Column(DateTime(timezone=True), nullable=True)   # Estimated departure
    eta = Column(DateTime(timezone=True), nullable=True)   # Estimated arrival

    # Financials
    freight_cost = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(10), nullable=False, default="USD")

    # Commodity
    goods_description = Column(Text, nullable=True)
    goods_description_ar = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="containers")
    shipping_agent = relationship("ShippingAgent", back_populates="containers")
    created_by = relationship("User", foreign_keys=[created_by_id])
