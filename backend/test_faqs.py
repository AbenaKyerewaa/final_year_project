import requests
import random
import sys

API_URL = "http://localhost:8000"

def run_faq_tests():
    print("=== STARTING FAQ CRUD INTEGRATION TESTS ===")

    # 1. Register and Log in a user to get a bearer token
    unique_id = random.randint(1000, 9999)
    email = f"owner_faq_{unique_id}@easybiz.ai"
    password = "password123"
    
    print(f"\n1. Setting up test user: {email}")
    register_payload = {
        "full_name": "Faq Test Owner",
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

    # 2. Create Business Profile
    print("\n2. Testing Business Profile Creation")
    biz_payload = {
        "business_name": f"FAQ Test Business {unique_id}",
        "category": "Retail",
        "location": "Accra",
        "phone": "+233240000000",
        "whatsapp_number": "+233240000000",
        "opening_hours": "Mon-Sat: 9AM - 6PM",
        "payment_methods": "Cash",
        "delivery_options": "Pickup",
        "description": "Business profile for FAQ unit testing."
    }
    response = requests.post(f"{API_URL}/businesses", json=biz_payload, headers=headers)
    assert response.status_code == 201, f"Failed to create business: {response.text}"
    business = response.json()
    business_id = business["id"]
    print(f"[OK] Business profile created! ID: {business_id}")

    # 3. Create FAQ (POST /businesses/{business_id}/faqs)
    print("\n3. Testing FAQ Creation")
    faq_payload = {
        "question": "What is your refund policy?",
        "answer": "We offer a 7-day full refund policy on all unopened products."
    }
    response = requests.post(f"{API_URL}/businesses/{business_id}/faqs", json=faq_payload, headers=headers)
    assert response.status_code == 201, f"Failed to create FAQ: {response.text}"
    faq = response.json()
    faq_id = faq["id"]
    assert faq["question"] == faq_payload["question"]
    assert faq["answer"] == faq_payload["answer"]
    print(f"[OK] FAQ successfully created! ID: {faq_id}")

    # 4. List FAQs (GET /businesses/{business_id}/faqs)
    print("\n4. Testing Listing FAQs")
    response = requests.get(f"{API_URL}/businesses/{business_id}/faqs", headers=headers)
    assert response.status_code == 200, f"Failed to list FAQs: {response.text}"
    faqs = response.json()
    assert len(faqs) >= 1, "Expected at least 1 FAQ in list"
    assert faqs[0]["id"] == faq_id
    print("[OK] FAQs listed successfully!")

    # 5. Get Single FAQ (GET /faqs/{faq_id})
    print("\n5. Testing Fetching Single FAQ")
    response = requests.get(f"{API_URL}/faqs/{faq_id}", headers=headers)
    assert response.status_code == 200, f"Failed to get FAQ: {response.text}"
    faq_detail = response.json()
    assert faq_detail["id"] == faq_id
    print("[OK] Single FAQ details fetched successfully!")

    # 6. Update FAQ (PUT /faqs/{faq_id})
    print("\n6. Testing Updating FAQ")
    update_payload = {
        "question": "What is your return & refund policy?",
        "answer": "We offer a 14-day return and refund policy on all unopened items."
    }
    response = requests.put(f"{API_URL}/faqs/{faq_id}", json=update_payload, headers=headers)
    assert response.status_code == 200, f"Failed to update FAQ: {response.text}"
    updated_faq = response.json()
    assert updated_faq["question"] == update_payload["question"]
    assert updated_faq["answer"] == update_payload["answer"]
    print("[OK] FAQ updated successfully!")

    # 7. Delete FAQ (DELETE /faqs/{faq_id})
    print("\n7. Testing Deleting FAQ")
    response = requests.delete(f"{API_URL}/faqs/{faq_id}", headers=headers)
    assert response.status_code == 204, f"Failed to delete FAQ: {response.text}"
    print("[OK] FAQ deleted successfully!")

    # 8. Verify FAQ deletion
    print("\n8. Verifying FAQ is deleted")
    response = requests.get(f"{API_URL}/faqs/{faq_id}", headers=headers)
    assert response.status_code == 404, f"Expected 404 for deleted FAQ, got {response.status_code}"
    print("[OK] FAQ deletion verified successfully!")

    print("\n=======================================================")
    print("[SUCCESS] ALL FAQ CRUD INTEGRATION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    try:
        run_faq_tests()
    except AssertionError as e:
        print(f"\n[FAIL] Test assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error running FAQ tests: {e}")
        sys.exit(1)
