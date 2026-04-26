from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Text, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# CBM capacity per container size
CONTAINER_CBM: dict[str, float] = {
    "20GP": 28.0,
    "40GP": 57.0,
    "40HQ": 72.0,
}

BOOKING_MODES    = ("LCL", "FCL", "AIR")
BOOKING_STATUSES = ("draft", "confirmed", "in_transit", "arrived", "delivered", "cancelled")


class Booking(Base):
    __tablename__ = "bookings"

    id             = Column(Integer, primary_key=True, index=True)
    booking_number = Column(String(60), unique=True, nullable=False, index=True)
    mode           = Column(String(10),  nullable=False)           # LCL | FCL | AIR
    status         = Column(String(20),  nullable=False, default="draft")

    # Agent & Branch
    shipping_agent_id = Column(Integer, ForeignKey("shipping_agents.id"), nullable=True)
    # Link to the current agent carrier rate used to create this booking (snapshot)
    agent_carrier_rate_id = Column(Integer, ForeignKey("agent_carrier_rates.id"), nullable=True)
    is_agent_snapshot = Column(Boolean, default=False, nullable=False)
    branch_id         = Column(Integer, ForeignKey("branches.id"),        nullable=True)

    # Container / transport identifiers
    container_size = Column(String(10),  nullable=True)   # 20GP | 40GP | 40HQ
    container_no   = Column(String(50),  nullable=True)
    seal_no        = Column(String(50),  nullable=True)
    bl_number      = Column(String(60),  nullable=True)   # Bill of Lading
    awb_number     = Column(String(60),  nullable=True)   # Air Waybill
    vessel_name    = Column(String(100), nullable=True)
    voyage_number  = Column(String(50),  nullable=True)
    flight_number  = Column(String(50),  nullable=True)

    # Routing
    port_of_loading   = Column(String(150), nullable=True)
    port_of_discharge = Column(String(150), nullable=True)
    etd = Column(Date, nullable=True)   # Estimated Time of Departure
    eta = Column(Date, nullable=True)   # Estimated Time of Arrival

    # Commercial
    incoterm     = Column(String(20),      nullable=True)
    freight_cost = Column(Numeric(14, 2),  nullable=True)
    currency     = Column(String(10),      default="USD")
    notes        = Column(Text,            nullable=True)

    # Destination — auto-derived from port_of_discharge; 'jordan' | 'iraq' | None (= unrestricted)
    destination = Column(String(10), nullable=True)

    # Capacity & pricing markup
    max_cbm    = Column(Numeric(10, 2), nullable=True)   # editable CBM capacity for this container
    markup_pct = Column(Numeric(6, 2),  nullable=True, default=0)  # selling markup % over agent price

    # Direct booking (no agent) — used for AIR self-booked
    is_direct_booking = Column(String(1), default="0", nullable=False)  # "1" = direct
    carrier_name      = Column(String(100), nullable=True)               # airline / shipping line

    # Loading info (origin warehouse + when goods were stuffed)
    loading_warehouse_id = Column(Integer, ForeignKey("company_warehouses.id"), nullable=True)
    loading_date         = Column(DateTime(timezone=True), nullable=True)
    loading_notes        = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    agent              = relationship("ShippingAgent",   foreign_keys=[shipping_agent_id])
    agent_carrier_rate = relationship("AgentCarrierRate", foreign_keys=[agent_carrier_rate_id])
    branch             = relationship("Branch",          foreign_keys=[branch_id])
    loading_warehouse  = relationship("CompanyWarehouse", foreign_keys=[loading_warehouse_id])
    loading_photos     = relationship(
        "BookingLoadingPhoto",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingLoadingPhoto.uploaded_at",
    )
    cargo_lines        = relationship(
        "BookingCargoLine",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingCargoLine.sort_order",
    )


