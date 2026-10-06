import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  wordCount: number;
  rawText: string;
  isSample?: boolean;
}

interface ChunkItem {
  chunk_id: string;
  doc_id: string;
  doc_name: string;
  heading: string;
  text: string;
  word_count: number;
  tokens: Set<string>;
  token_list: string[];
  is_sample: boolean;
}

interface RetrievedChunk {
  chunk_id: string;
  doc_name: string;
  heading: string;
  snippet: string;
  score: number;
}

const SAMPLE_DOCUMENTS: Omit<DocumentItem, 'size' | 'uploadedAt' | 'wordCount'>[] = [
  {
    id: 'doc-company-handbook',
    name: 'AtlasTech_Employee_Handbook_2025.md',
    type: 'markdown',
    isSample: true,
    rawText: `# AtlasTech Employee Handbook & Workplace Guidelines (2025)

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
Every team member has access to an annual Learning & Development budget of $1,500 USD for technical certifications, textbooks, academic coursework, and industry conferences.`,
  },
  {
    id: 'doc-system-architecture',
    name: 'Architecture_Spec_Distributed_Cache_v3.txt',
    type: 'text',
    isSample: true,
    rawText: `SYSTEM ARCHITECTURE SPECIFICATION: DISTRIBUTED CACHING LAYER (v3.2)
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
If Redis cluster CPU reaches >= 85% or connection pool timeouts exceed 50ms for 3 consecutive health checks, the resilience circuit breaker trips to HALF-OPEN. The gateway temporarily serves stale cache data for up to 10 minutes while rate-limiting write invalidations to protect the underlying Spanner database from a thundering herd problem.`,
  },
  {
    id: 'doc-incident-response',
    name: 'SRE_Incident_Response_Runbook.md',
    type: 'markdown',
    isSample: true,
    rawText: `# Site Reliability Engineering (SRE): Incident Severity Levels & Triage Protocol

## Severity Classifications
- **SEV-1 (Critical Outage)**: Complete disruption of core customer-facing functionality (e.g. checkout fails, API error rate > 5%, data loss hazard). Customer impact is widespread.
- **SEV-2 (Major Impairment)**: Substantial performance degradation or failure of non-critical secondary subsystems (e.g. recommendation engine offline, batch reporting delayed > 2 hours).
- **SEV-3 (Minor Disruption)**: Isolated bug affecting fewer than 1% of active users with an available manual workaround.
- **SEV-4 (Low Impact)**: Minor cosmetic UI defect or internal non-blocking telemetry delay.

## SEV-1 Escalation Procedures
1. **Immediate Declaration (0 - 5 minutes)**: Any on-call engineer can declare a SEV-1 via Slack command \`/incident declare sev-1\`. This triggers automated PagerDuty paging for the Incident Commander (IC), Communications Lead (CL), and Technical Subject Matter Experts (SMEs).
2. **War Room Setup (5 - 10 minutes)**: The Incident Commander opens a dedicated Google Meet war room and switches the incident Slack channel to read-only for non-essential observers.
3. **Public Status Notification (Within 15 minutes)**: The Communications Lead must update status.atlastech.io with an initial acknowledged message acknowledging investigation, refreshed every 30 minutes thereafter until resolution.
4. **Post-Incident Review (PIR)**: A blameless post-mortem document must be drafted within 48 business hours of incident closure, detailing timeline, root cause analysis (5 Whys), action items, and automated tests to prevent recurrence.`,
  },
  {
    id: 'doc-sustainability',
    name: 'Sustainability_Report_ESG_Targets.md',
    type: 'markdown',
    isSample: true,
    rawText: `# Global Environmental, Social & Governance (ESG) Annual Summary

## 1. Carbon Neutrality Milestones & Targets
- **Scope 1 & 2 Emissions**: Achieved 100% renewable electricity matching across all corporate headquarters and regional co-working hubs starting in Q3 2023.
- **Scope 3 Supply Chain Goal**: Commit to a 45% absolute reduction in supply chain carbon intensity per product unit by 2030, benchmarked against 2021 baselines.
- **Hardware Lifecycle Stewardship**: 92% of decommissioned server racks and employee laptops were refurbished or responsibly recycled through certified e-Stewards partners in fiscal year 2024.

## 2. Water Stewardship & Data Center PUE
Our tier-3 partnered data centers operate at an annualized Power Usage Effectiveness (PUE) average of 1.14. Closed-loop evaporative cooling systems saved an estimated 14.2 million gallons of potable water compared to traditional single-pass chillers.

## 3. Responsible AI & Energy Compute Budgets
Training large language models requires significant computational power. All production model inference nodes must be provisioned in carbon-aware regions during peak renewable supply hours (solar and wind excess curves). Batch offline index re-embeddings are scheduled during grid low-carbon intensity windows between 01:00 and 06:00 local time.`,
  },
];

