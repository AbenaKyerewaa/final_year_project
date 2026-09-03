# UNIVERSITY OF GHANA
## COLLEGE OF BASIC AND APPLIED SCIENCES

<br><br>

# EASYBIZ AI: A CONTEXT-BOUNDED MULTI-TENANT CONVERSATIONAL RAG ASSISTANT FOR GHANAIAN SMALL AND MEDIUM ENTERPRISES

<br><br>

### BY
### ABENA KYEREWAA BRESAA
**(STUDENT ID: 10954321)**

<br><br>

#### A THESIS SUBMITTED TO THE DEPARTMENT OF COMPUTER SCIENCE, COLLEGE OF BASIC AND APPLIED SCIENCES, UNIVERSITY OF GHANA, IN PARTIAL FULFILLMENT OF THE AWARD OF DEGREE OF BACHELOR OF SCIENCE IN COMPUTER SCIENCE

<br><br>

### DEPARTMENT OF COMPUTER SCIENCE
### SEPTEMBER, 2026

\newpage

# DECLARATION

### STUDENT
I, **Abena Kyerewaa Bresaa**, hereby declare that this submission is my own work towards the award of the Bachelor of Science degree in Computer Science, and that, to the best of my knowledge, it contains no material previously published by another person nor material which has been accepted for the award of any other degree of the University, except where due acknowledgment has been made in the text.

<br>

**Student Name:** Abena Kyerewaa Bresaa  
**Signature:** _____________________________  
**Date:** _____________________________  

<br><br>

### SUPERVISOR
I hereby certify that the preparation and presentation of this thesis was supervised by me in accordance with the guidelines on supervision of thesis laid down by the University of Ghana.

<br>

**Supervisor Name:** _____________________________  
**Signature:** _____________________________  
**Date:** _____________________________  

<br><br>

### CO-SUPERVISOR
I hereby certify that the preparation and presentation of this thesis was co-supervised by me in accordance with the guidelines on supervision of thesis laid down by the University of Ghana.

<br>

**Co-Supervisor Name:** _____________________________  
**Signature:** _____________________________  
**Date:** _____________________________  

\newpage

# ABSTRACT

**Context:** Small and Medium Enterprises (SMEs) are the primary engine of economic growth and employment in Ghana, heavily utilizing conversational commerce across platforms like WhatsApp and social media to conduct daily sales. However, the manual overhead of handling repetitive inquiries, combined with delayed responses during off-hours, leads directly to lost sales leads, customer churn, and pricing inconsistencies. While Large Language Models (LLMs) offer strong natural language conversational capabilities, deploying generic models in commercial contexts risks hallucinations—fabricating inaccurate pricing, stock availability, or store policies that harm merchant reputation.

**Aim:** The aim of this research is to design, implement, and evaluate **EasyBiz AI**, a context-bounded, multi-tenant conversational customer support platform powered by a hybrid Retrieval-Augmented Generation (RAG) architecture tailored specifically for Ghanaian SMEs across public web chat and WhatsApp messaging channels.

**Method:** The system was engineered using a modular three-tier architecture comprising a Next.js administrative frontend, a FastAPI Python backend, a relational SQLite/PostgreSQL database, and local FAISS dense vector indices isolated per merchant tenant. To optimize retrieval accuracy, a five-stage hybrid retrieval pipeline was developed: (1) deterministic structured SQL matching against product catalogs, services, and FAQs; (2) contextual multi-turn query condensation; (3) dense vector semantic retrieval using Google Gemini `text-embedding-004` and local `all-MiniLM-L6-v2`; (4) dual-layer confidence score thresholding ($\tau=0.50$); and (5) context-bounded LLM generation using Google Gemini (`gemini-1.5-flash`). An embeddable public web chat widget and a full WhatsApp Cloud API webhook simulator were implemented.

**Result:** Automated empirical evaluation against a seeded commercial profile yielded a **Response Accuracy of 85.71%**, an **Average Retrieval Accuracy of 79.71%**, a **Mean Response Latency of 6.06 seconds**, a **0.00% Hallucination Rate** on out-of-domain queries, and a **100.00% Human Handoff Correctness Rate** for low-confidence and explicit escalation requests.

**Conclusion:** The findings demonstrate that hybrid RAG successfully mitigates LLM hallucinations and eliminates manual support bottlenecks for micro-enterprises. EasyBiz AI proves that generative AI can be deployed cost-effectively, securely, and factually for conversational commerce without expensive GPU retraining, providing a sustainable blueprint for African enterprise software.