class BookingCargoLine(Base):
    __tablename__ = "booking_cargo_lines"

    id         = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id  = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    sort_order = Column(Integer, default=0)

    # Cargo description
    description    = Column(Text,        nullable=True)
    description_ar = Column(Text,        nullable=True)
    hs_code        = Column(String(30),  nullable=True)
    shipping_marks = Column(Text,        nullable=True)

    # Quantities
    cartons         = Column(Integer,         nullable=True)
    gross_weight_kg = Column(Numeric(10, 3),  nullable=True)
    net_weight_kg   = Column(Numeric(10, 3),  nullable=True)
    cbm             = Column(Numeric(10, 4),  nullable=True)

    # Air cargo dims (per carton)
    carton_length_cm     = Column(Numeric(8, 2),  nullable=True)
    carton_width_cm      = Column(Numeric(8, 2),  nullable=True)
    carton_height_cm     = Column(Numeric(8, 2),  nullable=True)
    volumetric_weight_kg = Column(Numeric(10, 3), nullable=True)
    chargeable_weight_kg = Column(Numeric(10, 3), nullable=True)

    # Cost split
    freight_share = Column(Numeric(14, 2), nullable=True)
    notes         = Column(Text,           nullable=True)

    # Per-client customs clearance decision inside this container
    clearance_through_us = Column(Boolean, nullable=True)
    clearance_agent_id = Column(Integer, ForeignKey("clearance_agents.id"), nullable=True)
    clearance_agent_rate_id = Column(Integer, ForeignKey("clearance_agent_rates.id"), nullable=True)
    manual_clearance_agent_name = Column(String(200), nullable=True)
    manual_clearance_agent_phone = Column(String(60), nullable=True)
    manual_clearance_agent_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    booking = relationship("Booking",         back_populates="cargo_lines")
    client  = relationship("Client",          foreign_keys=[client_id])
    clearance_agent = relationship("ClearanceAgent", foreign_keys=[clearance_agent_id])
    clearance_agent_rate = relationship("ClearanceAgentRate", foreign_keys=[clearance_agent_rate_id])
    images  = relationship(
        "BookingCargoImage",
        back_populates="cargo_line",
        cascade="all, delete-orphan",
        order_by="BookingCargoImage.uploaded_at",
    )
    documents = relationship(
        "BookingCargoDocument",
        back_populates="cargo_line",
        cascade="all, delete-orphan",
        order_by="BookingCargoDocument.uploaded_at",
    )


class BookingCargoImage(Base):
    __tablename__ = "booking_cargo_images"

    id                = Column(Integer,      primary_key=True, index=True)
    cargo_line_id     = Column(Integer,      ForeignKey("booking_cargo_lines.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path         = Column(String(500),  nullable=False)
    original_filename = Column(String(255),  nullable=True)
    uploaded_at       = Column(DateTime(timezone=True), server_default=func.now())

    cargo_line = relationship("BookingCargoLine", back_populates="images")


class BookingCargoDocument(Base):
    __tablename__ = "booking_cargo_documents"

    id                = Column(Integer,      primary_key=True, index=True)
    cargo_line_id     = Column(Integer,      ForeignKey("booking_cargo_lines.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type     = Column(String(40),   nullable=False, index=True)  # pl | security_approval | invoice | other
    custom_file_type  = Column(String(120),  nullable=True)
    file_path         = Column(String(500),  nullable=False)
    original_filename = Column(String(255),  nullable=True)
    uploaded_at       = Column(DateTime(timezone=True), server_default=func.now())

    cargo_line = relationship("BookingCargoLine", back_populates="documents")


class BookingLoadingPhoto(Base):
    __tablename__ = "booking_loading_photos"

    id                = Column(Integer,     primary_key=True, index=True)
    booking_id        = Column(Integer,     ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path         = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    caption           = Column(String(300), nullable=True)
    uploaded_at       = Column(DateTime(timezone=True), server_default=func.now())

    booking = relationship("Booking", back_populates="loading_photos")
