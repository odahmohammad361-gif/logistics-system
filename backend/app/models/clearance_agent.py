from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
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

    rates = relationship(
        "ClearanceAgentRate",
        back_populates="agent",
        order_by="ClearanceAgentRate.country, ClearanceAgentRate.service_mode, ClearanceAgentRate.port, ClearanceAgentRate.container_size, ClearanceAgentRate.carrier_name",
        cascade="all, delete-orphan",
    )
    edit_log = relationship(
        "ClearanceAgentEditLog",
        back_populates="agent",
        order_by="ClearanceAgentEditLog.changed_at.desc()",
        cascade="all, delete-orphan",
    )


class ClearanceAgentRate(Base):
    __tablename__ = "clearance_agent_rates"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("clearance_agents.id", ondelete="CASCADE"), nullable=False, index=True)

    service_mode = Column(String(10), nullable=False, default="sea")  # sea | air
    country = Column(String(100), nullable=True)                      # Jordan | Iraq
    port = Column(String(150), nullable=True)                         # Aqaba, Queen Alia, Umm Qasr...
    route = Column(String(200), nullable=True)                        # Aqaba -> Amman, airport -> warehouse...
    container_size = Column(String(20), nullable=True)                 # 20GP, 40GP, 40HQ for sea clearance
    carrier_name = Column(String(100), nullable=True)                  # shipping line / carrier reference

    buy_clearance_fee = Column(Numeric(10, 2), nullable=True)
    sell_clearance_fee = Column(Numeric(10, 2), nullable=True)
    buy_transportation = Column(Numeric(10, 2), nullable=True)
    sell_transportation = Column(Numeric(10, 2), nullable=True)
    buy_delivery_authorization = Column(Numeric(10, 2), nullable=True)
    sell_delivery_authorization = Column(Numeric(10, 2), nullable=True)
    buy_inspection_ramp = Column(Numeric(10, 2), nullable=True)
    sell_inspection_ramp = Column(Numeric(10, 2), nullable=True)
    buy_port_inspection = Column(Numeric(10, 2), nullable=True)
    sell_port_inspection = Column(Numeric(10, 2), nullable=True)

    buy_import_export_card_pct = Column(Numeric(7, 3), nullable=True)
    sell_import_export_card_pct = Column(Numeric(7, 3), nullable=True)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    agent = relationship("ClearanceAgent", back_populates="rates")


class ClearanceAgentEditLog(Base):
    __tablename__ = "clearance_agent_edit_log"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("clearance_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    summary = Column(Text, nullable=True)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent = relationship("ClearanceAgent", back_populates="edit_log")
    changed_by = relationship("User", foreign_keys=[changed_by_id])