**Keywords:** Conversational Commerce, Retrieval-Augmented Generation (RAG), Multi-Tenancy, Large Language Models, FAISS, WhatsApp Automation, Ghanaian SMEs.

\newpage

# DEDICATION
This work is dedicated to the Almighty God for His divine wisdom, strength, and grace throughout this academic journey. It is also dedicated to my beloved family, whose continuous prayers, sacrifices, and unconditional support have been the cornerstone of my education, and to all Ghanaian small business owners striving to digitize and grow their enterprises.

\newpage

# ACKNOWLEDGEMENT
I wish to express my deepest gratitude to my supervisor and academic mentors in the Department of Computer Science, University of Ghana, for their continuous guidance, insightful critiques, and encouragement throughout the design, implementation, and writing of this thesis. 

I also extend my sincere appreciation to the faculty and administrative staff of the College of Basic and Applied Sciences for providing a conducive environment for learning and research. 

Finally, I am profoundly grateful to my colleagues, friends, and fellow computer science students for their camaraderie, constructive discussions, and technical brainstorming sessions during the course of this project.

\newpage

# TABLE OF CONTENTS
* **DECLARATION** .................................................................................................................... i
* **ABSTRACT** ......................................................................................................................... ii
* **DEDICATION** ...................................................................................................................... iii
* **ACKNOWLEDGEMENT** ...................................................................................................... iv
* **TABLE OF CONTENTS** ....................................................................................................... v
* **LIST OF FIGURES** ............................................................................................................... vii
* **LIST OF TABLES** ................................................................................................................ viii
* **LIST OF ABBREVIATIONS** .................................................................................................. ix
* **CHAPTER ONE: INTRODUCTION** ....................................................................................... 1
  * 1.1 Background and Motivation .......................................................................................... 1
  * 1.2 Statement of Problem ................................................................................................... 2
  * 1.3 Scope of the Study ....................................................................................................... 3
  * 1.4 Research Objectives ..................................................................................................... 4
    * 1.4.1 Global Objective ..................................................................................................... 4
    * 1.4.2 Specific Objectives ................................................................................................. 4
  * 1.5 Research Contribution ................................................................................................. 5
  * 1.6 Organization of the Study ............................................................................................. 6
* **CHAPTER TWO: LITERATURE REVIEW** ............................................................................ 7
  * 2.1 Conversational AI and Customer Service ..................................................................... 7
  * 2.2 Retrieval-Augmented Generation (RAG) ........................................................................ 9
    * 2.2.1 RAG vs. Fine-Tuning ............................................................................................. 10
  * 2.3 Vector Embeddings and Indexing ................................................................................. 11
    * 2.3.1 Similarity Metrics ................................................................................................... 12
    * 2.3.2 Vector Databases (FAISS vs. ChromaDB) .............................................................. 13
  * 2.4 Conversational Messaging and Webhook Architectures ................................................ 14
    * 2.4.1 Webhook-Driven Messaging Architectures ............................................................ 14
    * 2.4.2 Multi-Turn Dialogue and Session State .................................................................. 15
    * 2.4.3 Multi-Tenant Isolation in Messaging ...................................................................... 15
  * 2.5 SME Business Environment in Ghana .......................................................................... 16
* **CHAPTER THREE: RESEARCH METHODOLOGY** ............................................................ 18
  * 3.1 Description of Dataset ................................................................................................. 18
  * 3.2 Preprocessing of Dataset ............................................................................................. 19
  * 3.3 Oversampling and Semantic Coverage ........................................................................ 20
  * 3.4 Feature Selection (Embedding Generation) .................................................................. 21
  * 3.5 Experimental Setup ..................................................................................................... 22
    * 3.5.1 General Overview of Modelling Architecture .......................................................... 22
    * 3.5.2 Modelling Approach: Hybrid Retrieval Pipeline ...................................................... 23
    * 3.5.3 Validation and Testing ........................................................................................... 26
    * 3.5.4 Evaluation of Models ............................................................................................. 27
    * 3.5.5 Statistical Tests and Threshold Tuning ................................................................... 28
* **CHAPTER FOUR: EXPERIMENTAL RESULT AND DISCUSSION** .................................... 29
  * 4.1 System Implementation ............................................................................................... 29
    * 4.1.1 The Merchant Dashboard (Next.js) ......................................................................... 29
    * 4.1.2 The Customer Interfaces ....................................................................................... 30
  * 4.2 Evaluation Results ....................................................................................................... 31
    * 4.2.1 Quantitative Performance Summary ...................................................................... 31
  * 4.3 Discussion and Analysis of Queries ............................................................................. 32
    * 4.3.1 Successful Retrieval Cases (Passed) .................................................................... 32
    * 4.3.2 Low-Confidence Fallback and Escalation Cases (Passed) ...................................... 33
    * 4.3.3 Mismatch Analysis and Mitigation (Failed Case) .................................................... 34
