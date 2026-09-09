import os
import uuid
os.environ["AI_MODE"] = "mock"

import app.database.base

from fastapi import BackgroundTasks
from app.database.session import SessionLocal
from app.auth.models import User
from app.businesses.models import Business
from app.chat.models import ChatSession, ChatMessage, Escalation
from app.auth.security import hash_password
from app.chat.routes import (
    handle_chat_message,
    ChatRequest,
    save_customer_contact,
    CustomerContactRequest,
    reply_to_chat_session,
    HumanReplyRequest,
    get_business_escalations
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

        # 4. Customer submits WhatsApp/Phone number via in-chat contact card
        contact_bg = BackgroundTasks()
        contact_req = CustomerContactRequest(
            session_id=session_id,
            customer_phone="0501234567",
            customer_name="Ama Osei"
        )
        contact_res = save_customer_contact(
            business_id=business.id,
            payload=contact_req,
            background_tasks=contact_bg,
            db=db
        )
        assert contact_res["customer_phone"] == "0501234567"
        asyncio.run(contact_bg())
        print(f"[4/6] Contact card submitted: {contact_res['customer_name']} - {contact_res['customer_phone']}")

        # 5. Dashboard queries pending escalations
        escalations = get_business_escalations(
            business_id=business.id,
            status="pending",
            db=db,
            current_user=owner
        )
        assert len(escalations) >= 1
        matched = [e for e in escalations if e.session_id == session_id]
        assert len(matched) == 1
        assert matched[0].customer_phone == "0501234567"
        print(f"[5/6] Dashboard escalations query returned {len(escalations)} pending escalation(s) with phone attached")

        # 6. Merchant sends human reply from Dashboard -> Auto-resolves escalation
        reply_req = HumanReplyRequest(
            message="Hello Ama, this is Kwabena from Mensah Hardware. We have 50 bags available for immediate delivery!"
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
        print(f"[6/6] Merchant human reply sent! Escalation status auto-updated to: '{esc.status}'")

        print("\n" + "=" * 60)
        print("[SUCCESS] ALL SMART HYBRID ESCALATION TESTS PASSED!")
        print("=" * 60 + "\n")

    finally:
        db.close()

if __name__ == "__main__":
    test_escalation_and_alert_flow()
