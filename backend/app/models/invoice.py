from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from decimal import Decimal
from app.database import Base


class InvoiceType(str, enum.Enum):
    PRICE_OFFER = "price_offer"
    PI = "PI"
    CI = "CI"
    PL = "PL"
    SC = "SC"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    APPROVED = "approved"
    PAID = "paid"
    CANCELLED = "cancelled"
    DUMMY = "dummy"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("invoice_packages.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_number = Column(String(60), unique=True, nullable=False, index=True)
    invoice_type = Column(Enum(InvoiceType), nullable=False)
    invoice_kind = Column(String(30), nullable=False, default="goods")  # goods | shipping | combined | ddp
    status = Column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT)

    # Client (buyer) — nullable for dummy/manual invoices
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    buyer_name = Column(Text, nullable=True)   # manual name when no real client

    # Dates
    issue_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Shipping / Trade details
    origin = Column(String(100), nullable=True)                  # e.g. China
    payment_terms = Column(Text, nullable=True)                  # e.g. 100% before shipping
    shipping_term = Column(String(30), nullable=True)            # Incoterm: FOB, CIF, etc.
    port_of_loading = Column(String(150), nullable=True)         # e.g. Nansha, China
    port_of_discharge = Column(String(150), nullable=True)       # e.g. Basra UM QASR
    shipping_marks = Column(Text, nullable=True)

    # Container / B/L details (used in PL)
    container_no = Column(String(50), nullable=True)
    seal_no = Column(String(50), nullable=True)
    bl_number = Column(String(50), nullable=True)
    vessel_name = Column(String(100), nullable=True)
    voyage_number = Column(String(50), nullable=True)

    # Financials (USD)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    discount = Column(Numeric(14, 2), nullable=False, default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="USD")

    # Bank details (seller bank — can override company default)
    bank_account_name = Column(String(200), nullable=True)
    bank_account_no = Column(String(100), nullable=True)
    bank_swift = Column(String(20), nullable=True)
    bank_name = Column(String(200), nullable=True)
    bank_address = Column(Text, nullable=True)

    # Stamp / signature image path (uploaded PNG)
    stamp_image_path = Column(String(500), nullable=True)
    stamp_position = Column(String(20), nullable=True, default="bottom-right")  # top-left|top-right|bottom-left|bottom-right

    # Background document image (uploaded)
    document_background_path = Column(String(500), nullable=True)

    notes = Column(Text, nullable=True)
    notes_ar = Column(Text, nullable=True)

    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.id")
    payment_schedule = relationship(
        "InvoicePaymentSchedule",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoicePaymentSchedule.sort_order",
    )
    payments = relationship(
        "InvoicePayment",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoicePayment.paid_at.desc()",
    )
    created_by = relationship("User", foreign_keys=[created_by_id])

    @property
    def paid_amount(self):
        return sum(((payment.amount or Decimal("0")) for payment in (self.payments or [])), Decimal("0"))

    @property
    def balance_due(self):
        return max((self.total or Decimal("0")) - self.paid_amount, Decimal("0"))


class InvoicePaymentSchedule(Base):
    __tablename__ = "invoice_payment_schedule"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(200), nullable=False)
    trigger = Column(String(120), nullable=True)
    percent = Column(Numeric(7, 3), nullable=False, default=100)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="pending")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="payment_schedule")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    receipt_number = Column(String(80), unique=True, nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    payment_method = Column(String(40), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=False)
    reference_no = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    accounting_entry_id = Column(Integer, ForeignKey("accounting_entries.id"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="payments")
    branch = relationship("Branch", foreign_keys=[branch_id])
    accounting_entry = relationship("AccountingEntry", foreign_keys=[accounting_entry_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class InvoiceBankAccount(Base):
    __tablename__ = "invoice_bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_label = Column(String(200), nullable=True)
    bank_account_name = Column(String(200), nullable=True)
    bank_account_no = Column(String(100), nullable=True, index=True)
    bank_swift = Column(String(20), nullable=True)
    bank_name = Column(String(200), nullable=True)
    bank_address = Column(Text, nullable=True)
    currency = Column(String(10), nullable=False, default="USD")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
