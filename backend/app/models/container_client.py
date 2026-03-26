from sqlalchemy import Column, Integer, Numeric, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class ContainerClient(Base):
    """Junction table for LCL containers: one container shared by multiple clients."""
    __tablename__ = "container_clients"
    __table_args__ = (UniqueConstraint("container_id", "client_id", name="uq_container_client"),)

    id = Column(Integer, primary_key=True, index=True)
    container_id = Column(Integer, ForeignKey("containers.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    # This client's portion of cargo in the container
    cbm = Column(Numeric(10, 4), nullable=True)
    cartons = Column(Integer, nullable=True)
    net_weight = Column(Numeric(10, 3), nullable=True)
    gross_weight = Column(Numeric(10, 3), nullable=True)
    freight_share = Column(Numeric(14, 2), nullable=True)  # USD share of freight cost
    notes = Column(Text, nullable=True)

    # Relationships
    container = relationship("Container", back_populates="lcl_clients")
    client = relationship("Client")
