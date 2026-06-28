import requests
import random

API_URL = "http://localhost:8000"

def test_auth_flow():
    print("=== STARTING AUTHENTICATION FLOW INTEGRATION TESTS ===")
    
    # Generate unique email to ensure a clean run
    unique_id = random.randint(1000, 9999)
    email = f"owner_{unique_id}@easybiz.ai"
    password = "password123"
    full_name = "Kojo Test Owner"
    role = "business_owner"
    
    # 1. Test POST /auth/register
    print(f"\n1. Testing User Registration with email: {email}")
    register_payload = {
        "full_name": full_name,
        "email": email,
        "password": password,
        "role": role
    }
    response = requests.post(f"{API_URL}/auth/register", json=register_payload)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 201, f"Failed registration. Response: {response.text}"
    user_data = response.json()
    assert user_data["email"] == email
    assert user_data["full_name"] == full_name
    assert user_data["role"] == role
    assert "id" in user_data
    print("[OK] Registration successful!")

    # 2. Test duplicate email registration
    print("\n2. Testing Duplicate Email Registration (should fail)")
    response = requests.post(f"{API_URL}/auth/register", json=register_payload)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 400, f"Allowed duplicate email. Response: {response.text}"
    print("[OK] Duplicate email registration correctly blocked with status code 400!")

    # 3. Test invalid email format validation
    print("\n3. Testing Invalid Email Format Registration (should fail)")
    invalid_payload = register_payload.copy()
    invalid_payload["email"] = "bademailformat"
    response = requests.post(f"{API_URL}/auth/register", json=invalid_payload)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 400, f"Allowed invalid email. Response: {response.text}"
    print("[OK] Invalid email registration correctly blocked with status code 400!")

    # 4. Test invalid role registration validation
    print("\n4. Testing Invalid Role Registration (should fail)")
    invalid_role_payload = register_payload.copy()
    invalid_role_payload["email"] = f"owner_bad_role_{unique_id}@easybiz.ai"
    invalid_role_payload["role"] = "super_user_not_allowed"
    response = requests.post(f"{API_URL}/auth/register", json=invalid_role_payload)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 400, f"Allowed invalid role. Response: {response.text}"
    print("[OK] Invalid role registration correctly blocked with status code 400!")

    # 5. Test POST /auth/login
    print(f"\n5. Testing User Login with email: {email}")
    login_payload = {
        "email": email,
        "password": password
    }
    response = requests.post(f"{API_URL}/auth/login", json=login_payload)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 200, f"Failed login. Response: {response.text}"
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert token_data["user"]["email"] == email
    token = token_data["access_token"]
    print("[OK] Login successful, JWT token retrieved!")

    # 6. Test GET /auth/me (Protected Route)
    print("\n6. Testing GET /auth/me with active token")
    headers = {
        "Authorization": f"Bearer {token}"
    }
    response = requests.get(f"{API_URL}/auth/me", headers=headers)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 200, f"Failed to retrieve profile. Response: {response.text}"
    me_data = response.json()
    assert me_data["email"] == email
    assert me_data["full_name"] == full_name
    print("[OK] Profile retrieved successfully!")

    # 7. Test GET /auth/me with invalid token (should fail)
    print("\n7. Testing GET /auth/me with invalid token (should fail)")
    bad_headers = {
        "Authorization": "Bearer badtoken12345"
    }
    response = requests.get(f"{API_URL}/auth/me", headers=bad_headers)
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 401, f"Allowed profile fetch with bad token. Response: {response.text}"
    print("[OK] Profile fetch with bad token correctly blocked with status code 401!")

    # 8. Test POST /auth/logout (Stateless placeholder)
    print("\n8. Testing POST /auth/logout")
    response = requests.post(f"{API_URL}/auth/logout")
    print(f"Response status code: {response.status_code}")
    assert response.status_code == 200, f"Logout failed. Response: {response.text}"
    print("[OK] Logout endpoint placeholder succeeded!")

    print("\n=======================================================")
    print("[SUCCESS] ALL AUTHENTICATION BACKEND INTEGRATION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    test_auth_flow()
