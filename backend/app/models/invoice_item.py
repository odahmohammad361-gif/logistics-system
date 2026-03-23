from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)

    description = Column(Text, nullable=False)
    description_ar = Column(Text, nullable=True)
    hs_code = Column(String(20), nullable=True)       # Harmonized System code

    quantity = Column(Numeric(10, 3), nullable=False, default=1)
    unit = Column(String(30), nullable=True)           # pcs, kg, carton...
    unit_price = Column(Numeric(14, 2), nullable=False, default=0)
    total_price = Column(Numeric(14, 2), nullable=False, default=0)

    # Packing list extras
    cartons = Column(Integer, nullable=True)
    net_weight = Column(Numeric(10, 3), nullable=True)
    gross_weight = Column(Numeric(10, 3), nullable=True)
    cbm = Column(Numeric(10, 4), nullable=True)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
