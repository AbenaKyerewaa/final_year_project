import uuid
from sqlalchemy import Column, String, DateTime, Text, Uuid, ForeignKey, Float, func
from sqlalchemy.orm import relationship
from app.database.base_class import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id = Column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    channel = Column(String(50), default="web", nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    business = relationship("Business", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(50), nullable=False)  # 'customer', 'ai', 'human'
    message = Column(Text, nullable=False)
    ai_response_source = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    business_id = Column(Uuid, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Uuid, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False)  # 'pending', 'resolved', 'ignored'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    business = relationship("Business", back_populates="escalations")
    session = relationship("ChatSession", back_populates="escalations")
