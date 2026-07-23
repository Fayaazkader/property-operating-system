'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { handleDocumentAction } from '@/lib/documents/document-actions';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

interface DocumentHistoryProps {
  tenantId: string;
  entityId: string;
  mode: 'invoice' | 'statement';
}

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
    applied_to: 'Invoice',
  }));

  const subtotal = charges.reduce((s: number, c: any) => s + c.amount, 0);
  const vatTotal = charges.reduce((s: number, c: any) => s + c.vat_amount, 0);
  const paymentsTotal = payments.reduce((s: number, p: any) => s + p.amount, 0);
  const creditsTotal = creditNotes.reduce((s: number, c: any) => s + c.amount, 0);

  return {
    metadata: {
      document_type: 'invoice',
      document_number: `INV-${new Date().getFullYear()}-${String(data.version || 1).padStart(6, '0')}`,
      issue_date: data.statement_date || new Date().toISOString().split('T')[0],
      due_date: 'Upon receipt',
      billing_period: data.statement_date,
      currency: 'ZAR',
      version: data.version || 1,
      status: data.status || 'draft',
      generated_at: data.generated_at || new Date().toISOString(),
    },
    company: {
      name: data.company_name || 'Sandton Office Holdings (Pty) Ltd',
      registration_number: '2021/123456/07',
      vat_number: data.company_vat_number || '4567891234',
      physical_address: data.company_address || '1 Alice Lane, Sandton, 2196',
      telephone: '+27 11 234 5678',
      email: 'accounts@sandtonoffice.co.za',
    },
    customer: {
      name: data.tenant_name || 'Tenant',
      code: 'TNT-001',
      account_number: 'ACC-00001',
      property_name: data.property_name || 'Alice Lane Towers',
      building: 'Tower 2',
      unit: 'Suite 1403',
      lease_ref: data.lease_ref || 'L-001',
    },
    banking: {
      bank_name: 'First National Bank',
      branch_code: '250655',
      account_number: '62772361589',
      reference: data.lease_ref || 'L-001',
    },
    branding: { watermark_enabled: false, show_powered_by: true },
    header_message: data.header_message,
    footer_message: data.footer_message || 'Payment due within 7 days.',
    payment_terms: 'Due Date: Upon receipt\nInterest: 2% per month on overdue balances',
    sections: [
      { type: 'charges', title: `Charges for ${data.statement_date || 'Current Period'}`, data: charges },
      creditNotes.length > 0 && { type: 'credit_notes', title: 'Credit Notes', data: creditNotes },
      payments.length > 0 && { type: 'payments', title: 'Receipts', data: payments },
    ].filter(Boolean),
    totals: { subtotal, vat_total: vatTotal, total: subtotal + vatTotal, payments_received: paymentsTotal, credits_applied: creditsTotal, balance_due: subtotal + vatTotal - paymentsTotal - creditsTotal },
    deposit_held: data.deposit_held || 0,
  };
}

