import uuid
from sqlalchemy import Column, String, DateTime, Text, Uuid, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id = Column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="GHS", nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    availability_status = Column(String(50), default="available", nullable=False)
    warranty = Column(String(100), nullable=True)
    image_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    business = relationship("Business", back_populates="products")
