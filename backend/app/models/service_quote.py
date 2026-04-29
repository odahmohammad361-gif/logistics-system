import enum
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ServiceQuoteMode(str, enum.Enum):
    SEA_LCL = "SEA_LCL"
    SEA_FCL = "SEA_FCL"
    AIR = "AIR"


class ServiceQuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    INVOICED = "invoiced"
    CANCELLED = "cancelled"


class ServiceQuoteScope(str, enum.Enum):
    PORT_TO_PORT = "port_to_port"
    WAREHOUSE_TO_PORT = "warehouse_to_port"
    FACTORY_TO_PORT = "factory_to_port"
    WAREHOUSE_TO_DOOR = "warehouse_to_door"
    FACTORY_TO_DOOR = "factory_to_door"


class ServiceQuote(Base):
    """Client-facing logistics service quote.

    This snapshots the client sell calculation separately from the agent's live
    buy/sell rate tables so old offers remain stable when weekly rates change.
    """

    __tablename__ = "service_quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(60), unique=True, nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    booking_cargo_line_id = Column(Integer, ForeignKey("booking_cargo_lines.id"), nullable=True, index=True)

    mode = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, default=ServiceQuoteStatus.DRAFT.value, index=True)
    service_scope = Column(String(40), nullable=False, default=ServiceQuoteScope.WAREHOUSE_TO_PORT.value)
    cargo_source = Column(String(40), nullable=False, default="outside_supplier")

    origin_country = Column(String(80), nullable=True)
    origin_city = Column(String(120), nullable=True)
    pickup_address = Column(Text, nullable=True)
    loading_warehouse_id = Column(Integer, ForeignKey("company_warehouses.id"), nullable=True)
    port_of_loading = Column(String(150), nullable=True)
    port_of_discharge = Column(String(150), nullable=True)
    destination_country = Column(String(80), nullable=True)
    destination_city = Column(String(120), nullable=True)
    final_address = Column(Text, nullable=True)

    container_size = Column(String(10), nullable=True)
    cbm = Column(Numeric(10, 4), nullable=True)
    gross_weight_kg = Column(Numeric(12, 3), nullable=True)
    chargeable_weight_kg = Column(Numeric(12, 3), nullable=True)
    cartons = Column(Integer, nullable=True)
    goods_description = Column(Text, nullable=True)

    clearance_through_us = Column(Boolean, nullable=False, default=False)
    delivery_through_us = Column(Boolean, nullable=False, default=False)
    clearance_agent_id = Column(Integer, ForeignKey("clearance_agents.id"), nullable=True)
    clearance_agent_rate_id = Column(Integer, ForeignKey("clearance_agent_rates.id"), nullable=True)
    customs_value_usd = Column(Numeric(14, 2), nullable=True)

    shipping_agent_id = Column(Integer, ForeignKey("shipping_agents.id"), nullable=True)
    agent_carrier_rate_id = Column(Integer, ForeignKey("agent_carrier_rates.id"), nullable=True)
    agent_quote_id = Column(Integer, ForeignKey("shipping_quotes.id"), nullable=True)
    city_fee_id = Column(Integer, ForeignKey("service_quote_city_fees.id"), nullable=True)
    carrier_name = Column(String(120), nullable=True)

    currency = Column(String(10), nullable=False, default="USD")
    rate_basis = Column(String(30), nullable=True)  # cbm | kg | container | manual
    buy_rate = Column(Numeric(14, 4), nullable=True)
    sell_rate = Column(Numeric(14, 4), nullable=True)
    chargeable_quantity = Column(Numeric(14, 4), nullable=True)

    freight_buy = Column(Numeric(14, 2), nullable=False, default=0)
    freight_sell = Column(Numeric(14, 2), nullable=False, default=0)
    origin_fees_buy = Column(Numeric(14, 2), nullable=False, default=0)
    origin_fees_sell = Column(Numeric(14, 2), nullable=False, default=0)
    destination_fees_buy = Column(Numeric(14, 2), nullable=False, default=0)
    destination_fees_sell = Column(Numeric(14, 2), nullable=False, default=0)
    other_fees_buy = Column(Numeric(14, 2), nullable=False, default=0)
    other_fees_sell = Column(Numeric(14, 2), nullable=False, default=0)
    total_buy = Column(Numeric(14, 2), nullable=False, default=0)
    total_sell = Column(Numeric(14, 2), nullable=False, default=0)
    profit = Column(Numeric(14, 2), nullable=False, default=0)
    margin_pct = Column(Numeric(8, 2), nullable=True)

    rate_snapshot = Column(JSON, nullable=True)
    calculation_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client")
    invoice = relationship("Invoice")
    booking = relationship("Booking")
    booking_cargo_line = relationship("BookingCargoLine")
    loading_warehouse = relationship("CompanyWarehouse")
    clearance_agent = relationship("ClearanceAgent")
    clearance_agent_rate = relationship("ClearanceAgentRate")
    shipping_agent = relationship("ShippingAgent")
    agent_carrier_rate = relationship("AgentCarrierRate")
    agent_quote = relationship("ShippingQuote")
    city_fee = relationship("ServiceQuoteCityFee")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ServiceQuoteCityFee(Base):
    """Origin pickup/trucking rule by city and loading port.

    Example: Ningbo factory -> Ningbo port or Foshan warehouse -> Yantian.
    These rules are optional helpers; manual fees can still override them.
    """

    __tablename__ = "service_quote_city_fees"

    id = Column(Integer, primary_key=True, index=True)
    origin_country = Column(String(80), nullable=True, default="China")
    origin_city = Column(String(120), nullable=False, index=True)
    port_of_loading = Column(String(150), nullable=True, index=True)
    service_scope = Column(String(40), nullable=True)
    buy_trucking = Column(Numeric(14, 2), nullable=False, default=0)
    sell_trucking = Column(Numeric(14, 2), nullable=False, default=0)
    buy_handling = Column(Numeric(14, 2), nullable=False, default=0)
    sell_handling = Column(Numeric(14, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])
