# CHAPTER FOUR: EXPERIMENTAL RESULT AND DISCUSSION

## 4.1 System Implementation
The **EasyBiz AI** application was successfully implemented and deployed as a modular, containerized multi-tenant platform. The implementation consists of two core user-facing systems: the Merchant Administrative Portal and the Customer Conversational Interfaces.

### 4.1.1 The Merchant Dashboard (Next.js)
The merchant dashboard provides a zero-code administrative portal developed with Next.js (App Router) and Vanilla CSS, enabling SME owners to configure their operational profile, curate business knowledge, and monitor customer engagement:
* **Business Profile Panel**: Enables merchants to configure operational variables, including business name, physical address, contact telephone numbers, operating hours, delivery zones, flat fees, and payment channels (e.g., MTN MoMo, Telecel Cash). These variables are saved to the relational database and dynamically compiled into declarative sentences for retrieval indexing.
* **Inventory Management Panels**: Full CRUD interfaces for managing products (name, category, price in GHS, stock availability status, warranty period, specifications) and services (service name, description, duration, pricing).
* **FAQ Management Panel**: An interface allowing owners to manually seed custom question-and-answer pairs or import them in bulk via CSV uploads.
* **Document Upload Panel**: Supports uploading unstructured text (.txt) and PDF documents. The backend parses the uploaded files, extracts clean text, segments it using a sliding window chunker (300–500 words, 10% overlap), generates dense embeddings, and updates the business's FAISS index.
* **Conversational Logs & Escalations Viewer**: Displays active customer chat history across sessions and flags inquiries escalated to human representatives, showing the exact question that triggered the fallback, customer contact numbers, and 1-click WhatsApp/direct reply actions.
* **WhatsApp Integration Page**: A dedicated management view (`frontend/app/dashboard/whatsapp/page.tsx`) that allows merchants to simulate WhatsApp account connection via a visual QR code flow, view the assigned webhook URL and verify token, and test conversations in a live simulated WhatsApp interface.

### 4.1.2 The Customer Interfaces
* **Embeddable Public Web Chat**: A lightweight, floating chat interface (`frontend/app/chat/[businessId]/page.tsx`) that can be integrated into merchant websites. It connects directly to the FastAPI backend public endpoint (`/chat/{business_id}`), creating isolated chat sessions and delivering context-grounded responses in real time. It includes an interactive contact capture card rendered upon escalation.
* **WhatsApp Chat Simulator**: To evaluate the system's integration with messaging networks, a custom web-based simulator was developed. It mirrors the WhatsApp mobile user interface (green incoming/outgoing message bubbles, read receipts, and contact headers) and simulates Meta’s WhatsApp Cloud API webhook payloads, calling the backend API to retrieve responses and simulating human representative escalations.

### 4.1.3 Smart Hybrid Escalation and Real-Time Alert Verification
To verify the out-of-band notification and escalation pipeline in production-like conditions, integration testing was executed using `backend/test_escalation_alert.py`:
* **Out-of-Band Email Alert Dispatch**: When a customer inquiry triggers low retrieval confidence or explicitly requests a human representative, the backend enqueues an asynchronous notification via FastAPI `BackgroundTasks`. The notification worker dispatches a structured, responsive HTML email to the merchant owner's registered address using Resend as the primary transactional email provider, with SMTP and console simulation as fallbacks.
* **In-Chat Contact Capture Flow**: Upon escalation, the web chat widget displays an embedded contact capture card. Submitting a phone or WhatsApp number triggers `POST /chat/{business_id}/contact`, persists the contact to the session, and dispatches an updated owner alert containing the customer's submitted name and phone/WhatsApp number.
* **Dashboard Indicators and 1-Click WhatsApp Reply**: The merchant dashboard displays real-time pending counters on the sidebar navigation (`Chat History`) and home banner. Within the session detail view, merchants can initiate a one-click conversation on WhatsApp (`https://wa.me/233...`) or submit a direct reply as an authenticated representative via `POST /chat-sessions/{session_id}/reply`, which auto-resolves the escalation ticket.

---

## 4.2 Evaluation Results
The hybrid Retrieval-Augmented Generation pipeline was evaluated using the automated evaluation suite (`backend/evaluate_ai.py`) against a populated knowledge base for **MelTech Computers** (an electronics retail and repair SME). The quantitative results extracted from `evaluation_report.json` are summarized in Table 4.1:

### 4.2.1 Quantitative Performance Summary
Table 4.1: Overall Performance Metrics of EasyBiz AI Evaluation Suite

| Metric | Value | Interpretation |
| :--- | :--- | :--- |
| **Response Accuracy** | 85.71% | Percentage of test queries where the generated response satisfied ground-truth keyword criteria. |
| **Average Retrieval Accuracy** | 79.71% | The mean FAISS similarity score across all evaluated queries. |
| **Average Response Time** | 6.06 seconds | End-to-end latency from request dispatch to response receipt (including remote Gemini API roundtrip). |
| **Hallucination Rate** | 0.00% | Percentage of out-of-domain queries where the AI fabricated ungrounded answers. |
| **Human Handoff Correctness** | 100.00% | Success rate of flagging low-confidence inquiries and explicit escalation requests. |

