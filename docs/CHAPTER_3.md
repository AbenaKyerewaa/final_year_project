# CHAPTER THREE: RESEARCH METHODOLOGY

## 3.1 Description of Dataset
The dataset utilized in this project is multi-tenant and business-specific. Unlike centralized open-domain training datasets, EasyBiz AI manages isolated data repositories for each registered Small and Medium Enterprise (SME). The dataset consists of both structured and unstructured data uploaded directly by the business owners:

1. **Structured Business Profile**: Metadata defining the SME, including business name, location, contact number, opening hours, accepted payment methods (e.g., Mobile Money, Cash), delivery options (e.g., delivery fee and regions), and business description.
2. **Structured Product Catalog**: Inventory items containing product name, price (in Ghanaian Cedis - GHS), availability status (Available, Out of Stock), warranty terms, and specifications.
3. **Structured Service Catalog**: Offered business services containing service name, description, duration, pricing, and deadlines.
4. **Structured Frequently Asked Questions (FAQs)**: Custom-seeded question-and-answer pairs capturing repetitive client inquiries (e.g., "Do you accept payment in installments?").
5. **Unstructured Documents**: Text files, PDFs, or DOCX files uploaded by the business owner containing detailed business guidelines, policy manuals, admission brochures, or product manuals.

For testing and experimental evaluation, the database was seeded with profiles and inventory details representing four distinct business types typical of the Ghanaian market:
* **MelTech Computers** (Electronics Shop): A hardware reseller cataloging laptops, pricing, warranty terms, and repair services.
* **Grace Academy** (Educational Institution): An academic profile describing admission requirements, fee structures, program lists, and application deadlines.
* **Akwaaba Restaurant** (Hospitality/Food Service): A dining profile detailing menus, ingredients, prices, operating hours, and local delivery zones.
* **Michy's Tech Hub** (Digital Services): A profile describing IT services, software development, consulting hours, and pricing.

---

## 3.2 Preprocessing of Dataset
To prepare raw SME data for embedding generation and retrieval, a multi-stage preprocessing pipeline was developed:
1. **Normalization of Structured Forms**: Structured database records are dynamically compiled into plain English sentences to enable semantic matching.
   * *Example Product record*: `HP EliteBook 840 G6, GHS 4,200, Available, 3-month warranty.`
   * *Preprocessed Text Chunk*: `"Product: HP EliteBook 840 G6. Category: Laptop. Price: GHS 4,200.00. Availability: Available. Warranty: 3-month warranty."`
2. **Text Cleaning**:
   * Standardizing currency notations (converting various symbol representations like `GH₵`, `gh`, `cedis`, `GHS` to `GHS`).
   * Eliminating duplicate records, excessive whitespaces, and system-level special characters.
   * Converting text to lowercase for embedding stability (depending on the embedding encoder guidelines).
3. **Document Parsing**: 
   * Extracting plain text from uploaded PDF files using robust text-extraction libraries.
   * Handling broken sentences and hyphenations commonly found in PDF text extraction.

---

## 3.3 Oversampling Approach
> [!NOTE]
> **[USER INPUT REQUIRED]**: Explain why standard oversampling (like SMOTE) is not applicable or how you handled dataset balance.

In traditional supervised classification tasks, oversampling (e.g., SMOTE) is used to balance minority classes in training datasets. Because EasyBiz AI relies on Retrieval-Augmented Generation (RAG)—which is an unsupervised, retrieval-based approach—traditional machine learning oversampling is **not applicable**. 

Instead, "dataset balance" in RAG refers to ensuring semantic coverage of business information. To achieve this:
* We ensure that the vector database has representation for every product, service, and FAQ by generating a minimum of one chunk per database entity.
* For long unstructured documents, we employ a **fixed-size sliding window chunking strategy** with **300 to 500 words per chunk** and a **10% (30-50 words) overlap**. The overlap ensures that sentences split across chunk boundaries do not lose context, mitigating the risk of retrieval gaps.

---

## 3.4 Feature Selection (Embedding Generation)
The "feature selection" stage in a RAG pipeline involves transforming clean text chunks into high-dimensional vector representations that capture semantic features:
1. **Google Gemini Embeddings**: The system uses `text-embedding-004` via the Google Gemini API as the primary model. This model outputs a 768-dimensional vector, encoding complex semantics, tone, and contextual relationships.
2. **Sentence Transformers (Fallback/Local)**: For offline execution and cost-saving development runs, the system integrates the `all-MiniLM-L6-v2` model. This model runs locally on the CPU, mapping chunks to a 384-dimensional space.

The resulting vector represents the dense semantic features of the chunk, which is then stored in the vector database index.

---

## 3.5 Experimental Setup

