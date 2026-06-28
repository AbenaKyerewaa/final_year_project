import uuid
from sqlalchemy import Column, DateTime, Text, Uuid, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id = Column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    business = relationship("Business", back_populates="faqs")