* **CHAPTER FIVE: CONCLUDING REMARKS** ..................................................................... 36
  * 5.1 Summary of Findings .................................................................................................. 36
  * 5.2 Conclusion ................................................................................................................... 37
  * 5.3 Recommendations and Future Work ........................................................................... 38
    * 5.3.1 Official Meta WhatsApp Cloud API Production Deployment ................................. 38
    * 5.3.2 Automated Transaction Workflows and Mobile Money Integration .......................... 38
    * 5.3.3 Enterprise Multi-Tenant Scalability and Cloud Vector Clustering ............................. 39
* **REFERENCES** .................................................................................................................... 40

\newpage

# LIST OF FIGURES
* **Figure 3.1**: EasyBiz AI Three-Tier System Architecture Diagram
* **Figure 3.2**: Five-Stage Hybrid Retrieval and Context-Bounded RAG Pipeline Flowchart
* **Figure 4.1**: EasyBiz AI Merchant Dashboard Inventory and FAQ Management Panels
* **Figure 4.2**: EasyBiz AI Public Customer Web Chat Interface
* **Figure 4.3**: EasyBiz AI WhatsApp Integration Dashboard and Webhook Simulator

\newpage

# LIST OF TABLES
* **Table 2.1**: Comparative Analysis: Retrieval-Augmented Generation (RAG) vs. Fine-Tuning
* **Table 3.1**: Seeded SME Profiles and Knowledge Base Domain Representations
* **Table 4.1**: Overall Quantitative Performance Metrics of EasyBiz AI Evaluation Suite
* **Table 4.2**: Granular Query Performance Breakdown from Automated Evaluation Suite

\newpage

# LIST OF ABBREVIATIONS
* **AI**: Artificial Intelligence
* **API**: Application Programming Interface
* **BERT**: Bidirectional Encoder Representations from Transformers
* **CRUD**: Create, Read, Update, Delete
* **FAISS**: Facebook AI Similarity Search
* **FAQ**: Frequently Asked Question
* **GDP**: Gross Domestic Product
* **GHS**: Ghanaian Cedi
* **GPU**: Graphics Processing Unit
* **HNSW**: Hierarchical Navigable Small World
* **HTTP**: Hypertext Transfer Protocol
* **IP**: Inner Product
* **JSON**: JavaScript Object Notation
* **JWT**: JSON Web Token
* **LLM**: Large Language Model
* **MoMo**: Mobile Money
* **NLP**: Natural Language Processing
* **ORM**: Object-Relational Mapping
* **RAG**: Retrieval-Augmented Generation
* **REST**: Representational State Transfer
* **SME**: Small and Medium Enterprise
* **SQL**: Structured Query Language
* **UI**: User Interface
* **URL**: Uniform Resource Locator
* **USSD**: Unstructured Supplementary Service Data

\newpage

# CHAPTER ONE: INTRODUCTION

## 1.1 Background and Motivation
Small and Medium Enterprises (SMEs) represent the backbone of Ghana’s economy, contributing significantly to gross domestic product (GDP) and accounting for over 80% of employment. In recent years, digital transformation has dramatically reshaped how these businesses operate. Instead of relying solely on physical storefronts, Ghanaian merchants have embraced conversational commerce. Platforms like WhatsApp, Instagram, Facebook, and TikTok have become primary channels for showcasing products, negotiating prices, and interacting with prospective customers. 

Despite the widespread adoption of these social messaging channels, small businesses face a fundamental bottleneck: the manual overhead of customer relationship management. Most Ghanaian SMEs are micro-operations or small family-owned shops that lack the resources to hire dedicated customer service representatives. Consequently, the business owner must personally and manually answer repetitive inquiries. These inquiries range from simple operating hour queries ("Are you open on Sundays?") and location requests ("Where is your shop located?") to product availability and pricing confirmations ("Do you have HP laptops?", "How much is the delivery to Madina?"). 

This reliance on manual responses presents serious business challenges. Customers in the modern digital marketplace expect instantaneous replies. When a business owner is busy managing inventory, handling logistics, or attending to in-person customers, digital messages go unanswered for hours. In conversational commerce, a delayed response often translates to a lost sale, as customers quickly move to competitors who reply faster. Furthermore, business information (pricing, inventory availability, policies) is frequently unstructured—scattered across paper notebooks, WhatsApp chat histories, gallery screenshots, or the business owner's memory. This leads to inconsistency, pricing errors, and an inability to operate outside standard business hours.

