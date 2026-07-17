'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

export default function InvoiceView({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: periodData } = await supabase
        .from('financial_periods')
        .select('id, period_name, period_start, period_end, status')
        .eq('entity_id', entityId)
        .eq('period_type', 'statement')
        .order('period_start', { ascending: false })
        .limit(24);
      setPeriods(periodData || []);
    }
    load();
  }, [entityId]);

  async function handleView() {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: false } });
      setGeneratedDoc(result);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Select period to view invoice</p>
        <div className="flex gap-3 items-end">
          <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none">
            <option value="">Select period...</option>
            {periods.map(p => (<option key={p.id} value={p.id}>{p.period_name} — {p.status}</option>))}
          </select>
          <button onClick={handleView} disabled={!selectedPeriodId || loading} className="rounded-lg bg-white px-5 py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40">
            {loading ? 'Loading...' : 'View Invoice'}
          </button>
        </div>
      </div>
      {generatedDoc && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setGeneratedDoc(null)} />
      )}
      {generatedDoc && (
        <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="flex justify-end mb-2">
              <button onClick={() => setGeneratedDoc(null)} className="text-white/60 hover:text-white text-sm">Close ✕</button>
            </div>
            <DocumentRenderer model={generatedDoc} />
          </div>
        </div>
      )}
    </div>
  );
}