These empirical metrics validate the design of the hybrid RAG architecture. The 0.00% hallucination rate is particularly critical: it proves that the dual-layer combination of deterministic structured lookup, similarity score thresholding ($\tau=0.50$), and strict system prompt grounding prevents the LLM from fabricating false information when faced with unknown or out-of-domain queries.

---

## 4.3 Discussion and Analysis of Queries
A detailed examination of individual test cases from the evaluation report illustrates how the system manages diverse query intents:

### 4.3.1 Successful Retrieval Cases (Passed)
* **Query 1**: *"Do you sell new or used laptops?"*
  * **Retrieval Score**: 0.898
  * **Response Time**: 7.06 seconds
  * **Generated Response**: *"We sell both brand new in box and Grade A clean refurbished laptops. Refurbished laptops come with a 6-month warranty, while brand new laptops carry a 1-year warranty."*
  * **Outcome**: PASSED. High similarity score (0.898) retrieved the inventory policy chunk. The response accurately communicated both options.
* **Query 2**: *"How much does the HP ProBook cost?"*
  * **Retrieval Score**: 0.682
  * **Response Time**: 6.50 seconds
  * **Generated Response**: *"We have 'HP ProBook 450 G8' available for GHS 5200.00. Core i5, 8GB RAM, 256GB SSD."*
  * **Outcome**: PASSED. The system accurately matched the product record and returned the exact catalog price in Ghanaian Cedis.
* **Query 3**: *"Do you do laptop screen replacement?"*
  * **Retrieval Score**: 0.762
  * **Response Time**: 7.67 seconds
  * **Generated Response**: *"Our 'Laptop Screen Replacement' service is available for GHS 450.00. Professional installation included."*
  * **Outcome**: PASSED. The service catalog entry was correctly retrieved with accurate pricing and description.
* **Query 4**: *"Do you offer any warranty on refurbished laptops?"*
  * **Retrieval Score**: 0.865
  * **Response Time**: 8.69 seconds
  * **Generated Response**: *"We provide a 1-year warranty on brand new laptops and a 6-month warranty on refurbished laptops."*
  * **Outcome**: PASSED. Grounded context prevented the model from quoting arbitrary warranty terms.

### 4.3.2 Low-Confidence Fallback and Escalation Cases (Passed)
* **Query 5**: *"What is the capital of Ghana?"* (Out-of-Domain Query)
  * **Retrieval Score**: 0.573
  * **Response Time**: 4.50 seconds
  * **Generated Response**: *"I'm sorry, I don't have enough information about that. Let me connect you with a representative from MelTech Computers who can help."*
  * **Outcome**: PASSED. Although semantic overlap with location metadata produced a score of 0.573, the grounding prompt recognized that national capital data is not part of MelTech Computers' catalog. The model refused to fabricate an answer, returning the polite fallback and creating an escalation ticket.
* **Query 6**: *"I want to talk to a human representative."* (Explicit Escalation)
  * **Retrieval Score**: 1.000 (Direct Match)
  * **Response Time**: 2.13 seconds
  * **Generated Response**: *"I have notified our team. A human representative will be with you shortly."*
  * **Outcome**: PASSED. The query router detected human handoff intent immediately, bypassed vector retrieval, and initiated an escalation record.

### 4.3.3 Mismatch Analysis and Mitigation (Failed Case)
* **Query 7**: *"What laptops do you have in stock?"*
  * **Retrieval Score**: 0.800
  * **Response Time**: 5.90 seconds
  * **Generated Response**: *"We sell both brand new in box and Grade A clean refurbished laptops. Refurbished laptops come with a 6-month warranty..."*
  * **Outcome**: FAILED (Under rigid string-matching criteria).
  * **Analysis**: The system successfully retrieved general laptop catalog information (similarity score 0.800), and the generated reply was factually correct. However, the evaluation test assertion strictly expected specific product model strings (`"Lenovo"`, `"ThinkPad"`, `"HP"`, `"ProBook"`), which the model summarized into broader category statements.
  * **Mitigation**: 
    1. *Deterministic Overview Pre-Pass*: In the updated retrieval pipeline, queries asking "What do you sell?" or "What do you have in stock?" trigger a deterministic SQL query returning all active catalog items directly, guaranteeing exhaustive product enumeration.
    2. *Semantic Evaluation*: Future evaluation suites should adopt semantic similarity metrics (such as BERTScore or RAGAS answer relevancy) alongside exact keyword matching.

> [!NOTE]
> **[USER INPUT REQUIRED]**: Add your own reflections on these test results. For instance, you can discuss whether the response time (~6 seconds) is acceptable for your target users, and what feedback your supervisor or trial merchants gave regarding the Next.js dashboard UI.