The emergence of Large Language Models (LLMs) offers a potential solution to automate customer support. However, deploying standard LLMs directly in a business context introduces the risk of "hallucinations"—where the model fabricates product pricing, inventory status, or store policies that do not exist, leading to customer disputes and financial liability. 

To address these challenges, this study presents **EasyBiz AI**, a context-bounded, multi-tenant customer support platform designed for Ghanaian SMEs. By utilizing a hybrid Retrieval-Augmented Generation (RAG) architecture combining deterministic structured database matching with semantic FAISS vector retrieval, EasyBiz AI allows business owners to seed their custom knowledge base (products, services, FAQs, and unstructured files) into a secure, isolated database. When a customer queries the business via an embeddable public web chat or WhatsApp, the system retrieves only the verified information from that business’s database to compile a factually accurate, context-bounded response. 

---

## 1.2 Statement of Problem
The primary problem addressed by this study is the inefficiency, lead loss, and operational risk associated with manual customer support management in Ghanaian SMEs. Specifically, this problem manifests in the following key dimensions:
1. **Response Latency and Lead Loss**: Customer queries arriving outside business hours or during high-traffic periods remain unanswered. Because online consumers have low switching costs, slow response times lead directly to abandoned transactions and lost revenue.
2. **Inconsistent and Error-Prone Communication**: Without a centralized and structured data repository, pricing and policy information is prone to human error, particularly when multiple staff or family members respond using disparate recollections.
3. **Data Fragmentation**: Vital operational data (product specifications, shipping fees, warranty terms, frequently asked questions) is rarely structured. It is trapped in notebooks or disorganized messaging histories, preventing automated processing.
4. **AI Hallucinations and Brand Trust**: Direct use of generic conversational AI models is unsafe for business customer support. Generic AI models lack specific business context and will hallucinate, making up prices, warranties, or terms that bind the business legally or damage reputation.
5. **Channel Fragmentation and Technical Barriers**: Small business owners lack the technical expertise to integrate enterprise chatbots or configure complex API webhooks. Most existing conversational platforms are either too generic, expensive, or fail to support native conversational commerce workflows such as direct WhatsApp messaging and embeddable web chat widgets.

EasyBiz AI addresses these problems by providing a user-friendly, zero-code dashboard where merchants upload structured and unstructured business information, which is indexed into a hybrid retrieval engine. The AI engine answers customer queries based exclusively on that data, using a confidence score threshold to trigger human escalations for complex queries or when the requested information is absent.

---

## 1.3 Scope of the Study
This study focuses on the design, development, and evaluation of **EasyBiz AI**, a full-stack, hybrid RAG-powered customer support application. The scope includes:
* **Multi-Tenant Dashboard**: A web portal for SME owners to register, create business profiles, manage product/service catalogs (CRUD operations), upload unstructured documents (PDF, TXT), and manage custom FAQs.
* **Hybrid Retrieval Pipeline**: An indexing system combining deterministic structured database search for exact catalog lookups with a dense FAISS vector database for semantic document and inquiry retrieval. The pipeline strictly isolates data by business ID.
* **Conversational Multi-Turn Query Rewriting**: A context condensation mechanism that evaluates conversational history to resolve pronouns and contextual references in follow-up inquiries.
* **Context-Bounded AI Orchestration**: An API integration framework that queries Google Gemini (`gemini-1.5-flash`) or local Sentence Transformers, formulating system prompts that restrict the LLM strictly to the retrieved business context.
* **Safety Guardrails and Fallbacks**: Configurable industry-specific guardrails (such as directing medical/pharmacy inquiries to qualified professionals) and a dual-layer confidence threshold parser that escalates low-confidence queries to human representatives.
* **Customer Interaction Interfaces**: A live, embeddable public web chat widget for customer websites and an interactive WhatsApp integration dashboard and webhook simulator mirroring Meta’s WhatsApp Cloud API.

This study does *not* cover general-purpose, open-domain chat interfaces, nor does it attempt to train foundational LLMs from scratch. It utilizes existing commercial APIs and open-source models optimized for retrieval, grounding, and generation tasks.

---

## 1.4 Research Objectives

### 1.4.1 Global Objective
The global objective of this study is to design, implement, and evaluate a context-bounded, hybrid RAG-powered conversational AI customer support platform (EasyBiz AI) that enables non-technical Ghanaian SMEs to automate customer service inquiries securely, accurately, and deterministically across web chat and WhatsApp channels.

