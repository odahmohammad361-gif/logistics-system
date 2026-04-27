from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ProductMainCategory(Base):
    __tablename__ = "product_main_categories"
    __table_args__ = (UniqueConstraint("code", name="uq_product_main_categories_code"),)

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    name_ar = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    subcategories = relationship("ProductSubcategory", back_populates="main_category", order_by="ProductSubcategory.sort_order")
    product_types = relationship("ProductType", back_populates="main_category", order_by="ProductType.sort_order")


class ProductSubcategory(Base):
    __tablename__ = "product_subcategories"
    __table_args__ = (UniqueConstraint("main_category_id", "code", name="uq_product_subcategories_parent_code"),)

    id = Column(Integer, primary_key=True, index=True)
    main_category_id = Column(Integer, ForeignKey("product_main_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    name_ar = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    main_category = relationship("ProductMainCategory", back_populates="subcategories")
    product_types = relationship("ProductType", back_populates="subcategory", order_by="ProductType.sort_order")


class HSCodeReference(Base):
    __tablename__ = "hs_code_references"
    __table_args__ = (UniqueConstraint("country", "hs_code", "description", name="uq_hs_code_references_country_code_desc"),)

    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(80), nullable=False, default="Jordan", index=True)
    hs_code = Column(String(30), nullable=False, index=True)
    chapter = Column(String(10), nullable=True, index=True)
    description = Column(String(500), nullable=False)
    description_ar = Column(String(500), nullable=True)
    customs_unit_basis = Column(String(30), nullable=True)
    customs_estimated_value_usd = Column(Numeric(14, 4), nullable=True)
    customs_duty_pct = Column(Numeric(6, 2), nullable=True)
    sales_tax_pct = Column(Numeric(6, 2), nullable=True)
    other_tax_pct = Column(Numeric(6, 2), nullable=True)
    source_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    import_allowed = Column(Boolean, nullable=False, default=True)
    effective_from = Column(DateTime(timezone=True), nullable=True)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ProductType(Base):
    __tablename__ = "product_types"
    __table_args__ = (UniqueConstraint("subcategory_id", "code", name="uq_product_types_subcategory_code"),)

    id = Column(Integer, primary_key=True, index=True)
    main_category_id = Column(Integer, ForeignKey("product_main_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    subcategory_id = Column(Integer, ForeignKey("product_subcategories.id", ondelete="CASCADE"), nullable=False, index=True)
    hs_code_ref_id = Column(Integer, ForeignKey("hs_code_references.id"), nullable=True, index=True)
    code = Column(String(80), nullable=False, index=True)
    name = Column(String(180), nullable=False)
    name_ar = Column(String(180), nullable=True)
    description = Column(Text, nullable=True)
    default_customs_unit_basis = Column(String(30), nullable=True)
    default_customs_estimated_value_usd = Column(Numeric(14, 4), nullable=True)
    default_customs_duty_pct = Column(Numeric(6, 2), nullable=True)
    default_sales_tax_pct = Column(Numeric(6, 2), nullable=True)
    default_other_tax_pct = Column(Numeric(6, 2), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    main_category = relationship("ProductMainCategory", back_populates="product_types")
    subcategory = relationship("ProductSubcategory", back_populates="product_types")
    hs_code_ref = relationship("HSCodeReference", foreign_keys=[hs_code_ref_id])


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
    main_category_id = Column(Integer, ForeignKey("product_main_categories.id"), nullable=True, index=True)
    subcategory_id = Column(Integer, ForeignKey("product_subcategories.id"), nullable=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=True, index=True)
    hs_code_ref_id = Column(Integer, ForeignKey("hs_code_references.id"), nullable=True, index=True)

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
    main_category = relationship("ProductMainCategory", foreign_keys=[main_category_id])
    subcategory = relationship("ProductSubcategory", foreign_keys=[subcategory_id])
    product_type = relationship("ProductType", foreign_keys=[product_type_id])
    hs_code_ref = relationship("HSCodeReference", foreign_keys=[hs_code_ref_id])
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
