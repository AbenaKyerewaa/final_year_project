# CHAPTER TWO: LITERATURE REVIEW

## 2.1 Conversational AI and Customer Service
Conversational Artificial Intelligence (AI) has undergone a rapid evolution over the past two decades. Early implementations of conversational agents, commonly referred to as chatbots, relied on rule-based decision trees and pattern matching. These systems operated on hardcoded templates and regular expressions; if a customer’s query did not match a predefined pattern exactly, the chatbot would fail, returning a generic error message. While these rule-based chatbots were highly predictable, they were severely limited in handling linguistic variation, synonyms, or complex multi-turn dialogue.

The second generation of chatbots incorporated Natural Language Processing (NLP) and intent-classification frameworks (such as Dialogflow, Rasa, and Microsoft LUIS). These systems used machine learning to map user queries to specific "intents" and extract "entities." While intent-based bots represented a major advancement, they required extensive manual training data and setup, making them complex to maintain for small businesses.

The introduction of the Transformer architecture by Vaswani et al. (2017) and the subsequent rise of Large Language Models (LLMs) like GPT-4, Claude, and Google Gemini marked a paradigm shift in conversational AI. LLMs are trained on vast corpora of text, allowing them to understand context, generate fluent natural language, and manage open-ended, multi-turn conversations without manual intent mapping.

In the context of customer service, Generative AI enables businesses to automate complex interactions that were previously impossible for chatbots to handle, such as drafting personalized email replies, parsing unstructured questions, and reasoning through multi-step support tickets. However, in enterprise and SME customer support applications, deploying vanilla LLMs directly introduces significant challenges:
1. **Knowledge Cutoffs**: LLMs are static and cannot access real-time information (e.g., whether a specific product is in stock today).
2. **Hallucinations**: LLMs are optimized for fluency, not strict factual accuracy. When asked about unknown information, they often generate false facts.
3. **Data Security**: Sending proprietary business or customer information directly to public APIs can raise compliance and privacy concerns.

To safely harness the power of LLMs for customer service, researchers and engineers developed Retrieval-Augmented Generation.

---

## 2.2 Retrieval-Augmented Generation (RAG)
Retrieval-Augmented Generation (RAG) is an architectural pattern first proposed by Lewis et al. (2020) that combines retrieval-based models with generative models. Instead of relying solely on the static parametric memory of the LLM to generate an answer, a RAG system first retrieves relevant documents or information snippets from an external knowledge source (non-parametric memory) based on the user's query. It then compiles the retrieved snippets along with the user's query into a prompt template, which is sent to the LLM to synthesize a factually grounded response.

### 2.2.1 RAG vs. Fine-Tuning
When customizing an LLM for a specific business domain, developers typically choose between RAG and fine-tuning. 

| Dimension | Retrieval-Augmented Generation (RAG) | Fine-Tuning |
| :--- | :--- | :--- |
| **Knowledge Updates** | Dynamically updates by editing the vector database (instantaneous). | Requires retraining the model on new data (time-consuming and expensive). |
| **Factual Accuracy** | High. The model is constrained to retrieved text, reducing hallucinations. | Moderate. The model may still hallucinate facts learned during training. |
| **Implementation Cost** | Low. Uses off-the-shelf LLMs and a separate vector database. | High. Requires GPU resources, structured training pairs, and ML expertise. |
| **Traceability** | High. Responses can be traced back to the specific retrieved source chunks. | Low. The knowledge is baked into the model's weights (black-box). |
| **Data Isolation** | Easy. Can filter vectors by tenant ID at query time. | Difficult. Hard to prevent data leakage between tenants in a single model. |

For Ghanaian SMEs, where inventory, pricing, and services change frequently, fine-tuning is impractical. RAG provides a cost-effective, auditable, and dynamically updatable solution that guarantees data isolation in multi-tenant environments.

> [!NOTE]
> **[USER INPUT REQUIRED]**: You can add your own analysis or supervisor-recommended comparisons between RAG and fine-tuning here, focusing on the cost barriers of GPUs for African developers.

---

