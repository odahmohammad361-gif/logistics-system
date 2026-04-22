from decimal import Decimal
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class QuoteServiceMode(str, enum.Enum):
    SEA_FCL = "SEA_FCL"   # Full Container Load (sea)
    AIR = "AIR"
    LCL = "LCL"           # Less than Container Load


class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    REJECTED = "rejected"


class Incoterm(str, enum.Enum):
    FOB = "FOB"   # Free on Board — most common China→Middle East
    CIF = "CIF"   # Cost, Insurance, Freight
    CFR = "CFR"   # Cost and Freight (no insurance)
    EXW = "EXW"   # Ex Works (buyer collects from factory)
    DAP = "DAP"   # Delivered at Place
    DDP = "DDP"   # Delivered, Duty Paid
    CIP = "CIP"   # Carriage & Insurance Paid
    CPT = "CPT"   # Carriage Paid To
    FCA = "FCA"   # Free Carrier
    FAS = "FAS"   # Free Alongside Ship


class ShippingQuote(Base):
    __tablename__ = "shipping_quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(60), unique=True, nullable=False, index=True)  # QT-2026-0001
    agent_id = Column(Integer, ForeignKey("shipping_agents.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)  # optional — quote for specific client

    # ── Quote classification ─────────────────────────────────────────────────
    service_mode = Column(Enum(QuoteServiceMode, values_callable=lambda x: [e.value for e in x]), nullable=False)
    # container_type: 20GP / 40FT / 40HQ for FCL; null for AIR / LCL
    container_type = Column(String(10), nullable=True)
    incoterm = Column(Enum(Incoterm, values_callable=lambda x: [e.value for e in x]), nullable=True)
    incoterm_point = Column(String(100), nullable=True)   # e.g. "FOB Guangzhou"

    # ── Carrier / Shipping Line ───────────────────────────────────────────────
    # The ocean/air carrier (CMA CGM, MSC, PIL, Evergreen, Emirates, etc.)
    carrier = Column(String(100), nullable=True)

    # ── Route ────────────────────────────────────────────────────────────────
    port_of_loading = Column(String(100), nullable=True)    # e.g. Guangzhou, Shenzhen
    port_of_discharge = Column(String(100), nullable=True)  # e.g. Aqaba, Umm Qasr

    # ── Validity ─────────────────────────────────────────────────────────────
    validity_from = Column(DateTime(timezone=True), nullable=True)
    validity_to = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(QuoteStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=QuoteStatus.DRAFT)
    currency = Column(String(10), nullable=False, default="USD")

    # ── FREIGHT (main charge) ────────────────────────────────────────────────
    # SEA FCL: per container | LCL: per CBM | AIR: use air_freight_per_kg
    ocean_freight = Column(Numeric(12, 2), nullable=True)
    air_freight_per_kg = Column(Numeric(10, 2), nullable=True)
    min_chargeable_weight_kg = Column(Numeric(10, 2), nullable=True)  # AIR minimum
    min_chargeable_cbm = Column(Numeric(10, 4), nullable=True)        # LCL minimum

    # ── SURCHARGES ───────────────────────────────────────────────────────────
    baf = Column(Numeric(10, 2), nullable=True)              # Bunker Adjustment Factor (fuel)
    eca_surcharge = Column(Numeric(10, 2), nullable=True)    # Emission Control Area
    war_risk_surcharge = Column(Numeric(10, 2), nullable=True)
    other_surcharges = Column(Numeric(10, 2), nullable=True)

    # ── ORIGIN CHARGES (China side) ──────────────────────────────────────────
    thc_origin = Column(Numeric(10, 2), nullable=True)         # Terminal Handling Charge
    bl_fee = Column(Numeric(10, 2), nullable=True)             # Bill of Lading fee
    doc_fee = Column(Numeric(10, 2), nullable=True)            # Documentation / customs export
    sealing_fee = Column(Numeric(10, 2), nullable=True)        # Container sealing
    inspection_fee = Column(Numeric(10, 2), nullable=True)     # CIQ / customs inspection
    trucking_origin = Column(Numeric(10, 2), nullable=True)    # Warehouse → port drayage
    stuffing_fee = Column(Numeric(10, 2), nullable=True)       # Labor to load cargo into container
    warehouse_handling = Column(Numeric(10, 2), nullable=True) # Receiving, sorting, consolidation

    # ── DESTINATION CHARGES (Jordan / Iraq) ──────────────────────────────────
    thc_destination = Column(Numeric(10, 2), nullable=True)       # Terminal Handling at port
    customs_destination = Column(Numeric(10, 2), nullable=True)   # Customs clearance fee
    brokerage_destination = Column(Numeric(10, 2), nullable=True) # Customs broker fee
    trucking_destination = Column(Numeric(10, 2), nullable=True)  # Port → final destination

    # ── TIMING ───────────────────────────────────────────────────────────────
    transit_days = Column(Integer, nullable=True)           # Sea/air transit days
    free_days_origin = Column(Integer, nullable=True)       # Free detention days at origin
    free_days_destination = Column(Integer, nullable=True)  # Free demurrage days at destination
    cut_off_days = Column(Integer, nullable=True)           # Days before ETD cargo must be at port
    stuffing_days = Column(Integer, nullable=True)          # Days needed to load from warehouse pickup

    # ── TOTALS (auto-computed on save) ───────────────────────────────────────
    total_origin = Column(Numeric(14, 2), nullable=True)
    total_destination = Column(Numeric(14, 2), nullable=True)
    total_surcharges = Column(Numeric(14, 2), nullable=True)
    total_all = Column(Numeric(14, 2), nullable=True)

    # ── META ─────────────────────────────────────────────────────────────────
    notes = Column(Text, nullable=True)
    document_path = Column(String(500), nullable=True)  # Original quote from WeChat (image/PDF)

    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    agent = relationship("ShippingAgent", back_populates="quotes")
    client = relationship("Client")
    created_by = relationship("User", foreign_keys=[created_by_id])
