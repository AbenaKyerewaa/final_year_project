# CHAPTER THREE: RESEARCH METHODOLOGY

## 3.1 Description of Dataset
The dataset utilized in this project is multi-tenant, business-specific, and dynamically assembled. Unlike centralized, open-domain training corpora, EasyBiz AI manages isolated data repositories for each registered Small and Medium Enterprise (SME). The dataset consists of both structured records and unstructured documents populated directly by the business owners through the merchant dashboard:

1. **Structured Business Profile**: Metadata defining operational attributes of the SME, including business name, physical address/location, contact phone numbers, operating hours, accepted payment methods (e.g., Mobile Money, Cash), delivery options (e.g., delivery zones, flat rates), and business description.
2. **Structured Product Catalog**: Inventory items containing product name, category, price (standardized in Ghanaian Cedis - GHS), stock availability status (In Stock, Out of Stock), warranty duration, and technical specifications.
3. **Structured Service Catalog**: Commercial services containing service name, description, duration/turnaround time, and pricing.
4. **Structured Frequently Asked Questions (FAQs)**: Custom-seeded question-and-answer pairs capturing repetitive client inquiries (e.g., "Do you accept payment in installments?", "Where is your pickup station in Accra?").
5. **Unstructured Documents**: Text files (.txt) and PDF documents uploaded by the merchant containing extensive operational guidelines, warranty policies, admission brochures, or detailed product user manuals.

For development, testing, and experimental evaluation, the database was populated with profiles and inventory details representing four distinct business archetypes representative of the Ghanaian commercial landscape:
* **MelTech Computers** (Electronics Retail & Hardware Repair): A computer hardware shop cataloging laptops, accessories, repair services, warranty terms, and delivery policies.
* **Grace Academy** (Educational Institution): A private basic school profile detailing academic programs, admission requirements, fee schedules, and term dates.
* **Akwaaba Restaurant** (Hospitality/Food Service): A dining profile detailing Ghanaian and continental menus, ingredients, prices, operating hours, and local delivery zones.
* **Michy's Tech Hub** (Digital Services): A profile describing IT services, software development, consulting hours, and hourly billing rates.

---

## 3.2 Preprocessing of Dataset
To prepare raw SME data for semantic indexing, vector retrieval, and deterministic matching, a multi-stage preprocessing pipeline was developed:

1. **Structured Entity Normalization**: Structured database records are dynamically transformed into declarative natural language sentences to enable semantic embedding alignment while preserving tabular precision.
   * *Raw Product record*: `HP EliteBook 840 G6, GHS 4,200.00, Available, 6-month warranty.`
   * *Compiled Text Chunk*: `"Product: HP EliteBook 840 G6. Category: Laptop. Price: GHS 4,200.00. Availability: In Stock. Warranty: 6-month warranty. Description: High-performance business laptop with Intel Core i5, 16GB RAM, 512GB SSD."`
2. **Text Cleaning and Standardization**:
   * Standardizing currency symbols and notations (converting inconsistent inputs such as `GH₵`, `gh`, `cedis`, `GHS` into uniform `GHS` representations).
   * Stripping non-printable ASCII characters, redundant whitespace, and duplicate record entries.
   * Normalizing casing and punctuation to prevent tokenization artifacts during embedding generation.
3. **Document Parsing and Text Chunking**: 
   * Extracting plain text from uploaded PDF and text documents using robust document parsing libraries (`pypdf` and standard file decoders).
   * Cleansing line-break hyphens and OCR artifacts from parsed document strings.

---

## 3.3 Oversampling and Semantic Coverage
In traditional supervised classification tasks, oversampling techniques (such as SMOTE) are used to balance minority classes in training datasets. Because EasyBiz AI relies on Retrieval-Augmented Generation (RAG)—which is an unsupervised, retrieval-based architecture—traditional supervised oversampling algorithms are **not applicable**. 

Instead, "dataset balance" in RAG refers to ensuring semantic coverage across all business domains. To achieve complete semantic coverage:
* The system enforces a **guaranteed entity indexing policy**: Every single product, service, and FAQ is individually converted into an indexed chunk, guaranteeing that no catalog item is omitted from the retrieval index.
* For unstructured text files and policy manuals, we employ a **fixed-size sliding window chunking strategy** with **300 to 500 words per chunk** and a **10% (30-50 words) overlap**. The overlap ensures that semantic statements spanning chunk boundaries maintain contextual integrity, eliminating retrieval dropouts.

