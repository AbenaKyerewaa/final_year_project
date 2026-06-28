import requests
import random
import uuid

API_URL = "http://localhost:8000"

def test_products_and_services_crud():
    print("=== STARTING PRODUCTS AND SERVICES CRUD INTEGRATION TESTS ===")

    # 1. Setup User and Business Context
    unique_id = random.randint(1000, 9999)
    email = f"owner_prod_{unique_id}@easybiz.ai"
    password = "password123"
    
    print(f"\n1. Setting up test user: {email}")
    register_payload = {
        "full_name": "Kojo Product Tester",
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

    # Create a business profile
    print("\n2. Creating test business profile")
    biz_payload = {
        "business_name": "Kojo's Gadget Hub",
        "category": "Electronics Shop",
        "location": "Adum, Kumasi",
        "phone": "+233245551212"
    }
    response = requests.post(f"{API_URL}/businesses", json=biz_payload, headers=headers)
    assert response.status_code == 201, f"Failed to create business: {response.text}"
    business_id = response.json()["id"]
    print(f"[OK] Business profile successfully created! ID: {business_id}")

    # ==========================================
    # PRODUCT CRUD TESTS
    # ==========================================
    print("\n--- RUNNING PRODUCT CRUD TESTS ---")

    # 3. Create Product (POST /businesses/{biz_id}/products)
    print("3.1 Testing Product Creation")
    product_payload = {
        "name": "HP ProBook 450 G8",
        "category": "Laptops",
        "description": "Core i7, 16GB RAM, 512GB SSD",
        "price": "4500.00",
        "currency": "GHS",
        "quantity": 10,
        "availability_status": "available",
        "warranty": "6 months",
        "image_url": "http://example.com/probook.png"
    }
    response = requests.post(f"{API_URL}/businesses/{business_id}/products", json=product_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 201, f"Failed to create product: {response.text}"
    product_data = response.json()
    assert product_data["name"] == "HP ProBook 450 G8"
    assert product_data["price"] == "4500.00"
    assert product_data["quantity"] == 10
    product_id = product_data["id"]
    print(f"[OK] Product successfully created! ID: {product_id}")

    # 3.2 Test validation for negative price
    print("\n3.2 Testing negative price rejection")
    invalid_price_payload = product_payload.copy()
    invalid_price_payload["price"] = "-100.00"
    response = requests.post(f"{API_URL}/businesses/{business_id}/products", json=invalid_price_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 422, f"Allowed negative price: {response.text}"
    print("[OK] Negative price correctly rejected!")

    # 3.3 Test validation for negative quantity
    print("\n3.3 Testing negative quantity rejection")
    invalid_qty_payload = product_payload.copy()
    invalid_qty_payload["quantity"] = -5
    response = requests.post(f"{API_URL}/businesses/{business_id}/products", json=invalid_qty_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 422, f"Allowed negative quantity: {response.text}"
    print("[OK] Negative quantity correctly rejected!")

    # 3.4 List Products (GET /businesses/{biz_id}/products)
    print("\n3.4 Testing List Products")
    response = requests.get(f"{API_URL}/businesses/{business_id}/products", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to list products: {response.text}"
    products_list = response.json()
    assert len(products_list) >= 1
    assert any(p["id"] == product_id for p in products_list)
    print("[OK] Products list fetched and verified!")

    # 3.5 Fetch Single Product (GET /products/{prod_id})
    print(f"\n3.5 Testing Single Product Fetch: {product_id}")
    response = requests.get(f"{API_URL}/products/{product_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to fetch product: {response.text}"
    assert response.json()["name"] == "HP ProBook 450 G8"
    print("[OK] Single product fetch verified!")

    # 3.6 Update Product (PUT /products/{prod_id})
    print(f"\n3.6 Testing Product Update: {product_id}")
    update_payload = {
        "price": "4300.00",
        "quantity": 8,
        "availability_status": "limited"
    }
    response = requests.put(f"{API_URL}/products/{product_id}", json=update_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to update product: {response.text}"
    updated_data = response.json()
    assert updated_data["price"] == "4300.00"
    assert updated_data["quantity"] == 8
    assert updated_data["availability_status"] == "limited"
    print("[OK] Product update verified!")

    # 3.7 Try updating as another unauthorized user
    print("\n3.7 Testing Unauthorized Product Update Rejection")
    other_email = f"other_prod_{unique_id}@easybiz.ai"
    other_register_payload = {
        "full_name": "Other Biz Tester",
        "email": other_email,
        "password": password,
        "role": "business_owner"
    }
    response = requests.post(f"{API_URL}/auth/register", json=other_register_payload)
    assert response.status_code == 201
    
    response = requests.post(f"{API_URL}/auth/login", json={"email": other_email, "password": password})
    other_token = response.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    
    response = requests.put(f"{API_URL}/products/{product_id}", json=update_payload, headers=other_headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 403, f"Allowed unauthorized product edit: {response.text}"
    print("[OK] Unauthorized product edit correctly blocked!")

    # ==========================================
    # SERVICE CRUD TESTS
    # ==========================================
    print("\n--- RUNNING SERVICE CRUD TESTS ---")

    # 4. Create Service (POST /businesses/{biz_id}/services)
    print("4.1 Testing Service Creation")
    service_payload = {
        "name": "Laptop Keyboard Replacement",
        "description": "Includes cleaning and brand new keyboard installation",
        "price": "350.00",
        "currency": "GHS",
        "duration": "15-30",
        "duration_unit": "minutes",
        "availability_status": "available"
    }
    response = requests.post(f"{API_URL}/businesses/{business_id}/services", json=service_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 201, f"Failed to create service: {response.text}"
    service_data = response.json()
    assert service_data["name"] == "Laptop Keyboard Replacement"
    assert service_data["price"] == "350.00"
    assert service_data["duration"] == "15-30"
    assert service_data["duration_unit"] == "minutes"
    service_id = service_data["id"]
    print(f"[OK] Service successfully created! ID: {service_id}")

    # 4.2 Test validation for negative price/duration
    print("\n4.2 Testing negative price service rejection")
    invalid_service_payload = service_payload.copy()
    invalid_service_payload["price"] = "-50.00"
    response = requests.post(f"{API_URL}/businesses/{business_id}/services", json=invalid_service_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 422, f"Allowed negative price service: {response.text}"
    print("[OK] Negative service price correctly rejected!")

    # 4.3 List Services (GET /businesses/{biz_id}/services)
    print("\n4.3 Testing List Services")
    response = requests.get(f"{API_URL}/businesses/{business_id}/services", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to list services: {response.text}"
    services_list = response.json()
    assert len(services_list) >= 1
    assert any(s["id"] == service_id for s in services_list)
    print("[OK] Services list fetched and verified!")

    # 4.4 Fetch Single Service (GET /services/{service_id})
    print(f"\n4.4 Testing Single Service Fetch: {service_id}")
    response = requests.get(f"{API_URL}/services/{service_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to fetch service: {response.text}"
    assert response.json()["name"] == "Laptop Keyboard Replacement"
    print("[OK] Single service fetch verified!")

    # 4.5 Update Service (PUT /services/{service_id})
    print(f"\n4.5 Testing Service Update: {service_id}")
    update_service_payload = {
        "price": "380.00",
        "duration": "2-3",
        "duration_unit": "hours",
        "availability_status": "available"
    }
    response = requests.put(f"{API_URL}/services/{service_id}", json=update_service_payload, headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Failed to update service: {response.text}"
    updated_service_data = response.json()
    assert updated_service_data["price"] == "380.00"
    assert updated_service_data["duration"] == "2-3"
    assert updated_service_data["duration_unit"] == "hours"
    print("[OK] Service update verified!")

    # 4.6 Try updating service as another unauthorized user
    print("\n4.6 Testing Unauthorized Service Update Rejection")
    response = requests.put(f"{API_URL}/services/{service_id}", json=update_service_payload, headers=other_headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 403, f"Allowed unauthorized service edit: {response.text}"
    print("[OK] Unauthorized service edit correctly blocked!")

    # ==========================================
    # DELETION TESTS
    # ==========================================
    print("\n--- RUNNING DELETION TESTS ---")

    # 5.1 Delete Product
    print(f"5.1 Deleting Product ID: {product_id}")
    response = requests.delete(f"{API_URL}/products/{product_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 204 or response.status_code == 200

    response = requests.get(f"{API_URL}/products/{product_id}", headers=headers)
    assert response.status_code == 404
    print("[OK] Product deleted and confirmed 404 Not Found!")

    # 5.2 Delete Service
    print(f"\n5.2 Deleting Service ID: {service_id}")
    response = requests.delete(f"{API_URL}/services/{service_id}", headers=headers)
    print(f"Response status: {response.status_code}")
    assert response.status_code == 204 or response.status_code == 200

    response = requests.get(f"{API_URL}/services/{service_id}", headers=headers)
    assert response.status_code == 404
    print("[OK] Service deleted and confirmed 404 Not Found!")

    print("\n=======================================================")
    print("[SUCCESS] ALL PRODUCTS & SERVICES CRUD TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    test_products_and_services_crud()
