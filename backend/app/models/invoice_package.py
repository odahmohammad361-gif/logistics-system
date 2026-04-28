from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class InvoicePackage(Base):
    __tablename__ = "invoice_packages"

    id = Column(Integer, primary_key=True, index=True)
    package_number = Column(String(60), unique=True, nullable=False, index=True)

    source_type = Column(String(40), nullable=False, default="manual", index=True)
    status = Column(String(30), nullable=False, default="draft", index=True)
    title = Column(String(250), nullable=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    buyer_name = Column(Text, nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    booking_cargo_line_id = Column(Integer, ForeignKey("booking_cargo_lines.id"), nullable=True, index=True)

    origin = Column(String(100), nullable=True)
    destination = Column(String(100), nullable=True)
    port_of_loading = Column(String(150), nullable=True)
    port_of_discharge = Column(String(150), nullable=True)
    shipping_term = Column(String(30), nullable=True)
    payment_terms = Column(Text, nullable=True)
    shipping_marks = Column(Text, nullable=True)

    container_no = Column(String(50), nullable=True)
    seal_no = Column(String(50), nullable=True)
    bl_number = Column(String(60), nullable=True)
    vessel_name = Column(String(100), nullable=True)
    voyage_number = Column(String(50), nullable=True)
    awb_number = Column(String(60), nullable=True)
    flight_number = Column(String(50), nullable=True)

    currency = Column(String(10), nullable=False, default="USD")
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    discount = Column(Numeric(14, 2), nullable=False, default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    notes = Column(Text, nullable=True)
    notes_ar = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client", foreign_keys=[client_id])
    booking = relationship("Booking", foreign_keys=[booking_id])
    cargo_line = relationship("BookingCargoLine", foreign_keys=[booking_cargo_line_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    items = relationship(
        "InvoicePackageItem",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="InvoicePackageItem.sort_order",
    )
    documents = relationship(
        "InvoiceDocument",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="InvoiceDocument.created_at.desc()",
    )
    files = relationship(
        "InvoiceFile",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="InvoiceFile.created_at.desc()",
    )
    activity_log = relationship(
        "InvoiceActivityLog",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="InvoiceActivityLog.created_at.desc()",
    )


class InvoicePackageItem(Base):
    __tablename__ = "invoice_package_items"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("invoice_packages.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    hs_code_ref_id = Column(Integer, ForeignKey("hs_code_references.id", ondelete="SET NULL"), nullable=True, index=True)

    description = Column(Text, nullable=False)
    description_ar = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    details_ar = Column(Text, nullable=True)
    product_image_path = Column(String(500), nullable=True)

    hs_code = Column(String(30), nullable=True, index=True)
    customs_unit_basis = Column(String(30), nullable=True)
    customs_unit_quantity = Column(Numeric(14, 4), nullable=True)

    quantity = Column(Numeric(14, 3), nullable=False, default=0)
    unit = Column(String(30), nullable=True)
    unit_price = Column(Numeric(14, 4), nullable=False, default=0)
    total_price = Column(Numeric(14, 2), nullable=False, default=0)

    cartons = Column(Numeric(14, 3), nullable=True)
    pcs_per_carton = Column(Numeric(14, 3), nullable=True)
    gross_weight = Column(Numeric(14, 3), nullable=True)
    net_weight = Column(Numeric(14, 3), nullable=True)
    cbm = Column(Numeric(14, 4), nullable=True)

    carton_length_cm = Column(Numeric(8, 2), nullable=True)
    carton_width_cm = Column(Numeric(8, 2), nullable=True)
    carton_height_cm = Column(Numeric(8, 2), nullable=True)
    volumetric_weight_kg = Column(Numeric(14, 3), nullable=True)
    chargeable_weight_kg = Column(Numeric(14, 3), nullable=True)

    source_product_snapshot_json = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    package = relationship("InvoicePackage", back_populates="items")
    product = relationship("Product", foreign_keys=[product_id])
    hs_code_ref = relationship("HSCodeReference", foreign_keys=[hs_code_ref_id])


class InvoiceDocument(Base):
    __tablename__ = "invoice_documents"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("invoice_packages.id", ondelete="CASCADE"), nullable=False, index=True)
    legacy_invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)

    document_type = Column(String(20), nullable=False, index=True)
    document_number = Column(String(80), nullable=False, unique=True, index=True)
    language = Column(String(5), nullable=False, default="en", index=True)
    status = Column(String(30), nullable=False, default="draft", index=True)

    issue_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    pdf_path = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    package = relationship("InvoicePackage", back_populates="documents")
    legacy_invoice = relationship("Invoice", foreign_keys=[legacy_invoice_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    files = relationship(
        "InvoiceFile",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="InvoiceFile.created_at.desc()",
    )


class InvoiceFile(Base):
    __tablename__ = "invoice_files"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("invoice_packages.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("invoice_documents.id", ondelete="CASCADE"), nullable=True, index=True)

    document_type = Column(String(40), nullable=False, index=True)
    custom_file_type = Column(String(120), nullable=True)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    content_type = Column(String(120), nullable=True)
    file_size = Column(Integer, nullable=True)

    extraction_status = Column(String(30), nullable=False, default="pending", index=True)
    extraction_json = Column(Text, nullable=True)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    package = relationship("InvoicePackage", back_populates="files")
    document = relationship("InvoiceDocument", back_populates="files")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class InvoiceActivityLog(Base):
    __tablename__ = "invoice_activity_log"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("invoice_packages.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(60), nullable=False, index=True)
    summary = Column(Text, nullable=True)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    package = relationship("InvoicePackage", back_populates="activity_log")
    changed_by = relationship("User", foreign_keys=[changed_by_id])