---

## 3.4 Feature Selection (Embedding Generation)
In a RAG pipeline, the "feature selection" stage corresponds to transforming cleaned text chunks into dense, high-dimensional vector representations that capture semantic features and contextual intent:
1. **Google Gemini Embeddings**: The primary embedding model is Google’s `text-embedding-004`. It maps each text chunk into a 768-dimensional dense vector space, capturing nuanced commercial semantics, synonyms, and intent.
2. **Sentence Transformers (Local Fallback)**: For cost-sensitive, low-latency, or offline environments, the architecture supports the open-source `all-MiniLM-L6-v2` model. This model runs locally on the CPU, generating 384-dimensional dense vectors.

Every generated vector is indexed alongside its metadata (`business_id`, `source_type`, `source_id`, `title`) into the vector database.

---

## 3.5 Experimental Setup

### 3.5.1 General Overview of Modelling Architecture
The system architecture of EasyBiz AI is organized into a modular three-tier structure deployed via containerized orchestration (Docker Compose):

```text
       ┌─────────────────────────────────────────────────────────────┐
       │               Next.js Merchant & Customer UI                │
       │  (Merchant Dashboard, Public Web Chat, WhatsApp Simulator)  │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
                                      ▼ HTTP REST / JSON
       ┌─────────────────────────────────────────────────────────────┐
       │             FastAPI Backend Engine (Python 3.11)             │
       │ ┌──────────────────────────┐   ┌──────────────────────────┐ │
       │ │ Deterministic Matcher    │   │ Query Condenser (History)│ │
       │ └────────────┬─────────────┘   └────────────┬─────────────┘ │
       │              │                              │               │
       │ ┌────────────▼─────────────┐   ┌────────────▼─────────────┐ │
       │ │ RAG Confidence Evaluator │   │ Grounded LLM Orchestrator│ │
       │ └──────────────────────────┘   └──────────────────────────┘ │
       └──────────────┬──────────────────────────────┬───────────────┘
                      │                              │
       ┌──────────────▼─────────────┐ ┌──────────────▼─────────────┐
       │ Relational Database (SQL)  │ │ Local FAISS Vector Indices │
       │ (Users, Catalogs, Tickets) │ │ (Isolated per Business ID) │
       └────────────────────────────┘ └────────────────────────────┘
```

The system components interact as follows:
* **Relational Database**: Manages user authentication, tenant metadata, products, services, FAQs, chat sessions, message histories, and human escalation tickets.
* **Vector Store**: Manages dense vector indices partitioned on disk by `business_id` inside `backend/vector_indices/{business_id}/`.
* **FastAPI Application**: Orchestrates incoming queries, executes the hybrid retrieval pipeline, invokes the LLM API, and logs conversation turns.

### 3.5.2 Modelling Approach: Hybrid Retrieval Pipeline
To achieve maximum factual accuracy and prevent hallucinations, EasyBiz AI implements a **five-stage Hybrid Retrieval Pipeline**:

```text
Incoming Customer Query
         │
         ▼
[ Stage 1: Deterministic Structured Database Matching ] ──► (Match Found? Return Factual Answer)
         │ (No Exact Match)
         ▼
[ Stage 2: Multi-Turn Context Condensation ] ─────────────► (Rewrite "How much is it?" -> "How much is HP 840?")
         │
         ▼
[ Stage 3: Dense Semantic Vector Search (FAISS) ] ────────► (Retrieve Top-K Chunks with Similarity Scores)
         │
         ▼
[ Stage 4: Dual-Layer Guardrail & Threshold Evaluation ]
         │
         ├─► (Top Score < 0.50 Threshold) ────────────────► Safe Fallback & Auto Human Escalation
         │
         ▼ (Top Score >= 0.50 Threshold)
[ Stage 5: Context-Bounded LLM Generation ] ──────────────► Factually Grounded Response
```

1. **Stage 1: Deterministic Structured Database Matching (`find_local_database_match`)**:
   Before querying dense vectors or calling the LLM, the backend analyzes the user's query against structured catalog entities.
   * *Catalog Overviews*: Queries like "What do you sell?" or "List your products" directly return an aggregated summary of registered products and services.
   * *Direct Entity Matching*: The matcher computes token overlap ($65\%$ query coverage, $35\%$ entity coverage) against product names, service titles, FAQ questions, and business profiles. If a confident match is found, the system immediately returns the factual price, description, and warranty without LLM latency or hallucination risk.
