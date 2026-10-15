# Option 1: Chat With Your Docs — Full-Stack RAG Assistant

A clean, production-ready Retrieval-Augmented Generation (RAG) web application built with **Python (Flask)**, **React (TypeScript + Vite)**, and **Google Gemini (`gemini-3.8-flash`)**.

---

## 1. Quick Setup Instructions

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & `npm`
- **Gemini API Key** (set via environment variable `GEMINI_API_KEY`)

### Environment Setup
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```
2. Set your Gemini API key:
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key-here"
   ```
3. Install dependencies:
   ```bash
   # Python packages
   pip3 install -r requirements.txt # or: pip3 install flask requests google-genai pypdf
   # Node packages
   npm install
   ```

### Running Locally
```bash
# Start both Python backend (port 5000) and React frontend (port 3000)
npm run dev
```
Open your browser at `http://localhost:3000`.

### Production Build & Run
```bash
npm run build
npm start # runs: python3 server.py --port 3000
```

---

## 2. Architecture Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (React)                            │
│  - DocumentManager: Drag & drop PDF/TXT upload, document preview & delete   │
│  - ChatAssistant: Streamlined QA interface, starter prompts, copy action   │
│  - Inspectable Citations & Retrieved Chunks with relevance score badges     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON & Multipart FormData
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND & RAG PIPELINE (Python)                       │
│                                                                             │
│  ┌─────────────────────────┐            ┌────────────────────────────────┐  │
│  │ 1. Document Ingestion   │            │ 2. Semantic Chunking           │  │
│  │ - PDF parsing (pypdf)   │ ─────────► │ - Boundary-aware section split │  │
│  │ - TXT / Markdown / JSON │            │ - Heading context retention    │  │
│  │ - Multimodal OCR Fallback            │ - Tokenization & term filtering│  │
│  └─────────────────────────┘            └───────────────┬────────────────┘  │
│                                                         │                   │
│                                                         ▼                   │
│                                         ┌────────────────────────────────┐  │
│                                         │ 3. In-Memory Chunk Index       │  │
│                                         │ - Document ID & section metadata│ │
│                                         │ - Token frequencies & snippets │  │
│                                         └───────────────┬────────────────┘  │
│                                                         │                   │
│  ┌─────────────────────────┐                            ▼                   │
│  │ 4. User Question Input  │ ─────────► ┌────────────────────────────────┐  │
│  └─────────────────────────┘            │ 5. Relevance Retrieval Engine  │  │
│                                         │ - Exact phrase boost (+8.0)    │  │
│                                         │ - Section heading boost (+3.5) │  │
│                                         │ - TF & token coverage scoring  │  │
│                                         └───────────────┬────────────────┘  │
│                                                         │ Top-K Chunks      │
│                                                         ▼                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 6. Grounded Context Assembly & Gemini Generation (`gemini-3.8-flash`) │  │
│  │ - Injected [PASSAGE 1..K] context with strict anti-hallucination rule │  │
│  │ - Verifiable source citations `[Document_Name.ext]`                   │  │
│  │ - Automatic suggested follow-up generation                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. What Would Be Required to Productionize and Deploy on a Hyper-Scaler (GCP / AWS)

To graduate this MVP to an enterprise-grade multi-tenant production system:

1. **Storage & Database Partitioning**:
There are 4 major considerations when productionizing this application. Storage would be key to this; with the large number of raw files that is going to be uploaded Cloud object storage would be a consideration. There are a number of Cloud storage provides that offer secure state of the art storage for unstructured files. The most notable of these products is Amazon S3; the most popular cloud storage due to its pre-signed upload URL’s and elastic space which makes it more cost effective than other provider’s. User chat sessions would be stored using a database provider such as Postrgress or Firestore.	 

Due to the potential size of documents that are going to be parsed in this application it wouldn’t make sense to rely on HTTP request cycles. Asynchronous tasks enable compute and store chunk embeddings once at ingestion rather than processing on-demand. Google run cloud can be used for Containerisation, users’ authorization will be role based providing access to chosen workspaces or folders using Firebase Auth, Auth0, or AWS Cognito.


---

## 4. RAG / LLM Approach & Technical Decisions


**LLM Model** |**Gemini 3.8 Flash** (`@google/genai`)  
The most integral part of this web application and every other RAG application is the ability for the application to reason efficiently. I have chosen Google’s Gemini 3.8 as it provides efficient reasoning capabilities whilst imploring low latency. The Gemini Pro and lite versions would have been sufficient if there was a requirement for autonomous agent planning and deep logic. As the goal is to not overengineer the adequate model for this project was Google’s Gemini 3.8

The chosen approach to chunking allows texts to be split by headings and paragrpahs, so sentences and topics are never chopped in half. Hallucination is prevented by using a low-creativity setting, this tells the AI to say ‘information not found’ instead of guessing. The search process uses a hybrid approach and matches exact keywords and titles. In terms of Context management; targeted passages keeps latency low and prevents the "lost in the middle" attention degradation, and forces the model to cite exact document names. |


---

## 5. Key Technical Decisions & Tradeoffs

•	  We used Python for the RAG and document processing core and React for the client UI, coupled with an automated dev runner (`run-dev.js`) and unified production build script. Running both services locally is handled by a single startup script, so you don’t need to open and manage multiple terminal windows
 PDFs with raw text are extracted via `pypdf` PDFs or images automatically fall back to Gemini's vision model for OCR. The trade-off is that it keeps the setup simple and lightweight, while alerting users if a PDF is an image instead of selectable text.
Document chunks were stored directly in memory, so search is instant and requires no external database setup. Fast and lightweight for single server use, but would be upgraded to a vector database for multi-server production scale.



---

## 6. Engineering Standards Followed 

### Standards Followed
•	Ensured the app used Full TypeScript coverage across the app to prevent runtime bugs Type-Safe to ensure stability and prevent run time bugs. Built the app with a user friendly mindset guaranteeing layout was mobile/desktop friendly. I also ensured that error messages were displayed clearly and loading feedback.  The app has been preloaded with test documents so it can be tested right away  



---

## 7. How AI Tools Were Used in the Development Process

- I  used AI to quickly draft initial React components and generate realistic sample documents (like SRE runbooks and technical specs). Also used AI to spot tricky file-parsing bugs, such as blank PDFs or awkward text breaks. I rejected frameworks (like LangChain or LlamaIndex) in favor of a lightweight script that is faster and easier to debug. I owned the overall architecture, designed the search-ranking rules, and personally reviewed the  code for long-term clarity.

---

## 8. What Would Be Added With More Time

I would have allowed the AI draft an ideal answer first, then use that draft to search for matching passages in the documents. A side-by-side document comparison: I would have also let users compare two files directly (e.g., a Job Description vs. a Resume, or v1 vs. v2 of a design spec) with a visual breakdown of differences. If there was more time it probably would have been helpful to use a tool like RAGAS or TruLens to grade how truthdul and relevant the AI answers are 
