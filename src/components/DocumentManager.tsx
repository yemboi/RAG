import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  Search,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { DocumentItem } from '../types';

interface DocumentManagerProps {
  documents: DocumentItem[];
  loading: boolean;
  onRefresh: () => void;
  onInspectDoc: (doc: DocumentItem) => void;
}

export function DocumentManager({
  documents,
  loading,
  onRefresh,
  onInspectDoc,
}: DocumentManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    setUploading(true);
    setStatusMessage(null);

    let successCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file, file.name);

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Upload failed (${res.status})`);
        }
        successCount++;
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message || 'Upload error'}`);
      }
    }

    setUploading(false);

    if (successCount > 0 && errors.length === 0) {
      setStatusMessage({
        type: 'success',
        text: `Indexed ${successCount} document${successCount > 1 ? 's' : ''}. You can now query its contents!`,
      });
      onRefresh();
    } else if (errors.length > 0) {
      setStatusMessage({
        type: 'error',
        text: errors[0],
      });
      if (successCount > 0) onRefresh();
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to remove ${docName}` });
    }
  };

  const handleResetSamples = async () => {
    setUploading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/documents/reset-samples', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      setStatusMessage({ type: 'success', text: 'Reset to canonical sample documents.' });
      onRefresh();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to reset sample documents.' });
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const userDocCount = documents.filter((d) => !d.isSample).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-900 text-sm">Knowledge Base</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {documents.length}
          </span>
          {userDocCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              {userDocCount} user upload{userDocCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={handleResetSamples}
          disabled={uploading}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          title="Reset to default sample documents"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
          <span>Reset Samples</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div className="p-4 border-b border-slate-100">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept=".txt,.md,.pdf,.json,.csv"
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-1.5">
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                <span className="text-xs font-medium text-slate-600">Uploading & indexing document...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-medium text-slate-700">
                  Click or drag files to upload
                </span>
                <span className="text-[11px] text-slate-400">
                  PDF, Markdown, TXT, CSV, JSON
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mt-2.5 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="truncate flex-1">{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search indexed documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-xs">Loading documents...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {searchQuery ? 'No documents match your search.' : 'No documents in knowledge base.'}
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isUserDoc = !doc.isSample;

            return (
              <div
                key={doc.id}
                className={`group p-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                  isUserDoc
                    ? 'bg-indigo-50/30 border-indigo-200 hover:bg-indigo-50/60'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div
                  onClick={() => onInspectDoc(doc)}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-100 text-slate-600">
                      {doc.type}
                    </span>
                    {isUserDoc && (
                      <span className="px-1.5 py-0.2 text-[10px] font-semibold tracking-wider rounded bg-indigo-100 text-indigo-700">
                        Uploaded
                      </span>
                    )}
                    <h4 className="text-xs font-medium text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                      {doc.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>•</span>
                    <span>{doc.wordCount.toLocaleString()} words</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onInspectDoc(doc)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                    title="View document text"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    title="Remove document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