2. **Stage 2: Multi-Turn Context Condensation**:
   If no direct catalog match occurs, the query history is examined. For follow-up questions containing pronouns (e.g., "Do you have it in black?", "How much is the delivery?"), the system uses context condensation to reformulate the query into a standalone semantic search string.
3. **Stage 3: Dense Semantic Vector Search (FAISS)**:
   The search query is embedded using the active embedding model (`text-embedding-004` or `all-MiniLM-L6-v2`). The backend dynamically loads the FAISS index strictly assigned to that `business_id` (`vector_indices/{business_id}/index.faiss`) and retrieves the top $K$ ($K=3$) most similar chunks.
4. **Stage 4: Dual-Layer Guardrail and Safe Escalation**:
   The maximum similarity score ($S_{\max}$) is compared against the confidence threshold ($\tau = 0.50$). If $S_{\max} < \tau$, the query is classified as low confidence. The system suppresses generation, returns a polite fallback ("I'm sorry, I don't have enough information about that. Let me connect you with a representative."), and automatically logs an Escalation record in the database for the business owner.
5. **Stage 5: Context-Bounded LLM Generation**:
   If $S_{\max} \ge \tau$, the retrieved chunks are formatted into an isolated context block. The LLM (Google Gemini `gemini-1.5-flash`) is executed with strict system prompt grounding: it is instructed to answer exclusively using the retrieved text and refuse to speculate on missing information.

### 3.5.3 Validation and Testing
System correctness and stability were verified through automated test suites:
* `test_auth.py`: Verifies multi-tenant password hashing, JWT generation, and token expiration.
* `test_business.py`: Validates CRUD operations for business profiles.
* `test_products_services.py`: Assesses product and service creation, editing, and stock toggling.
* `test_faqs.py`: Tests single and bulk FAQ creation and CSV parsing.
* `test_phase14.py`: Tests the WhatsApp webhook endpoint simulator, payload verification, and inbound messaging.
* `test_manual_flows.py`: Executes end-to-end user workflows from merchant onboarding to customer chat and escalation.

### 3.5.4 Evaluation of Models
The quantitative performance of the hybrid RAG architecture was evaluated using a dedicated benchmarking suite (`backend/evaluate_ai.py`). The evaluation dataset comprises test queries executed against the **MelTech Computers** knowledge base, categorized into:
* **In-Domain Retrieval Queries**: Queries testing specific pricing, laptop models, repair services, and warranty periods.
* **Out-of-Domain Queries**: Unrelated queries (e.g., "What is the capital of Ghana?") designed to test threshold guardrails and hallucination suppression.
* **Explicit Human Escalation Queries**: Direct requests for human intervention (e.g., "I want to talk to a human representative") testing intent classification and ticket creation.

The evaluation suite computes five standard quantitative metrics:
$$\text{Response Accuracy \%} = \left( \frac{N_{\text{passed}}}{N_{\text{total}}} \right) \times 100$$
$$\text{Average Retrieval Score} = \frac{1}{N} \sum_{i=1}^N S_i$$
$$\text{Average Response Latency (s)} = \frac{1}{N} \sum_{i=1}^N L_i$$
$$\text{Hallucination Rate \%} = \left( \frac{N_{\text{hallucinated}}}{N_{\text{out\_of\_domain}}} \right) \times 100$$
$$\text{Human Handoff Correctness \%} = \left( \frac{N_{\text{correct\_escalations}}}{N_{\text{escalation\_queries}}} \right) \times 100$$

### 3.5.5 Statistical Tests and Threshold Tuning
To determine the optimal confidence threshold $\tau$, experiments were conducted by stepping the similarity threshold from 0.30 to 0.70 at intervals of 0.10:
* At $\tau < 0.40$, the system admitted tangential chunks, increasing the risk of ungrounded responses for ambiguous customer questions.
* At $\tau > 0.65$, lexical variations in valid customer inquiries caused false rejections and excessive human handoffs.
* At $\tau = 0.50$, the system achieved an optimal balance: 0.00% hallucinations on out-of-domain queries while maintaining high retrieval sensitivity for legitimate business questions.
