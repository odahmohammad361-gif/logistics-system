from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class CompanyWarehouse(Base):
    """Company-owned warehouses: loading points (China) and unloading points (Jordan, Iraq)."""
    __tablename__ = "company_warehouses"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False)           # e.g. "Guangzhou Main Warehouse"
    name_ar      = Column(String(200), nullable=True)
    warehouse_type = Column(String(20), nullable=False)          # "loading" | "unloading"
    country      = Column(String(100), nullable=True)            # CN, JO, IQ
    city         = Column(String(100), nullable=True)
    address      = Column(Text, nullable=True)
    contact_name = Column(String(150), nullable=True)
    phone        = Column(String(50), nullable=True)
    notes        = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True, nullable=False)
    branch_id    = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
