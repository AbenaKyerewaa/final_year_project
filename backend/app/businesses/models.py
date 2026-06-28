import uuid
from sqlalchemy import Column, String, DateTime, Text, Uuid, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class Business(Base):
    __tablename__ = "businesses"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    business_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    location = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    whatsapp_number = Column(String(50), nullable=True)
    opening_hours = Column(Text, nullable=True)
    payment_methods = Column(Text, nullable=True)
    delivery_options = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="businesses")
    products = relationship("Product", back_populates="business", cascade="all, delete-orphan")
    services = relationship("Service", back_populates="business", cascade="all, delete-orphan")
    faqs = relationship("FAQ", back_populates="business", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="business", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="business", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="business", cascade="all, delete-orphan")
