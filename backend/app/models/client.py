from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    # Identity
    name = Column(String(200), nullable=False, index=True)
    name_ar = Column(String(200), nullable=True)
    client_code = Column(String(30), unique=True, nullable=False, index=True)  # e.g. JO-0001

    # Contact
    phone = Column(String(30), nullable=True)
    whatsapp = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    # Address
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)

    # Business
    company_name = Column(String(200), nullable=True)
    company_name_ar = Column(String(200), nullable=True)
    tax_number = Column(String(50), nullable=True)

    # Assignment
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    branch = relationship("Branch", back_populates="clients")
    created_by = relationship("User", foreign_keys=[created_by_id])
    invoices = relationship("Invoice", back_populates="client")
    containers = relationship("Container", back_populates="client")