// In-Memory Stores
let documentsStore: DocumentItem[] = [];
let chunksIndex: ChunkItem[] = [];

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't",
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
  'if', 'in', 'into', 'is', "isn't", 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', "wasn't", 'we', 'were', "weren't", 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
]);

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/\b[a-zA-Z0-9_\-$]+\b/g);
  if (!matches) return [];
  return matches.filter((w) => !STOP_WORDS.has(w) && w.length > 1);
}

// Semantic Chunking Engine
function chunkDocument(docId: string, docName: string, text: string, isSample: boolean): ChunkItem[] {
  const chunks: ChunkItem[] = [];
  const lines = text.split('\n');
  let currentHeading = docName;
  let currentLines: string[] = [];

  const flushChunk = () => {
    const chunkBody = currentLines.join('\n').trim();
    if (chunkBody && chunkBody.length > 5) {
      const words = tokenize(`${chunkBody} ${currentHeading} ${docName}`);
      chunks.push({
        chunk_id: `${docId}-c${chunks.length}`,
        doc_id: docId,
        doc_name: docName,
        heading: currentHeading,
        text: chunkBody,
        word_count: countWords(chunkBody),
        tokens: new Set(words),
        token_list: words,
        is_sample: isSample,
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped.startsWith('#') || (/^\d+\.\s+[A-Z]/.test(stripped) && stripped.length < 90)) {
      if (currentLines.length > 0) {
        flushChunk();
      }
      currentHeading = stripped.replace(/^#+\s*/, '').trim();
      currentLines.push(stripped);
    } else {
      currentLines.push(line);
      if (countWords(currentLines.join('\n')) >= 200) {
        flushChunk();
      }
    }
  }

  flushChunk();

  // Safeguard: Ensure at least one chunk exists for any document with text
  if (chunks.length === 0 && text.trim().length > 0) {
    const cleanText = text.trim();
    const words = tokenize(`${cleanText} ${docName}`);
    chunks.push({
      chunk_id: `${docId}-c0`,
      doc_id: docId,
      doc_name: docName,
      heading: docName,
      text: cleanText,
      word_count: countWords(cleanText),
      tokens: new Set(words),
      token_list: words,
      is_sample: isSample,
    });
  }

  return chunks;
}

function rebuildIndex() {
  chunksIndex = [];
  for (const doc of documentsStore) {
    const chunks = chunkDocument(doc.id, doc.name, doc.rawText, !!doc.isSample);
    chunksIndex.push(...chunks);
  }
}

function resetDocuments() {
  const now = new Date().toISOString();
  documentsStore = SAMPLE_DOCUMENTS.map((doc) => {
    const rawText = doc.rawText;
    return {
      ...doc,
      size: Buffer.byteLength(rawText, 'utf-8'),
      uploadedAt: now,
      wordCount: countWords(rawText),
      rawText,
    };
  });
  rebuildIndex();
}

resetDocuments();

// Robust Retrieval Engine with User-Upload Prioritization & Fuzzy Matching
function retrieveRelevantChunks(query: string, topK: number = 6): RetrievedChunk[] {
  if (chunksIndex.length === 0) return [];

  const qTokens = tokenize(query);
  const qLower = query.toLowerCase().trim();

  // Detect if user query refers to uploaded / user documents
  const isUploadReferenced =
    /\b(upload|uploaded|uploads|uploading|my doc|my document|my file|user doc|new doc|added doc|recent doc|what did i upload|inspect upload|retrieve upload|check upload|uploaded file|the file|this file)\b/i.test(
      query
    );

  const uploadedDocs = documentsStore.filter((d) => !d.isSample);

  // Check if query mentions any uploaded document's name
  const mentionsUploadedDoc = uploadedDocs.some((d) => {
    const cleanName = d.name.toLowerCase().replace(/\.[^/.]+$/, '');
    const nameParts = cleanName.split(/[-_.\s]+/).filter((p) => p.length >= 3);
    return (
      qLower.includes(d.name.toLowerCase()) ||
      qLower.includes(cleanName) ||
      nameParts.some((p) => qLower.includes(p))
    );
  });

  const scored: { score: number; chunk: ChunkItem }[] = [];

  for (const chunk of chunksIndex) {
    let score = 0.0;
    const textLower = chunk.text.toLowerCase();
    const headingLower = chunk.heading.toLowerCase();
    const docNameLower = chunk.doc_name.toLowerCase();
    const docNameBase = docNameLower.replace(/\.[^/.]+$/, '');
    const docNameParts = docNameBase.split(/[-_.\s]+/).filter((p) => p.length >= 2);

    // 1. If user asks about uploaded documents and this chunk is from an uploaded doc
    if ((isUploadReferenced || mentionsUploadedDoc) && !chunk.is_sample) {
      score += 25.0;
    }

    // 2. Exact full phrase match bonus
    if (qLower.length > 3 && textLower.includes(qLower)) {
      score += 10.0;
    }

    // 3. Document name match bonus
    if (qLower.includes(docNameLower) || qLower.includes(docNameBase)) {
      score += 15.0;
    } else {
      for (const part of docNameParts) {
        if (qLower.includes(part)) {
          score += 5.0;
        }
      }
    }

    // 4. Heading match bonus
    for (const qt of qTokens) {
      if (headingLower.includes(qt)) {
        score += 4.0;
      }
    }

    // 5. Term frequency and token matching (with prefix/stem matching)
    for (const qt of qTokens) {
      const exactCount = chunk.token_list.filter((w) => w === qt).length;
      if (exactCount > 0) {
        score += 1.5 + Math.log(1 + exactCount);
      } else if (qt.length >= 4) {
        const stem = qt.slice(0, 4);
        if (chunk.token_list.some((w) => w.startsWith(stem))) {
          score += 1.0;
        }
      }
    }

    // 6. Token coverage ratio
    if (qTokens.length > 0) {
      const matchedTokens = qTokens.filter(
        (qt) =>
          chunk.tokens.has(qt) ||
          [...chunk.tokens].some((t) => t.includes(qt) || qt.includes(t))
      ).length;
      const coverage = matchedTokens / qTokens.length;
      score += coverage * 4.0;
    }

    // 7. General recency / user-upload mild priority
    if (!chunk.is_sample) {
      score += 2.0;
    }

    scored.push({ score, chunk });
  }

  scored.sort((a, b) => b.score - a.score);

  const topResults: RetrievedChunk[] = [];
  const addedIds = new Set<string>();

  // If upload was specifically referenced, prioritize uploaded doc chunks first
  if ((isUploadReferenced || mentionsUploadedDoc) && uploadedDocs.length > 0) {
    for (const item of scored) {
      if (!item.chunk.is_sample && !addedIds.has(item.chunk.chunk_id)) {
        addedIds.add(item.chunk.chunk_id);
        topResults.push({
          chunk_id: item.chunk.chunk_id,
          doc_name: item.chunk.doc_name,
          heading: item.chunk.heading,
          snippet: item.chunk.text,
          score: Math.max(item.score, 10.0),
        });
      }
    }
  }

  for (const item of scored) {
    if (topResults.length >= topK) break;
    if (!addedIds.has(item.chunk.chunk_id)) {
      if (item.score > 0.5 || topResults.length === 0) {
        addedIds.add(item.chunk.chunk_id);
        topResults.push({
          chunk_id: item.chunk.chunk_id,
          doc_name: item.chunk.doc_name,
          heading: item.chunk.heading,
          snippet: item.chunk.text,
          score: Math.round(item.score * 100) / 100,
        });
      }
    }
  }

  // Fallback: If no query tokens matched, return chunks prioritizing user-uploaded documents first!
  if (topResults.length === 0 && chunksIndex.length > 0) {
    const sortedChunks = [...chunksIndex].sort((a, b) => {
      if (!a.is_sample && b.is_sample) return -1;
      if (a.is_sample && !b.is_sample) return 1;
      return 0;
    });

    for (const chunk of sortedChunks.slice(0, topK)) {
      topResults.push({
        chunk_id: chunk.chunk_id,
        doc_name: chunk.doc_name,
        heading: chunk.heading,
        snippet: chunk.text,
        score: chunk.is_sample ? 0.0 : 1.0,
      });
    }
  }

  return topResults;
}

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

const MODELS_TO_TRY = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

async function extractTextFromPdf(pdfBuffer: Buffer, filename: string): Promise<string> {
  let extracted = '';
  try {
    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText();
    extracted = (parsed?.text || '').trim();
  } catch (err) {
    console.error(`PDFParse error on ${filename}:`, err);
  }

  const cleanExtracted = extracted.replace(/--\s*\d+\s*of\s*\d+\s*--/g, '').trim();

  if (cleanExtracted.length >= 30) {
    return cleanExtracted;
  }

  // Fallback to Gemini Multimodal OCR
  const client = getGeminiClient();
  if (client) {
    for (const modelName of MODELS_TO_TRY) {
      try {
        const resp = await client.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                data: pdfBuffer.toString('base64'),
                mimeType: 'application/pdf',
              },
            },
            `Extract and transcribe all readable text, section headings, specifications, bullet points, and tables from this document ('${filename}') into clean Markdown. Do not summarize.`,
          ],
        });
        if (resp.text && resp.text.trim()) {
          return resp.text.trim();
        }
      } catch (geminiErr) {
        console.error(`Gemini OCR attempt on ${modelName} failed:`, geminiErr);
      }
    }
  }

  return cleanExtracted || extracted;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // ======================== API ROUTES ========================

  app.get('/api/health', (_req, res) => {
    const client = getGeminiClient();
    res.json({
      status: 'ok',
      backend: 'express-rag',
      hasGeminiKey: client !== null,
      totalDocs: documentsStore.length,
      totalChunks: chunksIndex.length,
      totalWords: documentsStore.reduce((acc, d) => acc + d.wordCount, 0),
    });
  });

  app.get('/api/documents', (_req, res) => {
    const docs = documentsStore.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      size: d.size,
      uploadedAt: d.uploadedAt,
      wordCount: d.wordCount,
      isSample: !!d.isSample,
    }));
    res.json({ documents: docs, totalDocs: docs.length });
  });

  app.get('/api/documents/:id', (req, res) => {
    const param = decodeURIComponent(req.params.id).toLowerCase();
    const doc = documentsStore.find(
      (d) =>
        d.id === req.params.id ||
        d.name.toLowerCase() === param ||
        d.name.toLowerCase().includes(param) ||
        param.includes(d.name.toLowerCase())
    );
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  });

  app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
      let name = '';
      let docType = 'text';
      let extractedText = '';

      if (req.file) {
        name = req.file.originalname || 'uploaded_document.txt';
        const buffer = req.file.buffer;

        if (name.toLowerCase().endsWith('.pdf')) {
          docType = 'pdf';
          extractedText = await extractTextFromPdf(buffer, name);
        } else {
          if (name.toLowerCase().endsWith('.md')) docType = 'markdown';
          else if (name.toLowerCase().endsWith('.json')) docType = 'json';
          else if (name.toLowerCase().endsWith('.csv')) docType = 'csv';
          else docType = 'text';

          extractedText = buffer.toString('utf-8').trim();
        }
      } else if (req.body) {
        const body = req.body;
        name = body.name || 'document.txt';
        const rawType = body.type || 'text';
        extractedText = (body.text || body.content || '').trim();

        if (name.toLowerCase().endsWith('.pdf') || rawType.toLowerCase().includes('pdf')) {
          docType = 'pdf';
          let b64 = body.base64 || body.content || '';
          if (b64.includes(',')) b64 = b64.split(',')[1];
          const pdfBuffer = Buffer.from(b64, 'base64');
          extractedText = await extractTextFromPdf(pdfBuffer, name);
        } else if (name.toLowerCase().endsWith('.md')) {
          docType = 'markdown';
        } else {
          docType = 'text';
        }
      }

      if (!extractedText || !extractedText.trim()) {
        return res.status(400).json({
          error: `The document '${name}' contains no readable text or is an unsupported format.`,
        });
      }

      // If document with the exact same name already exists in store, remove it first
      documentsStore = documentsStore.filter((d) => d.name.toLowerCase() !== name.toLowerCase());

      const docId = `doc-${Math.random().toString(36).substring(2, 10)}`;
      const now = new Date().toISOString();
      const newDoc: DocumentItem = {
        id: docId,
        name,
        type: docType,
        size: Buffer.byteLength(extractedText, 'utf-8'),
        uploadedAt: now,
        wordCount: countWords(extractedText),
        rawText: extractedText,
        isSample: false,
      };

      // Place user-uploaded documents at the beginning of the store
      documentsStore.unshift(newDoc);
      rebuildIndex();

      res.json({
        success: true,
        document: {
          id: newDoc.id,
          name: newDoc.name,
          type: newDoc.type,
          size: newDoc.size,
          uploadedAt: newDoc.uploadedAt,
          wordCount: newDoc.wordCount,
        },
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ error: `Failed to ingest document: ${err.message || err}` });
    }
  });

  app.delete('/api/documents/:id', (req, res) => {
    const initialCount = documentsStore.length;
    documentsStore = documentsStore.filter((d) => d.id !== req.params.id);

    if (documentsStore.length === initialCount) {
      return res.status(404).json({ error: 'Document not found' });
    }

    rebuildIndex();
    res.json({ success: true, remainingDocs: documentsStore.length });
  });

  app.post('/api/documents/reset-samples', (_req, res) => {
    resetDocuments();
    res.json({ success: true, documentsCount: documentsStore.length });
  });

  // Conversational RAG Endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const messages = req.body?.messages;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      if (documentsStore.length === 0) {
        return res.json({
          content: 'There are currently no documents in the knowledge base. Please upload documents or reset sample documents to get started.',
          grounded: false,
          sources: [],
          retrievedChunks: [],
          suggestedFollowUps: ['Reset sample documents'],
        });
      }

      // Extract the latest query from the conversation
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      const query = lastUserMsg?.content || '';

      // Perform RAG Retrieval to find most relevant semantic chunks
      const retrievedChunks = retrieveRelevantChunks(query, 6);

      const client = getGeminiClient();

      // If no API key is provided, perform smart local retrieval synthesis
      if (!client) {
        if (retrievedChunks.length === 0) {
          return res.json({
            content: 'No matching information found in the current documents for your query. Try searching for specific terms found in the documents.',
            grounded: true,
            sources: [],
            retrievedChunks: [],
            suggestedFollowUps: ['Summarize the employee handbook', 'What is the distributed cache architecture?'],
          });
        }

        const topChunk = retrievedChunks[0];
        const primaryDoc = documentsStore.find((d) => d.name === topChunk.doc_name);

        const synthesis = `Based on **[${topChunk.doc_name}]** (${topChunk.heading}):\n\n${topChunk.snippet}\n\n*Note: Running in local RAG retrieval mode. Configure GEMINI_API_KEY for advanced generative synthesis.*`;

        const sources = primaryDoc
          ? [{ id: primaryDoc.id, name: primaryDoc.name, type: primaryDoc.type }]
          : [];

        return res.json({
          content: synthesis,
          grounded: true,
          sources,
          retrievedChunks,
          suggestedFollowUps: [
            `Tell me more about ${topChunk.heading}`,
            'What other documents are available?',
            'What are the key points in this document?',
          ],
          modelUsed: 'local-rag-retrieval',
        });
      }

      // Distinguish between user-uploaded and canonical sample documents
      const userUploadedDocs = documentsStore.filter((d) => !d.isSample);
      const sampleDocs = documentsStore.filter((d) => d.isSample);

      const userDocSummary =
        userUploadedDocs.length > 0
          ? userUploadedDocs
              .map((d) => `- [USER UPLOADED]: "${d.name}" (${d.type}, ${d.wordCount} words)`)
              .join('\n')
          : 'None (no user documents uploaded yet)';

      const sampleDocSummary = sampleDocs
        .map((d) => `- [CANONICAL SAMPLE]: "${d.name}" (${d.type}, ${d.wordCount} words)`)
        .join('\n');

      const chunksContext = retrievedChunks
        .map(
          (c, idx) =>
            `[RETRIEVED CHUNK #${idx + 1}] Source: "${c.doc_name}" | Section: "${c.heading}" (Score: ${c.score})\n${c.snippet}`
        )
        .join('\n\n---\n\n');

      const conversationTranscript = messages
        .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || ''}`)
        .join('\n\n');

      const systemInstruction = `You are a helpful, accurate, and concise Document AI assistant.
