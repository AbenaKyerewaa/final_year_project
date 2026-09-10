import os
import uuid
os.environ["AI_MODE"] = "mock"

import app.database.base

from fastapi import BackgroundTasks
from app.database.session import SessionLocal
from app.auth.models import User
from app.businesses.models import Business
from app.chat.models import ChatSession, ChatMessage, Escalation
from app.products.models import Product
from app.auth.security import hash_password
from app.chat.routes import (
    handle_chat_message,
    ChatRequest,
    reply_to_chat_session,
    HumanReplyRequest,
    get_business_escalations,
    get_public_chat_session_messages
)

def test_escalation_and_alert_flow():
    db = SessionLocal()
    try:
        print("\n=== STARTING SMART ESCALATION & ALERT INTEGRATION TEST ===")
        
        # 1. Setup Test User / Owner
        owner_email = f"test_owner_{uuid.uuid4().hex[:6]}@example.com"
        owner = User(
            full_name="Kwabena Mensah",
            email=owner_email,
            password_hash=hash_password("password123"),
            role="business_owner"
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)
        print(f"[1/6] Created Owner: {owner.full_name} ({owner.email})")

        # 2. Setup Test Business
        business = Business(
            owner_id=owner.id,
            business_name="Mensah Hardware & Tools",
            category="Retail Hardware",
            location="Accra Central, High Street",
            phone="0244000111",
            whatsapp_number="0244000111",
            description="Specialist in construction tools, cement, and safety gear."
        )
        db.add(business)
        db.commit()
        db.refresh(business)

        product = Product(
            business_id=business.id,
            name="Cement Bag",
            category="Construction Supplies",
            description="50kg construction cement bag for building projects.",
            price=95.00,
            currency="GHS",
            quantity=50,
            availability_status="available"
        )
        db.add(product)
        db.commit()
        print(f"[2/6] Created Business: {business.business_name} (ID: {business.id})")

        # 3. Customer sends query requesting human agent -> Escalation triggered
        bg_tasks = BackgroundTasks()
        chat_req = ChatRequest(
            message="I need to talk to a manager or human agent about a bulk order",
            channel="web"
        )
        chat_res = handle_chat_message(
            business_id=business.id,
            payload=chat_req,
            background_tasks=bg_tasks,
            db=db
        )
        
        assert chat_res.escalated is True, "Expected chat_res.escalated to be True"
        assert "phone" not in chat_res.answer.lower(), "Escalation reply should keep the customer in chat, not ask for a phone number."
        assert "whatsapp number" not in chat_res.answer.lower(), "Escalation reply should not ask for a WhatsApp number."
        session_id = chat_res.session_id
        print(f"[3/6] Escalation triggered! Answer: \"{chat_res.answer}\" | Session ID: {session_id}")

        # Execute queued background tasks (dispatches escalation email alert)
        import asyncio
        asyncio.run(bg_tasks())
        print("[3/6] Background email alert executed successfully!")

        # Verify escalation record in DB
        esc = db.query(Escalation).filter(Escalation.session_id == session_id).first()
        assert esc is not None, "Escalation not found in DB!"
        assert esc.status == "pending"
        print(f"[3/6] Escalation verified in database with status='{esc.status}'")

        # 4. Dashboard queries pending escalations
        escalations = get_business_escalations(
            business_id=business.id,
            status="pending",
            db=db,
            current_user=owner
        )
        assert len(escalations) >= 1
        matched = [e for e in escalations if e.session_id == session_id]
        assert len(matched) == 1
        print(f"[4/6] Dashboard escalations query returned {len(escalations)} pending escalation(s)")

        # 5. Merchant sends human reply from Dashboard -> Auto-resolves escalation
        reply_req = HumanReplyRequest(
            message="Hello, this is Kwabena from Mensah Hardware. We have 50 bags available for immediate delivery!"
        )
        reply_res = reply_to_chat_session(
            session_id=session_id,
            payload=reply_req,
            db=db,
            current_user=owner
        )
        assert reply_res.sender == "human"
        
        # Verify escalation status changed to 'resolved'
        db.refresh(esc)
        assert esc.status == "resolved", f"Expected escalation to be resolved, got {esc.status}"

        public_messages = get_public_chat_session_messages(
            business_id=business.id,
            session_id=session_id,
            db=db
        )
        assert any(m.sender == "human" for m in public_messages), "Expected public session messages to include the human reply."
        print(f"[5/6] Merchant human reply sent! Escalation status auto-updated to: '{esc.status}'")

        # 6. AI resumes on the next answerable customer question
        follow_up_res = handle_chat_message(
            business_id=business.id,
            payload=ChatRequest(
                message="How much is the cement bag?",
                channel="web",
                session_id=session_id
            ),
            background_tasks=BackgroundTasks(),
            db=db
        )
        assert follow_up_res.escalated is False, "Expected AI to resume and answer after the human escalation was resolved."
        assert "95" in follow_up_res.answer, "Expected answer to include the product price."
        print("[6/6] AI resumed successfully after the resolved human handoff.")

        print("\n" + "=" * 60)
        print("[SUCCESS] ALL SMART HYBRID ESCALATION TESTS PASSED!")
        print("=" * 60 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    test_escalation_and_alert_flow()
