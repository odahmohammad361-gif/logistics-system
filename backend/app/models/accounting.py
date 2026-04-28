import enum

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class AccountingDirection(str, enum.Enum):
    MONEY_IN = "money_in"
    MONEY_OUT = "money_out"


class AccountingStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    NEEDS_REVIEW = "needs_review"
    VOID = "void"


class BankLineMatchStatus(str, enum.Enum):
    MATCHED = "matched"
    POSSIBLE = "possible"
    UNMATCHED = "unmatched"
    IGNORED = "ignored"


class AccountingEntry(Base):
    __tablename__ = "accounting_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(60), unique=True, nullable=False, index=True)
    direction = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, default=AccountingStatus.POSTED.value, index=True)

    entry_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    payment_method = Column(String(40), nullable=False, index=True)
    category = Column(String(80), nullable=False, index=True)

    counterparty_type = Column(String(40), nullable=True, index=True)
    counterparty_name = Column(String(250), nullable=True)
    reference_no = Column(String(120), nullable=True, index=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    invoice_package_id = Column(Integer, ForeignKey("invoice_packages.id"), nullable=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    shipping_agent_id = Column(Integer, ForeignKey("shipping_agents.id"), nullable=True, index=True)
    clearance_agent_id = Column(Integer, ForeignKey("clearance_agents.id"), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True, index=True)

    tax_rate_pct = Column(Numeric(7, 3), nullable=True)
    tax_amount = Column(Numeric(14, 2), nullable=True)
    has_official_tax_invoice = Column(Boolean, default=False, nullable=False)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client", foreign_keys=[client_id])
    invoice_package = relationship("InvoicePackage", foreign_keys=[invoice_package_id])
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    booking = relationship("Booking", foreign_keys=[booking_id])
    shipping_agent = relationship("ShippingAgent", foreign_keys=[shipping_agent_id])
    clearance_agent = relationship("ClearanceAgent", foreign_keys=[clearance_agent_id])
    supplier = relationship("Supplier", foreign_keys=[supplier_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    attachments = relationship(
        "AccountingAttachment",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="AccountingAttachment.created_at.desc()",
    )


class AccountingAttachment(Base):
    __tablename__ = "accounting_attachments"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("accounting_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(40), nullable=False, default="receipt", index=True)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    content_type = Column(String(120), nullable=True)
    file_size = Column(Integer, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entry = relationship("AccountingEntry", back_populates="attachments")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class BankStatementImport(Base):
    __tablename__ = "bank_statement_imports"

    id = Column(Integer, primary_key=True, index=True)
    bank_name = Column(String(200), nullable=True)
    account_name = Column(String(200), nullable=True)
    account_no = Column(String(100), nullable=True)
    statement_from = Column(Date, nullable=True)
    statement_to = Column(Date, nullable=True)
    original_filename = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    line_count = Column(Integer, nullable=False, default=0)
    status = Column(String(30), nullable=False, default="parsed")
    notes = Column(Text, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    lines = relationship(
        "BankStatementLine",
        back_populates="statement",
        cascade="all, delete-orphan",
        order_by="BankStatementLine.transaction_date.desc(), BankStatementLine.id.desc()",
    )


class BankStatementLine(Base):
    __tablename__ = "bank_statement_lines"

    id = Column(Integer, primary_key=True, index=True)
    statement_id = Column(Integer, ForeignKey("bank_statement_imports.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date, nullable=False, index=True)
    direction = Column(String(20), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    description = Column(Text, nullable=True)
    reference_no = Column(String(120), nullable=True, index=True)
    balance = Column(Numeric(14, 2), nullable=True)
    raw_data = Column(Text, nullable=True)

    match_status = Column(String(20), nullable=False, default=BankLineMatchStatus.UNMATCHED.value, index=True)
    matched_entry_id = Column(Integer, ForeignKey("accounting_entries.id"), nullable=True, index=True)
    match_confidence = Column(Integer, nullable=True)
    match_reason = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    statement = relationship("BankStatementImport", back_populates="lines")
    matched_entry = relationship("AccountingEntry", foreign_keys=[matched_entry_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