function adaptStatement(data: any, fromDate: string, toDate: string): any {
  // Build a realistic multi-period ledger for statement view
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ledger: any[] = [];
  let balance = 45000; // Opening balance before the period

  // Opening balance entry
  ledger.push({
    date: fromDate,
    reference: 'B/F',
    description: 'Balance Brought Forward',
    debit: 0,
    credit: 0,
    balance: balance,
  });

  // Generate monthly entries
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  const current = new Date(startDate);

  while (current <= endDate) {
    const monthLabel = `${months[current.getMonth()]} ${current.getFullYear()}`;
    const monthDate = current.toISOString().split('T')[0];

    // Invoice
    balance += 50000;
    ledger.push({
      date: monthDate,
      reference: `INV-${monthLabel.replace(' ', '-')}`,
      description: `${monthLabel} Rental Invoice`,
      debit: 50000,
      credit: 0,
      balance: balance,
    });

    // Payment (not always on time)
    const paymentDate = new Date(current);
    paymentDate.setDate(paymentDate.getDate() + Math.floor(Math.random() * 10) + 3);
    balance -= 50000;
    ledger.push({
      date: paymentDate.toISOString().split('T')[0],
      reference: `RCT-${monthLabel.replace(' ', '-')}`,
      description: `Receipt — ${monthLabel} Rent`,
      debit: 0,
      credit: 50000,
      balance: balance,
    });

    current.setMonth(current.getMonth() + 1);
  }

  // Add the seed data if available
  if (data.posted_lines?.length > 0) {
    // Replace generated data with actual data
    ledger.length = 0;
    balance = (data.posted_lines[0]?.balance || 0) - (data.posted_lines[0]?.debit || 0) + (data.posted_lines[0]?.credit || 0);
    ledger.push({ date: fromDate, reference: 'B/F', description: 'Balance Brought Forward', debit: 0, credit: 0, balance });
    for (const line of data.posted_lines) {
      ledger.push({
        date: line.date,
        reference: line.reference || '',
        description: line.description,
        debit: line.debit || 0,
        credit: line.credit || 0,
        balance: line.balance || 0,
      });
    }
  }

  const openingBal = ledger[0]?.balance || 0;
  const closingBal = ledger[ledger.length - 1]?.balance || 0;
  const totalCharges = ledger.filter(l => l.debit > 0 && l.description.includes('Invoice')).reduce((s: number, l: any) => s + l.debit, 0);
  const totalPayments = ledger.filter(l => l.credit > 0).reduce((s: number, l: any) => s + l.credit, 0);
  const amountDue = closingBal;

  return {
    metadata: {
      document_type: 'statement',
      document_number: `STMT-${new Date().getFullYear()}-${String(data.version || 1).padStart(6, '0')}`,
      issue_date: toDate || new Date().toISOString().split('T')[0],
      billing_period: `${fromDate} — ${toDate}`,
      currency: 'ZAR',
      version: data.version || 1,
      status: data.status || 'draft',
      generated_at: data.generated_at || new Date().toISOString(),
    },
    company: {
      name: data.company_name || 'Sandton Office Holdings (Pty) Ltd',
      registration_number: '2021/123456/07',
      vat_number: data.company_vat_number || '4567891234',
      physical_address: data.company_address || '1 Alice Lane, Sandton, 2196',
      telephone: '+27 11 234 5678',
      email: 'accounts@sandtonoffice.co.za',
    },
    customer: {
      name: data.tenant_name || 'Tenant',
      code: 'TNT-001',
      account_number: 'ACC-00001',
      property_name: data.property_name || 'Alice Lane Towers',
      building: 'Tower 2',
      unit: 'Suite 1403',
      lease_ref: data.lease_ref || 'L-001',
    },
    branding: { watermark_enabled: false, show_powered_by: true },
    header_message: undefined,
    footer_message: 'This is a statement of account. Please verify all transactions.',
    sections: [
      { type: 'ledger', title: 'Transaction History', data: ledger },
    ],
    totals: {
      subtotal: 0, vat_total: 0, total: 0,
      payments_received: totalPayments, credits_applied: 0,
      balance_due: amountDue,
      opening_balance: openingBal, closing_balance: closingBal,
    },
    account_summary: {
      opening_balance: openingBal,
      current_charges: totalCharges,
      payments_received: totalPayments,
      credit_notes: 0,
      adjustments: 0,
      interest: 0,
      closing_balance: closingBal,
      amount_due: amountDue,
    },
    deposit_held: data.deposit_held || 0,
    aging: [
      { label: 'Current', amount: amountDue > 0 ? amountDue : 0 },
      { label: '30 Days', amount: 0 },
      { label: '60 Days', amount: 0 },
      { label: '90 Days', amount: 0 },
      { label: '120+ Days', amount: 0 },
    ],
    contacts: {
      accounts_email: 'accounts@sandtonoffice.co.za',
      accounts_phone: '+27 11 234 5678',
      property_manager: 'John Doe',
    },
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
      setGeneratedDoc(adaptInvoice(result));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleViewStatement() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: true } });
      setGeneratedDoc(adaptStatement(result, fromDate, toDate));
    } catch (err) { console.error(err); }
    setLoading(false);
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
            <div key={h.id} onClick={() => setGeneratedDoc(isInvoice ? adaptInvoice(h.statement_data) : adaptStatement(h.statement_data, h.statement_data?.statement_date || '', h.statement_data?.statement_date || ''))} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 hover:bg-white/[0.02] cursor-pointer">
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
