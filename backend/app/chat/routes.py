import os
import json
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database.session import get_db

# Import models directly from base to resolve relationship mapping
from app.businesses.models import Business
from app.chat.models import ChatSession, ChatMessage, Escalation
from app.auth.models import User
from app.auth.security import get_current_user

from app.rag.vector_store import FAISSVectorStore
from app.ai_providers import get_llm_provider, get_embedding_provider
from app.speech_providers import get_stt_provider

router = APIRouter(prefix="/chat", tags=["chat"])


HANDOFF_KEYWORDS = ["human", "agent", "staff", "call me", "i want to talk to someone", "manager"]
SAFE_FALLBACK = "I'm sorry, I don't have enough information about that. Let me connect you with a human representative, or please ask another question."

# --- Pydantic Schemas ---

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The customer's message")
    customer_name: Optional[str] = Field(None, description="Optional customer's name")
    customer_phone: Optional[str] = Field(None, description="Optional customer's phone number")
    channel: str = Field("web", description="The channel context, e.g. web, whatsapp")
    session_id: Optional[uuid.UUID] = Field(None, description="Optional session UUID to continue previous chat")

class ChatResponse(BaseModel):
    session_id: uuid.UUID
    answer: str
    confidence_score: float
    sources: List[dict]
    escalated: bool

class VoiceChatResponse(BaseModel):
    session_id: uuid.UUID
    transcription: str
    answer: str
    confidence_score: float
    sources: List[dict]
    escalated: bool



# --- Handoff Helper ---

def is_handoff_requested(message: str) -> bool:
    msg = message.lower()
    return any(keyword in msg for keyword in HANDOFF_KEYWORDS)


# --- API Routes ---

