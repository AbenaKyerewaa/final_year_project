# Phase 9 Documentation: RAG Retrieval and AI Chat Engine

This document tracks the deliverables, schema mappings, escalation policies, prompting strategies, and verification procedures for **Phase 9: RAG Retrieval and AI Chat Engine** of EasyBiz AI.

---

## Objectives Completed

1.  **Customer-Facing Chat Endpoint:**
    *   Exposed a REST API endpoint `POST /chat/{business_id}`.
    *   Designed it to support context routing, query validation, and metadata-aware responses.

2.  **Session & Context Persistence:**
    *   Integrated SQLite persistence for conversation tracking.
    *   Resolves ongoing user context by using a passed `session_id`, falling back to the last active session for `customer_phone`, or generating a new session if no match exists.
    *   Persists `ChatMessage` rows mapping the dialogue progression (queries, answers, source references, and confidence scores).

3.  **Human Handoff Interceptor:**
    *   Configured instant keyword triggers (case-insensitive: `"human"`, `"agent"`, `"staff"`, `"call me"`, `"i want to talk to someone"`, `"manager"`).
    *   Queries containing these keywords bypass LLM execution and immediately log an `Escalation` record and a deterministic response.

4.  **Vector Retrieval & Confidence Guardrails:**
    *   Translates incoming user query text into vector space using the configured `BaseEmbeddingProvider`.
    *   Queries the specific business's FAISS index partitioned on disk.
    *   Enforces `RAG_CONFIDENCE_THRESHOLD` (default: `0.50`). Queries yielding top match similarity scores lower than the threshold trigger a safe fallback message and auto-escalate the session to human representatives.

5.  **Context-Bounded Prompting & Industry Safety Policies:**
    *   Builds prompt templates wrapping retrieval blocks and enforcing absolute grounding: the AI is strictly restricted to context facts and forbidden from fabricating catalog details or prices.
    *   Appends industry-specific compliance rules:
        *   **Pharmacy/Medical Categories:** Do not provide diagnoses, dosage recommendations, or prescribe treatments. Safely redirect to a doctor.
        *   **Legal Categories:** Avoid concrete legal or binding financial advice.

---

## Chat & Escalation Pipeline Flow

```mermaid
graph TD
    Cust([Customer Message]) -->|POST /chat/{business_id}| API[Chat Router]
    API -->|1. Resolve Session| DB[(SQLite DB)]
    
    API -->|2. Check Keywords| HandoffCheck{Handoff Requested?}
    HandoffCheck -->|Yes| EscalateH[Create Escalation: Customer Requested]
    EscalateH --> ReturnH[Return Handoff Message]
    
    HandoffCheck -->|No| RAG[RAG Vector Search]
    RAG -->|Query FAISS Index| Disk[(Local FAISS Storage)]
    Disk -->|Return Top Matching Chunks| RAG
    
    RAG --> ScoreCheck{Top Score >= RAG_CONFIDENCE_THRESHOLD?}
    ScoreCheck -->|No| EscalateL[Create Escalation: Low Confidence]
    EscalateL --> ReturnF[Return Safe Fallback Response]
    
    ScoreCheck -->|Yes| LLM[Formulate Bounded Prompt & Execute LLM]
    LLM -->|Generate Answer| DB
    DB -->|Log ChatMessage| ReturnAI[Return LLM Generated Response]
```

---

## Endpoint Specifications

### `POST /chat/{business_id}`

#### Request Body
```json
{
  "message": "Do you have HP laptops?",
  "customer_name": "Ama Serwaa",
  "customer_phone": "+233 20 888 7777",
  "channel": "web",
  "session_id": null
}
```

#### Response Body (High-Confidence Match)
```json
{
  "session_id": "a0c968ad-a77a-4b63-a4e7-a74dbb7ae221",
  "answer": "Yes! We have HP EliteBook laptops available. The HP EliteBook 840 G6 starts at GHS 4,200. It features a Core i5 processor, 8GB RAM, and a 256GB SSD, with a 3-month warranty.",
  "confidence_score": 1.0,
  "sources": [
    {
      "title": "Product: HP EliteBook 840 G6",
      "source_type": "product",
      "score": 1.0
    }
  ],
  "escalated": false
}
```

#### Response Body (Low-Confidence Fallback)
```json
{
  "session_id": "a0c968ad-a77a-4b63-a4e7-a74dbb7ae221",
  "answer": "I'm sorry, I don't have enough information about that. Let me connect you with a human representative, or please ask another question.",
  "confidence_score": 0.072,
  "sources": [],
  "escalated": true
}
```

---

## File Structure Scaffolded in Phase 9

```text
EasyBiz-ai/
  backend/
    app/
      chat/
        __init__.py
        models.py           # ChatSession, ChatMessage, and Escalation DB models
        routes.py           # Main chat controller POST /chat/{business_id}
      main.py               # Registered chat router
    test_phase9.py          # Integration test suite for Phase 9
```

---

## Verification Guide

To verify Phase 9 chat engine locally:

### 1. Run Automated Test Route Integration
Make sure your development server is running (`npm run start` or equivalent python server start).
Run the test command inside the `backend` directory:
```bash
# Inside backend/ directory
.\venv\Scripts\python.exe test_phase9.py
```
*Expected Output:*
```text
=== STARTING PHASE 9 (RAG RETRIEVAL & AI CHAT ENGINE) INTEGRATION TESTS ===

1. Logging in as Kojo...
[OK] Found business 'Kojo's Tech Hub' with ID: 3625fc62-82db-4eb7-ad3c-e07e8c4a6f64

2. Rebuilding RAG Index...
[OK] RAG index rebuilt!

3. Testing high-confidence RAG chat request...
Chat status: 200
Chat Session ID: a0c968ad-a77a-4b63-a4e7-a74dbb7ae221
Confidence score: 1.0
[OK] High confidence chat query verified!

4. Testing human handoff keyword trigger...
Chat status: 200
[OK] Handoff keyword trigger successfully intercepted and escalated!

5. Testing low-confidence fallback trigger...
Chat status: 200
[OK] Low-confidence query successfully fallback-triggered and escalated!

6. Verifying database logging records...
Total messages logged in DB: 18
Total escalations logged in DB: 6
[OK] Database log persistence verified!

=======================================================
[SUCCESS] ALL RAG RETRIEVAL & CHAT INTEGRATION TESTS PASSED!
=======================================================
```

### 2. Manual Swagger Verification
1. Open Swagger UI ([http://localhost:8000/docs](http://localhost:8000/docs)).
2. Under `chat` section, expand `POST /chat/{business_id}`.
3. Supply a valid UUID for a registered business profile.
4. Execute queries using:
   * **Keywords:** `"Could you get a human agent?"` -> should return handoff response and `escalated: true`.
   * **Out-of-bound text:** `"How to repair a spaceship?"` -> should return fallback response and `escalated: true` due to low similarity scores.
   * **Indexed catalog data:** `"Where are you located?"` -> should generate context-grounded response and `escalated: false`.
