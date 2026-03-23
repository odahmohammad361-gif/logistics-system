from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class InvoiceType(str, enum.Enum):
    PRICE_OFFER = "price_offer"   # Price offer form (before invoice)
    PI = "PI"                      # Proforma Invoice
    CI = "CI"                      # Commercial Invoice
    PL = "PL"                      # Packing List
    SC = "SC"                      # Sales Contract


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    APPROVED = "approved"
    PAID = "paid"
    CANCELLED = "cancelled"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g. PI-2024-0001
    invoice_type = Column(Enum(InvoiceType), nullable=False)
    status = Column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT)

    # Client link (CORE dependency)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    # Dates
    issue_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Financials (USD)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    discount = Column(Numeric(14, 2), nullable=False, default=0)
    tax = Column(Numeric(14, 2), nullable=False, default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="USD")

    # Shipping info
    port_of_loading = Column(String(100), nullable=True)
    port_of_discharge = Column(String(100), nullable=True)
    shipping_marks = Column(Text, nullable=True)
    payment_terms = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)
    notes_ar = Column(Text, nullable=True)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])
