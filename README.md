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
   - **Document Storage**: Offload raw files from container memory to object storage (**Google Cloud Storage** or **AWS S3**) with pre-signed upload URLs to reduce backend memory pressure.
   - **Vector Database**: Replace the in-memory array with a managed vector database (**pgvector on Cloud SQL / AWS RDS Aurora**, **Pinecone**, or **Qdrant**) using HNSW indexing for sub-10ms nearest-neighbor search across millions of chunks.
   - **Metadata & History**: Store user chat sessions and audit logs in a transactional database (PostgreSQL or Firestore) partitioned by `tenant_id` and `user_id`.

2. **Asynchronous Ingestion Pipeline**:
   - Move document parsing (especially large multi-hundred-page PDFs) out of the synchronous HTTP request cycle into an asynchronous task queue (e.g., **Google Cloud Tasks / Pub/Sub + Celery worker**).
   - Compute and store chunk embeddings once at ingestion time rather than processing on-demand.

3. **Containerization & Autoscaling**:
   - Deploy as a stateless container on **Google Cloud Run** or **AWS ECS Fargate** with autoscaling configured from 1 to N instances behind a Cloud Load Balancer with SSL termination and CDN edge caching for static assets.

4. **Authentication & Multi-Tenant Authorization**:
   - Integrate OAuth 2.0 / OIDC (Firebase Auth, Auth0, or AWS Cognito) with Role-Based Access Control (RBAC) so users only retrieve documents within their authorized workspace or folder.

---

## 4. RAG / LLM Approach & Technical Decisions

| Dimension | Choices Considered | Final Choice | Rationale |
| :--- | :--- | :--- | :--- |
| **LLM Model** | GPT-4o, Claude 3.5 Sonnet, Gemini 2.5 Flash, Gemini 3.8 Flash | **Gemini 3.8 Flash** (`@google/genai`) | Exceptional reasoning speed, low latency, 1M+ token context window, native multimodal understanding for document/PDF fallbacks, and cost-efficiency. |
| **Chunking Strategy** | Fixed-size character window (e.g. 500 chars) vs. Semantic heading-aware | **Boundary- & Heading-Aware Semantic Chunking** | Fixed character splits frequently cut words and logical predicates in half. Splitting by Markdown headings/paragraphs preserves section context (e.g., "Parental Leave" or "Cache Resiliency"). |
| **Retrieval Engine** | Pure dense vector vs. Pure BM25 vs. Hybrid | **Relevance-Scored Multi-Factor Retrieval** (Keyword + Heading + Phrase + Token Frequency) | Dense embeddings can fail on exact technical codes and numbers (e.g., "SEV-1", "PUE 1.14", "Redis 7.2"). Combining heading boosts, phrase matching, and token frequency delivers accurate recall for enterprise documentation without external infrastructure overhead. |
| **Context Management** | Sending entire documents vs. Top-K passages | **Top-K Passages with Source Tags** | Providing targeted passages keeps latency low, prevents the "lost in the middle" attention degradation, and forces the model to cite exact document names. |
| **Guardrails & Anti-Hallucination** | System prompt instructions, confidence thresholds, temperature tuning | **Low Temperature (0.2) + Explicit Negative Constraint** | Strict system instruction: if the retrieved passages do not contain the answer, explicitly state that the information was not found rather than improvising. |
| **Observability** | Console logs vs. Inspectable UI telemetry | **Transparent Retrieval Inspection in UI** | Users can click "View retrieved RAG passages" beneath any assistant response to view the exact text snippets, chunk headings, and relevance scores retrieved by the backend. |

---

## 5. Key Technical Decisions & Tradeoffs

1. **Python Flask + React SPA with Reverse Proxy**:
   - *Decision*: We used Python for the RAG and document processing core and React for the client UI, coupled with an automated dev runner (`run-dev.js`) and unified production build script.
   - *Tradeoff*: Running two runtimes in local development is managed seamlessly via an orchestration runner rather than requiring manual multi-terminal commands.
2. **Deterministic pypdf + Gemini Multimodal OCR Fallback**:
   - *Decision*: PDFs with raw text are extracted instantaneously via `pypdf` in memory with zero external API calls; scanned PDFs or images automatically fall back to Gemini's vision model for OCR.
   - *Tradeoff*: Avoids heavy Tesseract C-dependencies while ensuring scanned documents do not fail silently.
3. **In-Memory Semantic Chunk Store for MVP**:
   - *Decision*: Maintained an in-memory chunk index for rapid zero-dependency demonstration and instant re-indexing upon upload or reset.
   - *Tradeoff*: Ideal for single-instance MVPs; production would substitute `pgvector` or Pinecone for multi-instance persistence.

---

## 6. Engineering Standards Followed (and Consciously Deferred)

### Standards Followed
- **Strict TypeScript & Type Safety**: Centralized types in `src/types.ts` for all API payloads and UI state.
- **Fail-Fast Error Handling**: User-facing toast notifications and non-blocking recovery for unparsable files or network errors.
- **Graceful Degradation**: Preloaded sample enterprise documents (handbook, architecture spec, SRE runbook, ESG report) so the evaluator can test immediately without searching for test files.
- **Accessible & Responsive UX**: High-contrast typography, clear keyboard shortcuts (`Enter` to submit), loading states, and mobile/desktop responsiveness.

### Standards Consciously Deferred for MVP Scope
- **Persistent User Accounts**: Skipped OAuth login to keep the reviewer's evaluation friction-free.
- **Distributed Celery Queue**: Skipped asynchronous message broker infrastructure to keep the repository runnable with a single command.

---

## 7. How AI Tools Were Used in the Development Process

- **Scaffolding & Boilerplate**: AI assistance was used to rapidly scaffold the initial React component structure and generate representative enterprise sample documents (SRE runbook, caching spec).
- **Quality Verification & Refactoring**: AI was used to identify boundary failure points in text parsing (such as empty PDF streams and markdown split boundaries).
- **Human Guidance & Code Ownership**:
  - *Do's*: Kept architectural ownership, curated precise RAG scoring heuristics (phrase bonus, heading matching), and reviewed all generated code for maintainability.
  - *Don'ts*: Avoided blindly accepting complex multi-layer abstractions or unneeded dependencies (e.g. avoided pulling in heavyweight frameworks like LangChain/LlamaIndex when a direct, readable 200-line Python implementation is faster, more transparent, and easier to debug).

---

## 8. What Would Be Added With More Time

1. **HyDE (Hypothetical Document Embeddings)**: Generate a hypothetical ideal answer first to improve semantic similarity matching against declarative document passages.
2. **Parent-Document Retrieval**: Embed smaller 100-word chunks for precision matching, but retrieve and feed the full parent section (500 words) to the LLM for broader contextual reasoning.
3. **Multi-Document Comparison Mode**: Allow users to select two documents side-by-side (e.g., Job Description vs. Candidate Resume or v1 vs. v2 architecture) with a structured diff view.
4. **Automated RAG Evaluation (RAGAS / TruLens)**: Add automated evaluation metrics for Faithfulness, Answer Relevance, and Context Precision.
