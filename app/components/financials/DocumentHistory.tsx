'use client';

import { useState, useEffect } from 'react';
import { revenueApi } from '@/lib/revenue/api';
import DocumentPreview from './DocumentPreview';
import type { DocumentMode } from './DocumentPreview';

interface DocumentHistoryProps {
  tenantId: string;
  entityId: string;
  mode: DocumentMode;
}

export default function DocumentHistory({ tenantId, entityId, mode }: DocumentHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isInvoice = mode === 'invoice';
  const label = isInvoice ? 'invoice' : 'statement';

  async function handleDocumentAction(action: string) {
    if (action === 'email') alert('Email sending — coming soon');
    if (action === 'whatsapp') alert('WhatsApp sending — coming soon');
    if (action === 'download') alert('PDF download — coming soon');
    if (action === 'print') window.print();
  }

  useEffect(() => {
    async function load() {
      try {
        const hist = await revenueApi.getStatementHistory({ entityId, tenantId });
        setHistory(hist || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, [tenantId, entityId]);

  if (loading) return <p className="text-sm text-zinc-500 py-4">Loading...</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-300">{history.length} {label}{history.length !== 1 ? 's' : ''}</p>

      {history.length === 0 ? (
        <p className="text-sm text-zinc-500 py-4">No {label}s yet. Run a billing cycle in Revenue Ops to generate {label}s.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h: any) => (
            <div
              key={h.id}
              onClick={() => setSelectedDoc({ ...h.statement_data, status: h.status })}
              className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:bg-white/[0.02] cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-light">
                    {h.statement_data?.lease_ref ? `${h.statement_data.lease_ref} — v${h.version}` : `${label} v${h.version}`}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{h.generated_at?.split('T')[0]}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  h.status === 'issued' ? 'bg-emerald-500/10 text-emerald-400' :
                  h.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                  'bg-zinc-800 text-zinc-500'
                }`}>
                  {h.status}
                </span>
              </div>
              {h.change_reason && <p className="text-xs text-zinc-600 mt-2">{h.change_reason}</p>}
            </div>
          ))}
        </div>
      )}

      {selectedDoc && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-end mb-2">
                <button onClick={() => setSelectedDoc(null)} className="text-white/60 hover:text-white text-sm">Close ✕</button>
              </div>
              <DocumentPreview data={selectedDoc} mode={mode} onAction={handleDocumentAction} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
