'use client';

import { useState, useEffect } from 'react';
import { revenueApi } from '@/lib/revenue/api';
import { DocumentRenderer } from '@/lib/documents/renderers/react-renderer';

function adaptToModel(data: any, from: string, to: string): any {
  const rawLines = data.posted_lines || [];
  
  // Group lines by statement period (month)
  const periods: Record<string, any[]> = {};
  
  for (const l of rawLines) {
    const date = l.date || '';
    const monthKey = date.substring(0, 7); // "2026-08"
    if (!periods[monthKey]) periods[monthKey] = [];
    periods[monthKey].push(l);
  }

  // Build structured ledger with period headers, B/F, C/F
  const ledger: any[] = [];
  let runningBalance = 0;
  const sortedMonths = Object.keys(periods).sort();

  for (const month of sortedMonths) {
    const monthLines = periods[month];
    const monthName = new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Period header
    ledger.push({ type: 'period_header', label: monthName.toUpperCase() });
    
    // B/F for this period
    ledger.push({ type: 'bf', date: month + '-01', description: 'Balance Brought Forward', balance: runningBalance });
    
    // Transactions
    for (const l of monthLines) {
      const isCharge = l.debit > 0;
      const isPayment = l.credit > 0;
      
      if (isCharge) {
        const debitExVat = l.debit;
        const vatAmount = Math.round(debitExVat * 0.15);
        runningBalance += debitExVat + vatAmount;
        
        ledger.push({
          type: 'charge',
          date: l.date,
          reference: l.reference || 'INV',
          description: l.description,
          debit: debitExVat,
          vat: vatAmount,
          credit: 0,
          balance: runningBalance,
        });
      } else if (isPayment) {
        runningBalance -= l.credit;
        
        ledger.push({
          type: 'payment',
          date: l.date,
          reference: l.reference || 'RCT',
          description: l.description,
          debit: 0,
          vat: 0,
          credit: l.credit,
          balance: runningBalance,
        });
      }
    }
    
    // C/F for this period
    ledger.push({ type: 'cf', label: `${monthName} C/F`, balance: runningBalance });
  }

  const charges = rawLines.filter((l: any) => l.debit > 0);
  const payments = rawLines.filter((l: any) => l.credit > 0);
  const totalChargesExVat = charges.reduce((s: number, l: any) => s + l.debit, 0);
  const totalVat = Math.round(totalChargesExVat * 0.15);
  const totalPayments = payments.reduce((s: number, l: any) => s + l.credit, 0);

  return {
    metadata: { document_type: 'statement', document_number: `STMT-${Date.now()}`, issue_date: new Date().toISOString().split('T')[0], billing_period: `${from} — ${to}`, currency: 'ZAR', version: data.version || 1, status: data.status || 'draft', generated_at: data.generated_at || '' },
    company: { name: data.company_name || 'Sandton Office Holdings', registration_number: '2021/123456/07', vat_number: data.company_vat_number || '4567891234', physical_address: '1 Alice Lane, Sandton, 2196', telephone: '+27 11 234 5678', email: 'accounts@sandtonoffice.co.za' },
    customer: { name: data.tenant_name || 'Tenant', code: 'TNT-001', account_number: 'ACC-00001', property_name: data.property_name || 'Alice Lane Towers', lease_ref: data.lease_ref || 'L-001' },
    branding: { watermark_enabled: false, show_powered_by: true },
    footer_message: 'This is a statement of account.',
    sections: [{ type: 'ledger', title: 'Transaction History', data: ledger }],
    totals: { subtotal: totalChargesExVat, vat_total: totalVat, total: totalChargesExVat + totalVat, payments_received: totalPayments, credits_applied: 0, balance_due: runningBalance, opening_balance: 0, closing_balance: runningBalance },
    account_summary: { opening_balance: 0, current_charges: totalChargesExVat + totalVat, payments_received: totalPayments, credit_notes: 0, adjustments: 0, interest: 0, closing_balance: runningBalance, amount_due: runningBalance },
    aging: [{ label: 'Current', amount: runningBalance }, { label: '30 Days', amount: 0 }, { label: '60 Days', amount: 0 }, { label: '90 Days', amount: 0 }, { label: '120+ Days', amount: 0 }],
    contacts: { accounts_email: 'accounts@sandtonoffice.co.za', accounts_phone: '+27 11 234 5678', property_manager: 'John Doe' },
  };
}

export default function StatementView({ tenantId, entityId }: { tenantId: string; entityId: string }) {
  const [fromDate, setFromDate] = useState('2026-02-01');
  const [toDate, setToDate] = useState('2026-07-31');
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const hist = await revenueApi.getStatementHistory({ entityId, tenantId });
        setHistory(hist || []);
      } catch (err) { console.error(err); }
    }
    load();
  }, [entityId, tenantId]);

  async function handleView() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      const result = await revenueApi.generateStatement({ entityId, tenantId, options: { includeBalanceBf: true, includeDeposit: true, includeProjected: false } });
      setGeneratedDoc(adaptToModel(result, fromDate, toDate));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Select date range for statement</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div className="flex-1"><label className="text-[10px] text-zinc-600 block mb-1">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <button onClick={handleView} disabled={!fromDate || !toDate || loading} className="rounded-lg border border-white/20 px-5 py-2.5 text-xs font-medium text-white hover:border-white/40 disabled:opacity-40">
            {loading ? 'Loading...' : 'View Statement'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Previous Statements</p>
          {history.map((h: any) => (
            <div key={h.id} onClick={() => setGeneratedDoc(adaptToModel(h.statement_data, h.statement_data?.statement_date || '', h.statement_data?.statement_date || ''))} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 hover:bg-white/[0.02] cursor-pointer">
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
              <DocumentRenderer model={generatedDoc} onAction={(a) => { if (a === 'print') window.print(); }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
