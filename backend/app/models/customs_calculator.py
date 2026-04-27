from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CustomsEstimate(Base):
    __tablename__ = "customs_estimates"

    id = Column(Integer, primary_key=True, index=True)
    estimate_number = Column(String(60), unique=True, nullable=False, index=True)
    title = Column(String(250), nullable=True)
    country = Column(String(100), nullable=False, default="Jordan", index=True)
    currency = Column(String(10), nullable=False, default="USD")
    status = Column(String(30), nullable=False, default="estimated", index=True)
    notes = Column(Text, nullable=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)

    product_value_usd = Column(Numeric(14, 2), nullable=False, default=0)
    shipping_cost_usd = Column(Numeric(14, 2), nullable=False, default=0)
    customs_base_usd = Column(Numeric(14, 2), nullable=False, default=0)
    customs_duty_usd = Column(Numeric(14, 2), nullable=False, default=0)
    sales_tax_usd = Column(Numeric(14, 2), nullable=False, default=0)
    other_tax_usd = Column(Numeric(14, 2), nullable=False, default=0)
    total_taxes_usd = Column(Numeric(14, 2), nullable=False, default=0)
    landed_estimate_usd = Column(Numeric(14, 2), nullable=False, default=0)

    is_archived = Column(Boolean, nullable=False, default=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client", foreign_keys=[client_id])
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    booking = relationship("Booking", foreign_keys=[booking_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    lines = relationship(
        "CustomsEstimateLine",
        back_populates="estimate",
        cascade="all, delete-orphan",
        order_by="CustomsEstimateLine.sort_order",
    )


class CustomsEstimateLine(Base):
    __tablename__ = "customs_estimate_lines"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("customs_estimates.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)

    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    description = Column(String(500), nullable=False)
    description_ar = Column(String(500), nullable=True)
    hs_code = Column(String(30), nullable=True, index=True)
    customs_category = Column(String(120), nullable=True, index=True)
    unit_basis = Column(String(30), nullable=False, default="dozen")

    cartons = Column(Numeric(14, 3), nullable=False, default=0)
    pieces_per_carton = Column(Numeric(14, 3), nullable=False, default=0)
    total_pieces = Column(Numeric(14, 3), nullable=False, default=0)
    gross_weight_kg = Column(Numeric(14, 3), nullable=False, default=0)
    customs_units = Column(Numeric(14, 3), nullable=False, default=0)

    estimated_value_per_unit_usd = Column(Numeric(14, 2), nullable=False, default=0)
    shipping_cost_per_unit_usd = Column(Numeric(14, 2), nullable=False, default=0)
    shipping_cost_total_usd = Column(Numeric(14, 2), nullable=False, default=0)
    product_value_usd = Column(Numeric(14, 2), nullable=False, default=0)
    customs_base_usd = Column(Numeric(14, 2), nullable=False, default=0)

    customs_duty_pct = Column(Numeric(6, 2), nullable=False, default=0)
    sales_tax_pct = Column(Numeric(6, 2), nullable=False, default=0)
    other_tax_pct = Column(Numeric(6, 2), nullable=False, default=0)
    total_tax_pct = Column(Numeric(6, 2), nullable=False, default=0)
    customs_duty_usd = Column(Numeric(14, 2), nullable=False, default=0)
    sales_tax_usd = Column(Numeric(14, 2), nullable=False, default=0)
    other_tax_usd = Column(Numeric(14, 2), nullable=False, default=0)
    total_taxes_usd = Column(Numeric(14, 2), nullable=False, default=0)
    landed_estimate_usd = Column(Numeric(14, 2), nullable=False, default=0)
    warnings_json = Column(Text, nullable=True)

    estimate = relationship("CustomsEstimate", back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id])
