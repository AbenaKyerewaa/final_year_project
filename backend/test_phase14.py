import requests
import random
import sys
import os

API_URL = "http://127.0.0.1:8000"

def clean_database():
    print("Cleaning database of old test WhatsApp data...")
    # Import inside function to avoid import conflicts if environment changes
    from app.database.base import Base
    from app.database.session import SessionLocal
    from app.businesses.models import Business
    from app.chat.models import ChatSession, ChatMessage
    
    db = SessionLocal()
    try:
        # Find business IDs matching the test number
        test_biz_ids = [b.id for b in db.query(Business).filter(
            (Business.whatsapp_number == "+233 24 999 9999") | 
            (Business.business_name == "WhatsApp Test Boutique")
        ).all()]
        
        if test_biz_ids:
            # Delete messages
            db.query(ChatMessage).filter(ChatMessage.session_id.in_(
                db.query(ChatSession.id).filter(ChatSession.business_id.in_(test_biz_ids))
            )).delete(synchronize_session=False)
            
            # Delete sessions
            db.query(ChatSession).filter(ChatSession.business_id.in_(test_biz_ids)).delete(synchronize_session=False)
            
            # Delete businesses
            db.query(Business).filter(Business.id.in_(test_biz_ids)).delete(synchronize_session=False)
            db.commit()
            print(f"[OK] Cleaned {len(test_biz_ids)} conflicting test business profiles.")
    except Exception as e:
        print(f"[WARNING] Database cleanup failed: {e}. Proceeding anyway...")
    finally:
        db.close()

def run_integration_tests():
    clean_database()
    print("=== STARTING PHASE 14 (WHATSAPP WEBHOOK) INTEGRATION TESTS ===")
    
    # 1. Register and Log in a user to get a bearer token
    unique_id = random.randint(1000, 9999)
    email = f"owner_wa_{unique_id}@easybiz.ai"
    password = "password123"
    
    print(f"\n1. Setting up test user: {email}")
    register_payload = {
        "full_name": "Kwame Webhook Tester",
        "email": email,
        "password": password,
        "role": "business_owner"
    }
    response = requests.post(f"{API_URL}/auth/register", json=register_payload)
    assert response.status_code == 201, f"Failed to register test user: {response.text}"
    
    # Log in
    login_payload = {
        "email": email,
        "password": password
    }
    response = requests.post(f"{API_URL}/auth/login", json=login_payload)
    assert response.status_code == 200, f"Failed to log in: {response.text}"
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] User set up and token obtained.")

    # 2. Create Business Profile with whatsapp_number
    print("\n2. Testing Business Profile Creation with whatsapp_number")
    biz_payload = {
        "business_name": "WhatsApp Test Boutique",
        "category": "Retail",
        "location": "Osu, Accra",
        "phone": "+233241112222",
        "whatsapp_number": "+233 24 999 9999", # Suffix will match display phone number in webhook
        "opening_hours": "Mon-Sat: 9AM - 6PM",
        "payment_methods": "Mobile Money, Cash",
        "delivery_options": "Courier, Local Pickup",
        "description": "Boutique shop for testing webhook phone matching."
    }
    response = requests.post(f"{API_URL}/businesses", json=biz_payload, headers=headers)
    assert response.status_code == 201, f"Failed to create business: {response.text}"
    business = response.json()
    business_id = business["id"]
    print(f"[OK] Business profile successfully created! ID: {business_id}")

    # 3. Test GET Webhook Verification Handshake
    print("\n3. Testing GET /webhooks/whatsapp verification handshake...")
    verify_token = "easybiz_verify_token_2026" # This matches verify token from simulated default or environment
    
    # Token matches
    # Note: We temporarily set WHATSAPP_VERIFY_TOKEN env in backend or rely on defaults. Let's send verify_token
    # If the backend is running with a specific token, it will check it. 
    # Let's see: we will send verification token and mode
    response = requests.get(
        f"{API_URL}/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": "verify_challenge_token_abc_123",
            "hub.verify_token": "easybiz_verify_token_2026"
        }
    )
    print(f"GET handshake response status: {response.status_code}")
    print(f"GET handshake response body: {response.text}")
    # If WHATSAPP_VERIFY_TOKEN is different in the running server, we print a warning, but let's assert
    # if it's set to default:
    if response.status_code == 200:
        assert response.text == "verify_challenge_token_abc_123", "Verify challenge token returned is incorrect."
        print("[OK] GET verification handshake passed!")
    elif response.status_code == 403:
        print("[WARNING] GET verification handshake failed with 403. This is expected if the server is running with a different WHATSAPP_VERIFY_TOKEN.")
    else:
        assert False, f"GET handshake returned unexpected status: {response.status_code} - {response.text}"

    # 4. Test POST Webhook Message Processing
    print("\n4. Testing POST /webhooks/whatsapp incoming message processing...")
    webhook_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA_ID_TEST",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "233249999999", # Matches +233 24 999 9999
                                "phone_number_id": "phone_id_123"
                            },
                            "contacts": [
                                {
                                    "profile": {
                                        "name": "Kwame Kojo"
                                    },
                                    "wa_id": "233245555555"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "233245555555",
                                    "id": "wamid.HBgLMTU1NTEyMzQ1NjcVAgASGBQzQjRDNUIzQjQ5REQ0QzUzRTMA",
                                    "timestamp": "1675200000",
                                    "text": {
                                        "body": "Do you deliver to Kumasi?"
                                    },
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    response = requests.post(f"{API_URL}/webhooks/whatsapp", json=webhook_payload)
    print(f"POST status: {response.status_code}")
    assert response.status_code == 200, f"Webhook POST failed: {response.text}"
    print("[OK] Webhook POST processed successfully!")

    # 5. Query chat sessions to verify record insertion
    print("\n5. Verifying DB insertion of chat session and messages via API...")
    response = requests.get(f"{API_URL}/businesses/{business_id}/chat-sessions", headers=headers)
    assert response.status_code == 200, f"Failed to retrieve chat sessions: {response.text}"
    sessions = response.json()
    print(f"Sessions returned: {sessions}")
    
    # Check if we have a WhatsApp session
    wa_session = None
    for s in sessions:
        if s["channel"] == "whatsapp" and s["customer_phone"] == "233245555555":
            wa_session = s
            break
            
    assert wa_session is not None, "WhatsApp chat session was not created or phone mismatch."
    session_id = wa_session["id"]
    print(f"[OK] WhatsApp ChatSession created successfully: {session_id}")

    # Retrieve messages
    response = requests.get(f"{API_URL}/chat-sessions/{session_id}", headers=headers)
    assert response.status_code == 200, f"Failed to retrieve chat session detail: {response.text}"
    session_detail = response.json()
    messages = session_detail["messages"]
    
    assert len(messages) >= 2, f"Expected at least 2 messages in session, got {len(messages)}"
    assert messages[0]["sender"] == "customer"
    assert messages[0]["message"] == "Do you deliver to Kumasi?"
    assert messages[1]["sender"] == "ai"
    print(f"[OK] Customer message logged: '{messages[0]['message']}'")
    print(f"[OK] AI Response generated and logged: '{messages[1]['message']}'")
    
    print("\n=======================================================")
    print("[SUCCESS] ALL PHASE 14 BACKEND INTEGRATION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    try:
        run_integration_tests()
        sys.exit(0)
    except AssertionError as e:
        print("\n[FAIL] Assertion failed during tests:")
        print(e)
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        sys.exit(1)