### 3.5.1 General Overview of Modelling Architecture
The system architecture of EasyBiz AI is divided into frontend, backend, and data storage layers, deployed via containerized orchestration (Docker Compose):

```text
       [ Next.js Frontend App Router (Merchant Dashboard & Web Chat UI) ]
                                      │
                                      ▼ (REST API / JSON)
               [ FastAPI Backend Application (Python 3.11) ]
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
[ SQLite/PostgreSQL Relational DB ]  [ Local FAISS Vector DB ]  [ Local Uploads Directory ]
(Auth, Products, FAQs, Sessions)     (Separated Index Files)    (Raw PDF & DOCX Files)
```

The FastAPI backend uses the SQLAlchemy ORM. The relational database handles persistent operational records and authentication, while the local FAISS indices manage semantic vector searches.

### 3.5.2 Modelling Approach
The EasyBiz AI modelling flow operates through two main pipelines:

#### A. The Indexing Pipeline
When a merchant updates their business details or uploads a document, the system triggers the indexing pipeline:
1. Fetch all products, services, FAQs, and documents from the SQL database for the given `business_id`.
2. Convert and clean all records into text chunks.
3. Generate embeddings using the active provider (Gemini or Sentence Transformers).
4. Build a local FAISS index specifically for that business, storing the index files (`index.faiss` and `index.pkl`) inside `vector_indices/{business_id}/` on the local disk.

#### B. The Retrieval and Generation Pipeline
When a customer sends a message:
1. The backend loads the specific FAISS index for that `business_id`.
2. The user's query is embedded using the same embedding provider.
3. The FAISS database performs a similarity search, returning the top $K$ (configured to $K=3$) matching chunks and their similarity scores.
4. **Confidence Threshold Parser**:
   * If the maximum similarity score is below the confidence threshold (e.g., `score < 0.50`), the query is flagged as low confidence. The system bypasses LLM generation, returns a configured fallback response ("I'm sorry, I don't have enough information about that."), and opens a human representative escalation ticket.
   * If `score >= 0.50`, the chunks are concatenated into a system context block.
5. **Prompt Injection & LLM Orchestration**:
   * The context is combined with a system prompt that mandates strict grounding.
   * The prompt is sent to the LLM (e.g., `gemini-1.5-flash`), which generates the final customer response.

### 3.5.3 Training, Validation and Testing
Since RAG does not involve model training in the traditional sense, validation and testing were conducted via:
1. **Automated Integration Tests**:
   * `test_auth.py`: Verifies JWT authentication and registration.
   * `test_business.py`: Tests profile CRUD operations.
   * `test_products_services.py`: Assesses inventory data processing.
   * `test_faqs.py`: Evaluates bulk FAQ uploads.
   * `test_phase14.py`: Tests the WhatsApp webhook endpoint simulator.
2. **End-to-End Flow Tests**:
   * `test_manual_flows.py` programmatically runs user flows, including adding products, indexing, asking questions, evaluating low-confidence fallbacks, and checking human handoff escalation status.

### 3.5.4 Evaluation of Models
The RAG pipeline is evaluated using a dedicated module (`evaluate_ai.py`). The evaluation dataset comprises 7 test queries directed at the "MelTech Computers" index:
* **Retrieval queries (5)**: Testing information extraction regarding product categories, specific pricing, service details, and warranty durations.
* **Out-of-Domain query (1)**: Testing low-confidence fallback trigger ("What is the capital of Ghana?").
* **Explicit Handoff query (1)**: Testing manual escalation trigger ("I want to talk to a human").

The evaluation script calculates five performance metrics:
$$\text{Response Accuracy \%} = \left( \frac{\text{Passed Questions}}{\text{Total Questions}} \right) \times 100$$
$$\text{Average Retrieval Score} = \frac{1}{N} \sum_{i=1}^N \text{Similarity Score}_i$$
$$\text{Average Response Time} = \frac{1}{N} \sum_{i=1}^N \text{Latency}_i$$
$$\text{Hallucination Rate \%} = \left( \frac{\text{Out of Domain Queries Answered Confidently}}{\text{Total Out of Domain Queries}} \right) \times 100$$
$$\text{Human Handoff Correctness \%} = \left( \frac{\text{Correct Escalations}}{\text{Total Escalation Queries}} \right) \times 100$$

### 3.5.5 Statistical Tests
For confidence score threshold tuning, experiments were run by varying the confidence threshold parameter ($\tau$) from 0.30 to 0.70 in increments of 0.10. 
* A threshold that is too low ($\tau < 0.40$) leads to high response rates but increases the risk of hallucination on unrelated queries.
* A threshold that is too high ($\tau > 0.65$) causes the system to reject valid business queries and trigger unnecessary human escalations.
Based on empirical testing, $\tau = 0.50$ was selected as the optimal threshold, providing a balance between high response accuracy and zero hallucination.
