import { useState, useEffect } from 'react';
import {
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  FileText,
} from 'lucide-react';
import { DocumentItem, HealthStatus } from './types';
import { DocumentManager } from './components/DocumentManager';
import { ChatAssistant } from './components/ChatAssistant';
import { DocumentViewerModal } from './components/DocumentViewerModal';

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [inspectedDoc, setInspectedDoc] = useState<DocumentItem | null>(null);

  const fetchDocuments = async () => {
    try {
      const [docRes, healthRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/health'),
      ]);

      if (docRes.ok) {
        const docData = await docRes.json();
        setDocuments(docData.documents || []);
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealthStatus(healthData);
      }
    } catch (err) {
      console.error('Failed to fetch documents or health status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleInspectDocByName = (docName: string) => {
    const cleanSearch = docName.toLowerCase().replace(/[`\[\]]/g, '').trim();
    const cleanBase = cleanSearch.replace(/\.[^/.]+$/, '');
    const found = documents.find((d) => {
      const dName = d.name.toLowerCase();
      const dBase = dName.replace(/\.[^/.]+$/, '');
      return (
        dName === cleanSearch ||
        dBase === cleanBase ||
        dName.includes(cleanSearch) ||
        cleanSearch.includes(dName) ||
        dBase.includes(cleanBase) ||
        cleanBase.includes(dBase)
      );
    });

    if (found) {
      setInspectedDoc(found);
    } else {
      setInspectedDoc({
        id: cleanSearch,
        name: docName,
        type: 'text',
        size: 0,
        uploadedAt: new Date().toISOString(),
        wordCount: 0,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Simple Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Document Collection Q&A
              </h1>
              <p className="text-[11px] text-slate-500 leading-none">
                Retrieval-Augmented Generation (RAG)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {healthStatus && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  {documents.length} Docs ({documents.filter((d) => !d.isSample).length} uploaded) ·{' '}
                  {healthStatus.totalChunks ?? 0} Chunks
                </span>
              </div>
            )}

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-slate-500" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-slate-500" />
              )}
              <span>{isSidebarOpen ? 'Hide Documents' : 'Show Documents'}</span>
              <span className="text-slate-400">({documents.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Document Knowledge Base */}
        {isSidebarOpen && (
          <aside className="lg:col-span-4 h-[calc(100vh-6rem)] min-h-[500px]">
            <DocumentManager
              documents={documents}
              loading={loading}
              onRefresh={fetchDocuments}
              onInspectDoc={(doc) => setInspectedDoc(doc)}
            />
          </aside>
        )}

        {/* Right Column: Conversational Assistant */}
        <section
          className={`${
            isSidebarOpen ? 'lg:col-span-8' : 'lg:col-span-12'
          } h-[calc(100vh-6rem)] min-h-[500px] transition-all`}
        >
          <ChatAssistant
            documents={documents}
            onInspectDocByName={handleInspectDocByName}
            onOpenKnowledgeBase={() => setIsSidebarOpen(true)}
          />
        </section>
      </main>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        doc={inspectedDoc}
        isOpen={Boolean(inspectedDoc)}
        onClose={() => setInspectedDoc(null)}
      />
    </div>
  );
}
