from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)   # e.g. TS-001
    name = Column(String(300), nullable=False)
    name_ar = Column(String(300), nullable=True)
    category = Column(String(100), nullable=True, index=True)            # t-shirt, jeans, jacket...
    description = Column(Text, nullable=True)
    description_ar = Column(Text, nullable=True)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)

    # Pricing (stored in CNY — converted on frontend via market rates)
    price_cny = Column(Numeric(10, 2), nullable=False)
    price_usd = Column(Numeric(14, 4), nullable=True)

    # Customs / tax foundation (USD until multi-currency rules are finalized)
    hs_code = Column(String(30), nullable=True, index=True)
    origin_country = Column(String(100), nullable=True)
    customs_category = Column(String(120), nullable=True, index=True)
    customs_unit_basis = Column(String(30), nullable=True)  # dozen | piece | kg | carton
    customs_estimated_value_usd = Column(Numeric(14, 4), nullable=True)
    customs_duty_pct = Column(Numeric(6, 2), nullable=True)
    sales_tax_pct = Column(Numeric(6, 2), nullable=True)
    other_tax_pct = Column(Numeric(6, 2), nullable=True)
    customs_notes = Column(Text, nullable=True)

    # Carton / shipping info
    pcs_per_carton = Column(Integer, nullable=False, default=250)
    cbm_per_carton = Column(Numeric(8, 4), nullable=False, default=0.20)
    min_order_cartons = Column(Integer, nullable=False, default=1)
    gross_weight_kg_per_carton = Column(Numeric(10, 3), nullable=True)
    net_weight_kg_per_carton = Column(Numeric(10, 3), nullable=True)
    carton_length_cm = Column(Numeric(8, 2), nullable=True)
    carton_width_cm = Column(Numeric(8, 2), nullable=True)
    carton_height_cm = Column(Numeric(8, 2), nullable=True)

    # Display
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    supplier = relationship("Supplier", back_populates="products")
    photos = relationship("ProductPhoto", back_populates="product", cascade="all, delete-orphan",
                          order_by="ProductPhoto.sort_order")


class ProductPhoto(Base):
    __tablename__ = "product_photos"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    is_main = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", back_populates="photos")
