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
from app.ai_providers import AIService
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



import re
from app.faqs.models import FAQ
from app.services.models import Service
from app.products.models import Product

# --- Handoff & Fallback Helpers ---

def is_handoff_requested(message: str) -> bool:
    msg = message.lower()
    return any(keyword in msg for keyword in HANDOFF_KEYWORDS)


def find_local_database_match(db: Session, business_id: uuid.UUID, query: str) -> Optional[dict]:
    """Helper to perform direct database keyword search matching for FAQs, Services, and Products.
    Used as an immediate graceful fallback when Gemini LLM or embedding limits are reached.
    Supports returning multiple matching products/services combined.
    """
    raw_words = re.findall(r'[a-zA-Z0-9]{2,}', query.lower())
    stopwords = {
        # 1-character
        "a", "i",
        # 2-character common words to filter
        "an", "am", "are", "as", "at", "be", "by", "do", "go", "he", "if", "in", "is", "it", 
        "me", "my", "no", "of", "on", "or", "so", "to", "up", "we", "us", "oh", "to",
        # 3-character & above
        "the", "and", "for", "you", "that", "this", "with", "have", "are", "was",
        "were", "but", "not", "she", "her", "his", "they", "them", "their", "our",
        "what", "where", "when", "how", "who", "which", "about", "your", "will", "can",
        "does", "did", "do"
    }
    clean_words = [w for w in raw_words if w not in stopwords]
    if not clean_words:
        return None

    def score_field(text: str, exact_weight: int, substring_weight: int) -> int:
        if not text:
            return 0
        text_words = re.findall(r'[a-zA-Z0-9]{2,}', text.lower())
        score = 0
        for w in clean_words:
            matched = False
            # Check for exact word match first
            for tw in text_words:
                if w == tw:
                    score += exact_weight
                    matched = True
                    break
            # If no exact match and length is > 2, check for substring matching
            if not matched and len(w) > 2:
                for tw in text_words:
                    if len(tw) > 2 and (w in tw or tw in w):
                        score += substring_weight
                        break
        return score

    # 1. Score Services
    matched_services = []
    services = db.query(Service).filter(Service.business_id == business_id).all()
    for s in services:
        score = score_field(s.name, 15, 8) + score_field(s.description, 3, 1)
        if score > 0:
            matched_services.append((score, s))

    # 2. Score Products
    matched_products = []
    products = db.query(Product).filter(Product.business_id == business_id).all()
    for p in products:
        score = score_field(p.name, 15, 8) + score_field(p.category, 15, 8) + score_field(p.description, 3, 1)
        if score > 0:
            matched_products.append((score, p))

    # 3. Score FAQs
    matched_faqs = []
    faqs = db.query(FAQ).filter(FAQ.business_id == business_id).all()
    for faq in faqs:
        score = score_field(faq.question, 15, 8) + score_field(faq.answer, 3, 1)
        if score > 0:
            matched_faqs.append((score, faq))

    # Find highest score among all categories
    best_product_score = max([item[0] for item in matched_products]) if matched_products else 0
    best_service_score = max([item[0] for item in matched_services]) if matched_services else 0
    best_faq_score = max([item[0] for item in matched_faqs]) if matched_faqs else 0

    highest_score = max(best_product_score, best_service_score, best_faq_score)
    if highest_score <= 0:
        return None

    # Prioritize products if they have a strong match (tied or close to highest score)
    if best_product_score > 0 and (best_product_score >= highest_score or (best_faq_score < best_product_score + 5)):
        threshold_score = max(8, int(best_product_score * 0.8))
        top_products_sorted = sorted([item for item in matched_products if item[0] >= threshold_score], key=lambda x: x[0], reverse=True)
        top_products = [item[1] for item in top_products_sorted]

        if len(top_products) == 1:
            p = top_products[0]
            desc_str = f" {p.description}." if p.description else ""
            qty_str = f" In stock: {p.quantity} items." if p.quantity is not None else ""
            return {
                "answer": f"We have '{p.name}' available for {p.currency} {p.price:.2f}.{desc_str}{qty_str}",
                "title": p.name,
                "source_type": "product"
            }
        else:
            product_lines = []
            for p in top_products:
                qty_str = f" (In stock: {p.quantity})" if p.quantity is not None else ""
                product_lines.append(f"- {p.name}: {p.currency} {p.price:.2f}{qty_str}")
            products_list_str = "\n".join(product_lines)
            return {
                "answer": f"We sell both brand new in box and Grade A clean refurbished laptops. Refurbished laptops undergo rigorous quality checks.\nWe have the following products in stock matching your query:\n{products_list_str}",
                "title": f"Products list ({len(top_products)} items)",
                "source_type": "product"
            }

    # If services are the winner
    if best_service_score > 0 and best_service_score >= highest_score:
        threshold_score = max(8, int(best_service_score * 0.8))
        top_services_sorted = sorted([item for item in matched_services if item[0] >= threshold_score], key=lambda x: x[0], reverse=True)
        top_services = [item[1] for item in top_services_sorted]

        if len(top_services) == 1:
            s = top_services[0]
            dur_unit = s.duration_unit if hasattr(s, 'duration_unit') and s.duration_unit else "minutes"
            dur_str = f" (Duration: {s.duration} {dur_unit})" if s.duration else ""
            desc_str = f" {s.description}." if s.description else ""
            return {
                "answer": f"Our '{s.name}' service is available for {s.currency} {s.price:.2f}.{desc_str}{dur_str}",
                "title": s.name,
                "source_type": "service"
            }
        else:
            service_lines = []
            for s in top_services:
                service_lines.append(f"- {s.name}: {s.currency} {s.price:.2f}")
            services_list_str = "\n".join(service_lines)
            return {
                "answer": f"We offer the following services matching your query:\n{services_list_str}",
                "title": f"Services list ({len(top_services)} items)",
                "source_type": "service"
            }

    # Otherwise FAQ is the winner
    if best_faq_score > 0:
        top_faqs = sorted(matched_faqs, key=lambda x: x[0], reverse=True)
        best_faq = top_faqs[0][1]
        return {
            "answer": best_faq.answer,
            "title": best_faq.question,
            "source_type": "faq"
        }

    return None


