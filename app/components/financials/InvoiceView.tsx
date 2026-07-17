'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

function adaptInvoice(data: any): any {
  const charges = (data.posted_lines || []).filter((l: any) => l.debit > 0).map((l: any) => ({
    charge_code: l.reference || undefined,
    description: l.description,
    amount: l.debit,
    vat_rate: 15,
    vat_amount: Math.round(l.debit * 0.15),
    total: l.debit + Math.round(l.debit * 0.15),
  }));

  const payments = (data.posted_lines || []).filter((l: any) => l.credit > 0 && !(l.description || '').toLowerCase().includes('credit')).map((l: any) => ({
    reference: l.reference || `PMT-${l.date}`,
    method: 'EFT',
    date: l.date,
    amount: l.credit,
  }));

  const creditNotes = (data.posted_lines || []).filter((l: any) => l.credit > 0 && (l.description || '').toLowerCase().includes('credit')).map((l: any) => ({
    reference: l.reference || `CN-${l.date}`,
    reason: l.description,
    amount: l.credit,
  }));

  const subtotal = charges.reduce((s: number, c: any) => s + c.amount, 0);
  const vatTotal = charges.reduce((s: number, c: any) => s + c.vat_amount, 0);
  const paymentsTotal = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const creditsTotal = creditNotes.reduce((s: number, c: any) => s + c.amount, 0);

  return {
    metadata: { document_type: 'invoice', document_number: `INV-${new Date().getFullYear()}-${String(data.version || 1).padStart(6, '0')}`, issue_date: data.statement_date || new Date().toISOString().split('T')[0], due_date: 'Upon receipt', billing_period: data.statement_date, currency: 'ZAR', version: data.version || 1, status: data.status || 'draft', generated_at: data.generated_at || new Date().toISOString() },
    company: { name: data.company_name || 'Sandton Office Holdings (Pty) Ltd', registration_number: '2021/123456/07', vat_number: data.company_vat_number || '4567891234', physical_address: data.company_address || '1 Alice Lane, Sandton, 2196', telephone: '+27 11 234 5678', email: 'accounts@sandtonoffice.co.za' },
    customer: { name: data.tenant_name || 'Tenant', code: 'TNT-001', account_number: 'ACC-00001', property_name: data.property_name || 'Alice Lane Towers', building: 'Tower 2', unit: 'Suite 1403', lease_ref: data.lease_ref || 'L-001' },
    banking: { bank_name: 'First National Bank', branch_code: '250655', account_number: '62772361589', reference: data.lease_ref || 'L-001' },
    branding: { watermark_enabled: false, show_powered_by: true },
    header_message: data.header_message,
    footer_message: data.footer_message || 'Payment due within 7 days.',
    payment_terms: 'Due Date: Upon receipt\nInterest: 2% per month on overdue balances',
    sections: [{ type: 'charges', title: `Charges for ${data.statement_date || 'Current Period'}`, data: charges }, creditNotes.length > 0 && { type: 'credit_notes', title: 'Credit Notes', data: creditNotes }, payments.length > 0 && { type: 'payments', title: 'Receipts', data: payments }].filter(Boolean),
    totals: { subtotal, vat_total: vatTotal, total: subtotal + vatTotal, payments_received: paymentsTotal, credits_applied: creditsTotal, balance_due: subtotal + vatTotal - paymentsTotal - creditsTotal },
    deposit_held: data.deposit_held || 0,
  };
}

export default function InvoiceView({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: periodData } = await supabase.from('financial_periods').select('id, period_name, period_start, period_end, status').eq('entity_id', entityId).eq('period_type', 'statement').order('period_start', { ascending: false }).limit(24);
      setPeriods(periodData || []);
    }
    load();
  }, [entityId]);

  async function handleView() {
    if (!selectedPeriodId) return;
    setLoading(true);
    const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: false } });
    setGeneratedDoc(adaptInvoice(result));
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
          <button onClick={handleView} disabled={!selectedPeriodId || loading} className="rounded-lg bg-white px-5 py-2.5 text-xs font-medium text-black hover:bg-gray-100 disabled:opacity-40">{loading ? 'Loading...' : 'View Invoice'}</button>
        </div>
      </div>
      {generatedDoc && <DocumentRenderer model={generatedDoc} onAction={(a) => { if (a === 'print') window.print(); }} />}
    </div>
  );
}
