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
# from app.speech_providers import get_stt_provider

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

# class VoiceChatResponse(BaseModel):
#     session_id: uuid.UUID
#     transcription: str
#     answer: str
#     confidence_score: float
#     sources: List[dict]
#     escalated: bool



import re
from app.faqs.models import FAQ
from app.services.models import Service
from app.products.models import Product

# --- Handoff & Fallback Helpers ---

def is_handoff_requested(message: str) -> bool:
    msg = message.lower()
    return any(keyword in msg for keyword in HANDOFF_KEYWORDS)


def _normalise_tokens(text: str) -> List[str]:
    """Return conservative searchable tokens for structured chat matching."""
    raw = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    stopwords = {
        "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "did", "do", "does",
        "for", "from", "have", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
        "our", "please", "some", "that", "the", "their", "them", "these", "they", "this", "to",
        "us", "we", "what", "when", "where", "which", "who", "will", "with", "you", "your"
    }

    tokens: List[str] = []
    for token in raw:
        if token in stopwords:
            continue
        # Small amount of normalisation so "laptops" matches "laptop", etc.
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 4 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        tokens.append(token)
    return tokens


def _money(currency, price) -> str:
    currency = currency or "GHS"
    try:
        return f"{currency} {float(price):,.2f}"
    except (TypeError, ValueError):
        return f"{currency} {price}" if price is not None else currency


def _service_duration(service) -> str:
    duration = getattr(service, "duration", None)
    duration_unit = getattr(service, "duration_unit", None)
    if duration in (None, ""):
        return ""
    duration_text = str(duration).strip()
    if duration_unit:
        unit_text = str(duration_unit).strip()
        if unit_text and unit_text.lower() not in duration_text.lower():
            duration_text = f"{duration_text} {unit_text}"
    return duration_text