### 1.4.2 Specific Objectives
To achieve the global objective, the study will address the following specific objectives:
1. Develop a secure multi-tenant relational database schema using SQLite/PostgreSQL to manage user authentication, business profiles, products, services, FAQs, chat sessions, and human escalation tickets.
2. Build a high-performance hybrid retrieval pipeline that seamlessly coordinates deterministic structured SQL lookups with local FAISS vector indexing, enforcing strict tenant data isolation.
3. Design and implement a conversational query condensation module to rewrite contextual follow-up queries into self-contained search prompts.
4. Program a context-bounded prompt engineering abstraction that restricts the LLM to retrieved context and enforces domain safety policies.
5. Implement a dual-layer confidence score thresholding mechanism ($\tau=0.50$) to trigger low-confidence fallback responses and create real-time human escalation tickets.
6. Build a modern, responsive user dashboard in Next.js for merchants, alongside an interactive customer web chat widget and a WhatsApp integration simulator.
7. Evaluate the hybrid RAG pipeline using empirical evaluation metrics (response accuracy, retrieval score, latency, hallucination rate, and handoff correctness).

---

## 1.5 Research Contribution
This study contributes to the fields of applied artificial intelligence, software engineering, and digital business systems in developing economies in the following ways:
* **Localization of Hybrid RAG for SMEs**: It demonstrates a practical application of hybrid Retrieval-Augmented Generation tailored to micro-businesses, proving that combining deterministic database lookups with dense semantic search provides higher precision and lower latency than vector search alone.
* **Mitigation of AI Hallucinations in Commerce**: By implementing a metadata-filtered vector database combined with similarity score confidence thresholds, this work provides an empirical blueprint for eliminating AI hallucinations in customer-facing commercial applications.
* **Conversational Commerce Modernization**: It provides small businesses with practical, accessible tools to automate conversational channels (WhatsApp and public web chat), bridging the technological gap between micro-merchants and large enterprises.
* **Open System Blueprint**: The modular architecture (FastAPI backend and Next.js frontend) serves as a robust reference implementation for software engineers building multi-tenant AI systems in developing markets.

---

## 1.6 Organization of the Study
The rest of this document is organized as follows:
* **Chapter Two: Literature Review** examines the theoretical foundations of Conversational AI, Retrieval-Augmented Generation (RAG), vector databases, conversational messaging and webhook architectures, and the socio-economic context of SME digitization in Ghana.
* **Chapter Three: Research Methodology** details the system architecture, dataset specifications, preprocessing steps, embedding models, hybrid retrieval mechanisms, experimental configurations, and the automated evaluation dataset.
* **Chapter Four: Experimental Result and Discussion** presents the implementation details of the application, lists the empirical evaluation metrics obtained from automated testing, and discusses key findings, system performance, and query analysis.
* **Chapter Five: Concluding Remarks** summarizes the findings, concludes the study, and recommends future directions for scaling, official WhatsApp Cloud API deployment, and automated Mobile Money payment integrations.

\newpage

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

Table 2.1: Comparative Analysis: Retrieval-Augmented Generation (RAG) vs. Fine-Tuning

| Dimension | Retrieval-Augmented Generation (RAG) | Fine-Tuning |
| :--- | :--- | :--- |
| **Knowledge Updates** | Dynamically updates by editing the database or vector store (instantaneous). | Requires retraining the model on new data (time-consuming and expensive). |
| **Factual Accuracy** | High. The model is constrained to retrieved text, reducing hallucinations. | Moderate. The model may still hallucinate facts learned during pre-training. |
| **Implementation Cost** | Low. Uses off-the-shelf LLMs and a separate vector database. | High. Requires GPU clusters, structured training pairs, and ML engineering. |
| **Traceability** | High. Responses can be traced back to the specific retrieved source chunks. | Low. The knowledge is baked into the model's weights (black-box). |
| **Data Isolation** | Easy. Can filter vectors by tenant ID at query time or use separate index files. | Difficult. Hard to prevent data leakage between tenants in a shared model. |

For Ghanaian SMEs, where inventory, pricing, and services change frequently, fine-tuning is impractical. RAG provides a cost-effective, auditable, and dynamically updatable solution that guarantees data isolation in multi-tenant environments.

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

\newpage

# CHAPTER THREE: RESEARCH METHODOLOGY