def process_rag_chat(
    db: Session,
    business_id: uuid.UUID,
    message: str,
    channel: str,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    session_id: Optional[uuid.UUID] = None
) -> dict:
    """Core RAG Chat pipeline helper.
    Returns a dictionary with session_id, answer, confidence_score, sources, and escalated flag.
    """
    # 1. Verify business profile exists
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found."
        )

    # 2. Retrieve or create session
    session = None
    if session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.business_id == business_id
        ).first()
        
    if not session and customer_phone:
        # Lookup latest session for this phone number
        session = db.query(ChatSession).filter(
            ChatSession.business_id == business_id,
            ChatSession.customer_phone == customer_phone
        ).order_by(ChatSession.created_at.desc()).first()

    if not session:
        session = ChatSession(
            business_id=business_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            channel=channel
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Save customer message to history
    cust_msg_record = ChatMessage(
        session_id=session.id,
        sender="customer",
        message=message.strip()
    )
    db.add(cust_msg_record)
    db.commit()

    # 3. Check for human handoff keywords
    if is_handoff_requested(message):
        # Create Escalation record
        escalation = Escalation(
            business_id=business_id,
            session_id=session.id,
            reason="Customer requested human handoff."
        )
        db.add(escalation)
        
        # Save AI handoff response to history
        handoff_reply = "I have notified our team. A human representative will be with you shortly."
        ai_msg_record = ChatMessage(
            session_id=session.id,
            sender="ai",
            message=handoff_reply,
            confidence_score=1.0,
            ai_response_source=json.dumps([])
        )
        db.add(ai_msg_record)
        db.commit()
        
        return {
            "session_id": session.id,
            "answer": handoff_reply,
            "confidence_score": 1.0,
            "sources": [],
            "escalated": True
        }

    # 4. RAG Retrieval from Vector DB
    store = FAISSVectorStore()
    embed_provider = get_embedding_provider()
    
    try:
        query_embedding = embed_provider.embed_text(message.strip())
        # Query FAISS index for this business
        results = store.query(
            business_id=str(business_id),
            query_embedding=query_embedding,
            limit=4
        )
    except Exception as e:
        print(f"RAG Retrieval failed: {e}")
        results = []

    # Calculate top score
    top_score = results[0]["score"] if results else 0.0
    
    # Read threshold from environment
    try:
        threshold = float(os.getenv("RAG_CONFIDENCE_THRESHOLD", "0.50"))
    except ValueError:
        threshold = 0.50

    # In mock mode, lower the threshold to 0.15 to allow keyword matches to succeed
    ai_mode = os.getenv("AI_MODE", "mock").strip().lower()
    if ai_mode == "mock":
        threshold = 0.15

    # 5. Low-Confidence Fallback Handoff
    if top_score < threshold:
        # Create Escalation
        escalation = Escalation(
            business_id=business_id,
            session_id=session.id,
            reason=f"Low confidence score (score: {top_score:.3f})."
        )
        db.add(escalation)
        
        # Save AI reply to history
        sources_data = [{"title": r["metadata"]["title"], "source_type": r["metadata"]["source_type"], "score": r["score"]} for r in results]
        ai_msg_record = ChatMessage(
            session_id=session.id,
            sender="ai",
            message=SAFE_FALLBACK,
            confidence_score=top_score,
            ai_response_source=json.dumps([{"text": r["text"], "title": r["metadata"]["title"], "score": r["score"]} for r in results])
        )
        db.add(ai_msg_record)
        db.commit()
        
        return {
            "session_id": session.id,
            "answer": SAFE_FALLBACK,
            "confidence_score": top_score,
            "sources": sources_data,
            "escalated": True
        }

    # 6. Prompt Formulation & LLM Execution
    # Build text blocks context
    context_blocks = []
    for idx, res in enumerate(results):
        context_blocks.append(f"Context Source [{idx + 1}]: {res['metadata']['title']}\n{res['text']}")
    context_str = "\n\n".join(context_blocks)
    
    # Configure safety guidelines based on business category
    category_instructions = ""
    category_lower = business.category.lower() if business.category else ""
    if any(k in category_lower for k in ["pharmacy", "chemist", "medical", "clinic"]):
        category_instructions = (
            "IMPORTANT: As a pharmacy/medical assistant, you must NOT provide medical diagnosis, "
            "dosage recommendations, or prescribe medications. Safely redirect the customer to consult a licensed doctor or pharmacist."
        )
    elif any(k in category_lower for k in ["legal", "law", "attorney", "court"]):
        category_instructions = (
            "IMPORTANT: Avoid providing concrete legal advice or making binding legal declarations."
        )

    system_prompt = (
        f"You are a polite, helpful customer support AI assistant representing the business '{business.business_name}'.\n"
        f"Answer the customer's question strictly using the provided business contexts below.\n\n"
        f"CONTEXTS:\n"
        f"{context_str}\n\n"
        f"RULES:\n"
        f"1. Rely ONLY on the context provided. Never invent prices, products, services, discounts, or availability.\n"
        f"2. If the context does not contain the answer, politely state that you do not have that information.\n"
        f"3. Keep your responses short, helpful, and concise.\n"
        f"4. Ask a helpful follow-up question to keep the customer engaged when appropriate.\n"
        f"{category_instructions}"
    )

    try:
        llm = get_llm_provider()
        ai_reply = llm.generate_response(prompt=message.strip(), system_prompt=system_prompt)
        ai_reply = ai_reply.strip()
    except Exception as e:
        print(f"LLM generation failed: {e}")
        # If generation fails, return a safe error message
        ai_reply = "I apologize, but I am having trouble connecting to my brain. Please ask again or contact support."

    # 7. Log Response in Database History
    sources_data = [{"title": r["metadata"]["title"], "source_type": r["metadata"]["source_type"], "score": r["score"]} for r in results]
    ai_msg_record = ChatMessage(
        session_id=session.id,
        sender="ai",
        message=ai_reply,
        confidence_score=top_score,
        ai_response_source=json.dumps(sources_data)
    )
    db.add(ai_msg_record)
    db.commit()

    return {
        "session_id": session.id,
        "answer": ai_reply,
        "confidence_score": top_score,
        "sources": sources_data,
        "escalated": False
    }


@router.post("/{business_id}", response_model=ChatResponse)
def handle_chat_message(
    business_id: uuid.UUID,
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    """Customer-facing AI Chat endpoint using RAG (Retrieval-Augmented Generation).
    Resolves session history, checks for human handoffs, retrieves vectors, and calls the LLM.
    """
    res = process_rag_chat(
        db=db,
        business_id=business_id,
        message=payload.message,
        channel=payload.channel,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        session_id=payload.session_id
    )
    return ChatResponse(
        session_id=res["session_id"],
        answer=res["answer"],
        confidence_score=res["confidence_score"],
        sources=res["sources"],
        escalated=res["escalated"]
    )


import tempfile
import shutil

@router.post("/{business_id}/voice", response_model=VoiceChatResponse)
def handle_voice_chat(
    business_id: uuid.UUID,
    file: UploadFile = File(...),
    session_id: Optional[uuid.UUID] = Form(None),
    customer_name: Optional[str] = Form(None),
    customer_phone: Optional[str] = Form(None),
    channel: str = Form("voice"),
    db: Session = Depends(get_db)
):
    """Customer-facing voice chat endpoint.
    Uploads audio file, runs speech-to-text, feeds text to standard chat pipeline, and returns text answer + transcription.
    """
    # 1. Save uploaded file to a temporary location
    suffix = os.path.splitext(file.filename)[1] if file.filename else ".webm"
    if not suffix:
        suffix = ".webm"
    prefix = os.path.splitext(file.filename)[0] + "_" if file.filename else "voice_recording_"
        
    try:
        with tempfile.NamedTemporaryFile(delete=False, prefix=prefix, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create temporary file for voice recording: {e}"
        )
        
    # 2. Transcribe voice file using configured speech-to-text provider
    try:
        stt_provider = get_stt_provider()
        transcription = stt_provider.transcribe(temp_path)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech-to-text transcription failed: {e}"
        )
    finally:
        # 3. Clean up the temporary file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as ex:
                print(f"Warning: Failed to delete temp file {temp_path}: {ex}")

    # 4. Check if transcription is empty
    if not transcription or not transcription.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Speech-to-text transcription resulted in empty text. Please speak more clearly."
        )

    # 5. Call handle_chat_message to execute RAG retrieval and LLM response generation
    chat_payload = ChatRequest(
        message=transcription.strip(),
        customer_name=customer_name,
        customer_phone=customer_phone,
        channel=channel,
        session_id=session_id
    )
    
    chat_res = handle_chat_message(
        business_id=business_id,
        payload=chat_payload,
        db=db
    )
    
    return VoiceChatResponse(
        session_id=chat_res.session_id,
        transcription=transcription.strip(),
        answer=chat_res.answer,
        confidence_score=chat_res.confidence_score,
        sources=chat_res.sources,
        escalated=chat_res.escalated
    )