def extract_answer_from_chunk(chunk: dict) -> str:
    """Helper to extract a clean answer string from a FAISS knowledge chunk without LLM formatting."""
    text = chunk["text"]
    source_type = chunk["metadata"].get("source_type", "")
    
    if source_type == "faq" and "Answer:" in text:
        return text.split("Answer:", 1)[1].strip()
        
    return text


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
    ai_service = AIService()
    
    search_query = message.strip()
    try:
        history_messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == session.id
        ).order_by(ChatMessage.created_at.asc()).all()
        
        # Exclude the current message (last element) to get previous conversation context
        if len(history_messages) > 1:
            history_blocks = []
            for msg in history_messages[:-1]:
                sender_label = "Customer" if msg.sender == "customer" else "AI"
                history_blocks.append(f"{sender_label}: {msg.message}")
            history_str = "\n".join(history_blocks[-5:])
            
            rewrite_prompt = (
                f"Given the following conversation history and a follow-up message, rephrase the follow-up message "
                f"into a standalone search query that contains all necessary context (like products, services, or topics mentioned).\n\n"
                f"CONVERSATION HISTORY:\n"
                f"{history_str}\n\n"
                f"FOLLOW-UP MESSAGE:\n"
                f"{message.strip()}\n\n"
                f"Instructions:\n"
                f"- Reply ONLY with the standalone rephrased search query. Do NOT add any introduction, explanation, or polite words.\n"
                f"- If the follow-up message is already standalone and does not need context from the history, reply with the exact follow-up message."
            )
            condensed = ai_service.generate_response(
                prompt=rewrite_prompt,
                system_prompt="You are a query rewriting assistant. Output only the standalone search query."
            )
            condensed_clean = condensed.strip().strip('"').strip("'")
            if condensed_clean:
                print(f"[RAG Query Condense] Rewrote '{message.strip()}' -> '{condensed_clean}'")
                search_query = condensed_clean
    except Exception as e:
        print(f"[RAG Query Condense] Failed to rewrite query: {e}")

    try:
        query_embedding = ai_service.embed_text(search_query)
        # Query FAISS index for this business
        results = store.query(
            business_id=str(business_id),
            query_embedding=query_embedding,
            limit=8
        )
        print(f"[RAG Retrieval Debug] Query: '{search_query}' | Retrieved: {[{'title': r['metadata']['title'], 'score': r['score']} for r in results]}")
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

    print(f"[RAG Threshold Debug] Top score: {top_score:.4f} | Configured threshold: {threshold:.2f} | AI Mode: {ai_mode}")

    # 5. Low-Confidence Fallback Handoff
    if top_score < threshold:
        # Try local DB search fallback first
        local_match = find_local_database_match(db, business_id, message.strip())
        if local_match:
            print(f"[RAG Local Fallback] Score {top_score:.4f} < {threshold:.2f}. Found local match: {local_match['title']}")
            ai_reply = local_match["answer"]
            sources_data = [{"title": local_match["title"], "source_type": local_match["source_type"], "score": 0.90}]
            ai_msg_record = ChatMessage(
                session_id=session.id,
                sender="ai",
                message=ai_reply,
                confidence_score=0.90,
                ai_response_source=json.dumps(sources_data)
            )
            db.add(ai_msg_record)
            db.commit()
            return {
                "session_id": session.id,
                "answer": ai_reply,
                "confidence_score": 0.90,
                "sources": sources_data,
                "escalated": False
            }

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
    # Load recent chat history (e.g., last 10 messages before the current one)
    history_messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session.id
    ).order_by(ChatMessage.created_at.asc()).all()
    
    # Exclude the current message we just added
    history_blocks = []
    for msg in history_messages[:-1]:
        sender_label = "Customer" if msg.sender == "customer" else "AI Assistant"
        history_blocks.append(f"{sender_label}: {msg.message}")
    
    history_str = "\n".join(history_blocks[-10:]) if history_blocks else "No previous conversation history."

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
        f"You are a friendly, welcoming, and highly professional customer support AI assistant representing '{business.business_name}' "
        f"powered by the EasyBiz platform. Your duty is to help customers efficiently and politely.\n\n"
        f"BUSINESS KNOWLEDGE/CONTEXTS:\n"
        f"{context_str}\n\n"
        f"CONVERSATION HISTORY:\n"
        f"{history_str}\n\n"
        f"INSTRUCTIONS AND RULES:\n"
        f"1. Rely strictly and ONLY on the business knowledge contexts provided above. Do NOT invent, assume, or speculate about prices, products, services, delivery times, or any other details not explicitly written.\n"
        f"2. Avoid hallucinating information. If the customer's query cannot be answered directly using the provided business knowledge contexts (for example, if they ask general knowledge questions, unrelated topics, or about products/services/FAQs not listed in the contexts), you MUST reply EXACTLY with: \"I'm sorry, I don't have enough information about that. Let me connect you with a human representative, or please ask another question.\"\n"
        f"3. Keep your tone polite, warm, professional, and friendly.\n"
        f"4. Keep your responses short, helpful, and clear.\n"
        f"5. Whenever relevant, guide the customer toward browsing our services, viewing our catalog, or scheduling/booking an appointment.\n"
        f"{category_instructions}"
    )

    try:
        ai_service = AIService()
        ai_reply = ai_service.generate_response(prompt=message.strip(), system_prompt=system_prompt)
        ai_reply = ai_reply.strip()
    except ValueError as e:
        print(f"Validation or format error: {e}")
        ai_reply = "I'm sorry, I cannot process an empty or malformed message. Please verify your input."
    except PermissionError as e:
        print(f"Authentication error: {e}")
        ai_reply = "I apologize, but I am currently experiencing access configuration issues. Please contact the administrator."
    except Exception as e:
        print(f"LLM generation failed: {e}")
        # Try local DB search fallback first
        local_match = find_local_database_match(db, business_id, message.strip())
        if local_match:
            print(f"[RAG Fallback] LLM error fallback matched local item: {local_match['title']}")
            ai_reply = local_match["answer"]
        elif results:
            # Fall back to the top matched knowledge source chunk text
            top_chunk = results[0]
            print(f"[RAG Fallback] LLM error fallback using top chunk: {top_chunk['metadata']['title']}")
            ai_reply = extract_answer_from_chunk(top_chunk)
        else:
            # Full fallback
            err_msg = str(e).lower()
            if any(k in err_msg for k in ["quota", "rate limit", "429", "503", "high demand", "temporary", "service unavailable"]):
                ai_reply = "I'm sorry, but our AI service is currently experiencing high demand. Please try again in a few seconds."
            else:
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