def find_local_database_match(db: Session, business_id: uuid.UUID, query: str) -> Optional[dict]:
    """Structured, business-scoped retrieval for Products, Services and FAQs.

    This is intentionally conservative: it returns an answer only when the query can be
    matched to a clear catalogue intent, a product/service entity, or a sufficiently strong
    FAQ match. Ambiguous queries return None and are left to document RAG instead of being
    force-matched to an unrelated record.
    """
    query_text = (query or "").strip()
    query_lower = query_text.lower()
    query_tokens = _normalise_tokens(query_text)
    query_set = set(query_tokens)

    if not query_text:
        return None

    products = db.query(Product).filter(Product.business_id == business_id).all()
    services = db.query(Service).filter(Service.business_id == business_id).all()
    faqs = db.query(FAQ).filter(FAQ.business_id == business_id).all()

    # ---------- 1. Specific product/entity matching ----------
    product_matches = []
    for product in products:
        name_tokens = set(_normalise_tokens(getattr(product, "name", "")))
        category_tokens = set(_normalise_tokens(getattr(product, "category", "")))
        description_tokens = set(_normalise_tokens(getattr(product, "description", "")))

        name_hits = query_set & name_tokens
        category_hits = query_set & category_tokens
        description_hits = query_set & description_tokens

        score = (len(name_hits) * 6) + (len(category_hits) * 3) + min(len(description_hits), 2)
        if score > 0:
            product_matches.append((score, product, name_hits, category_hits))

    product_matches.sort(key=lambda item: item[0], reverse=True)
    best_product_score = product_matches[0][0] if product_matches else 0

    # ---------- 2. Specific service/entity matching ----------
    service_matches = []
    for service in services:
        name_tokens = set(_normalise_tokens(getattr(service, "name", "")))
        description_tokens = set(_normalise_tokens(getattr(service, "description", "")))

        name_hits = query_set & name_tokens
        description_hits = query_set & description_tokens
        score = (len(name_hits) * 6) + min(len(description_hits), 3)
        if score > 0:
            service_matches.append((score, service, name_hits))

    service_matches.sort(key=lambda item: item[0], reverse=True)
    best_service_score = service_matches[0][0] if service_matches else 0

    # Generic words should not turn a catalogue question into one arbitrary item.
    product_catalogue_terms = {"sell", "product", "item", "gadget", "stock", "catalog", "catalogue", "buy"}
    service_catalogue_terms = {"service", "repair", "support", "fix", "installation", "upgrade"}

    has_product_catalogue_intent = bool(query_set & product_catalogue_terms)
    has_service_catalogue_intent = bool(query_set & service_catalogue_terms)

    # A product is considered specific when the customer mentioned meaningful product/name/category tokens.
    specific_product_matches = [
        item for item in product_matches
        if item[2] or item[3]
    ]
    specific_service_matches = [
        item for item in service_matches
        if item[2]
    ]

    # ---------- 3. Clear product request ----------
    if specific_product_matches and best_product_score >= max(6, best_service_score + 2):
        top_score = specific_product_matches[0][0]
        selected = [item[1] for item in specific_product_matches if item[0] >= max(6, top_score - 3)]
        selected = selected[:12]

        if len(selected) == 1:
            p = selected[0]
            parts = [f"{p.name} is {_money(getattr(p, 'currency', None), getattr(p, 'price', None))}."]
            if getattr(p, "description", None):
                parts.append(str(p.description).strip())
            if getattr(p, "quantity", None) is not None:
                parts.append(f"Current stock: {p.quantity}.")
            warranty = getattr(p, "warranty", None)
            if warranty:
                parts.append(f"Warranty: {warranty}.")
            return {
                "answer": " ".join(parts),
                "title": p.name,
                "source_type": "product",
                "confidence_score": 0.95,
            }

        lines = []
        for p in selected:
            qty = f" — {p.quantity} in stock" if getattr(p, "quantity", None) is not None else ""
            lines.append(f"- {p.name}: {_money(getattr(p, 'currency', None), getattr(p, 'price', None))}{qty}")
        return {
            "answer": "Here are the matching products I found:\n" + "\n".join(lines),
            "title": f"Matching products ({len(selected)})",
            "source_type": "product",
            "confidence_score": 0.93,
        }

    # ---------- 4. Clear service request ----------
    if specific_service_matches and best_service_score >= max(6, best_product_score + 2):
        top_score = specific_service_matches[0][0]
        selected = [item[1] for item in specific_service_matches if item[0] >= max(6, top_score - 3)]
        selected = selected[:12]

        if len(selected) == 1:
            s = selected[0]
            parts = [f"Our {s.name} service costs {_money(getattr(s, 'currency', None), getattr(s, 'price', None))}."]
            if getattr(s, "description", None):
                parts.append(str(s.description).strip())
            duration_text = _service_duration(s)
            if duration_text:
                parts.append(f"Estimated duration: {duration_text}.")
            return {
                "answer": " ".join(parts),
                "title": s.name,
                "source_type": "service",
                "confidence_score": 0.95,
            }

        lines = []
        for s in selected:
            duration_text = _service_duration(s)
            duration_suffix = f" — {duration_text}" if duration_text else ""
            lines.append(f"- {s.name}: {_money(getattr(s, 'currency', None), getattr(s, 'price', None))}{duration_suffix}")
        return {
            "answer": "Here are the matching services I found:\n" + "\n".join(lines),
            "title": f"Matching services ({len(selected)})",
            "source_type": "service",
            "confidence_score": 0.93,
        }

    # ---------- 5. Broad catalogue/list requests ----------
    # Only use these when no specific entity clearly won above.
    if has_product_catalogue_intent and not has_service_catalogue_intent and products:
        lines = []
        for p in products[:15]:
            qty = f" — {p.quantity} in stock" if getattr(p, "quantity", None) is not None else ""
            lines.append(f"- {p.name}: {_money(getattr(p, 'currency', None), getattr(p, 'price', None))}{qty}")
        extra = ""
        if len(products) > 15:
            extra = f"\n\nThere are {len(products)} products in the catalogue. Ask about a product or category for more details."
        return {
            "answer": "We sell a range of products, including:\n" + "\n".join(lines) + extra,
            "title": "Product catalogue",
            "source_type": "product",
            "confidence_score": 0.96,
        }

    if has_service_catalogue_intent and not has_product_catalogue_intent and services:
        lines = []
        for s in services[:18]:
            duration_text = _service_duration(s)
            duration_suffix = f" — {duration_text}" if duration_text else ""
            lines.append(f"- {s.name}: {_money(getattr(s, 'currency', None), getattr(s, 'price', None))}{duration_suffix}")
        return {
            "answer": "We offer the following services:\n" + "\n".join(lines),
            "title": "Services catalogue",
            "source_type": "service",
            "confidence_score": 0.96,
        }

    # ---------- 6. FAQ matching ----------
    # FAQ matching requires more evidence than one shared generic word.
    faq_matches = []
    for faq in faqs:
        question_text = getattr(faq, "question", "") or ""
        question_tokens = set(_normalise_tokens(question_text))
        if not question_tokens:
            continue

        overlap = query_set & question_tokens
        coverage = len(overlap) / max(1, min(len(query_set), len(question_tokens)))
        phrase_bonus = 1.0 if query_lower in question_text.lower() or question_text.lower() in query_lower else 0.0
        score = coverage + phrase_bonus

        # Require either two meaningful shared tokens, a strong short-query overlap, or phrase containment.
        strong_enough = (
            len(overlap) >= 2
            or (len(query_set) <= 2 and coverage >= 0.75)
            or phrase_bonus > 0
        )
        if strong_enough:
            faq_matches.append((score, faq, overlap, coverage))

    if faq_matches:
        faq_matches.sort(key=lambda item: item[0], reverse=True)
        best_score, best_faq, overlap, coverage = faq_matches[0]
        return {
            "answer": best_faq.answer,
            "title": best_faq.question,
            "source_type": "faq",
            "confidence_score": min(0.94, max(0.82, 0.82 + (coverage * 0.12))),
        }

    # No forced guess. Let semantic/document RAG handle the question.
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

    # IMPORTANT: Always try deterministic structured retrieval against the
    # customer's ORIGINAL message before any LLM-based query rewriting.
    # This prevents a mock/fallback provider or conversation rewrite from
    # changing clear requests such as "What do you sell?" or
    # "Do you have Samsung phones?" into text that no longer matches the
    # business's Products, Services, or FAQs.
    original_query = message.strip()
    structured_match = find_local_database_match(db, business_id, original_query)
    if structured_match:
        structured_confidence = float(structured_match.get("confidence_score", 0.90))
        sources_data = [{
            "title": structured_match["title"],
            "source_type": structured_match["source_type"],
            "score": structured_confidence,
        }]
        print(
            f"[Structured Retrieval] Original query matched {structured_match['source_type']}: "
            f"{structured_match['title']} (confidence={structured_confidence:.2f})"
        )

        ai_msg_record = ChatMessage(
            session_id=session.id,
            sender="ai",
            message=structured_match["answer"],
            confidence_score=structured_confidence,
            ai_response_source=json.dumps(sources_data),
        )
        db.add(ai_msg_record)
        db.commit()

        return {
            "session_id": session.id,
            "answer": structured_match["answer"],
            "confidence_score": structured_confidence,
            "sources": sources_data,
            "escalated": False,
        }

    search_query = original_query
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

    # If the original message did not match structured data, try the rewritten
    # standalone query once. This is useful for genuine follow-ups such as
    # "How much is it?" while keeping clear standalone questions untouched.
    if search_query != original_query:
        structured_match = find_local_database_match(db, business_id, search_query)
        if structured_match:
            structured_confidence = float(structured_match.get("confidence_score", 0.90))
            sources_data = [{
                "title": structured_match["title"],
                "source_type": structured_match["source_type"],
                "score": structured_confidence,
            }]
            print(
                f"[Structured Retrieval] Rewritten query matched {structured_match['source_type']}: "
                f"{structured_match['title']} (confidence={structured_confidence:.2f})"
            )

            ai_msg_record = ChatMessage(
                session_id=session.id,
                sender="ai",
                message=structured_match["answer"],
                confidence_score=structured_confidence,
                ai_response_source=json.dumps(sources_data),
            )
            db.add(ai_msg_record)
            db.commit()

            return {
                "session_id": session.id,
                "answer": structured_match["answer"],
                "confidence_score": structured_confidence,
                "sources": sources_data,
                "escalated": False,
            }

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
        # Structured retrieval was already attempted above. If both the structured
        # database lookup and semantic retrieval are uncertain, do not invent a match.
        # Escalate safely instead.
        print(
            f"[RAG Safe Fallback] No reliable structured match and vector score "
            f"{top_score:.4f} < threshold {threshold:.2f}. Escalating safely."
        )

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



