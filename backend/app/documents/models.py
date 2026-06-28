import uuid
from sqlalchemy import Column, String, DateTime, Text, Uuid, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id = Column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    processed_status = Column(String(50), default="pending", nullable=False)
    extracted_text = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    business = relationship("Business", back_populates="documents")
