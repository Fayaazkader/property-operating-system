'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

interface DocumentHistoryProps {
  tenantId: string;
  entityId: string;
  mode: 'invoice' | 'statement';
}

function adaptToModel(data: any, mode: string): any {
  return {
    metadata: {
      document_type: mode,
      document_number: `DOC-${Date.now()}`,
      issue_date: data.statement_date || new Date().toISOString().split('T')[0],
      version: data.version || 1,
      status: data.status || 'draft',
      generated_at: data.generated_at || new Date().toISOString(),
    },
    company: {
      name: data.company_name || 'Company',
      vat_number: data.company_vat_number,
      physical_address: data.company_address,
    },
    customer: {
      name: data.tenant_name || 'Tenant',
      property_name: data.property_name,
      lease_ref: data.lease_ref,
    },
    branding: {
      logo_url: data.logo_url,
      watermark_enabled: false,
      show_powered_by: true,
    },
    header_message: data.header_message,
    footer_message: data.footer_message,
    sections: (data.posted_lines || []).length > 0 ? [{
      type: mode === 'invoice' ? 'charges' : 'ledger',
      title: mode === 'invoice' ? 'Charges' : 'Transaction History',
      data: (data.posted_lines || []).map((l: any) => ({
        gl_code: l.gl_code,
        description: l.description,
        amount: l.debit || l.credit || l.amount,
        date: l.date,
        debit: l.debit || 0,
        credit: l.credit || 0,
        balance: l.balance || 0,
      })),
    }] : [],
    totals: {
      subtotal: 0,
      vat_total: 0,
      total: 0,
      payments_received: 0,
      credits_applied: 0,
      balance_due: data.closing_balance || 0,
    },
    deposit_held: data.deposit_held,
  };
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

      try {
        const hist = await revenueApi.getStatementHistory({ entityId, tenantId });
        setHistory(hist || []);
      } catch (err) {
        console.error('getStatementHistory error:', err);
      }
    }
    load();
  }, [tenantId, entityId]);

  async function handleViewInvoice() {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({
        entityId, tenantId,
        options: { includeBalanceBf: true, includeDeposit: true, includeProjected: false },
      });
      setGeneratedDoc(adaptToModel(result, 'invoice'));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleViewStatement() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({
        entityId, tenantId,
        options: { includeBalanceBf: true, includeDeposit: true, includeProjected: true },
      });
      setGeneratedDoc(adaptToModel(result, 'statement'));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  function handleDocumentAction(action: string) {
    if (action === 'email') alert('Email — coming soon');
    if (action === 'whatsapp') alert('WhatsApp — coming soon');
    if (action === 'download-pdf') alert('PDF download — coming soon');
    if (action === 'print') window.print();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">
          {isInvoice ? 'Select period to view invoice' : 'Select date range for statement'}
        </p>
        {isInvoice ? (
          <div className="flex gap-3 items-end">
            <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none">
              <option value="">Select period...</option>
              {periods.map(p => (<option key={p.id} value={p.id}>{p.period_name} — {p.status}</option>))}
            </select>
            <button onClick={handleViewInvoice} disabled={!selectedPeriodId || loading} className="rounded-lg bg-white px-5 py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40">
              {loading ? 'Loading...' : 'View Invoice'}
            </button>
          </div>
        ) : (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-600 block mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-zinc-600 block mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <button onClick={handleViewStatement} disabled={!fromDate || !toDate || loading} className="rounded-lg border border-white/20 px-5 py-2.5 text-xs font-medium text-white hover:border-white/40 disabled:opacity-40">
              {loading ? 'Loading...' : 'View Statement'}
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Previous</p>
          {history.map((h: any) => (
            <div key={h.id} onClick={() => setGeneratedDoc(adaptToModel(h.statement_data, mode))} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 hover:bg-white/[0.02] cursor-pointer">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-light">v{h.version} — {h.generated_at?.split('T')[0]}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${h.status === 'issued' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{h.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

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
