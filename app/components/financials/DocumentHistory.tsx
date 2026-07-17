'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';
import type { DocumentMode } from './DocumentPreview';

interface DocumentHistoryProps {
  tenantId: string;
  entityId: string;
  mode: DocumentMode;
}

export default function DocumentHistory({ tenantId, entityId, mode }: DocumentHistoryProps) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const isInvoice = mode === 'invoice';
  const label = isInvoice ? 'invoice' : 'statement';

  useEffect(() => {
    async function load() {
      // Load periods for selector
      const { data: periodData } = await supabase
        .from('financial_periods')
        .select('id, period_name, period_start, period_end, status')
        .eq('entity_id', entityId)
        .eq('period_type', 'statement')
        .order('period_start', { ascending: false })
        .limit(24);
      setPeriods(periodData || []);

      // Load existing documents
      try {
        console.log("Fetching history for", { entityId, tenantId });
        const hist = await revenueApi.getStatementHistory({ entityId, tenantId });
        setHistory(hist || []);
      } catch (err) { console.error("getStatementHistory error:", err); }
    }
    load();
  }, [tenantId, entityId]);

  async function handleViewInvoice() {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({
        entityId,
        tenantId,
        options: {
          includeBalanceBf: true,
          includeDeposit: true,
          includeProjected: false,
        },
      });
      setGeneratedDoc({ ...result, status: result.status });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleViewStatement() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({
        entityId,
        tenantId,
        options: {
          includeBalanceBf: true,
          includeDeposit: true,
          includeProjected: true,
        },
      });
      setGeneratedDoc({ ...result, status: result.status });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleDocumentAction(action: string) {
    if (action === 'email') alert('Email sending — coming soon');
    if (action === 'whatsapp') alert('WhatsApp sending — coming soon');
    if (action === 'download') alert('PDF download — coming soon');
    if (action === 'print') window.print();
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">
          {isInvoice ? 'Select period to view invoice' : 'Select date range for statement'}
        </p>

        {isInvoice ? (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="">Select statement period...</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({p.period_start?.split('T')[0]} — {p.period_end?.split('T')[0]}) — {p.status}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleViewInvoice}
              disabled={!selectedPeriodId || loading}
              className="rounded-lg bg-white px-5 py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
            >
              {loading ? 'Loading...' : 'View Invoice'}
            </button>
          </div>
        ) : (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-600 block mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-zinc-600 block mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>
            <button
              onClick={handleViewStatement}
              disabled={!fromDate || !toDate || loading}
              className="rounded-lg border border-white/20 px-5 py-2.5 text-xs font-medium text-white hover:border-white/40 disabled:opacity-40 transition-all"
            >
              {loading ? 'Loading...' : 'View Statement'}
            </button>
          </div>
        )}
      </div>

      {/* Previous documents */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Previous {label}s</p>
          {history.map((h: any) => (
            <div
              key={h.id}
              onClick={() => setGeneratedDoc({ ...h.statement_data, status: h.status })}
              className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 hover:bg-white/[0.02] cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-light">v{h.version} — {h.generated_at?.split('T')[0]}</p>
                  {h.change_reason && <p className="text-xs text-zinc-600 mt-0.5">{h.change_reason}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  h.status === 'issued' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {h.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Preview Modal */}
      {generatedDoc && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setGeneratedDoc(null)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-end mb-2">
                <button onClick={() => setGeneratedDoc(null)} className="text-white/60 hover:text-white text-sm">Close ✕</button>
              </div>
              <DocumentRenderer model={generatedDoc} onAction={handleDocumentAction} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