## 2.3 Vector Embeddings and Indexing
The core of any RAG system is the representation of text as vector embeddings. An embedding model (such as Google’s `text-embedding-004` or the open-source `all-MiniLM-L6-v2`) converts a text string into a high-dimensional vector of real numbers (typically ranging from 384 to 1536 dimensions). 

These vectors represent the semantic meaning of the text. Words or phrases with similar semantic meaning are mapped close together in the vector space, regardless of spelling or word choice. For instance, the queries "How much is this?" and "What is the price?" will have a high cosine similarity score because their underlying intent is identical.

### 2.3.1 Similarity Metrics
Vector search engines compare the user's query embedding ($q$) to stored document chunk embeddings ($d$) using distance metrics:
1. **Cosine Similarity**: Measures the cosine of the angle between two vectors, focusing on direction rather than magnitude.
   $$\text{Cosine Similarity}(q, d) = \frac{q \cdot d}{\|q\| \|d\|}$$
2. **Inner Product (IP)**: Commonly used for normalized embeddings, representing the dot product.
3. **Euclidean Distance (L2)**: Measures the straight-line distance between two points in Euclidean space.

### 2.3.2 Vector Databases (FAISS vs. ChromaDB)
To perform similarity searches at scale, RAG systems utilize specialized vector databases. Two prominent options are:
* **ChromaDB**: An open-source, developer-friendly vector database built on top of SQLite and ClickHouse, designed for easy local prototyping and embedding integration.
* **FAISS (Facebook AI Similarity Search)**: Developed by Meta, FAISS is an extremely fast library optimized for dense vector clustering and similarity search. It offers efficient implementations of IndexFlatIP (Inner Product) and HNSW (Hierarchical Navigable Small World) algorithms, making it ideal for memory-efficient local deployment on standard CPU or GPU hardware.

In EasyBiz AI, FAISS is used to manage local business vector stores, enabling rapid metadata-filtered retrieval partitioned by business ID.

---

## 2.4 Voice Processing (STT)
In developing countries, conversational systems must account for diverse user interactions, including voice notes. Speech-to-Text (STT) models convert spoken audio into written text. 

A major milestone in open-source STT is OpenAI’s **Whisper** (Radford et al., 2022). Whisper is a multi-task, sequence-to-sequence model trained on 680,000 hours of multilingual and multitask web data. It achieves high robustness to background noise, accents, and colloquial phrasing, making it highly effective for transcribing Ghanaian English and local dialects spoken with a Ghanaian accent.

By integrating Whisper, conversational interfaces can transcribe voice queries into text, feed them into the RAG pipeline, and generate text-based or speech-based answers. This technology is critical for expanding digital accessibility to users who prefer spoken communication.

---

## 2.5 SME Business Environment in Ghana
The digitalization of Ghanaian SMEs has occurred largely through informal channels. Rather than building custom websites or e-commerce platforms, merchants utilize WhatsApp Business, Facebook, and Instagram to run their operations. This phenomenon, known as **Conversational Commerce**, is highly popular due to:
* Low data usage requirements.
* Familiarity with social media interfaces.
* The direct, relationship-based nature of transaction negotiation.

Transactions are usually completed using **Mobile Money (MoMo)**, operated by telecommunications providers (MTN, Telecel, AT), rather than traditional credit cards.

However, conversational commerce introduces significant overhead. Merchants are overwhelmed by repetitive queries, and since many run their businesses alone or with minimal staff, they cannot maintain 24/7 responsiveness. Additionally, language barriers (many customers speak Twi, Ga, or Fante) and varying literacy levels mean that rigid, English-only text interfaces exclude a substantial portion of the consumer base.

Therefore, an AI customer support assistant tailored for Ghana must be low-cost, support conversational commerce channels (specifically WhatsApp), process local accents/voice inputs, and enforce strict safety guardrails (especially for pharmacies and schools) to prevent customer disputes. EasyBiz AI fills this gap by combining modular RAG architectures with localized design constraints.

> [!NOTE]
> **[USER INPUT REQUIRED]**: Insert additional citations, academic papers, or local statistics on Ghanaian internet penetration, mobile money transaction volume, or SME challenges here to enrich this section.