Your task is to answer user queries using Retrieval-Augmented Generation (RAG).

GROUNDING RULES:
1. Ground answers strictly in the retrieved document chunks provided below. Do NOT make up facts.
2. If the user asks about an uploaded document, "my file", "what was uploaded", or refers to what was recently uploaded, prioritize and synthesize from the [USER UPLOADED] document(s).
3. Always cite the source document name in brackets whenever stating a fact, metric, policy, or detail (e.g. [${documentsStore[0]?.name || 'Document'}]).
4. Be clear, direct, and well-structured using markdown headings and bullet points.
5. If the retrieved chunks contain relevant information, present it thoroughly.
6. Conclude your response with exactly 3 helpful follow-up questions formatted as:
[SUGGESTED_FOLLOW_UPS]
- Follow-up question 1?
- Follow-up question 2?
- Follow-up question 3?`;

      const prompt = `=== KNOWLEDGE BASE INVENTORY ===
USER UPLOADED FILES:
${userDocSummary}

CANONICAL SAMPLE FILES:
${sampleDocSummary}

=== RETRIEVED RELEVANT CHUNKS ===
${chunksContext}

=== CONVERSATION TRANSCRIPT ===
${conversationTranscript}

Please formulate an accurate, well-structured response answering the user's latest query, citing the source document(s) in brackets, and including follow-up suggestions.`;

      let responseText = '';
      let usedModel = '';
      let lastError: any = null;

      for (const modelName of MODELS_TO_TRY) {
        try {
          const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
          responseText = response.text || '';
          usedModel = modelName;
          break;
        } catch (err) {
          console.error(`Model ${modelName} error:`, err);
          lastError = err;
        }
      }

      if (!responseText) {
        return res.status(500).json({
          content: `Unable to generate response: ${lastError?.message || lastError}. Please try again.`,
          grounded: false,
          sources: [],
          retrievedChunks,
          suggestedFollowUps: ['Retry inquiry', 'Summarize sample documents'],
        });
      }

      // Parse follow-up questions
      let cleanContent = responseText;
      const suggestedFollowUps: string[] = [];

      if (responseText.includes('[SUGGESTED_FOLLOW_UPS]')) {
        const parts = responseText.split('[SUGGESTED_FOLLOW_UPS]');
        cleanContent = parts[0].trim();
        const rawFollowUps = parts[1].trim();
        for (const line of rawFollowUps.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const q = trimmed.replace(/^[-*\s]+/, '').trim();
            if (q) suggestedFollowUps.push(q);
          } else if (/^\d+\./.test(trimmed)) {
            const q = trimmed.replace(/^\d+\.\s*/, '').trim();
            if (q) suggestedFollowUps.push(q);
          }
        }
      }

      if (suggestedFollowUps.length === 0) {
        suggestedFollowUps.push(
          'Can you elaborate on this section?',
          'What are the key takeaways?',
          'Are there any exceptions or edge cases mentioned?'
        );
      }

      // Identify cited documents
      const citedSources = documentsStore
        .filter((d) => {
          const lower = cleanContent.toLowerCase();
          const baseName = d.name.split('.')[0].toLowerCase();
          return (
            lower.includes(d.name.toLowerCase()) ||
            lower.includes(baseName) ||
            retrievedChunks.some((rc) => rc.doc_name === d.name)
          );
        })
        .map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
        }));

      res.json({
        content: cleanContent,
        grounded: true,
        sources: citedSources,
        retrievedChunks,
        suggestedFollowUps: suggestedFollowUps.slice(0, 3),
        modelUsed: usedModel,
      });
    } catch (err: any) {
      console.error('Chat endpoint error:', err);
      res.status(500).json({ error: `Chat processing error: ${err.message || err}` });
    }
  });

  // Mount Vite dev middleware or serve static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Document RAG Server running on http://localhost:${PORT}`);
  });
}

startServer();
