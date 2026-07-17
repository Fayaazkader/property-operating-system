'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

function adaptStatement(data: any, fromDate: string, toDate: string): any {
  const lines = data.posted_lines || [];
  
  const ledger = lines.map((l: any) => ({
    date: l.date,
    reference: l.reference || '',
    description: l.description,
    debit: l.debit || 0,
    credit: l.credit || 0,
    balance: l.balance || 0,
  }));

  const openingBal = ledger[0]?.balance || 0;
  const closingBal = ledger[ledger.length - 1]?.balance || 0;
  const totalCharges = ledger.filter(l => l.debit > 0).reduce((s: number, l: any) => s + l.debit, 0);
  const totalPayments = ledger.filter(l => l.credit > 0).reduce((s: number, l: any) => s + l.credit, 0);
  const totalCredits = ledger.filter(l => l.credit > 0 && (l.description || '').toLowerCase().includes('credit')).reduce((s: number, l: any) => s + l.credit, 0);
  const amountDue = closingBal;

  return {
    metadata: { document_type: 'statement', document_number: `STMT-${new Date().getFullYear()}-${String(data.version || 1).padStart(6, '0')}`, issue_date: toDate || new Date().toISOString().split('T')[0], billing_period: `${fromDate} — ${toDate}`, currency: 'ZAR', version: data.version || 1, status: data.status || 'draft', generated_at: data.generated_at || new Date().toISOString() },
    company: { name: data.company_name || 'Sandton Office Holdings (Pty) Ltd', registration_number: '2021/123456/07', vat_number: data.company_vat_number || '4567891234', physical_address: data.company_address || '1 Alice Lane, Sandton, 2196', telephone: '+27 11 234 5678', email: 'accounts@sandtonoffice.co.za' },
    customer: { name: data.tenant_name || 'Tenant', code: 'TNT-001', account_number: 'ACC-00001', property_name: data.property_name || 'Alice Lane Towers', building: 'Tower 2', unit: 'Suite 1403', lease_ref: data.lease_ref || 'L-001' },
    branding: { watermark_enabled: false, show_powered_by: true },
    footer_message: 'This is a statement of account. Please verify all transactions.',
    sections: [{ type: 'ledger', title: 'Transaction History', data: ledger }],
    totals: { subtotal: 0, vat_total: 0, total: 0, payments_received: totalPayments, credits_applied: totalCredits, balance_due: amountDue, opening_balance: openingBal, closing_balance: closingBal },
    account_summary: { opening_balance: openingBal, current_charges: totalCharges, payments_received: totalPayments, credit_notes: totalCredits, adjustments: 0, interest: 0, closing_balance: closingBal, amount_due: amountDue },
    aging: [{ label: 'Current', amount: amountDue > 0 ? amountDue : 0 }, { label: '30 Days', amount: 0 }, { label: '60 Days', amount: 0 }, { label: '90 Days', amount: 0 }, { label: '120+ Days', amount: 0 }],
    contacts: { accounts_email: 'accounts@sandtonoffice.co.za', accounts_phone: '+27 11 234 5678', property_manager: 'John Doe' },
  };
}

export default function StatementView({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const [fromDate, setFromDate] = useState('2026-02-01');
  const [toDate, setToDate] = useState('2026-07-31');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleView() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: false } });
    setGeneratedDoc(adaptStatement(result, fromDate, toDate));
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Select date range for statement</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none" /></div>
          <button onClick={handleView} disabled={!fromDate || !toDate || loading} className="rounded-lg border border-white/20 px-5 py-2.5 text-xs font-medium text-white hover:border-white/40 disabled:opacity-40">{loading ? 'Loading...' : 'View Statement'}</button>
        </div>
      </div>
      {generatedDoc && <DocumentRenderer model={generatedDoc} onAction={(a) => { if (a === 'print') window.print(); }} />}
    </div>
  );
}
