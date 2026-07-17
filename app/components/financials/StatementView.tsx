'use client';

import { useState } from 'react';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

export default function StatementView({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const [fromDate, setFromDate] = useState('2026-02-01');
  const [toDate, setToDate] = useState('2026-07-31');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleView() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: true } });
      setGeneratedDoc(result);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Select date range for statement</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" /></div>
          <button onClick={handleView} disabled={!fromDate || !toDate || loading} className="rounded-lg border border-white/20 px-5 py-2.5 text-xs font-medium text-white hover:border-white/40 disabled:opacity-40">
            {loading ? 'Loading...' : 'View Statement'}
          </button>
        </div>
      </div>
      {generatedDoc && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setGeneratedDoc(null)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="max-w-2xl w-full">
              <div className="flex justify-end mb-2">
                <button onClick={() => setGeneratedDoc(null)} className="text-white/60 hover:text-white text-sm">Close ✕</button>
              </div>
              <DocumentRenderer model={generatedDoc} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
