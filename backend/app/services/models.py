import uuid
from sqlalchemy import Column, String, DateTime, Text, Uuid, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Service(Base):
    __tablename__ = "services"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id = Column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="GHS", nullable=False)
    duration = Column(String(50), nullable=True)  # duration value or range (e.g. "30", "15-20")
    duration_unit = Column(String(20), default="minutes", server_default="minutes", nullable=False)
    availability_status = Column(String(50), default="available", nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    business = relationship("Business", back_populates="services")