@router.get("/{business_id}/public-info")
def get_public_business_info(
    business_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    business = (
        db.query(Business)
        .filter(Business.id == business_id)
        .first()
    )

    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business profile not found."
        )

    return {
        "id": str(business.id),
        "business_name": business.business_name
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

# @router.post("/{business_id}/voice", response_model=VoiceChatResponse)
# def handle_voice_chat(
#     business_id: uuid.UUID,
#     file: UploadFile = File(...),
#     session_id: Optional[uuid.UUID] = Form(None),
#     customer_name: Optional[str] = Form(None),
#     customer_phone: Optional[str] = Form(None),
#     channel: str = Form("voice"),
#     db: Session = Depends(get_db)
# ):
#     """Customer-facing voice chat endpoint.
#     Uploads audio file, runs speech-to-text, feeds text to standard chat pipeline, and returns text answer + transcription.
#     """
#     # 1. Save uploaded file to a temporary location
#     suffix = os.path.splitext(file.filename)[1] if file.filename else ".webm"
#     if not suffix:
#         suffix = ".webm"
#     prefix = os.path.splitext(file.filename)[0] + "_" if file.filename else "voice_recording_"
#         
#     try:
#         with tempfile.NamedTemporaryFile(delete=False, prefix=prefix, suffix=suffix) as temp_file:
#             shutil.copyfileobj(file.file, temp_file)
#             temp_path = temp_file.name
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to create temporary file for voice recording: {e}"
#         )
#         
#     # 2. Transcribe voice file using configured speech-to-text provider
#     try:
#         stt_provider = get_stt_provider()
#         transcription = stt_provider.transcribe(temp_path)
#     except Exception as e:
#         if os.path.exists(temp_path):
#             os.remove(temp_path)
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Speech-to-text transcription failed: {e}"
#         )
#     finally:
#         # 3. Clean up the temporary file
#         if os.path.exists(temp_path):
#             try:
#                 os.remove(temp_path)
#             except Exception as ex:
#                 print(f"Warning: Failed to delete temp file {temp_path}: {ex}")
# 
#     # 4. Check if transcription is empty
#     if not transcription or not transcription.strip():
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Speech-to-text transcription resulted in empty text. Please speak more clearly."
#         )
# 
#     # 5. Call handle_chat_message to execute RAG retrieval and LLM response generation
#     chat_payload = ChatRequest(
#         message=transcription.strip(),
#         customer_name=customer_name,
#         customer_phone=customer_phone,
#         channel=channel,
#         session_id=session_id
#     )
#     
#     chat_res = handle_chat_message(
#         business_id=business_id,
#         payload=chat_payload,
#         db=db
#     )
#     
#     return VoiceChatResponse(
#         session_id=chat_res.session_id,
#         transcription=transcription.strip(),
#         answer=chat_res.answer,
#         confidence_score=chat_res.confidence_score,
#         sources=chat_res.sources,
#         escalated=chat_res.escalated
#     )


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
