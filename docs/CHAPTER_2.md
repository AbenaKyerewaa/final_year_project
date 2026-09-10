# CHAPTER TWO: LITERATURE REVIEW

## 2.1 Conversational AI and Customer Service
Conversational Artificial Intelligence (AI) has undergone a rapid evolution over the past two decades. Early implementations of conversational agents, commonly referred to as chatbots, relied on rule-based decision trees and pattern matching. These systems operated on hardcoded templates and regular expressions; if a customer’s query did not match a predefined pattern exactly, the chatbot would fail, returning a generic error message. While these rule-based chatbots were highly predictable, they were severely limited in handling linguistic variation, synonyms, or complex multi-turn dialogue.

The second generation of chatbots incorporated Natural Language Processing (NLP) and intent-classification frameworks (such as Dialogflow, Rasa, and Microsoft LUIS). These systems used machine learning to map user queries to specific "intents" and extract "entities." While intent-based bots represented a major advancement, they required extensive manual training data, intent definition, and ongoing maintenance, making them impractical and unaffordable for small businesses.

The introduction of the Transformer architecture by Vaswani et al. (2017) and the subsequent rise of Large Language Models (LLMs) like GPT-4, Claude, and Google Gemini marked a paradigm shift in conversational AI. LLMs are trained on vast corpora of text, allowing them to understand context, generate fluent natural language, and manage open-ended, multi-turn conversations without manual intent mapping.

