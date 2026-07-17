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
      setGeneratedDoc(adaptToModel(result, 'invoice'));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  function handleAction(action: string) {
    if (action === 'print') window.print();
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
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setGeneratedDoc(null)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-end mb-2">
                <button onClick={() => setGeneratedDoc(null)} className="text-white/60 hover:text-white text-sm">Close ✕</button>
              </div>
              <DocumentRenderer model={generatedDoc} onAction={handleAction} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function adaptToModel(data: any, mode: string): any {
  const isInvoice = mode === 'invoice';
  const lines = data.posted_lines || [];
  const charges = lines.filter((l: any) => l.debit > 0).map((l: any) => ({
    charge_code: l.reference || undefined, description: l.description,
    amount: l.debit, vat_rate: 15, vat_amount: Math.round(l.debit * 0.15), total: l.debit + Math.round(l.debit * 0.15),
  }));
  const payments = lines.filter((l: any) => l.credit > 0 && !(l.description || '').toLowerCase().includes('credit')).map((l: any) => ({
    reference: l.reference || `PMT-${l.date}`, method: 'EFT', date: l.date, amount: l.credit,
  }));
  const creditNotes = lines.filter((l: any) => l.credit > 0 && (l.description || '').toLowerCase().includes('credit')).map((l: any) => ({
    reference: l.reference || `CN-${l.date}`, reason: l.description, amount: l.credit,
  }));
  const subtotal = charges.reduce((s: number, c: any) => s + c.amount, 0);
  const vatTotal = charges.reduce((s: number, c: any) => s + c.vat_amount, 0);
  const paymentsTotal = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const creditsTotal = creditNotes.reduce((s: number, c: any) => s + c.amount, 0);

  return {
    metadata: { document_type: mode, document_number: `${isInvoice ? 'INV' : 'STMT'}-${Date.now()}`, issue_date: data.statement_date || '', due_date: 'Upon receipt', billing_period: data.statement_date, currency: 'ZAR', version: data.version || 1, status: data.status || 'draft', generated_at: data.generated_at || '' },
    company: { name: data.company_name || 'Sandton Office Holdings (Pty) Ltd', registration_number: '2021/123456/07', vat_number: data.company_vat_number || '4567891234', physical_address: data.company_address || '1 Alice Lane, Sandton, 2196', telephone: '+27 11 234 5678', email: 'accounts@sandtonoffice.co.za' },
    customer: { name: data.tenant_name || 'Tenant', code: 'TNT-001', account_number: 'ACC-00001', property_name: data.property_name || 'Alice Lane Towers', building: 'Tower 2', unit: 'Suite 1403', lease_ref: data.lease_ref || 'L-001' },
    banking: isInvoice ? { bank_name: 'First National Bank', branch_code: '250655', account_number: '62772361589', reference: data.lease_ref || 'L-001' } : undefined,
    branding: { watermark_enabled: false, show_powered_by: true },
    header_message: data.header_message,
    footer_message: isInvoice ? (data.footer_message || 'Payment due within 7 days.') : 'This is a statement of account.',
    payment_terms: isInvoice ? 'Due Date: Upon receipt\nInterest: 2% per month on overdue balances' : undefined,
    sections: isInvoice
      ? [{ type: 'charges', title: `Charges for ${data.statement_date || 'Current Period'}`, data: charges }, creditNotes.length > 0 && { type: 'credit_notes', title: 'Credit Notes', data: creditNotes }, payments.length > 0 && { type: 'payments', title: 'Receipts', data: payments }].filter(Boolean)
      : [{ type: 'ledger', title: 'Transaction History', data: lines.map((l: any) => ({ date: l.date, reference: l.reference || '', description: l.description, debit: l.debit || 0, credit: l.credit || 0, balance: l.balance || 0 })) }],
    totals: { subtotal, vat_total: vatTotal, total: subtotal + vatTotal, payments_received: paymentsTotal, credits_applied: creditsTotal, balance_due: isInvoice ? subtotal + vatTotal - paymentsTotal - creditsTotal : (lines[lines.length - 1]?.balance || 0) },
    account_summary: !isInvoice ? { opening_balance: lines[0]?.balance || 0, current_charges: lines.filter((l: any) => l.debit > 0).reduce((s: number, l: any) => s + l.debit, 0), payments_received: lines.filter((l: any) => l.credit > 0).reduce((s: number, l: any) => s + l.credit, 0), credit_notes: 0, adjustments: 0, interest: 0, closing_balance: lines[lines.length - 1]?.balance || 0, amount_due: lines[lines.length - 1]?.balance || 0 } : undefined,
    aging: !isInvoice ? [{ label: 'Current', amount: lines[lines.length - 1]?.balance || 0 }, { label: '30 Days', amount: 0 }, { label: '60 Days', amount: 0 }, { label: '90 Days', amount: 0 }, { label: '120+ Days', amount: 0 }] : undefined,
    contacts: !isInvoice ? { accounts_email: 'accounts@sandtonoffice.co.za', accounts_phone: '+27 11 234 5678', property_manager: 'John Doe' } : undefined,
    deposit_held: data.deposit_held || 0,
  };
}