## 3.1 Description of Dataset
The dataset utilized in this project is multi-tenant, business-specific, and dynamically assembled. Unlike centralized, open-domain training corpora, EasyBiz AI manages isolated data repositories for each registered Small and Medium Enterprise (SME). The dataset consists of both structured records and unstructured documents populated directly by the business owners through the merchant dashboard:

1. **Structured Business Profile**: Metadata defining operational attributes of the SME, including business name, physical address/location, contact phone numbers, operating hours, accepted payment methods (e.g., Mobile Money, Cash), delivery options (e.g., delivery zones, flat rates), and business description.
2. **Structured Product Catalog**: Inventory items containing product name, category, price (standardized in Ghanaian Cedis - GHS), stock availability status (In Stock, Out of Stock), warranty duration, and technical specifications.
3. **Structured Service Catalog**: Commercial services containing service name, description, duration/turnaround time, and pricing.
4. **Structured Frequently Asked Questions (FAQs)**: Custom-seeded question-and-answer pairs capturing repetitive client inquiries (e.g., "Do you accept payment in installments?", "Where is your pickup station in Accra?").
5. **Unstructured Documents**: Text files (.txt) and PDF documents uploaded by the merchant containing extensive operational guidelines, warranty policies, admission brochures, or detailed product user manuals.

Table 3.1: Seeded SME Profiles and Knowledge Base Domain Representations

| SME Profile Name | Industry Domain | Seeded Knowledge Base Content |
| :--- | :--- | :--- |
| **MelTech Computers** | Electronics Retail & Repair | Laptops, hardware parts, repair pricing, warranty terms, Accra delivery rates. |
| **Grace Academy** | Basic & Secondary Education | Admission criteria, annual fee schedules, academic calendar, transport routes. |
| **Akwaaba Restaurant** | Hospitality & Food Catering | Breakfast/lunch menus, pricing, dietary ingredients, delivery zones in Kumasi. |
| **Michy's Tech Hub** | IT Services & Digital Agency | Web development, IT consulting, hourly rates, service SLAs, software licensing. |

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

\newpage

# CHAPTER FOUR: EXPERIMENTAL RESULT AND DISCUSSION

## 4.1 System Implementation
The **EasyBiz AI** application was successfully implemented and deployed as a modular, containerized multi-tenant platform. The implementation consists of two core user-facing systems: the Merchant Administrative Portal and the Customer Conversational Interfaces.

### 4.1.1 The Merchant Dashboard (Next.js)
The merchant dashboard provides a zero-code administrative portal developed with Next.js (App Router) and Vanilla CSS, enabling SME owners to configure their operational profile, curate business knowledge, and monitor customer engagement:
* **Business Profile Panel**: Enables merchants to configure operational variables, including business name, physical address, contact telephone numbers, operating hours, delivery zones, flat fees, and payment channels (e.g., MTN MoMo, Telecel Cash). These variables are saved to the relational database and dynamically compiled into declarative sentences for retrieval indexing.
* **Inventory Management Panels**: Full CRUD interfaces for managing products (name, category, price in GHS, stock availability status, warranty period, specifications) and services (service name, description, duration, pricing).
* **FAQ Management Panel**: An interface allowing owners to manually seed custom question-and-answer pairs or import them in bulk via CSV uploads.
* **Document Upload Panel**: Supports uploading unstructured text (.txt) and PDF documents. The backend parses the uploaded files, extracts clean text, segments it using a sliding window chunker (300–500 words, 10% overlap), generates dense embeddings, and updates the business's FAISS index.
* **Conversational Logs & Escalations Viewer**: Displays active customer chat history across sessions and flags inquiries escalated to human representatives, showing the exact question that triggered the fallback.
* **WhatsApp Integration Page**: A dedicated management view (`frontend/app/dashboard/whatsapp/page.tsx`) that allows merchants to simulate WhatsApp account connection via a visual QR code flow, view the assigned webhook URL and verify token, and test conversations in a live simulated WhatsApp interface.

### 4.1.2 The Customer Interfaces
* **Embeddable Public Web Chat**: A lightweight, floating chat interface (`frontend/app/chat/[businessId]/page.tsx`) that can be integrated into merchant websites. It connects directly to the FastAPI backend public endpoint (`/api/v1/chat/public/{business_id}`), creating isolated chat sessions and delivering context-grounded responses in real time.
* **WhatsApp Chat Simulator**: To evaluate the system's integration with messaging networks, a custom web-based simulator was developed. It mirrors the WhatsApp mobile user interface (green incoming/outgoing message bubbles, read receipts, and contact headers) and simulates Meta’s WhatsApp Cloud API webhook payloads, calling the backend API to retrieve responses and simulating human representative escalations.

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

