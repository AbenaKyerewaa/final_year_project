import requests
import random
import sys

API_URL = "http://127.0.0.1:8000"

def run_manual_flow_tests():
    print("=== STARTING EASYBIZ AI MANUAL FLOWS INTEGRATION TESTS ===")

    # 1. Register and Log in a user to get a bearer token
    unique_id = random.randint(1000, 9999)
    email = f"owner_flow_{unique_id}@easybiz.ai"
    password = "password123"
    
    print(f"\n1. Setting up test user: {email}")
    register_payload = {
        "full_name": "Kojo Flow Owner",
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

    # 2. Test Business Profile Creation
    print("\n2. Testing Business Profile Creation")
    biz_payload = {
        "business_name": f"Manual Flow Cafe {unique_id}",
        "category": "Food & Beverage",
        "location": "Accra Mall",
        "phone": "+233240001111",
        "whatsapp_number": "+233240001111",
        "opening_hours": "Mon-Sun: 8AM - 10PM",
        "payment_methods": "Mobile Money, Cash",
        "delivery_options": "Local Delivery",
        "description": "Artisanal coffee and fresh pastries in the heart of Accra."
    }
    response = requests.post(f"{API_URL}/businesses", json=biz_payload, headers=headers)
    assert response.status_code == 201, f"Failed to create business: {response.text}"
    business = response.json()
    business_id = business["id"]
    print(f"[OK] Business profile successfully created! ID: {business_id}")

    # 3. Test Add Product
    print("\n3. Testing Product Addition")
    product_payload = {
        "name": "Iced Vanilla Latte",
        "category": "Beverages",
        "description": "Double espresso shot with fresh cold milk and organic vanilla syrup.",
        "price": 25.00,
        "currency": "GHS",
        "quantity": 30,
        "availability_status": "available",
        "warranty": "None"
    }
    response = requests.post(f"{API_URL}/businesses/{business_id}/products", json=product_payload, headers=headers)
    assert response.status_code == 201, f"Failed to add product: {response.text}"
    product = response.json()
    product_id = product["id"]
    print(f"[OK] Product successfully added! ID: {product_id}")

    # 4. Test Add FAQ
    print("\n4. Testing FAQ Addition")
    faq_payload = {
        "question": "Where is the cafe located exactly?",
        "answer": "We are located on the ground floor of Accra Mall, right next to the main entrance."
    }
    response = requests.post(f"{API_URL}/businesses/{business_id}/faqs", json=faq_payload, headers=headers)
    assert response.status_code == 201, f"Failed to add FAQ: {response.text}"
    faq = response.json()
    faq_id = faq["id"]
    print(f"[OK] FAQ successfully added! ID: {faq_id}")

    # 5. Test Reindex Business
    print("\n5. Testing Business Reindexing (RAG Pipeline)")
    response = requests.post(f"{API_URL}/businesses/{business_id}/rag/reindex", headers=headers)
    assert response.status_code == 200, f"Failed to reindex: {response.text}"
    reindex_result = response.json()
    print(f"[OK] Reindexing completed! Result: {reindex_result}")

    # 6. Test Ask Customer Question (Retrieval / Chat response flow)
    print("\n6. Testing RAG Customer Chat Response Flow")
    chat_payload = {
        "message": "What beverages do you sell?",
        "channel": "web",
        "customer_name": "Esi Support Tester"
    }
    response = requests.post(f"{API_URL}/chat/{business_id}", json=chat_payload)
    assert response.status_code == 200, f"Chat failed: {response.text}"
    chat_res = response.json()
    session_id = chat_res["session_id"]
    print(f"[OK] RAG chat response received! Answer: '{chat_res['answer']}'")
    assert session_id is not None, "Expected valid session_id in response"

    # 7. Test Check Chat History
    print("\n7. Testing Retrieval of Business Chat History")
    response = requests.get(f"{API_URL}/businesses/{business_id}/chat-sessions", headers=headers)
    assert response.status_code == 200, f"Failed to fetch sessions: {response.text}"
    sessions = response.json()
    assert len(sessions) >= 1, "Expected at least 1 chat session"
    assert sessions[0]["id"] == session_id
    print(f"[OK] Verified chat history logs are successfully saved in DB!")

    # 8. Test Low-Confidence Question (Should trigger fallback)
    print("\n8. Testing Low-Confidence Question Fallback")
    chat_payload_unrelated = {
        "message": "Who was the first president of the United States?",
        "channel": "web",
        "session_id": session_id
    }
    response = requests.post(f"{API_URL}/chat/{business_id}", json=chat_payload_unrelated)
    assert response.status_code == 200, f"Chat failed: {response.text}"
    chat_res_unrelated = response.json()
    print(f"[OK] Low-confidence question response: '{chat_res_unrelated['answer']}'")
    assert "information" in chat_res_unrelated["answer"].lower() or "connect you" in chat_res_unrelated["answer"].lower(), \
        "Expected fallback reply for low-confidence query."

    # 9. Test Human Handoff Keyword Trigger
    print("\n9. Testing Human Handoff Keyword Trigger")
    chat_payload_handoff = {
        "message": "Please connect me to a human representative.",
        "channel": "web",
        "session_id": session_id
    }
    response = requests.post(f"{API_URL}/chat/{business_id}", json=chat_payload_handoff)
    assert response.status_code == 200, f"Chat failed: {response.text}"
    chat_res_handoff = response.json()
    print(f"[OK] Handoff response: '{chat_res_handoff['answer']}'")
    assert chat_res_handoff["escalated"] == True, "Expected escalated = True for handoff query."
    assert "Representative" in chat_res_handoff["answer"] or "representative" in chat_res_handoff["answer"], \
        "Expected escalation notification message."

    print("\n=======================================================")
    print("[SUCCESS] ALL MANUAL FLOW INTEGRATION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    try:
        run_manual_flow_tests()
    except AssertionError as e:
        print(f"\n[FAIL] Test assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error running manual flow tests: {e}")
        sys.exit(1)
