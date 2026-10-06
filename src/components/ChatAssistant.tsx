import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  Send,
  User,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Layers,
  Loader2,
} from 'lucide-react';
import { ChatMessage, DocumentItem } from '../types';

interface ChatAssistantProps {
  documents: DocumentItem[];
  onInspectDocByName: (docName: string) => void;
  onOpenKnowledgeBase?: () => void;
}

const SAMPLE_PROMPTS = [
  'What is our remote equipment stipend and connectivity allowance?',
  'How does the distributed cache cluster handle node failover and read misses?',
  'What are the SEV-1 incident response steps, timeline, and communication SLA?',
  'What carbon neutrality and renewable energy targets have been attained?',
];

export function ChatAssistant({
  documents,
  onInspectDocByName,
  onOpenKnowledgeBase,
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Hello! I can answer questions grounded in your indexed documents.\n\nAsk about company policies, architecture specifications, incident runbooks, or upload your own files to expand the knowledge base.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowUps: SAMPLE_PROMPTS,
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [expandedChunksMsgId, setExpandedChunksMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'msg-welcome' && userDocs.length > 0) {
      setMessages([
        {
          id: 'msg-welcome',
          role: 'assistant',
          content: `Hello! I can answer questions grounded in your indexed documents, including your uploaded file **${userDocs[0].name}**.\n\nAsk about company policies, architecture specifications, incident runbooks, or your uploaded files.`,
          timestamp: messages[0].timestamp,
          suggestedFollowUps: activeSamplePrompts,
        },
      ]);
    }
  }, [documents.length]);

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate response');
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: data.sources || [],
        retrievedChunks: data.retrievedChunks || [],
        grounded: data.grounded ?? true,
        suggestedFollowUps: data.suggestedFollowUps || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Unable to complete query: ${err.message || 'Server error'}. Please verify connection.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          suggestedFollowUps: ['Retry inquiry', 'What documents are indexed?'],
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const userDocs = documents.filter((d) => !d.isSample);
  const activeSamplePrompts = userDocs.length > 0
    ? [
        `What are the key points in ${userDocs[0].name}?`,
        `Summarize the uploaded document`,
        ...SAMPLE_PROMPTS.slice(0, 2),
      ]
    : SAMPLE_PROMPTS;

  const handleResetChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Chat cleared. What question can I help you research in your documents?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: activeSamplePrompts,
      },
    ]);
  };

  // Helper to format text with bold, bullet points, headers, citations
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-sm text-slate-800 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="font-semibold text-slate-900 text-sm mt-3 mb-1">
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="font-bold text-slate-900 text-base mt-4 mb-1.5">
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            );
          }
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const itemText = trimmed.replace(/^[-*]\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 ml-1">
                <span className="text-indigo-600 mt-1.5">•</span>
                <span className="flex-1">{renderInlineStyles(itemText)}</span>
              </div>
            );
          }
          if (/^\d+\.\s+/.test(trimmed)) {
            const numMatch = trimmed.match(/^(\d+)\.\s+/);
            const num = numMatch ? numMatch[1] : '1';
            const itemText = trimmed.replace(/^\d+\.\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 ml-1">
                <span className="font-semibold text-slate-600 text-xs mt-0.5">{num}.</span>
                <span className="flex-1">{renderInlineStyles(itemText)}</span>
              </div>
            );
          }
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          return <p key={idx}>{renderInlineStyles(trimmed)}</p>;
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string) => {
    // Replace doc citations in [brackets] with interactive links
    const parts = text.split(/(\[[^\]]+\]|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('[') && part.endsWith(']')) {
        const inner = part.slice(1, -1);
        const isDocCitation = documents.some(
          (d) =>
            d.name.toLowerCase() === inner.toLowerCase() ||
            inner.toLowerCase().includes(d.name.toLowerCase()) ||
            d.name.toLowerCase().includes(inner.toLowerCase())
        );

        if (isDocCitation) {
          return (
            <button
              key={i}
              onClick={() => onInspectDocByName(inner)}
              className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors cursor-pointer"
              title="Click to view source document"
            >
              <span>{inner}</span>
              <ExternalLink className="w-3 h-3 text-indigo-500" />
            </button>
          );
        }
      }
      return part;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-semibold text-slate-900 text-sm">Document Assistant</h2>
          <span className="text-xs text-slate-400">RAG Semantic Search</span>
        </div>

        <button
          onClick={handleResetChat}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          title="Clear current conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const chunksExpanded = expandedChunksMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : msg.isError
                    ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-bl-xs'
                    : 'bg-slate-50 text-slate-900 border border-slate-200 rounded-bl-xs'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75">
                  <span className="font-medium">
                    {isUser ? 'You' : 'Assistant'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Text */}
                <div className="mt-1">
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    renderFormattedContent(msg.content)
                  )}
                </div>

                {/* Retrieved RAG Chunks Accordion */}
                {!isUser && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80">
                    <button
                      onClick={() =>
                        setExpandedChunksMsgId(chunksExpanded ? null : msg.id)
                      }
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        {chunksExpanded ? 'Hide' : 'View'} {msg.retrievedChunks.length} Retrieved Semantic Chunks
                      </span>
                      {chunksExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {chunksExpanded && (
                      <div className="mt-2.5 space-y-2">
                        {msg.retrievedChunks.map((chunk, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 truncate">
                                {chunk.heading || chunk.doc_name}
                              </span>
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 shrink-0">
                                Match: {chunk.score}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Source: {chunk.doc_name}
                            </div>
                            <p className="text-slate-600 line-clamp-3 leading-relaxed mt-1">
                              {chunk.snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cited Sources List */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Sources:</span>
                    {msg.sources.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onInspectDocByName(s.name)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[160px]">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Message Actions */}
                {!isUser && (
                  <div className="mt-2 pt-2 flex items-center justify-end">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Suggested Follow-Up Chips */}
              {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-2xl">
                  {msg.suggestedFollowUps.map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => handleSend(prompt)}
                      disabled={isGenerating}
                      className="text-xs px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors text-left cursor-pointer disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isGenerating && (
          <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Searching indexed chunks and synthesizing response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your indexed documents..."
            className="w-full pl-4 pr-12 py-3 bg-transparent text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none max-h-32"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputPrompt.trim() || isGenerating}
            className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
          <span>Press Enter to send · Shift+Enter for new line</span>
          {documents.length > 0 && (
            <span>{documents.length} document{documents.length > 1 ? 's' : ''} in search scope</span>
          )}
        </div>
      </div>
    </div>
  );
}
