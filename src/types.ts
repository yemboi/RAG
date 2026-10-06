export interface DocumentItem {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'markdown' | 'csv' | 'json';
  size: number;
  uploadedAt: string;
  wordCount: number;
  isSample?: boolean;
}

export interface SourceDoc {
  id: string;
  name: string;
  type: string;
}

export interface RetrievedChunk {
  chunk_id?: string;
  doc_name: string;
  heading?: string;
  snippet: string;
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: SourceDoc[];
  retrievedChunks?: RetrievedChunk[];
  grounded?: boolean;
  suggestedFollowUps?: string[];
  isError?: boolean;
}

export interface HealthStatus {
  status: string;
  backend: string;
  hasGeminiKey: boolean;
  totalDocs: number;
  totalChunks?: number;


  
  totalWords?: number;
}
