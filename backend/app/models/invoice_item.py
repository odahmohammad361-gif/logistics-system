from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    # Product info
    description = Column(Text, nullable=False)           # English name
    description_ar = Column(Text, nullable=True)         # Arabic name
    details = Column(Text, nullable=True)                # Material, Sizes, Colors, Packing
    details_ar = Column(Text, nullable=True)
    product_image_path = Column(String(500), nullable=True)  # uploaded product image

    # Trade fields
    hs_code = Column(String(20), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False, default=0)  # pieces/pairs
    unit = Column(String(30), nullable=True)              # pcs, pairs, kg...
    unit_price = Column(Numeric(14, 4), nullable=False, default=0)
    total_price = Column(Numeric(14, 2), nullable=False, default=0)

    # Packing / weight
    cartons = Column(Integer, nullable=True)              # CTN count
    gross_weight = Column(Numeric(10, 3), nullable=True)  # KG
    net_weight = Column(Numeric(10, 3), nullable=True)
    cbm = Column(Numeric(10, 4), nullable=True)           # cubic meters

    # Air cargo dimensions (for volumetric weight calculation)
    carton_length_cm = Column(Numeric(8, 2), nullable=True)
    carton_width_cm = Column(Numeric(8, 2), nullable=True)
    carton_height_cm = Column(Numeric(8, 2), nullable=True)
    volumetric_weight_kg = Column(Numeric(10, 3), nullable=True)   # L×W×H×cartons/6000
    chargeable_weight_kg = Column(Numeric(10, 3), nullable=True)   # max(actual, volumetric)

    # Sort order
    sort_order = Column(Integer, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", foreign_keys=[product_id])