# --- Dashboard API Router & Schemas ---


dashboard_router = APIRouter(tags=["dashboard-chat"])

class ChatSessionSummary(BaseModel):
    id: uuid.UUID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    channel: str
    created_at: datetime
    latest_message: Optional[str] = None
    escalated: bool
    escalation_status: Optional[str] = None

    class Config:
        from_attributes = True

class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    sender: str
    message: str
    confidence_score: Optional[float] = None
    ai_response_source: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionDetail(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    channel: str
    created_at: datetime
    escalated: bool
    escalation_status: Optional[str] = None
    messages: List[ChatMessageResponse]

    class Config:
        from_attributes = True

class EscalationResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    session_id: uuid.UUID
    reason: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    channel: str

    class Config:
        from_attributes = True

class EscalationUpdate(BaseModel):
    status: str = Field(..., description="Escalation status, e.g. pending, resolved, ignored")


def verify_dashboard_access(business_id: uuid.UUID, db: Session, current_user: User):
    """Checks that the user is the owner, staff, or admin of this business profile."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found"
        )
    is_owner = business.owner_id == current_user.id
    is_staff = current_user.role == "staff"
    is_admin = current_user.role == "admin"
    if not (is_owner or is_staff or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view chat history for this business."
        )
    return business


@dashboard_router.get("/businesses/{business_id}/chat-sessions", response_model=List[ChatSessionSummary])
def get_business_chat_sessions(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all chat sessions associated with a specific business profile. Restricted to owner/staff/admin."""
    verify_dashboard_access(business_id, db, current_user)
    
    sessions = db.query(ChatSession).filter(
        ChatSession.business_id == business_id
    ).order_by(ChatSession.created_at.desc()).all()
    
    result = []
    for s in sessions:
        # Get latest message
        latest_msg = db.query(ChatMessage).filter(
            ChatMessage.session_id == s.id
        ).order_by(ChatMessage.created_at.desc()).first()
        latest_msg_text = latest_msg.message if latest_msg else None
        
        # Get escalations status
        escalation = db.query(Escalation).filter(
            Escalation.session_id == s.id
        ).order_by(Escalation.created_at.desc()).first()
        
        escalated = False
        escalation_status = None
        if escalation:
            escalation_status = escalation.status
            if escalation.status == "pending":
                escalated = True

        result.append(ChatSessionSummary(
            id=s.id,
            customer_name=s.customer_name,
            customer_phone=s.customer_phone,
            channel=s.channel,
            created_at=s.created_at,
            latest_message=latest_msg_text,
            escalated=escalated,
            escalation_status=escalation_status
        ))
    return result


@dashboard_router.get("/chat-sessions/{session_id}", response_model=ChatSessionDetail)
def get_chat_session_details(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve chat history and details for a single chat session. Restricted to owner/staff/admin."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found."
        )
    
    verify_dashboard_access(session.business_id, db, current_user)
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.created_at.asc()).all()
    
    escalation = db.query(Escalation).filter(
        Escalation.session_id == session.id
    ).order_by(Escalation.created_at.desc()).first()
    
    escalated = False
    escalation_status = None
    if escalation:
        escalation_status = escalation.status
        if escalation.status == "pending":
            escalated = True

    return ChatSessionDetail(
        id=session.id,
        business_id=session.business_id,
        customer_name=session.customer_name,
        customer_phone=session.customer_phone,
        channel=session.channel,
        created_at=session.created_at,
        escalated=escalated,
        escalation_status=escalation_status,
        messages=messages
    )


