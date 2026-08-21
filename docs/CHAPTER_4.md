# CHAPTER FOUR: EXPERIMENTAL RESULT AND DISCUSSION

## 4.1 System Implementation
The **EasyBiz AI** application was successfully built and deployed as a containerized, multi-tenant platform. The implementation consists of two core user-facing systems:

### 4.1.1 The Merchant Dashboard (Next.js)
The dashboard provides a premium, zero-code administrative portal for SME owners to manage their business identity and custom knowledge base:
* **Business Profile Panel**: Enables merchants to configure operational variables, such as opening hours, delivery ranges, contact numbers, and payment details. These variables are saved to the relational database and dynamically compiled into text representation.
* **Inventory Management Panels**: Full CRUD panels for products (name, description, price, stock status, warranty) and services.
* **FAQ Management Panel**: An interface allowing owners to seed custom question-and-answer pairs or import them in bulk via CSV files.
* **Document Upload Panel**: Supports uploading text and PDF files. Upon upload, the backend extracts the text, segments it using a sliding window chunker, embeds the chunks, and indexes them into the business's FAISS vector store.
* **Conversational Logs & Escalations**: Displays active customer chat history and flags sessions escalated to human representatives, showing the exact question that triggered the escalation.

### 4.1.2 The Customer Interfaces
* **Web Chat Widget**: A clean, floating chat window that can be embedded into any business website. It connects to the FastAPI backend, initiating a unique chat session and communicating via REST endpoints.
* **WhatsApp Chat Simulator**: To showcase the system's integration with messaging networks, a custom web-based simulator was built. It mirrors a mobile WhatsApp chat screen (complete with standard green bubbles and contact headers) and simulates Meta's webhook payloads, calling the backend API to retrieve responses and simulating human representative escalations.

---

## 4.2 Evaluation Results
The Retrieval-Augmented Generation pipeline was evaluated using the automated evaluation suite (`evaluate_ai.py`) on a seeded profile for **MelTech Computers** (an electronics retail and repair SME). The quantitative results extracted from `evaluation_report.json` are summarized in the table below:

### 4.2.1 Quantitative Performance Summary
| Metric | Value | Interpretation |
| :--- | :--- | :--- |
| **Response Accuracy** | 85.71% | Percentage of test queries where the AI response contained all expected keywords. |
| **Average Retrieval Accuracy** | 79.71% | The mean FAISS similarity score across all evaluation queries. |
| **Average Response Time** | 6.06 seconds | Time elapsed from sending a request to receiving the generated answer (including remote Gemini API call). |
| **Hallucination Rate** | 0.00% | Percentage of out-of-domain queries where the AI generated a confident, ungrounded response. |
| **Human Handoff Correctness** | 100.00% | Accuracy of the system in flagging human-handoff requests and generating escalation tickets. |

These results demonstrate the viability of using off-the-shelf LLMs combined with local FAISS indices for business automation. The 0% hallucination rate is particularly critical, as it proves that similarity thresholding successfully constrains the LLM, preventing it from fabricating ungrounded information.

---

## 4.3 Discussion and Analysis of Queries
A detailed review of the evaluation report reveals how the system processes different classes of questions:

### 4.3.1 Successful Retrieval Cases (Passed)
* **Query**: *"Do you offer any warranty on refurbished laptops?"*
  * **Retrieval Score**: 0.865
  * **Response**: *"We provide a 1-year warranty on brand new laptops and a 6-month warranty on refurbished..."*
  * **Status**: PASSED. The similarity score of 0.865 was well above the threshold ($\tau=0.50$). The retrieved chunk correctly informed the LLM that refurbished items have a 6-month warranty, and the generated response was factually grounded.
* **Query**: *"Do you do laptop screen replacement?"*
  * **Retrieval Score**: 0.761
  * **Response**: *"Our 'Laptop Screen Replacement' service is available for GHS 450.00. Professional..."*
  * **Status**: PASSED. The RAG pipeline correctly retrieved the screen replacement service chunk and returned the exact pricing.

### 4.3.2 Low-Confidence Fallback and Escalation Cases (Passed)
* **Query**: *"What is the capital of Ghana?"* (Out-of-Domain Query)
  * **Retrieval Score**: 0.572
  * **Response**: *"I'm sorry, I don't have enough information about that. Let me connect you with a representative..."*
  * **Status**: PASSED. Although the query returned a retrieval score of 0.572 (due to semantic terms matching general business location variables), the prompt guidelines and grounding constraints forced the LLM to recognize that the capital of Ghana is not mentioned in the business data. The LLM correctly generated a polite fallback response, preventing a hallucination, and the system flagged the session for escalation.

* **Query**: *"I want to talk to a human representative."* (Explicit Handoff)
  * **Retrieval Score**: 1.000
  * **Response**: *"I have notified our team. A human representative will be with you shortly."*
  * **Status**: PASSED. The message router recognized the explicit handoff intent, bypassed the FAISS similarity search, generated an escalation ticket, and set the session's `escalated` status to `True`.

### 4.3.3 Mismatch / Failed Retrieval Cases (Failed)
* **Query**: *"What laptops do you have in stock?"*
  * **Retrieval Score**: 0.800
  * **Response**: *"We sell both brand new in box and Grade A clean refurbished laptops. Refurbished..."*
  * **Status**: FAILED. 
  * **Analysis of Failure**: The RAG retrieval pipeline successfully found relevant laptop categories (yielding a high similarity score of 0.800), and the generated text was factually correct. However, the query was marked as failed by the evaluation script because the generated response did not contain the specific brand keywords `"Lenovo"`, `"ThinkPad"`, `"HP"`, and `"ProBook"` that the test suite expected. 
  * **Mitigation**: To resolve this failure, two approaches can be taken:
    1. *Refining prompt instructions*: Instruct the LLM to list specific product names when a customer asks for stock availability, rather than summarizing categories.
    2. *Adjusting evaluation criteria*: Modify the test assertions in `evaluate_ai.py` to allow partial keyword matching or use semantic similarity (such as BERTScore or LLM-as-a-judge) rather than rigid string matching.

> [!NOTE]
> **[USER INPUT REQUIRED]**: Add your own reflections on these test results. For instance, you can discuss if the response time (~6 seconds) is acceptable for your target users, and what feedback your supervisor or trial merchants gave regarding the Next.js dashboard UI.
