from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, Date, ForeignKey
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

    # Buy prices (what agent charges us)
    price_20gp    = Column(Numeric(10, 2), nullable=True)
    price_40ft    = Column(Numeric(10, 2), nullable=True)
    price_40hq    = Column(Numeric(10, 2), nullable=True)
    price_air_kg  = Column(Numeric(10, 2), nullable=True)
    buy_lcl_cbm   = Column(Numeric(10, 2), nullable=True)   # LCL buy per CBM
    # Sell prices (what we charge clients)
    sell_price_20gp    = Column(Numeric(10, 2), nullable=True)
    sell_price_40ft    = Column(Numeric(10, 2), nullable=True)
    sell_price_40hq    = Column(Numeric(10, 2), nullable=True)
    sell_price_air_kg  = Column(Numeric(10, 2), nullable=True)
    sell_lcl_cbm       = Column(Numeric(10, 2), nullable=True)   # LCL sell per CBM
    transit_sea_days   = Column(Integer, nullable=True)
    transit_air_days   = Column(Integer, nullable=True)

    # Service modes offered by this agent
    serves_sea = Column(Boolean, default=True, nullable=False)
    serves_air = Column(Boolean, default=False, nullable=False)

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Current offer validity window
    offer_valid_from = Column(Date, nullable=True)
    offer_valid_to   = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    quotes        = relationship("ShippingQuote",     back_populates="agent")
    price_history = relationship("AgentPriceHistory", back_populates="agent", order_by="AgentPriceHistory.effective_date.desc()", cascade="all, delete-orphan")
    carrier_rates = relationship("AgentCarrierRate",  back_populates="agent", order_by="AgentCarrierRate.carrier_name", cascade="all, delete-orphan")
    contracts     = relationship("AgentContract",     back_populates="agent", order_by="AgentContract.created_at.desc()", cascade="all, delete-orphan")
    edit_log      = relationship("AgentEditLog",      back_populates="agent", order_by="AgentEditLog.changed_at.desc()", cascade="all, delete-orphan")


class AgentPriceHistory(Base):
    __tablename__ = "agent_price_history"

    id             = Column(Integer, primary_key=True, index=True)
    agent_id       = Column(Integer, ForeignKey("shipping_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    carrier_name   = Column(String(100), nullable=True, index=True)   # e.g. PIL, CMA, Evergreen
    pol            = Column(String(150), nullable=True)                # port of loading
    pod            = Column(String(150), nullable=True)                # port of discharge
    effective_date = Column(Date, nullable=False)
    expiry_date    = Column(Date, nullable=True)
    buy_20gp       = Column(Numeric(10, 2), nullable=True)
    sell_20gp      = Column(Numeric(10, 2), nullable=True)
    buy_40ft       = Column(Numeric(10, 2), nullable=True)
    sell_40ft      = Column(Numeric(10, 2), nullable=True)
    buy_40hq       = Column(Numeric(10, 2), nullable=True)
    sell_40hq      = Column(Numeric(10, 2), nullable=True)
    buy_air_kg     = Column(Numeric(10, 2), nullable=True)
    sell_air_kg    = Column(Numeric(10, 2), nullable=True)
    buy_lcl_cbm    = Column(Numeric(10, 2), nullable=True)
    sell_lcl_cbm   = Column(Numeric(10, 2), nullable=True)
    transit_sea_days = Column(Integer, nullable=True)
    transit_air_days = Column(Integer, nullable=True)
    notes          = Column(Text, nullable=True)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent      = relationship("ShippingAgent", back_populates="price_history")
    created_by = relationship("User", foreign_keys=[created_by_id])


class AgentCarrierRate(Base):
    """Current (latest) rate per carrier per agent — upserted on each price update."""
    __tablename__ = "agent_carrier_rates"

    id           = Column(Integer, primary_key=True, index=True)
    agent_id     = Column(Integer, ForeignKey("shipping_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    carrier_name = Column(String(100), nullable=False, index=True)
    pol          = Column(String(150), nullable=True)
    pod          = Column(String(150), nullable=True)
    effective_date = Column(Date, nullable=True)
    expiry_date    = Column(Date, nullable=True)
    buy_20gp     = Column(Numeric(10, 2), nullable=True)
    sell_20gp    = Column(Numeric(10, 2), nullable=True)
    buy_40ft     = Column(Numeric(10, 2), nullable=True)
    sell_40ft    = Column(Numeric(10, 2), nullable=True)
    buy_40hq     = Column(Numeric(10, 2), nullable=True)
    sell_40hq    = Column(Numeric(10, 2), nullable=True)
    buy_lcl_cbm  = Column(Numeric(10, 2), nullable=True)
    sell_lcl_cbm = Column(Numeric(10, 2), nullable=True)
    transit_sea_days = Column(Integer, nullable=True)
    notes        = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True, nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    agent = relationship("ShippingAgent", back_populates="carrier_rates")


class AgentContract(Base):
    __tablename__ = "agent_contracts"

    id                = Column(Integer, primary_key=True, index=True)
    agent_id          = Column(Integer, ForeignKey("shipping_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    title             = Column(String(300), nullable=False)
    file_path         = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    valid_from        = Column(Date, nullable=True)
    valid_to          = Column(Date, nullable=True)
    notes             = Column(Text, nullable=True)
    uploaded_by_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent       = relationship("ShippingAgent", back_populates="contracts")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class AgentEditLog(Base):
    __tablename__ = "agent_edit_log"

    id             = Column(Integer, primary_key=True, index=True)
    agent_id       = Column(Integer, ForeignKey("shipping_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    action         = Column(String(60), nullable=False)   # update | price_update | contract_upload | contract_delete
    summary        = Column(Text, nullable=True)
    changed_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent      = relationship("ShippingAgent", back_populates="edit_log")
    changed_by = relationship("User", foreign_keys=[changed_by_id])