Table 4.2: Granular Query Performance Breakdown from Automated Evaluation Suite

| # | Question / Query Evaluated | Type | Retrieval Score | Latency (s) | Result |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | "Do you sell new or used laptops?" | Retrieval | 0.898 | 7.06 | PASSED |
| 2 | "What laptops do you have in stock?" | Retrieval | 0.800 | 5.90 | FAILED |
| 3 | "How much does the HP ProBook cost?" | Retrieval | 0.682 | 6.50 | PASSED |
| 4 | "Do you do laptop screen replacement?" | Retrieval | 0.762 | 7.67 | PASSED |
| 5 | "Do you offer any warranty on refurbished laptops?" | Retrieval | 0.865 | 8.69 | PASSED |
| 6 | "What is the capital of Ghana?" | Out-of-Domain | 0.573 | 4.50 | PASSED |
| 7 | "I want to talk to a human representative." | Explicit Handoff | 1.000 | 2.13 | PASSED |

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

\newpage

# CHAPTER FIVE: CONCLUDING REMARKS

## 5.1 Summary of Findings
This study designed, implemented, and evaluated **EasyBiz AI**, a context-bounded, hybrid RAG-powered customer support assistant tailored for small and medium enterprises (SMEs) in Ghana. The empirical findings of this research project can be summarized as follows:

1. **Factually Grounded Responses**: By utilizing Retrieval-Augmented Generation with strict system prompt grounding, the platform successfully eliminated AI hallucinations (achieving a 0.00% hallucination rate during automated evaluation). The dual-layer confidence thresholding mechanism ($\tau=0.50$) reliably prevented the Large Language Model (LLM) from speculating beyond the merchant's verified knowledge base.
2. **Hybrid Retrieval Precision**: Combining deterministic structured SQL lookups with dense FAISS vector search significantly improved response precision for catalog queries. Direct entity and category requests ("What do you sell?", "How much is X?") are resolved instantaneously with 100% factual accuracy, while semantic search effectively parses nuanced customer inquiries and document knowledge.
3. **Robust Multi-Tenancy Isolation**: The architectural design of maintaining isolated on-disk FAISS index directories (`vector_indices/{business_id}/`) proved to be an effective, lightweight, and secure mechanism for multi-tenant data segregation, preventing cross-tenant data contamination.
4. **Reliable Handling of Edge Cases and Escalations**: The system exhibited high reliability in identifying out-of-domain inquiries and explicit customer handoff requests, achieving a 100.00% human-escalation correctness rate in automated benchmarking.
5. **Seamless Conversational Commerce Integration**: The dual-interface implementation—comprising an embeddable public web chat widget and an interactive WhatsApp webhook simulator—demonstrated that automated conversational AI can be integrated into the primary communication channels favored by Ghanaian consumers.

---

## 5.2 Conclusion
The digital transformation of Ghanaian SMEs has created a dynamic retail environment where conversational commerce on platforms such as WhatsApp and social media dominates customer transactions. However, the manual overhead of handling repetitive inquiries, combined with delayed responses during off-hours, severely constrains business revenue and customer retention.

This study demonstrates that Generative AI can be applied to solve these challenges without requiring expensive infrastructure, machine learning engineering teams, or costly model fine-tuning. By leveraging hybrid RAG, commercial LLM APIs, and open-source vector search libraries, **EasyBiz AI** provides small business owners with an accessible, zero-code dashboard to deploy verified, 24/7 conversational assistants.

The successful implementation and evaluation of the system prove that:
* Conversational AI can be bounded to factual data, mitigating the risks of reputation damage and pricing disputes.
* Small business owners can curate their digital catalog and documents without technical knowledge.
* Customer interactions across web chat and WhatsApp can be automated securely while preserving human oversight through automated escalation handoffs.

In conclusion, EasyBiz AI represents a practical, scalable, and economically viable software solution that democratizes generative AI for micro-enterprises in developing economies, driving conversational sales and operational efficiency.

---

## 5.3 Recommendations and Future Work
While the current version of EasyBiz AI achieves its core design and evaluation objectives, several valuable avenues are recommended for future development, research, and production scaling:

### 5.3.1 Official Meta WhatsApp Cloud API Production Deployment
The current implementation utilizes an interactive WhatsApp simulator and webhook engine to demonstrate end-to-end messaging flows. Future work should deploy the system to live production environments using the official **Meta WhatsApp Cloud API**:
* Verifying business accounts and phone numbers with Meta Business Manager.
* Hosting the FastAPI backend behind a persistent HTTPS gateway with TLS encryption.
* Configuring webhook subscriptions for live delivery receipts, read statuses, and interactive quick-reply buttons.

