from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ShopOrder(Base):
    __tablename__ = "shop_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(60), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    invoice_package_id = Column(Integer, ForeignKey("invoice_packages.id", ondelete="SET NULL"), nullable=True, index=True)

    status = Column(String(30), nullable=False, default="submitted", index=True)
    destination = Column(String(30), nullable=True, index=True)
    currency = Column(String(10), nullable=False, default="USD")

    subtotal_usd = Column(Numeric(14, 2), nullable=False, default=0)
    total_cartons = Column(Numeric(14, 3), nullable=False, default=0)
    total_pieces = Column(Numeric(14, 3), nullable=False, default=0)
    total_cbm = Column(Numeric(14, 4), nullable=False, default=0)
    total_gross_weight_kg = Column(Numeric(14, 3), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    customer = relationship("Customer", foreign_keys=[customer_id])
    client = relationship("Client", foreign_keys=[client_id])
    invoice_package = relationship("InvoicePackage", foreign_keys=[invoice_package_id])
    items = relationship(
        "ShopOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="ShopOrderItem.sort_order",
    )


class ShopOrderItem(Base):
    __tablename__ = "shop_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("shop_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    product_code = Column(String(80), nullable=True)
    product_name = Column(Text, nullable=False)
    product_name_ar = Column(Text, nullable=True)
    hs_code = Column(String(30), nullable=True, index=True)

    cartons = Column(Numeric(14, 3), nullable=False, default=0)
    pcs_per_carton = Column(Numeric(14, 3), nullable=True)
    quantity = Column(Numeric(14, 3), nullable=False, default=0)
    unit_price_usd = Column(Numeric(14, 4), nullable=False, default=0)
    total_price_usd = Column(Numeric(14, 2), nullable=False, default=0)
    cbm = Column(Numeric(14, 4), nullable=True)
    gross_weight_kg = Column(Numeric(14, 3), nullable=True)
    net_weight_kg = Column(Numeric(14, 3), nullable=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("ShopOrder", back_populates="items")
    product = relationship("Product", foreign_keys=[product_id])
