# Technical Methodology: EasyBiz AI RAG Assistant

This document outlines the detailed system architecture, modular design, and Retrieval-Augmented Generation (RAG) pipeline for **EasyBiz AI**.

## 1. System Overview & User Roles
The system accommodates three categories of users:
1.  **Business Owner:** Manages business details, adds/updates products, services, FAQs, and documents, triggers data re-indexing, and monitors customer chat history/escalations.
2.  **Customer:** Interacts via web chat or WhatsApp, asking questions and receiving responses sourced from the business knowledge base.
3.  **System Admin:** Monitors system performance, manages registration, and conducts audit reviews.

```text
Business Owner uploads business data
        ↓
System processes and stores the data
        ↓
Customer asks a question
        ↓
System searches the business data (Vector DB)
        ↓
AI generates a context-bounded answer (LLM)
        ↓
Customer receives response
```

---

## 2. Proposed Architecture Diagram
```text
                   ┌──────────────────────┐
                   │   Business Owner UI   │
                   │  Dashboard / Portal   │
                   └──────────┬───────────┘
                              │
                              v
                   ┌──────────────────────┐
                   │      Backend API      │
                   │      (FastAPI)       │
                   └──────────┬───────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          v                   v                   v
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Relational DB   │  │ Vector Database │  │ File Storage    │
│ (SQLite/Postgres│  │ (FAISS / Local) │  │ (PDFs, TXTs)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │
          └─────────┬─────────┘
                    v
          ┌─────────────────────┐
          │    AI RAG Engine     │
          │ (Retrieval + LLM)   │
          └─────────┬───────────┘
                    v
          ┌─────────────────────┐
          │ Customer Interfaces │
          │ (Web Chat/WhatsApp) │
          └─────────────────────┘
```

---

## 3. The Hybrid RAG Pipeline
The primary AI features utilize a hybrid Retrieval-Augmented Generation pipeline. Rather than generating answers from pre-trained weights alone, the system dynamically fetches context from the business's dataset.

### Step 1: Data Collection & Cleaning
Data from forms (products, services, FAQs) and uploads (.txt, .pdf) are standardized:
*   **Form Data:** Structured as plain key-value sentences.
    *   *Example:* `Product: HP EliteBook 840 G6. Category: Laptop. Price: GHS 4,200. Availability: In Stock.`
*   **Cleaning:** Removes extraneous whitespaces, formats prices to GHS, normalizes availability states, and resolves formatting bugs.

### Step 2: Text Chunking
Long files are partitioned into retrieval units:
*   Products, services, and FAQ items map to single individual chunks.
*   Document files are split into overlapping segments of **300 to 500 words** (10% overlap) to maintain context while staying within embedding limitations.

### Step 3: Embedding Generation & Vector Storage
Chunks are mapped into high-dimensional vectors representing semantic meaning using:
*   Provider-based embeddings (Google Gemini `text-embedding-004`).
*   Fallback local setup: Sentence Transformers (`all-MiniLM-L6-v2`).
These embeddings are loaded into an isolated FAISS vector store saved under `vector_indices/{business_id}/` paired with metadata including `business_id`, `source_type`, and `source_id`.
> [!IMPORTANT]
> **Data Isolation:** Every retrieval query is strictly filtered using the respective `business_id` metadata tag to guarantee a customer chatting with one SME can never retrieve data belonging to another.

### Step 4: Hybrid Search & Confidence Logic
When a customer queries the system:
1.  **Deterministic Structured Match**: The query is first checked against structured catalog entities (products, services, FAQs) for direct matches or catalog overviews.
2.  **Context Condensation**: For multi-turn conversational follow-ups, pronouns and context are rewritten into a standalone query.
3.  **Semantic Vector Search**: The query is converted into an embedding and FAISS locates the top $K$ (e.g., 3) relevant vectors within the isolated business index.
4.  **Confidence Thresholding**: If the maximum similarity score falls below the threshold (`RAG_CONFIDENCE_THRESHOLD=0.50`) and no structured match exists, the system safely suppresses generation, returns a polite fallback, and logs an Escalation record.
5.  If the score is acceptable, the chunks are compiled into a system prompt.

### Step 5: LLM Generation & Guardrails
The LLM generates a response under strict rules:
*   Answer only from the provided context.
*   Do not synthesize prices, availability, or policies not present in the text.
*   Include polite handoff cues if information is missing.
*   Adhere to specialized safety policies (e.g., direct pharmacies to refer users to licensed pharmacists rather than prescribing meds).

---

## 4. WhatsApp and Conversational Commerce Strategy
*   **WhatsApp Simulation & Webhooks:** An interactive interface matching WhatsApp mobile UI styling interacts with the backend webhook API (`backend/app/chat/whatsapp_routes.py`), demonstrating incoming message events, session management, and human escalation handoffs without requiring immediate Meta production credentials.
*   **Public Web Chat Widget:** A lightweight, embeddable web chat interface (`frontend/app/chat/[businessId]/page.tsx`) that communicates directly with the live FastAPI backend public endpoint (`/api/v1/chat/public/{business_id}`), enabling real-time grounded customer support on any merchant website.
*   **Escalation Email Notifications:** When handoff is required, the backend sends owner alerts through Resend transactional email first, SMTP second, and console simulation in local development. The customer contact card stores submitted phone/WhatsApp numbers and triggers an updated email containing the customer's contact details.
