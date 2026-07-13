import requests
import random

API_URL = "http://127.0.0.1:8000"

def test_business_crud():
    print("=== STARTING BUSINESS CRUD INTEGRATION TESTS ===")

    # 1. Register and Log in a user to get a bearer token
    unique_id = random.randint(1000, 9999)
    email = f"owner_biz_{unique_id}@easybiz.ai"
    password = "password123"
    
    print(f"\n1. Setting up test user: {email}")
    register_payload = {
        "full_name": "Kojo Biz Tester",
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

    # 2. Test Business Creation (POST /businesses)
    print("\n2. Testing Business Profile Creation")
    biz_payload = {
        "business_name": "Kojo's Tech Hub",
        "category": "Electronics Retail",
        "location": "Adum, Kumasi",
        "phone": "+233241112222",
        "whatsapp_number": "+233241112222",
        "opening_hours": "Mon-Sat: 9AM - 6PM",
        "payment_methods": "Mobile Money, Cash",
        "delivery_options": "VIP Bus Shipping, Local Pickup",
        "description": "Premium electronics store in Kumasi."
    }
    response = requests.post(f"{API_URL}/businesses", json=biz_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 201, f"Failed to create business: {response.text}"
    biz_data = response.json()
    assert biz_data["business_name"] == "Kojo's Tech Hub"
    assert biz_data["category"] == "Electronics Retail"
    assert biz_data["location"] == "Adum, Kumasi"
    assert biz_data["phone"] == "+233241112222"
    biz_id = biz_data["id"]
    print(f"[OK] Business profile successfully created! ID: {biz_id}")

    # 3. Test Creation Validation (missing required fields)
    print("\n3. Testing Creation Validation (missing location field)")
    invalid_payload = biz_payload.copy()
    del invalid_payload["location"]  # Missing required field
    response = requests.post(f"{API_URL}/businesses", json=invalid_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 422, f"Allowed creation with missing field: {response.text}"
    print("[OK] Missing required field was correctly rejected with status code 422 (Pydantic validation)!")

    # 4. Test List Businesses (GET /businesses)
    print("\n4. Testing List Businesses")
    response = requests.get(f"{API_URL}/businesses", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to list businesses: {response.text}"
    biz_list = response.json()
    assert len(biz_list) >= 1
    assert any(b["id"] == biz_id for b in biz_list)
    print("[OK] Business profile list fetched and verified successfully!")

    # 5. Test Retrieve Single Business (GET /businesses/{id})
    print(f"\n5. Testing Single Business Profile Fetch for ID: {biz_id}")
    response = requests.get(f"{API_URL}/businesses/{biz_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to fetch business: {response.text}"
    fetched_data = response.json()
    assert fetched_data["business_name"] == "Kojo's Tech Hub"
    print("[OK] Business profile retrieval verified!")

    # 6. Test Update Business Profile (PUT /businesses/{id})
    print(f"\n6. Testing Business Profile Update for ID: {biz_id}")
    update_payload = {
        "location": "Adum, Kumasi (Updated Store Location)",
        "phone": "+233240000000"
    }
    response = requests.put(f"{API_URL}/businesses/{biz_id}", json=update_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to update business: {response.text}"
    updated_data = response.json()
    assert updated_data["location"] == "Adum, Kumasi (Updated Store Location)"
    assert updated_data["phone"] == "+233240000000"
    assert updated_data["business_name"] == "Kojo's Tech Hub"  # Unchanged
    print("[OK] Business profile update verified!")

    # 7. Test Unauthorized access checking permissions
    # Create another user
    print("\n7. Testing Unauthorized Access (another user trying to modify the business)")
    other_email = f"other_biz_{unique_id}@easybiz.ai"
    other_register_payload = {
        "full_name": "Another Tester",
        "email": other_email,
        "password": password,
        "role": "business_owner"
    }
    response = requests.post(f"{API_URL}/auth/register", json=other_register_payload)
    assert response.status_code == 201
    
    other_login_payload = {"email": other_email, "password": password}
    response = requests.post(f"{API_URL}/auth/login", json=other_login_payload)
    assert response.status_code == 200
    other_token = response.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    
    # Try updating Kojo's business as other user (should be 403 Forbidden)
    response = requests.put(f"{API_URL}/businesses/{biz_id}", json=update_payload, headers=other_headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 403, f"Allowed unauthorized update: {response.text}"
    print("[OK] Unauthorized update correctly rejected with status code 403 Forbidden!")

    # 8. Test Delete Business Profile (DELETE /businesses/{id})
    print(f"\n8. Testing Business Profile Deletion for ID: {biz_id}")
    response = requests.delete(f"{API_URL}/businesses/{biz_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 204 or response.status_code == 200, f"Failed to delete: {response.text}"
    print("[OK] Business profile deletion query succeeded!")

    # Verify 404 after deletion
    print("\n9. Verifying Business is gone (should return 404)")
    response = requests.get(f"{API_URL}/businesses/{biz_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 404, f"Business still exists: {response.text}"
    print("[OK] Verifying deleted profile returns 404 Not Found!")

    print("\n=======================================================")
    print("[SUCCESS] ALL BUSINESS CRUD INTEGRATION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    test_business_crud()
