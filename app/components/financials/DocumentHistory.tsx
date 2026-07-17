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
  const isInvoice = mode === 'invoice';
  const lines = data.posted_lines || [];

  const charges = lines.filter((l: any) => l.debit > 0).map((l: any) => ({
    charge_code: l.reference || undefined,
    gl_code: undefined,
    description: l.description,
    billing_period: l.date,
    quantity: 1,
    rate: l.debit,
    amount: l.debit,
    vat_rate: 15,
    vat_amount: Math.round(l.debit * 0.15),
    total: l.debit + Math.round(l.debit * 0.15),
  }));

  const payments = lines.filter((l: any) => l.credit > 0 && !(l.description || '').toLowerCase().includes('credit')).map((l: any) => ({
    reference: l.reference || `PMT-${l.date}`,
    method: 'EFT',
    date: l.date,
    amount: l.credit,
  }));

  const creditNotes = lines.filter((l: any) => l.credit > 0 && (l.description || '').toLowerCase().includes('credit')).map((l: any) => ({
    reference: l.reference || `CN-${l.date}`,
    reason: l.description,
    amount: l.credit,
    applied_to: 'Invoice',
  }));

  const ledger = lines.map((l: any) => ({
    date: l.date,
    reference: l.reference || '',
    description: l.description,
    debit: l.debit || 0,
    credit: l.credit || 0,
    balance: l.balance || 0,
  }));

  const subtotal = charges.reduce((s: number, c: any) => s + c.amount, 0);
  const vatTotal = charges.reduce((s: number, c: any) => s + c.vat_amount, 0);
  const paymentsTotal = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const creditsTotal = creditNotes.reduce((s: number, c: any) => s + c.amount, 0);

  return {
    metadata: {
      document_type: mode,
      document_number: `${isInvoice ? 'INV' : 'STMT'}-${new Date().getFullYear()}-${String(data.version || 1).padStart(6, '0')}`,
      issue_date: data.statement_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date,
      billing_period: data.statement_date,
      currency: 'ZAR',
      version: data.version || 1,
      status: data.status || 'draft',
      generated_at: data.generated_at || new Date().toISOString(),
      prepared_by: data.generated_by,
    },
    company: {
      name: data.company_name || 'Sandton Office Holdings (Pty) Ltd',
      registration_number: '2021/123456/07',
      vat_number: data.company_vat_number || '4567891234',
      physical_address: data.company_address || '1 Alice Lane, Sandton, 2196',
      postal_address: 'PO Box 1234, Sandton, 2146',
      telephone: '+27 11 234 5678',
      email: 'accounts@sandtonoffice.co.za',
      website: 'www.sandtonoffice.co.za',
    },
    customer: {
      name: data.tenant_name || 'Tenant',
      code: 'TNT-001',
      account_number: 'ACC-00001',
      property_name: data.property_name || 'Alice Lane Towers',
      building: 'Tower 2',
      unit: 'Suite 1403',
      lease_ref: data.lease_ref || 'L-001',
      entity: 'Sandton Portfolio',
      portfolio: 'Gauteng Commercial',
    },
    banking: {
      bank_name: 'First National Bank',
      branch_name: 'Sandton',
      branch_code: '250655',
      account_number: '62772361589',
      account_type: 'Current',
      reference: data.lease_ref || 'L-001',
      swift: 'FIRNZAJJ',
    },
    branding: {
      logo_url: data.logo_url,
      watermark_enabled: false,
      show_powered_by: true,
      primary_color: '#000000',
    },
    header_message: data.header_message,
    footer_message: data.footer_message || 'Payment due within 7 days. Interest at 2% per month on overdue amounts.',
    payment_terms: 'Due Date: Upon receipt\nInterest: 2% per month on overdue balances\nQueries: accounts@sandtonoffice.co.za | +27 11 234 5678',
    contacts: {
      accounts_email: 'accounts@sandtonoffice.co.za',
      accounts_phone: '+27 11 234 5678',
      property_manager: 'John Doe',
      maintenance: 'maintenance@sandtonoffice.co.za',
    },
    sections: isInvoice ? [
      { type: 'charges', title: 'Charges', data: charges },
      creditNotes.length > 0 && { type: 'credit_notes', title: 'Credit Notes', data: creditNotes, variant: 'credit' },
      payments.length > 0 && { type: 'payments', title: 'Receipts Received', data: payments, variant: 'receipt' },
    ].filter(Boolean) : [
      { type: 'ledger', title: 'Transaction History', data: ledger },
    ],
    totals: {
      subtotal,
      vat_total: vatTotal,
      total: subtotal + vatTotal,
      payments_received: paymentsTotal,
      credits_applied: creditsTotal,
      balance_due: subtotal + vatTotal - paymentsTotal - creditsTotal,
      opening_balance: ledger[0]?.balance || 0,
      closing_balance: ledger[ledger.length - 1]?.balance || 0,
    },
    account_summary: !isInvoice ? {
      opening_balance: ledger[0]?.balance || 0,
      current_charges: subtotal,
      payments_received: paymentsTotal,
      credit_notes: creditsTotal,
      adjustments: 0,
      interest: 0,
      closing_balance: ledger[ledger.length - 1]?.balance || 0,
      amount_due: subtotal + vatTotal - paymentsTotal - creditsTotal,
    } : undefined,
    deposit_held: data.deposit_held || 0,
    aging: !isInvoice ? [
      { label: 'Current', amount: subtotal + vatTotal - paymentsTotal - creditsTotal },
      { label: '30 Days', amount: 0 },
      { label: '60 Days', amount: 0 },
      { label: '90 Days', amount: 0 },
      { label: '120+ Days', amount: 0 },
    ] : undefined,
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
      } catch (err) { console.error(err); }
    }
    load();
  }, [tenantId, entityId]);

  async function handleViewInvoice() {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: false } });
      setGeneratedDoc(adaptToModel(result, 'invoice'));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleViewStatement() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: true } });
      setGeneratedDoc(adaptToModel(result, 'statement'));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  function handleDocumentAction(action: string) {
    if (action === 'email') alert('Email — coming soon');
    if (action === 'whatsapp') alert('WhatsApp — coming soon');
    if (action === 'download-pdf') alert('PDF download — coming soon');
    if (action === 'print') window.print();
    if (action === 'preview-pdf') alert('Preview PDF — coming soon');
    if (action === 'issue') alert('Document issued');
    if (action === 'regenerate') alert('Regenerate — coming soon');
    if (action === 'archive') alert('Archive — coming soon');
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
            <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" /></div>
            <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" /></div>
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