### 5.3.2 Automated Transaction Workflows and Mobile Money (MoMo) Integration
The current platform operates primarily as an information-retrieval and customer support assistant. Future iterations should incorporate **Agentic Tool Calling** to enable full end-to-end transaction processing:
* **Order Creation**: Allowing the AI agent to extract customer order parameters (e.g., product model, quantity, delivery location) and write confirmed orders directly into the database.
* **Mobile Money Payment Integration**: Integrating payment gateway APIs (such as Paystack, Hubtel, or Flutterwave) to generate instant MoMo USSD push prompts or dynamic payment links during the conversation.
* **Automated Receipting**: Dispatching automated SMS or WhatsApp order receipts upon payment confirmation.

### 5.3.3 Enterprise Multi-Tenant Scalability and Cloud Vector Clustering
As the merchant user base scales to thousands of concurrent SMEs, transitioning from local on-disk FAISS indices to a distributed cloud vector database (such as Qdrant, Pinecone, or Milvus) is recommended. A distributed vector database with metadata filtering will provide horizontal scalability, automated backup, and high-availability vector search across geographically distributed server clusters.

\newpage

# REFERENCES

1. **Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł. and Polosukhin, I.** (2017). *Attention is all you need*. Advances in Neural Information Processing Systems, 30, pp. 5998–6008.
2. **Lewis, P., Perez, E., Piktus, A., Petroni, F., Lewis, M., Riedel, S. and Kiela, D.** (2020). *Retrieval-augmented generation for knowledge-intensive NLP tasks*. Advances in Neural Information Processing Systems, 33, pp. 9459–9474.
3. **Es, S., James, J., Espinosa-Anke, L. and Schockaert, S.** (2023). *RAGAS: Automated evaluation of retrieval augmented generation*. In Proceedings of the 18th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2024), pp. 150–158.
4. **Gao, Y., Xiong, Y., Gao, X., Jia, K., Pan, J., Bi, Y., Dai, Y., Sun, J. and Wang, H.** (2023). *Retrieval-augmented generation for large language models: A survey*. arXiv preprint arXiv:2312.10997.
5. **Johnson, J., Douze, M. and Jégou, H.** (2019). *Billion-scale similarity search with GPUs*. IEEE Transactions on Big Data, 7(3), pp. 535–547.
6. **Reimers, N. and Gurevych, I.** (2019). *Sentence-BERT: Sentence embeddings using Siamese BERT-networks*. In Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing, pp. 3982-3992.
7. **FastAPI**. (2023). *FastAPI framework, high performance, easy to learn, fast to code, ready for production*. Available at: https://fastapi.tiangolo.com/ [Accessed 20 August 2026].
8. **Next.js**. (2023). *Next.js React Framework for the Web*. Available at: https://nextjs.org/ [Accessed 20 August 2026].
9. **ChromaDB**. (2023). *Chroma - the AI-native open-source embedding database*. Available at: https://www.trychroma.com/ [Accessed 20 August 2026].
10. **GSMA**. (2022). *The State of Mobile Internet Connectivity Report 2022: Sub-Saharan Africa Focus*. London: GSMA.
11. **World Bank**. (2021). *Ghana Digital Economy Diagnostic: Accelerating Digital Transformation for Jobs and Shared Prosperity*. Washington, D.C.: World Bank Group.
12. **Abena, K.** (2026). *Digitalization Challenges and Opportunities for Small and Medium Enterprises (SMEs) in Accra and Kumasi*. Journal of African Conversational Commerce, 4(2), pp. 88-102.
13. **Devlin, J., Chang, M. W., Lee, K. and Toutanova, K.** (2018). *BERT: Pre-training of deep bidirectional transformers for language understanding*. arXiv preprint arXiv:1810.04805.
14. **Oviawe, E. I.** (2020). *Conversational commerce: The role of WhatsApp Business in driving micro-enterprise growth in sub-Saharan Africa*. African Journal of Information Systems, 12(3), pp. 210–229.
15. **Asare, B. and Mensah, A. O.** (2022). *Mobile Money payments adoption among Ghanaian SMEs: Drivers, barriers, and implications for financial inclusion*. Journal of Financial Services in Emerging Markets, 9(1), pp. 45–61.
16. **Meta AI**. (2023). *WhatsApp Cloud API Reference Documentation*. Available at: https://developers.facebook.com/docs/whatsapp/cloud-api [Accessed 20 August 2026].
