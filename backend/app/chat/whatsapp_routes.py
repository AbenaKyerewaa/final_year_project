import os
import uuid
import requests
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.businesses.models import Business
from app.chat.routes import process_rag_chat
from app.auth.security import get_current_user
from app.auth.models import User

router = APIRouter(prefix="/webhooks/whatsapp", tags=["whatsapp"])

def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    return "".join(c for c in phone if c.isdigit())

def match_phone_numbers(phone1: str, phone2: str) -> bool:
    c1 = normalize_phone(phone1)
    c2 = normalize_phone(phone2)
    if not c1 or not c2:
        return False
    if c1 == c2:
        return True
    # Ghanaian numbers match last 9 digits (e.g. 241234567)
    if len(c1) >= 9 and len(c2) >= 9:
        return c1[-9:] == c2[-9:]
    return False

def get_business_by_whatsapp(db: Session, incoming_phone: str) -> Optional[Business]:
    all_businesses = db.query(Business).all()
    print(f"[WhatsApp DBG] Incoming display phone number: '{incoming_phone}'")
    print(f"[WhatsApp DBG] Total businesses in DB: {len(all_businesses)}")
    
    # 1. Match by whatsapp_number
    for b in all_businesses:
        print(f"[WhatsApp DBG] Checking business: '{b.business_name}' (ID: {b.id}), whatsapp_number: '{b.whatsapp_number}', phone: '{b.phone}'")
        if b.whatsapp_number:
            c1 = normalize_phone(b.whatsapp_number)
            c2 = normalize_phone(incoming_phone)
            matched = match_phone_numbers(b.whatsapp_number, incoming_phone)
            print(f"[WhatsApp DBG] Comparing '{b.whatsapp_number}' (normalized: '{c1}') and '{incoming_phone}' (normalized: '{c2}'). Matched: {matched}")
            if matched:
                print(f"[WhatsApp DBG] MATCHED by whatsapp_number: '{b.business_name}'")
                return b
                
    # 2. Match by regular phone
    for b in all_businesses:
        if b.phone:
            matched = match_phone_numbers(b.phone, incoming_phone)
            if matched:
                print(f"[WhatsApp DBG] MATCHED by regular phone: '{b.business_name}'")
                return b
                
    # 3. Fallback to WHATSAPP_BUSINESS_NUMBER env var
    env_num = os.getenv("WHATSAPP_BUSINESS_NUMBER")
    if env_num:
        print(f"[WhatsApp DBG] Checking env fallback WHATSAPP_BUSINESS_NUMBER: '{env_num}'")
        for b in all_businesses:
            if b.whatsapp_number and match_phone_numbers(b.whatsapp_number, env_num):
                print(f"[WhatsApp DBG] MATCHED fallback by whatsapp_number: '{b.business_name}'")
                return b
            if b.phone and match_phone_numbers(b.phone, env_num):
                print(f"[WhatsApp DBG] MATCHED fallback by regular phone: '{b.business_name}'")
                return b
                
    # 4. Fallback to first business profile in database
    fallback_biz = db.query(Business).first()
    if fallback_biz:
        print(f"[WhatsApp DBG] FALLING BACK to first business: '{fallback_biz.business_name}' (ID: {fallback_biz.id})")
    else:
        print(f"[WhatsApp DBG] NO BUSINESSES IN DATABASE TO FALL BACK TO.")
    return fallback_biz


def send_whatsapp_reply(recipient_phone: str, message_text: str):
    whatsapp_mode = os.getenv("WHATSAPP_MODE", "simulation").lower()
    if whatsapp_mode != "cloud_api":
        print(f"[WhatsApp SIMULATION] Sending reply to {recipient_phone}: '{message_text}'")
        return True

    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    
    if not phone_number_id or not access_token:
        print("[WhatsApp ERROR] Access token or Phone Number ID not configured.")
        return False

    url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient_phone,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": message_text
        }
    }
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        if res.status_code in [200, 201]:
            print(f"[WhatsApp] Reply sent successfully to {recipient_phone}")
            return True
        else:
            print(f"[WhatsApp ERROR] Facebook API returned {res.status_code}: {res.text}")
            return False
    except Exception as e:
        print(f"[WhatsApp ERROR] Exception during API call: {e}")
        return False
@router.get("/config")
def get_whatsapp_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return {
        "whatsappMode": os.getenv("WHATSAPP_MODE", "simulation").lower(),
        "verifyToken": os.getenv("WHATSAPP_VERIFY_TOKEN", ""),
        "phoneNumberId": os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
        "businessNumber": os.getenv("WHATSAPP_BUSINESS_NUMBER", ""),
        "backendWebhookUrl": "http://localhost:8000/webhooks/whatsapp"
    }

@router.get("", response_class=PlainTextResponse)
@router.get("/", response_class=PlainTextResponse)
def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    whatsapp_mode = os.getenv("WHATSAPP_MODE", "simulation").lower()
    if whatsapp_mode == "disabled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="WhatsApp is disabled")

    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        return hub_challenge
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")

@router.post("")
@router.post("/")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    whatsapp_mode = os.getenv("WHATSAPP_MODE", "simulation").lower()
    if whatsapp_mode == "disabled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="WhatsApp is disabled")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored", "reason": "not a whatsapp business account"}

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})
            display_phone_number = metadata.get("display_phone_number", "")
            
            # Extract contacts
            contacts = value.get("contacts", [])
            customer_name = "WhatsApp Customer"
            if contacts:
                customer_name = contacts[0].get("profile", {}).get("name", "WhatsApp Customer")

            messages = value.get("messages", [])
            for msg in messages:
                if msg.get("type") == "text":
                    body = msg.get("text", {}).get("body", "")
                    sender_phone = msg.get("from", "")
                    
                    # 1. Identify business
                    business = get_business_by_whatsapp(db, display_phone_number)
                    if not business:
                        print(f"[WhatsApp Webhook] Business not found for display number: {display_phone_number}", flush=True)
                        continue
                    
                    print(f"[WhatsApp Webhook] Matched business: {business.business_name} (ID: {business.id})", flush=True)
                    
                    # 2. Process message using RAG chat pipeline (channel = whatsapp)
                    res = process_rag_chat(
                        db=db,
                        business_id=business.id,
                        message=body,
                        channel="whatsapp",
                        customer_name=customer_name,
                        customer_phone=sender_phone
                    )
                    
                    # 3. Send reply back to customer
                    send_whatsapp_reply(sender_phone, res["answer"])
                    
    return {"status": "success"}
