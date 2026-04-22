from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class MarketRate(Base):
    """Stores snapshots of currency exchange rates fetched from the API."""
    __tablename__ = "market_rates"

    id = Column(Integer, primary_key=True, index=True)
    base_currency = Column(String(10), nullable=False, default="USD")
    target_currency = Column(String(10), nullable=False)
    rate = Column(Numeric(18, 6), nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