In the context of customer service, Generative AI enables businesses to automate complex interactions that were previously impossible for chatbots to handle, such as drafting personalized replies, parsing unstructured inquiries, and reasoning through multi-step customer inquiries. However, in enterprise and SME customer support applications, deploying vanilla LLMs directly introduces significant challenges:
1. **Knowledge Cutoffs**: LLMs are static and cannot access real-time or private information (e.g., whether a specific product is currently in stock or what today's promotional price is).
2. **Hallucinations**: LLMs are optimized for linguistic fluency and probabilistic token generation, not strict factual verification. When asked about domain-specific or unknown information, they frequently generate plausible-sounding falsehoods.
3. **Data Security and Multi-Tenancy**: Sending proprietary business or customer information directly to public APIs without isolation can raise compliance, privacy, and data leakage concerns.

To safely harness the power of LLMs for customer service, modern architectures employ Retrieval-Augmented Generation.

---

## 2.2 Retrieval-Augmented Generation (RAG)
Retrieval-Augmented Generation (RAG) is an architectural pattern first proposed by Lewis et al. (2020) that combines retrieval-based models with generative models. Instead of relying solely on the static parametric memory of the LLM to generate an answer, a RAG system first retrieves relevant documents or information snippets from an external knowledge source (non-parametric memory) based on the user's query. It then compiles the retrieved snippets along with the user's query into a prompt template, which is sent to the LLM to synthesize a factually grounded response.

### 2.2.1 RAG vs. Fine-Tuning
When customizing an LLM for a specific business domain, developers typically choose between RAG and fine-tuning. 

| Dimension | Retrieval-Augmented Generation (RAG) | Fine-Tuning |
| :--- | :--- | :--- |
| **Knowledge Updates** | Dynamically updates by editing the database or vector store (instantaneous). | Requires retraining the model on new data (time-consuming and expensive). |
| **Factual Accuracy** | High. The model is constrained to retrieved text, reducing hallucinations. | Moderate. The model may still hallucinate facts learned during pre-training. |
| **Implementation Cost** | Low. Uses off-the-shelf LLMs and a separate vector database. | High. Requires GPU clusters, structured training pairs, and ML engineering. |
| **Traceability** | High. Responses can be traced back to the specific retrieved source chunks. | Low. The knowledge is baked into the model's weights (black-box). |
| **Data Isolation** | Easy. Can filter vectors by tenant ID at query time or use separate index files. | Difficult. Hard to prevent data leakage between tenants in a shared model. |

For Ghanaian SMEs, where inventory, pricing, and services change frequently, fine-tuning is impractical. RAG provides a cost-effective, auditable, and dynamically updatable solution that guarantees data isolation in multi-tenant environments.

> [!NOTE]
> **[USER INPUT REQUIRED]**: You can add your own analysis or supervisor-recommended comparisons between RAG and fine-tuning here, focusing on the cost barriers of GPUs for African developers.

---

## 2.3 Vector Embeddings and Indexing
The foundation of semantic search in a RAG system is the representation of text as dense vector embeddings. An embedding model (such as Google’s `text-embedding-004` or the open-source `all-MiniLM-L6-v2`) converts a text string into a high-dimensional vector of real numbers (typically ranging from 384 to 1536 dimensions). 

These vectors capture the semantic meaning of the text. Words or phrases with similar semantic meaning are mapped close together in the vector space, regardless of lexical variation or surface phrasing. For instance, the queries "How much is this?" and "What is the price?" will have a high cosine similarity score because their underlying intent is identical.

### 2.3.1 Similarity Metrics
Vector search engines compare the user's query embedding ($q$) to stored document chunk embeddings ($d$) using distance metrics:
1. **Cosine Similarity**: Measures the cosine of the angle between two vectors, focusing on direction rather than magnitude:
   $$\text{Cosine Similarity}(q, d) = \frac{q \cdot d}{\|q\| \|d\|}$$
2. **Inner Product (IP)**: Commonly used for unit-normalized embeddings, representing the dot product where higher values denote greater alignment.
3. **Euclidean Distance (L2)**: Measures the straight-line distance between two points in Euclidean space:
   $$\text{Distance}(q, d) = \sqrt{\sum_{i=1}^n (q_i - d_i)^2}$$

### 2.3.2 Vector Databases (FAISS vs. ChromaDB)
To perform similarity searches at scale, RAG systems utilize specialized vector databases:
* **ChromaDB**: An open-source, developer-friendly embedding database built with SQLite and ClickHouse, designed for rapid local prototyping and metadata-filtered vector searches.
* **FAISS (Facebook AI Similarity Search)**: Developed by Meta, FAISS is an extremely fast library optimized for dense vector clustering and similarity search. It offers efficient implementations of IndexFlatIP (Inner Product) and HNSW (Hierarchical Navigable Small World) algorithms, making it ideal for memory-efficient local deployment on standard CPU or GPU hardware.

In EasyBiz AI, FAISS is employed to manage local business vector stores, enabling rapid metadata-filtered retrieval partitioned by business ID into separate on-disk indices.

---

## 2.4 Conversational Messaging and Webhook Architectures
In conversational commerce, user interactions occur across distributed messaging channels rather than centralized web forms. To support real-world business communications, conversational systems must integrate with external messaging platforms using asynchronous webhook event models.

### 2.4.1 Webhook-Driven Messaging Architectures
Modern enterprise messaging networks, such as the Meta WhatsApp Cloud API, utilize HTTP POST webhooks to deliver incoming message events to application backends:
1. **Verification Phase**: Upon configuring a webhook URL, the messaging server issues a challenge request (`hub.verify_token`, `hub.challenge`). The backend must validate the shared secret and echo back the challenge.
2. **Event Payload Processing**: When a customer sends a text message, the platform delivers a JSON webhook payload containing the sender's phone number, message text, timestamp, and message ID.
3. **Asynchronous Response Delivery**: The backend processes the incoming message through its business logic and issues an outbound HTTP request to the messaging API endpoint to deliver the assistant's reply.

### 2.4.2 Multi-Turn Dialogue and Session State
Customer inquiries in conversational commerce are rarely isolated. A customer often asks a sequence of interrelated questions (e.g., "Do you have HP laptops?", followed by "How much is it?", and then "Does it come with a bag?"). 
* **State Tracking**: Because REST APIs and webhooks are inherently stateless, conversational systems must persist session tokens, sender identifiers, and conversation history in a relational database.
* **Context Condensation**: To prevent the retrieval engine from failing on pronoun-heavy queries ("How much is it?"), the system must perform multi-turn context condensation—rewriting the follow-up question into a standalone semantic query before executing vector search.

### 2.4.3 Multi-Tenant Isolation in Messaging
When multiple business owners share a single backend platform, strict tenant isolation is required:
* Incoming webhooks must route to the specific merchant's knowledge base based on the target business identifier or assigned phone number.
* Vector indices, relational records, and conversation histories must be strictly partitioned to prevent accidental data leaks between rival merchants.

---

## 2.5 SME Business Environment in Ghana
The digitalization of Ghanaian SMEs has occurred largely through informal channels. Rather than building custom e-commerce websites or adopting complex enterprise resource planning (ERP) tools, merchants rely predominantly on **Conversational Commerce** conducted via WhatsApp Business, Instagram, and Facebook. This paradigm is favored due to:
* Low data usage and widespread adoption of social media apps.
* Widespread consumer familiarity with instant messaging interfaces.
* The direct, relationship-driven nature of price negotiations and product inquiries in Ghanaian commerce.

Transactions are usually concluded using **Mobile Money (MoMo)**, operated by telecommunication providers (MTN, Telecel, AT), which has achieved near-ubiquitous adoption across urban and rural markets.

However, conversational commerce introduces severe operational overhead. Merchants are overwhelmed by repetitive customer inquiries regarding location, pricing, availability, and delivery fees. Because most small businesses operate with solo entrepreneurs or small family teams, they cannot maintain 24/7 responsiveness. Delayed responses—particularly in the evening or during peak sales hours—lead directly to abandoned customer carts and lost revenue.

Furthermore, business data is heavily fragmented across phone galleries, notes, and chat threads. When an automated conversational assistant is introduced, it must be zero-code, low-cost, strictly bounded to factual merchant data, and capable of operating across both public web chat and WhatsApp text messages. EasyBiz AI directly addresses this economic need by providing a context-bounded, multi-tenant conversational platform tailored to the reality of Ghanaian SMEs.

> [!NOTE]
> **[USER INPUT REQUIRED]**: Insert additional citations, academic papers, or local statistics on Ghanaian internet penetration, mobile money transaction volume, or SME challenges here to enrich this section.

---

## 2.6 Human-in-the-Loop (HITL) and The Chatbot Bypass Dilemma
While automated conversational agents can resolve a substantial majority of routine, informational queries, complete autonomy in commercial customer support is neither feasible nor desirable. In real-world enterprise environments, automated agents inevitably encounter low-confidence retrieval states, complex customized order negotiations, or subjective customer complaints that necessitate human judgment. Consequently, modern software architectures incorporate **Human-in-the-Loop (HITL)** paradigms to bridge the gap between machine efficiency and human expertise (Wang et al., 2022).

### 2.6.1 The Chatbot Bypass Dilemma (Conversational Disintermediation)
A prevalent design failure in conversational customer service is the **Chatbot Bypass Dilemma**, also known as conversational disintermediation (Følstad & Brandtzæg, 2017). When an automated bot fails to answer a customer question and simply responds by exposing the business owner's personal telephone number or direct contact handle, customers immediately save the direct number. In subsequent interactions, customers bypass the conversational assistant entirely—even for basic inquiries such as operating hours or product prices—and revert to calling or messaging the owner directly. 

This disintermediation directly undermines the primary purpose of deploying an AI assistant: relieving the merchant of repetitive operational overhead. For Ghanaian micro-enterprises with solo founders, direct customer calling results in severe context switching, fragmented order records, and operational burnout.

### 2.6.2 Tiered Asynchronous Escalation and Lead Capture
To resolve the bypass trap without stranding the customer, contemporary customer support architectures employ a **tiered, asynchronous escalation framework**:
1. **In-Platform Handoff**: Rather than passively refusing to answer or exposing raw private contact numbers, the automated assistant explicitly informs the customer that their inquiry has been escalated to management and keeps the customer inside the same chat session for a representative response.
2. **Out-of-Band Real-Time Notifications**: Small business owners do not maintain constant surveillance over administrative web portals. To eliminate lead response latency, the backend triggers asynchronous out-of-band notification events (such as formatted transactional emails or SMS alerts) directly to the merchant's personal device, encapsulating the customer's query, contact details, and session deep link.
3. **One-Click Merchant Resolution**: Upon receiving the notification, the merchant can review the conversation transcript and either execute a one-click response via official messaging channels (e.g., deep linking into WhatsApp with pre-filled context) or reply through the web console as an authenticated representative.

This architectural pattern preserves the AI assistant as the primary operational shield while guaranteeing that high-value sales leads and edge cases receive prompt, high-touch human attention.
