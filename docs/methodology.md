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
│ (PostgreSQL)    │  │ (Chroma/FAISS)  │  │ (PDFs, CSVs)    │
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

## 3. The RAG Pipeline
The primary AI features utilize Retrieval-Augmented Generation. Rather than generating answers from pre-trained weights alone, the system dynamically fetches context from the business's dataset.

### Step 1: Data Collection & Cleaning
Data from forms (products, services, FAQs) and uploads (.txt, .csv, .pdf) are standardized. 
*   **Form Data:** Structured as plain key-value sentences.
    *   *Example:* `Product: HP EliteBook 840 G6. Category: Laptop. Price: GHS 4,200. Availability: Available.`
*   **Cleaning:** Removes extraneous whitespaces, formats prices to GHS, normalizes availability states, and resolves formatting bugs.

### Step 2: Text Chunking
Long files are partitioned into retrieval units:
*   Products, services, and FAQ items map to single individual chunks.
*   Document files are split into overlapping segments of **300 to 500 words** to maintain context while staying within embedding limitations.

### Step 3: Embedding Generation & Vector Storage
Chunks are mapped into high-dimensional vectors representing semantic meaning using:
*   Provider-based embeddings (Google Gemini, OpenAI).
*   Fallback local setup: Sentence Transformers (`all-MiniLM-L6-v2`).
These embeddings are loaded into a vector store (ChromaDB or FAISS) paired with metadata including `business_id`, `source_type`, and `source_id`.
> [!IMPORTANT]
> **Data Isolation:** Every retrieval query is strictly filtered using the respective `business_id` metadata tag to guarantee a customer chatting with one SME can never retrieve data belonging to another.

### Step 4: Search & Confidence Logic
When a customer queries the system:
1.  The query is converted into an embedding.
2.  A similarity search locates the top $K$ (e.g., 3 to 5) relevant vectors within the isolated business index.
3.  The system checks the maximum similarity score. If it falls below the threshold (e.g., `RAG_CONFIDENCE_THRESHOLD=0.50`), it triggers a fallback response or human escalation instead of generating a response.
4.  If the score is acceptable, the chunks are compiled into a system prompt.

### Step 5: LLM Generation & Guardrails
The LLM generates a response under strict rules:
*   Answer only from the provided context.
*   Do not synthesize prices, availability, or policies not present in the text.
*   Include polite handoff cues if information is missing.
*   Adhere to specialized safety policies (e.g., direct pharmacies to refer users to licensed pharmacists rather than prescribing meds).

---

## 4. WhatsApp and Voice Support Strategy
*   **WhatsApp Simulation:** An interface matching WhatsApp UI styling will interact with the chat API (simulating webhook triggers) for demonstrating user flows without needing immediate API credentials.
*   **Voice Transcription:** Uses OpenAI Whisper or faster-whisper locally to transcribe user voice notes, feeding the resulting text into the standard RAG pipeline.
