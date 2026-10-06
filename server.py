#!/usr/bin/env python3
"""
Python Flask Backend with Retrieval-Augmented Generation (RAG)
Provides clean document ingestion, semantic chunking, keyword-relevance retrieval,
and Gemini-grounded responses with citations.
"""

import os
import sys
import io
import json
import uuid
import re
import math
import argparse
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

app = Flask(__name__, static_folder='dist', static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB upload limit

MODELS_TO_TRY = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

# Default Sample Documents
SAMPLE_DOCUMENTS = [
    {
        "id": "doc-company-handbook",
        "name": "AtlasTech_Employee_Handbook_2025.md",
        "type": "markdown",
        "isSample": True,
        "text": """# AtlasTech Employee Handbook & Workplace Guidelines (2025)

## 1. Work Schedules & Core Hours
AtlasTech operates on a flexible, hybrid workplace model. Team members may work from home or from an authorized regional hub. 
To ensure cross-functional collaboration across time zones, all full-time employees are required to be reachable during Core Collaboration Hours from 10:00 AM to 3:00 PM EST (15:00 UTC to 20:00 UTC), Monday through Thursday. Fridays are designated as Focus Days: no recurring meetings may be scheduled after 12:00 PM local time.

## 2. Equipment Stipend & Remote Ergonomics
Upon hiring, every employee receives a one-time home office setup stipend of $1,200 USD. This budget can be applied toward ergonomic desks, external 4K monitors, ergonomic office chairs, noise-canceling headsets, and surge protectors.
In addition, employees can expense up to $75 USD per month toward high-speed residential fiber internet or dedicated mobile hotspot costs via our Expensify portal under the "Remote Connectivity" category.

## 3. Paid Time Off (PTO) & Leave Policies
AtlasTech provides a Flexible Vacation policy for exempt employees, with a recommended minimum of 20 days off per calendar year to promote work-life wellness. All leave requests of 4 consecutive days or more must be submitted at least 2 weeks in advance through BambooHR.
Parental leave: All new parents (birth, adoption, or foster placement) receive 16 weeks of 100% paid parental leave, eligible after 90 days of continuous employment.

## 4. Health, Mental Wellness & Continuing Education
Comprehensive health insurance coverage begins on the first day of the calendar month following the hire date. AtlasTech covers 90% of employee healthcare premiums and 75% of dependent premiums.
Every team member has access to an annual Learning & Development budget of $1,500 USD for technical certifications, textbooks, academic coursework, and industry conferences."""
    },
    {
        "id": "doc-system-architecture",
        "name": "Architecture_Spec_Distributed_Cache_v3.txt",
        "type": "text",
        "isSample": True,
        "text": """SYSTEM ARCHITECTURE SPECIFICATION: DISTRIBUTED CACHING LAYER (v3.2)
Author: Principal Infrastructure Engineering
Updated: January 2025

1. OVERVIEW & OBJECTIVES
The Distributed Caching Layer serves high-throughput reads for user metadata, catalog searches, and authorization scopes. Our system goal is a 99.9th percentile read latency under 4 milliseconds with sustained throughput of 85,000 queries per second (QPS).

2. CACHING TOPOLOGY & STRATEGY
The caching cluster utilizes Redis Enterprise version 7.2 in an active-active multi-region deployment across us-east4 and europe-west1.
We employ a Cache-Aside (Lazy Loading) pattern with Write-Through invalidation:
- Read Path: The API gateway checks Redis first. If a cache miss occurs, the read is routed to Cloud Spanner, and the result is asynchronously backfilled into Redis with an explicit TTL.
- Write Path: Updates are committed to Spanner first. Once the distributed transaction succeeds, a Pub/Sub invalidation event is dispatched to purge stale keys across all regional Redis replicas within 120 milliseconds.

3. EVICTION POLICIES & KEY NAMESPACING
The cache is configured with volatile-lru (Least Recently Used among keys with an expiration set) with a hard memory ceiling of 64 GB per shard node.
Default Time-To-Live (TTL) values:
- Session tokens: 3,600 seconds (1 hour)
- User profile data: 86,400 seconds (24 hours) with pub/sub invalidation triggers
- Search index facet lookups: 300 seconds (5 minutes)
- Permission role matrices: 900 seconds (15 minutes)

4. RESILIENCY & CIRCUIT BREAKING
If Redis cluster CPU reaches >= 85% or connection pool timeouts exceed 50ms for 3 consecutive health checks, the resilience circuit breaker trips to HALF-OPEN. The gateway temporarily serves stale cache data for up to 10 minutes while rate-limiting write invalidations to protect the underlying Spanner database from a thundering herd problem."""
    },
    {
        "id": "doc-incident-response",
        "name": "SRE_Incident_Response_Runbook.md",
        "type": "markdown",
        "isSample": True,
        "text": """# Site Reliability Engineering (SRE): Incident Severity Levels & Triage Protocol

## Severity Classifications
- **SEV-1 (Critical Outage)**: Complete disruption of core customer-facing functionality (e.g. checkout fails, API error rate > 5%, data loss hazard). Customer impact is widespread.
- **SEV-2 (Major Impairment)**: Substantial performance degradation or failure of non-critical secondary subsystems (e.g. recommendation engine offline, batch reporting delayed > 2 hours).
- **SEV-3 (Minor Disruption)**: Isolated bug affecting fewer than 1% of active users with an available manual workaround.
- **SEV-4 (Low Impact)**: Minor cosmetic UI defect or internal non-blocking telemetry delay.

## SEV-1 Escalation Procedures
1. **Immediate Declaration (0 - 5 minutes)**: Any on-call engineer can declare a SEV-1 via Slack command `/incident declare sev-1`. This triggers automated PagerDuty paging for the Incident Commander (IC), Communications Lead (CL), and Technical Subject Matter Experts (SMEs).
2. **War Room Setup (5 - 10 minutes)**: The Incident Commander opens a dedicated Google Meet war room and switches the incident Slack channel to read-only for non-essential observers.
3. **Public Status Notification (Within 15 minutes)**: The Communications Lead must update status.atlastech.io with an initial acknowledged message acknowledging investigation, refreshed every 30 minutes thereafter until resolution.
4. **Post-Incident Review (PIR)**: A blameless post-mortem document must be drafted within 48 business hours of incident closure, detailing timeline, root cause analysis (5 Whys), action items, and automated tests to prevent recurrence."""
    },
    {
        "id": "doc-sustainability",
        "name": "Sustainability_Report_ESG_Targets.md",
        "type": "markdown",
        "isSample": True,
        "text": """# Global Environmental, Social & Governance (ESG) Annual Summary

## 1. Carbon Neutrality Milestones & Targets
- **Scope 1 & 2 Emissions**: Achieved 100% renewable electricity matching across all corporate headquarters and regional co-working hubs starting in Q3 2023.
- **Scope 3 Supply Chain Goal**: Commit to a 45% absolute reduction in supply chain carbon intensity per product unit by 2030, benchmarked against 2021 baselines.
- **Hardware Lifecycle Stewardship**: 92% of decommissioned server racks and employee laptops were refurbished or responsibly recycled through certified e-Stewards partners in fiscal year 2024.

## 2. Water Stewardship & Data Center PUE
Our tier-3 partnered data centers operate at an annualized Power Usage Effectiveness (PUE) average of 1.14. Closed-loop evaporative cooling systems saved an estimated 14.2 million gallons of potable water compared to traditional single-pass chillers.

## 3. Responsible AI & Energy Compute Budgets
Training large language models requires significant computational power. All production model inference nodes must be provisioned in carbon-aware regions during peak renewable supply hours (solar and wind excess curves). Batch offline index re-embeddings are scheduled during grid low-carbon intensity windows between 01:00 and 06:00 local time."""
    }
]

# Stores
documents_store = []
chunks_index = []

STOP_WORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
    'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
    'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
    'if', 'in', 'into', 'is', 'isn\'t', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
    'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
    'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'were', 'weren\'t', 'what', 'when', 'where',
    'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
}


def tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric keywords."""
    words = re.findall(r'\b[a-zA-Z0-9_\-\$]+\b', text.lower())
    return [w for w in words if w not in STOP_WORDS and len(w) > 1]


def count_words(text: str) -> int:
    return len(text.strip().split())


def chunk_document(doc_id: str, doc_name: str, text: str) -> list[dict]:
    """
    RAG Chunking Engine:
    Splits text by markdown headings or paragraphs into coherent semantic chunks.
    Preserves document name, section title, chunk index, and snippet.
    """
    chunks = []
    lines = text.split('\n')
    current_heading = doc_name
    current_lines = []

    def flush_chunk():
        nonlocal current_lines, current_heading
        chunk_body = '\n'.join(current_lines).strip()
        if chunk_body and len(chunk_body) > 30:
            words = tokenize(chunk_body + ' ' + current_heading)
            chunks.append({
                "chunk_id": f"{doc_id}-c{len(chunks)}",
                "doc_id": doc_id,
                "doc_name": doc_name,
                "heading": current_heading,
                "text": chunk_body,
                "word_count": count_words(chunk_body),
                "tokens": set(words),
                "token_list": words,
            })
        current_lines = []

    for line in lines:
        stripped = line.strip()
        # Markdown heading or numbered section header
        if stripped.startswith('#') or (re.match(r'^\d+\.\s+[A-Z]', stripped) and len(stripped) < 80):
            if current_lines:
                flush_chunk()
            current_heading = stripped.lstrip('#').strip()
            current_lines.append(stripped)
        else:
            current_lines.append(line)
            # If paragraph exceeds ~250 words, flush chunk for granular RAG indexing
            if count_words('\n'.join(current_lines)) >= 220:
                flush_chunk()

    flush_chunk()
    return chunks


def rebuild_index():
    """Re-indexes all documents into the RAG vector/token store."""
    global chunks_index
    chunks_index = []
    for doc in documents_store:
        doc_chunks = chunk_document(doc["id"], doc["name"], doc["rawText"])
        chunks_index.extend(doc_chunks)


def reset_documents():
    """Initializes sample enterprise documents."""
    global documents_store
    documents_store = []
    now = datetime.utcnow().isoformat() + "Z"
    for sample in SAMPLE_DOCUMENTS:
        raw_text = sample["text"]
        documents_store.append({
            "id": sample["id"],
            "name": sample["name"],
            "type": sample["type"],
            "size": len(raw_text.encode('utf-8')),
            "uploadedAt": now,
            "wordCount": count_words(raw_text),
            "rawText": raw_text,
            "isSample": True,
        })
    rebuild_index()


# Initialize sample docs
reset_documents()


def retrieve_relevant_chunks(query: str, top_k: int = 4) -> list[dict]:
    """
    RAG Retrieval Engine:
    Scores chunks based on query keyword matching, heading relevance,
    exact phrase occurrence, and term frequency.
    """
    if not chunks_index:
        return []

    q_tokens = tokenize(query)
    q_lower = query.lower().strip()

    scored = []
    for chunk in chunks_index:
        score = 0.0
        text_lower = chunk["text"].lower()
        heading_lower = chunk["heading"].lower()

        # 1. Exact phrase matching bonus
        if len(q_lower) > 4 and q_lower in text_lower:
            score += 8.0

        # 2. Heading match bonus
        for qt in q_tokens:
            if qt in heading_lower:
                score += 3.5

        # 3. Document name match bonus
        if any(qt in chunk["doc_name"].lower() for qt in q_tokens):
            score += 2.0

        # 4. Token overlap & frequency
        for qt in q_tokens:
            count = chunk["token_list"].count(qt)
            if count > 0:
                # Log-dampened term frequency
                score += 1.0 + math.log(1 + count)

        # 5. Token coverage ratio
        if q_tokens:
            matched_tokens = sum(1 for qt in q_tokens if qt in chunk["tokens"])
            coverage = matched_tokens / len(q_tokens)
            score += coverage * 3.0

        scored.append((score, chunk))

    # Sort descending by relevance score
    scored.sort(key=lambda x: x[0], reverse=True)

    # If the query had matching keywords, return top scored chunks
    top_results = []
    for score, chunk in scored[:top_k]:
        if score > 0.5 or not top_results:
            top_results.append({
                "chunk_id": chunk["chunk_id"],
                "doc_name": chunk["doc_name"],
                "heading": chunk["heading"],
                "snippet": chunk["text"],
                "score": round(score, 2),
            })

    # Fallback if no specific keywords matched (general greeting or query)
    if not top_results and chunks_index:
        for chunk in chunks_index[:top_k]:
            top_results.append({
                "chunk_id": chunk["chunk_id"],
                "doc_name": chunk["doc_name"],
                "heading": chunk["heading"],
                "snippet": chunk["text"],
                "score": 0.0,
            })

    return top_results


def extract_text_from_pdf(pdf_bytes: bytes, filename: str) -> str:
    """Extracts text from PDF bytes via pypdf with OCR fallback."""
    extracted = ""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                extracted += t + "\n\n"
    except Exception as e:
        print(f"pypdf extraction error for {filename}: {e}")

    # If extraction is empty or very short, attempt Gemini multimodal OCR
    if not extracted.strip():
        client = get_gemini_client()
        if client:
            try:
                from google.genai import types
                part = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
                prompt = "Please extract and transcribe all readable text, tables, and content from this document clearly."
                resp = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=[part, prompt]
                )
                extracted = (resp.text or "").strip()
            except Exception as e2:
                print(f"Gemini PDF OCR error: {e2}")

    return extracted.strip()


def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Error instantiating GenAI client: {e}")
        return None


# ======================== API ROUTES ========================

@app.route("/api/health", methods=["GET"])
def health_check():
    client = get_gemini_client()
    return jsonify({
        "status": "ok",
        "backend": "python-flask",
        "hasGeminiKey": client is not None,
        "totalDocs": len(documents_store),
        "totalChunks": len(chunks_index),
        "totalWords": sum(d["wordCount"] for d in documents_store),
    })


@app.route("/api/documents", methods=["GET"])
def get_documents():
    docs = [
        {
            "id": d["id"],
            "name": d["name"],
            "type": d["type"],
            "size": d["size"],
            "uploadedAt": d["uploadedAt"],
            "wordCount": d["wordCount"],
            "isSample": d.get("isSample", False)
        }
        for d in documents_store
    ]
    return jsonify({
        "documents": docs,
        "totalDocs": len(docs)
    })


@app.route("/api/documents/<doc_id>", methods=["GET"])
def get_document_detail(doc_id):
    doc = next((d for d in documents_store if d["id"] == doc_id), None)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify(doc)


@app.route("/api/documents/upload", methods=["POST"])
def upload_document():
    try:
        name = "uploaded_doc.txt"
        doc_type = "text"
        extracted_text = ""

        # Multipart upload
        if "file" in request.files:
            uploaded_file = request.files["file"]
            name = uploaded_file.filename or "uploaded_doc.txt"
            raw_bytes = uploaded_file.read()

            if name.lower().endswith(".pdf"):
                doc_type = "pdf"
                extracted_text = extract_text_from_pdf(raw_bytes, name)
            elif name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                doc_type = "image"
                client = get_gemini_client()
                if client:
                    from google.genai import types
                    mime = "image/png" if name.lower().endswith(".png") else "image/jpeg"
                    part = types.Part.from_bytes(data=raw_bytes, mime_type=mime)
                    prompt = "Transcribe all visible text, numbers, and data points from this document image cleanly."
                    resp = client.models.generate_content(model="gemini-3.8-flash", contents=[part, prompt])
                    extracted_text = (resp.text or "").strip()
            else:
                if name.lower().endswith(".md"):
                    doc_type = "markdown"
                elif name.lower().endswith(".json"):
                    doc_type = "json"
                elif name.lower().endswith(".csv"):
                    doc_type = "csv"
                else:
                    doc_type = "text"
                extracted_text = raw_bytes.decode("utf-8", errors="replace").strip()

        # JSON body upload
        elif request.is_json:
            data = request.get_json() or {}
            name = data.get("name", "untitled_doc.txt")
            extracted_text = (data.get("text") or data.get("content") or "").strip()
            if name.lower().endswith(".md"):
                doc_type = "markdown"
            elif name.lower().endswith(".json"):
                doc_type = "json"
            else:
                doc_type = "text"
        else:
            return jsonify({"error": "No file uploaded"}), 400

        if not extracted_text:
            return jsonify({"error": f"Could not extract readable text from '{name}'."}), 400

        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat() + "Z"
        new_doc = {
            "id": doc_id,
            "name": name,
            "type": doc_type,
            "size": len(extracted_text.encode("utf-8")),
            "uploadedAt": now,
            "wordCount": count_words(extracted_text),
            "rawText": extracted_text,
            "isSample": False,
        }

        documents_store.insert(0, new_doc)
        rebuild_index()

        return jsonify({
            "success": True,
            "document": {
                "id": new_doc["id"],
                "name": new_doc["name"],
                "type": new_doc["type"],
                "size": new_doc["size"],
                "uploadedAt": new_doc["uploadedAt"],
                "wordCount": new_doc["wordCount"],
            }
        })

    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({"error": f"Failed to upload document: {str(e)}"}), 500


@app.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    global documents_store
    initial_count = len(documents_store)
    documents_store = [d for d in documents_store if d["id"] != doc_id]

    if len(documents_store) == initial_count:
        return jsonify({"error": "Document not found"}), 404

    rebuild_index()
    return jsonify({"success": True, "remainingDocs": len(documents_store)})


@app.route("/api/documents/reset-samples", methods=["POST"])
def reset_samples():
    reset_documents()
    return jsonify({
        "success": True,
        "documentsCount": len(documents_store),
        "chunksCount": len(chunks_index),
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    RAG Conversational Assistant endpoint:
    1. Retrieves relevant document passages for the query.
    2. Augments the Gemini prompt with retrieved context.
    3. Generates grounded answer with document citations and follow-up prompts.
    """
    try:
        data = request.get_json() or {}
        messages = data.get("messages", [])

        if not messages or not isinstance(messages, list):
            return jsonify({"error": "Messages array is required"}), 400

        # Latest user query
        user_query = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                user_query = m.get("content", "")
                break

        if not user_query:
            user_query = "Summarize the documents"

        # 1. RAG Retrieval Step
        retrieved_chunks = retrieve_relevant_chunks(user_query, top_k=4)

        if not documents_store:
            return jsonify({
                "content": "No documents are currently indexed in the wire archives. Please ingest documents or click 'Reset Wires' to begin broadcast.",
                "grounded": False,
                "sources": [],
                "retrievedChunks": [],
                "suggestedFollowUps": ["Reset to sample documents"]
            })

        client = get_gemini_client()
        if not client:
            # High-impact newsroom extractive synthesis mode
            top_chunk = retrieved_chunks[0] if retrieved_chunks else None
            cited_sources = []
            for doc in documents_store:
                if any(rc["doc_name"] == doc["name"] for rc in retrieved_chunks):
                    cited_sources.append({
                        "id": doc["id"],
                        "name": doc["name"],
                        "type": doc["type"]
                    })

            if top_chunk:
                report_lines = [
                    f"### BREAKING WIRE REPORT // EXTRACTIVE INTELLIGENCE",
                    f"Reporting live from our **verified newsroom dossiers** regarding *\"{user_query}\"*:",
                    f"",
                    f"* **Key Findings**: {top_chunk['snippet'][:450]}...",
                    f"* **Primary Wire Source**: `[{top_chunk['doc_name']}]` ({top_chunk.get('heading', 'Intelligence Segment')})",
                ]
                if len(retrieved_chunks) > 1:
                    second = retrieved_chunks[1]
                    report_lines.append(f"* **Corroborating Wire**: `[{second['doc_name']}]` — {second['snippet'][:250]}...")

                report_lines.extend([
                    f"",
                    f"> *Newsroom Note: Full RAG semantic vector retrieval is operational with live citations. Connect your `GEMINI_API_KEY` for generative multi-turn anchors.*"
                ])
                content = "\n".join(report_lines)
            else:
                content = f"### ANCHOR DESK BULLETIN\nNo direct match was found in the indexed dossiers for *\"{user_query}\"*. Please query topics covered in your wire archives or ingest new documents."

            return jsonify({
                "content": content,
                "grounded": True,
                "sources": cited_sources,
                "retrievedChunks": retrieved_chunks,
                "suggestedFollowUps": [
                    "What is our remote work equipment stipend?",
                    "How does distributed cache failover work?",
                    "What are the SEV-1 incident steps?"
                ],
                "modelUsed": "extractive-rag-teleprinter"
            })

        # 2. Build Context from Retrieved Chunks
        context_blocks = []
        for i, chunk in enumerate(retrieved_chunks, 1):
            context_blocks.append(
                f"[PASSAGE {i}] Source: {chunk['doc_name']} | Section: {chunk['heading']}\n{chunk['snippet']}"
            )
        rag_context = "\n\n---\n\n".join(context_blocks)

        # 3. Conversation history
        history_lines = []
        for msg in messages[-6:]:  # recent turns
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_lines.append(f"{role}: {msg.get('content', '')}")
        dialogue = "\n".join(history_lines)

        system_instruction = """You are a helpful, accurate, and concise Document RAG Assistant.
You answer user questions strictly based on the retrieved knowledge base passages provided.

RULES:
1. Ground your answer in the provided passages. Do not invent facts not found in the text.
2. Cite the source document name in square brackets whenever citing details, for example: `[AtlasTech_Employee_Handbook_2025.md]`.
3. Keep your answers clear, elegant, and straightforward:
   - Use bold for key terms or numbers.
   - Use concise bullet points where appropriate.
4. If the retrieved passages do not contain the answer, politely state that the information was not found in the current documents.
5. End your response with exactly 3 suggested follow-up questions formatted as:
[SUGGESTED_FOLLOW_UPS]
- Question 1?
- Question 2?
- Question 3?
"""

        prompt = f"""=== RETRIEVED KNOWLEDGE BASE PASSAGES (RAG SEARCH RESULTS) ===
{rag_context}

=== RECENT CONVERSATION ===
{dialogue}

Please provide a grounded answer based on the retrieved passages above, cite the documents used, and provide 3 suggested follow-ups."""

        # 4. Generate with Gemini
        response_text = ""
        used_model = ""
        last_error = None

        for model_name in MODELS_TO_TRY:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "system_instruction": system_instruction,
                        "temperature": 0.2,
                    }
                )
                response_text = resp.text or ""
                used_model = model_name
                break
            except Exception as err:
                print(f"Model {model_name} error: {err}")
                last_error = err

        if not response_text:
            return jsonify({
                "content": f"AI model generation error: {last_error}",
                "grounded": False,
                "sources": [],
                "retrievedChunks": retrieved_chunks,
                "suggestedFollowUps": ["Try asking another question"]
            }), 500

        # Parse follow-ups
        suggested_follow_ups = []
        clean_content = response_text
        if "[SUGGESTED_FOLLOW_UPS]" in response_text:
            parts = response_text.split("[SUGGESTED_FOLLOW_UPS]")
            clean_content = parts[0].strip()
            for line in parts[1].strip().splitlines():
                line = line.strip().lstrip("-* 1234567890.").strip()
                if line:
                    suggested_follow_ups.append(line)

        if not suggested_follow_ups:
            suggested_follow_ups = [
                "Can you summarize the main points?",
                "What other documents are available?",
                "Are there any specific requirements or policies?"
            ]

        # Identify cited sources
        cited_sources = []
        for doc in documents_store:
            if doc["name"].lower() in clean_content.lower() or any(rc["doc_name"] == doc["name"] for rc in retrieved_chunks):
                cited_sources.append({
                    "id": doc["id"],
                    "name": doc["name"],
                    "type": doc["type"]
                })

        return jsonify({
            "content": clean_content,
            "grounded": True,
            "sources": cited_sources,
            "retrievedChunks": retrieved_chunks,
            "suggestedFollowUps": suggested_follow_ups[:3],
            "modelUsed": used_model
        })

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": f"Failed to generate response: {str(e)}"}), 500


# ======================== STATIC SERVING (PRODUCTION) ========================

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_static(path):
    dist_dir = os.path.join(os.getcwd(), "dist")
    if os.path.exists(dist_dir):
        if path != "" and os.path.exists(os.path.join(dist_dir, path)):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, "index.html")
    return jsonify({
        "status": "Python RAG Backend Active",
        "message": "Frontend is running via Vite or building.",
        "endpoints": ["/api/health", "/api/documents", "/api/chat"]
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Python RAG Assistant Server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 5000)))
    parser.add_argument("--host", type=str, default="0.0.0.0")
    args = parser.parse_args()

    print(f"Starting Python RAG Assistant Server on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
