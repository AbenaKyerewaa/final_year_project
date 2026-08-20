# Phase 15 Documentation: Testing, Evaluation, Deployment, and Documentation

This document tracks the test suites, evaluation engines, seeding mechanisms, containerized deployment systems, and VPS hosting specifications configured for **Phase 15: Testing, Evaluation, Deployment, and Documentation** of EasyBiz AI.

---

## 1. Overview of Phase 15

Phase 15 guarantees that EasyBiz AI is robust, fully tested, performant, and ready for production hosting. It encompasses:
1. **Automated Test Suite**: Individual integration test files targeting user authentication, business profile management, inventory (products/services) CRUD, FAQs, and WhatsApp webhook channels.
2. **End-to-End Flow Script**: An automated script replicating the exact manual checklist actions required to verify full dashboard functionality and fallback responses.
3. **AI evaluation Engine**: A keyword-matching and retrieval-scoring script that queries sample businesses, verifies response correctness, checks average latencies, tracks hallucination rates, and outputs structured JSON reports.
4. **Database Seeding**: An automated seed pipeline creating four distinct business profiles (Michy's Tech Hub, MelTech Computers, Grace Academy, and Akwaaba Restaurant) along with respective products, services, and FAQs.
5. **Docker Containerization**: Multi-container docker-compose setups building both the FastAPI backend and Next.js frontend, connecting them to PostgreSQL, and maintaining persistent volume storage.

---

## 2. Test Architecture & Files

The backend includes several self-contained integration test scripts built with standard Python `requests` modules that execute against the active FastAPI local instance (defaulting to `http://127.0.0.1:8000`).

### 1. User Authentication (`test_auth.py`)
* **Scope**: Registers a new user, checks for duplicate email errors, performs email structure validation, verifies invalid role rejection, logs the user in, extracts the JWT Bearer Token, queries the protected `/auth/me` profile route with valid/invalid header tokens, and checks logout.
* **Command**: `python test_auth.py`

### 2. Business CRUD (`test_business.py`)
* **Scope**: Validates business profile creation, field parsing (e.g. name, location, contact phone, whatsapp number), business profile retrieval list, individual business profile GET, update operations, and owner authorization protection checks.
* **Command**: `python test_business.py`

### 3. Inventory CRUD (`test_products_services.py`)
* **Scope**: Validates create, read, update, and delete actions for both product inventory (laptops, parts, menus) and service catalogs (installations, consultancies, repairs).
* **Command**: `python test_products_services.py`

### 4. FAQ CRUD (`test_faqs.py`)
* **Scope**: Validates FAQ question/answer insertion, matching retrieval, updates, deletions, and CSV-based bulk import routes.
* **Command**: `python test_faqs.py`

### 5. WhatsApp Webhook Routing (`test_phase14.py`)
* **Scope**: Simulates Meta Graph API webhook callbacks, checking the GET verification challenge handshake and POST messaging webhooks. Verifies response delivery to simulation databases.
* **Command**: `python test_phase14.py`

### 6. Automated Manual Flow Checklist (`test_manual_flows.py`)
* **Scope**: Groups the full lifecycle of an SME user:
  1. Creates user account and retrieves JWT token.
  2. Generates business profile.
  3. Inserts inventory products.
  4. Seeds local FAQs.
  5. Triggers synchronous RAG index rebuilding.
  6. Executes a customer RAG chat session query.
  7. Fetches the saved business chat history to verify persistence.
  8. Submits a completely unrelated prompt to confirm low-confidence fallback response.
  9. Submits a handoff request to confirm the creation of human escalation logs.
* **Command**: `python test_manual_flows.py`

---

## 3. RAG Evaluation Module (`evaluate_ai.py`)

To systematically audit the performance of our LLM, the `evaluate_ai.py` script queries the **MelTech Computers** profile using a set of evaluation questions mapping back to expected keyword responses, falling into three categories:

1. **Retrieval**: Verifies that standard FAQ/inventory facts are parsed and correctly answered.
2. **Low-Confidence Fallback**: Asks out-of-domain questions (e.g. "What is the capital of Ghana?") and verifies the AI triggers the fallback message rather than hallucinating.
3. **Handoff**: Submits messages requesting human support and checks that the system flags the session as `escalated=True`.

### Evaluation Metrics Calculated
* **Response Accuracy**: Percentage of answers containing the expected keyword markers.
* **Retrieval Accuracy**: Average confidence/similarity score retrieved by the similarity matcher.
* **Average Response Time**: Total elapsed seconds divided by total questions.
* **Hallucination Rate**: Percentage of out-of-domain queries where the LLM answers with high confidence (`score > 0.70`) instead of calling the fallback.
* **Human Handoff Correctness**: Accuracy of triggering escalations on explicit human request messages.

### Sample Output Report (`evaluation_report.json`)
The script automatically dumps structured evaluation runs to disk:
```json
{
    "metrics": {
        "response_accuracy_pct": 100.0,
        "average_retrieval_accuracy_pct": 82.5,
        "average_response_time_seconds": 0.421,
        "hallucination_rate_pct": 0.0,
        "human_handoff_correctness_pct": 100.0
    },
    "details": [
        {
            "question": "Do you sell new or used laptops?",
            "expected_keywords": ["new", "refurbished", "both"],
            "actual_answer": "We sell both brand-new and premium refurbished laptops...",
            "retrieval_score": 0.88,
            "response_time": 0.381,
            "passed": true,
            "type": "retrieval"
        }
    ]
}
```

---

## 4. Sample Businesses & Data Seeding (`seed.py`)

Running `python app/database/seed.py` creates standardized demonstration business profiles and populates their knowledge bases:

| Business Name | Category | Location | Sample Data Seeded |
| :--- | :--- | :--- | :--- |
| **Michy's Tech Hub** | Electronics Shop | Adum, Kumasi | Custom phones, delivery options, and payment methods. |
| **MelTech Computers** | Computer Retail | Accra Mall, Accra | EliteBooks, ProBooks, repairs, warranty FAQs. |
| **Grace Academy** | Education/School | East Legon, Accra | Admission info, tuition fees, calendar terms. |
| **Akwaaba Restaurant** | Food & Beverage | Osu, Accra | Local menus (Jollof, Fufu, Waakye), delivery areas. |

---

## 5. Docker Containerization

EasyBiz AI provides Docker configurations for easy local setup and cloud staging:

### Backend Dockerfile (`backend/Dockerfile`)
Uses a lightweight Python 3.11 image, sets flags to prevent pyc creation, installs compiler tools, installs pip packages from `requirements.txt`, copies source code, and opens port `8000` via Uvicorn.

### Frontend Dockerfile (`frontend/Dockerfile`)
Implements a multi-stage Alpine build:
1. **builder**: Imports package files, runs `npm ci` dependencies, and executes `npm run build` compilation.
2. **runner**: Copies only the built bundles (`.next`), public assets, and `node_modules` into a clean, lightweight image to run `npm start` on port `3000`.

### Orchestration (`docker-compose.yml`)
Spins up three Docker containers in a unified internal network:
1. **postgres**: A PostgreSQL 15 database container mapped to a persistent named volume `postgres_data`.
2. **backend**: Builds the FastAPI application, mounts volumes for the persistent FAISS vector indices and uploaded files, and exposes `8000`.
3. **frontend**: Builds the Next.js React client, configures base API routing, and exposes `3000`.

---

## 6. VPS Production Hosting Notes

When launching EasyBiz AI onto standard VPS platforms (e.g. Ubuntu instance on DigitalOcean, AWS EC2, Linode, or Vultr), observe the following deployment practices:

### 1. Database Migrations via Alembic
Instead of relying on SQLite or standard database seed files in production, execute migrations inside the backend containers:
```bash
docker-compose exec backend alembic upgrade head
```

### 2. Persistent Volumes Mappings
RAG uses a FAISS vector store saved on the local disk. In a containerized VPS environment:
* Verify that your `docker-compose.yml` mounts standard persistent directories (`/app/vector_indices` and `/app/uploads`) to host volumes.
* If deploying on serverless architectures (like Render, AWS ECS, or Railway), configure **Persistent Disk Volumes** and map them to `/app/vector_indices` to prevent the knowledge base from resetting when containers restart.

### 3. Production CORS & Security Settings
Avoid using standard wildcards. Set `CORS_ORIGINS` in your production VPS `.env`:
```env
CORS_ORIGINS=https://easybiz-app.com,https://api.easybiz-app.com
JWT_SECRET=generate_a_secure_long_random_hash_string_here
```

### 4. permanent Access WhatsApp Tokens
The Meta Developer Dashboard only issues a WhatsApp access token valid for **24 hours**:
* Link your app to a **Meta Business Manager** account.
* Go to **System Users**, create an API User, grant the user access to the WhatsApp account, and generate a **Permanent Access Token** with `whatsapp_business_messaging` permissions.

---

## 7. Operational & Verification Commands

### Database Seeding Command
Ensure you have activated the virtual environment:
```powershell
cd backend
.\venv\Scripts\python.exe app/database/seed.py
```

### Run All Integration Tests
Ensure the backend server is running, then execute:
```powershell
cd backend
.\venv\Scripts\python.exe test_auth.py
.\venv\Scripts\python.exe test_business.py
.\venv\Scripts\python.exe test_products_services.py
.\venv\Scripts\python.exe test_faqs.py
.\venv\Scripts\python.exe test_phase14.py
.\venv\Scripts\python.exe test_manual_flows.py
```

### Run RAG Accuracy Evaluation
Make sure your business profiles are seeded, then execute:
```powershell
cd backend
.\venv\Scripts\python.exe evaluate_ai.py
```
Check `evaluation_report.json` for detailed metrics logs.

### Start the Docker Services
From the repository root:
```bash
docker-compose up --build -d
```
Verify logs using:
```bash
docker-compose logs -f
```
