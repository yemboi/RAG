import { useState, useEffect } from 'react';
import { X, Copy, Check, FileText, Calendar, Hash } from 'lucide-react';
import { DocumentItem } from '../types';

interface DocumentViewerModalProps {
  doc: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewerModal({ doc, isOpen, onClose }: DocumentViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !doc) {
      setContent('');
      return;
    }

    setLoading(true);
    fetch(`/api/documents/${doc.id}`)
      .then((res) => res.json())
      .then((data) => {
        setContent(data.rawText || 'No text content available.');
      })
      .catch((err) => {
        console.error('Error fetching document content:', err);
        setContent('Failed to load document content.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="document-viewer-modal"
        className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {doc.type}
              </span>
              {doc.isSample && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Sample Document
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-slate-900 truncate" title={doc.name}>
              {doc.name}
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(doc.uploadedAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" />
                {doc.wordCount.toLocaleString()} words
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              disabled={loading || !content}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close document modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-white text-sm text-slate-800 leading-relaxed font-mono whitespace-pre-wrap selection:bg-indigo-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2 font-sans">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading document text...</span>
            </div>
          ) : (
            content
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Indexed in RAG semantic vector store</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