@dashboard_router.get("/businesses/{business_id}/escalations", response_model=List[EscalationResponse])
def get_business_escalations(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all customer escalations for a specific business profile. Restricted to owner/staff/admin."""
    verify_dashboard_access(business_id, db, current_user)
    
    escalations = db.query(Escalation).filter(
        Escalation.business_id == business_id
    ).order_by(Escalation.created_at.desc()).all()
    
    result = []
    for esc in escalations:
        session = esc.session
        result.append(EscalationResponse(
            id=esc.id,
            business_id=esc.business_id,
            session_id=esc.session_id,
            reason=esc.reason,
            status=esc.status,
            created_at=esc.created_at,
            updated_at=esc.updated_at,
            customer_name=session.customer_name if session else None,
            customer_phone=session.customer_phone if session else None,
            channel=session.channel if session else "web"
        ))
    return result


@dashboard_router.put("/escalations/{escalation_id}", response_model=EscalationResponse)
def update_escalation_status(
    escalation_id: uuid.UUID,
    payload: EscalationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update escalation status (e.g. mark as 'resolved' or 'ignored'). Scoped to owner/staff/admin."""
    escalation = db.query(Escalation).filter(Escalation.id == escalation_id).first()
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation not found."
        )
        
    verify_dashboard_access(escalation.business_id, db, current_user)
    
    valid_statuses = ["pending", "resolved", "ignored"]
    status_lower = payload.status.lower().strip()
    if status_lower not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of {valid_statuses}."
        )
        
    escalation.status = status_lower
    db.commit()
    db.refresh(escalation)
    
    session = escalation.session
    return EscalationResponse(
        id=escalation.id,
        business_id=escalation.business_id,
        session_id=escalation.session_id,
        reason=escalation.reason,
        status=escalation.status,
        created_at=escalation.created_at,
        updated_at=escalation.updated_at,
        customer_name=session.customer_name if session else None,
        customer_phone=session.customer_phone if session else None,
        channel=session.channel if session else "web"
    )

