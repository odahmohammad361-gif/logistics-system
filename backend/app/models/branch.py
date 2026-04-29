from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)          # e.g. "Jordan", "China", "Iraq"
    name_ar = Column(String(100), nullable=False)       # Arabic name
    code = Column(String(10), unique=True, nullable=False)  # e.g. "JO", "CN", "IQ"
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    users = relationship("User", back_populates="branch")
    clients = relationship("Client", back_populates="branch")
