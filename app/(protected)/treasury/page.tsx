'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { treasuryIntelligence } from '@/lib/treasury/intelligence';
import type { TreasuryHealth, CashForecast } from '@/lib/treasury/intelligence';

const STATUS_LIFECYCLE = ['draft', 'awaiting_treasury', 'approved', 'batched', 'submitted_to_bank', 'awaiting_confirmation', 'matched', 'completed'] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', awaiting_treasury: 'Awaiting Treasury', approved: 'Approved',
  batched: 'In Batch', submitted_to_bank: 'Submitted', awaiting_confirmation: 'Awaiting Bank',
  matched: 'Matched', completed: 'Completed', rejected: 'Rejected', held: 'Held', cancelled: 'Cancelled',
};

export default function TreasuryWorkspacePage() {
  const [entityId, setEntityId] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<'review' | 'approved' | 'batches'>('review');
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});
  const [selectedForApproval, setSelectedForApproval] = useState<string[]>([]);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [batchBankAccount, setBatchBankAccount] = useState('');
  const [batchReference, setBatchReference] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [health, setHealth] = useState({ availableCash: 0, approvedToPay: 0, heldPayments: 0, overdueSuppliers: 0, batchesAwaitingBank: 0 });
  const [treasuryHealth, setTreasuryHealth] = useState<TreasuryHealth | null>(null);
const [forecast, setForecast] = useState<CashForecast[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const eid = entities[0]; setEntityId(eid);
      const [invData, reqData, batchData, bankData] = await Promise.all([
        supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', eid).eq('lifecycle_status', 'posted').order('due_date'),
        supabase.from('payment_requests').select('*, invoice:invoice_id(invoice_number, total_amount), supplier:supplier_id(supplier_name)').eq('entity_id', eid).order('created_at', { ascending: false }),
        supabase.from('payment_batches').select('*').eq('entity_id', eid).order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('id, bank_name, account_name, account_number').eq('entity_id', eid).eq('is_active', true),
      ]);
      const th = await treasuryIntelligence.getTreasuryHealth(eid);
setTreasuryHealth(th);
const fc = await treasuryIntelligence.getCashForecast(eid, 14);
setForecast(fc);
      setInvoices(invData.data || []);
      setRequests(reqData.data || []);
      setBatches(batchData.data || []);
      setBankAccounts(bankData.data || []);

      const approved = (reqData.data || []).filter(r => r.status === 'approved');
      const held = (reqData.data || []).filter(r => r.status === 'held');
      const overdue = (invData.data || []).filter(i => new Date(i.due_date) < new Date());
      const awaiting = (batchData.data || []).filter(b => b.status === 'submitted' || b.status === 'awaiting_confirmation');
      setHealth({
        availableCash: 8200000,
        approvedToPay: approved.reduce((s: number, r: any) => s + r.amount, 0),
        heldPayments: held.reduce((s: number, r: any) => s + r.amount, 0),
        overdueSuppliers: overdue.length,
        batchesAwaitingBank: awaiting.length,
      });
      setLoading(false);
    }
    init();
  }, []);

  async function loadData() {
    const [reqData, batchData] = await Promise.all([
      supabase.from('payment_requests').select('*, invoice:invoice_id(invoice_number, total_amount), supplier:supplier_id(supplier_name)').eq('entity_id', entityId).order('created_at', { ascending: false }),
      supabase.from('payment_batches').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }),
    ]);
    setRequests(reqData.data || []);
    setBatches(batchData.data || []);
  }

  async function createRequest(invId: string, amount: number) {
    const inv = invoices.find(i => i.id === invId);
    if (!inv) return;
    await supabase.from('payment_requests').insert({
      entity_id: entityId, invoice_id: invId, supplier_id: inv.supplier_id,
      amount, status: 'awaiting_treasury', due_date: inv.due_date, payment_method: 'eft',
    });
    await loadData();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('payment_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    await loadData();
  }

  async function updateAmount(id: string, amount: number) {
    await supabase.from('payment_requests').update({ amount, updated_at: new Date().toISOString() }).eq('id', id);
    await loadData();
  }

  async function createBatch() {
    const approved = requests.filter(r => r.status === 'approved');
    if (!approved.length) return;
    const total = approved.reduce((s: number, r: any) => s + r.amount, 0);
    const batchNumber = `PB-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: batch } = await supabase.from('payment_batches').insert({
      entity_id: entityId, batch_number: batchNumber, description: batchReference || 'Payment Batch',
      total_amount: total, payment_count: approved.length, status: 'draft',
    }).select('*').single();

    if (batch) {
      await supabase.from('payment_requests').update({ batch_id: batch.id, status: 'batched' }).in('id', approved.map(r => r.id));
    }
    setShowCreateBatch(false); setBatchReference(''); setBatchBankAccount('');
    await loadData();
  }

  function handleEditAmount(id: string, val: string) {
    setEditAmounts(prev => ({ ...prev, [id]: val }));
  }

  function saveAmount(id: string) {
    const val = parseFloat(editAmounts[id]);
    if (val > 0) updateAmount(id, val);
    setEditAmounts(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;

  const reviewRequests = requests.filter(r => r.status === 'draft' || r.status === 'awaiting_treasury');
  const approvedRequests = requests.filter(r => r.status === 'approved');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Payment Hub</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Treasury Workspace</h1>
        </div>
      </div>

      {/* Treasury Health Panel */}
      <div className="grid grid-cols-5 gap-3">
        <HealthCard label="Available Cash" value={`R${(health.availableCash / 1000000).toFixed(1)}m`} />
        <HealthCard label="Approved to Pay" value={`R${(health.approvedToPay / 1000).toFixed(0)}k`} />
        <HealthCard label="Held Payments" value={`R${(health.heldPayments / 1000).toFixed(0)}k`} highlight />
        <HealthCard label="Overdue Suppliers" value={health.overdueSuppliers} highlight={health.overdueSuppliers > 0} />
        <HealthCard label="Awaiting Bank" value={health.batchesAwaitingBank} highlight={health.batchesAwaitingBank > 0} />
      {treasuryHealth && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Treasury Intelligence</p>
            <span className={`text-xs px-3 py-1 rounded-full ${treasuryHealth.status === 'green' ? 'bg-emerald-500/10 text-emerald-400' : treasuryHealth.status === 'amber' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>Score: {treasuryHealth.score}% · {treasuryHealth.status === 'green' ? 'Healthy' : treasuryHealth.status === 'amber' ? 'Warning' : 'Critical'}</span>
          </div>
          {treasuryHealth.alerts.length > 0 && (
            <div className="space-y-1">{treasuryHealth.alerts.map((a, i) => <p key={i} className="text-xs text-amber-400">⚠ {a}</p>)}</div>
          )}
          {treasuryHealth.recommendations.length > 0 && (
            <div className="space-y-1"><p className="text-[10px] text-zinc-500">Recommendations</p>{treasuryHealth.recommendations.map((r, i) => <p key={i} className="text-xs text-zinc-400">• {r}</p>)}</div>
          )}
        </div>
      )}      </div>

      {forecast.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 mt-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Treasury Calendar</p>
          <div className="space-y-1">
            {forecast.filter(f => f.events.length > 0 || f.expected_inflows > 100000).slice(0, 10).map((f, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] text-xs">
                <span className="text-zinc-400 w-16">{new Date(f.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</span>
                <span className="text-white flex-1">{f.events.length > 0 ? f.events.map(e => e.description).join(", ") : f.expected_inflows > 0 ? "Rental Collection" : ""}</span>
                <span className={f.events.length > 0 ? "text-red-400 tabular-nums" : f.expected_inflows > 0 ? "text-emerald-400 tabular-nums" : "text-zinc-500 tabular-nums"}>{f.events.length > 0 ? "-R" + f.expected_outflows.toLocaleString() : f.expected_inflows > 0 ? "+R" + f.expected_inflows.toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 mt-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Risk Simulation</p>
        <p className="text-xs text-zinc-400 mb-2">Adjust supplier batch amount to see impact on forecast</p>
        <input type="range" min="0" max="100" defaultValue="100" className="w-full" />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>      {/* Workflow Stages */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {([
          { key: 'review', label: 'Treasury Review', count: reviewRequests.length },
          { key: 'approved', label: 'Approved', count: approvedRequests.length },
          { key: 'batches', label: 'Batches', count: batches.length },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setStage(s.key)} className={`px-4 py-2 text-xs font-light transition-colors ${stage === s.key ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* Stage 1: Treasury Review */}
      {stage === 'review' && (
        <div className="space-y-4">
          {/* Invoices ready for payment request */}
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Ready for Payment Request</p>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Outstanding</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Pay Now</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Due</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Action</th></tr></thead>
              <tbody>
                {invoices.filter(i => !requests.some(r => r.invoice_id === i.id && r.status !== 'cancelled' && r.status !== 'rejected')).map(inv => {
                  const payAmount = editAmounts[inv.id] || String(inv.total_amount || 0);
                  return (
                    <tr key={inv.id} className="border-b border-white/[0.03]">
                      <td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td>
                      <td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td>
                      <td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right">
                        <input value={payAmount} onChange={(e) => handleEditAmount(inv.id, e.target.value)} onBlur={() => saveAmount(inv.id)} className="w-24 text-right rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-xs text-white outline-none focus:border-white/20" />
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.due_date}</td>
                      <td className="py-2.5 px-4 text-center">
                        <button onClick={() => createRequest(inv.id, parseFloat(payAmount) || inv.total_amount)} className="text-emerald-400 hover:text-emerald-300 text-xs">Request →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Existing requests in review */}
          {reviewRequests.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-6">Awaiting Treasury</p>
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead>
                  <tbody>{reviewRequests.map(r => (<tr key={r.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{r.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{r.invoice?.invoice_number || '—'}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{r.amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{r.status}</span></td><td className="py-2.5 px-4 text-right space-x-2"><button onClick={() => updateStatus(r.id, 'approved')} className="text-emerald-400 hover:text-emerald-300 text-xs">Approve</button><button onClick={() => updateStatus(r.id, 'held')} className="text-amber-400 hover:text-amber-300 text-xs">Hold</button><button onClick={() => updateStatus(r.id, 'rejected')} className="text-red-400 hover:text-red-300 text-xs">Reject</button></td></tr>))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stage 2: Approved */}
      {stage === 'approved' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">{approvedRequests.length} approved · R{approvedRequests.reduce((s, r) => s + r.amount, 0).toLocaleString()}</p>
            {approvedRequests.length > 0 && (
              <button onClick={() => setShowCreateBatch(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
                Create Batch ({approvedRequests.length})
              </button>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead>
              <tbody>{approvedRequests.map(r => (<tr key={r.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{r.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{r.invoice?.invoice_number || '—'}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{r.amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-right"><button onClick={() => updateStatus(r.id, 'held')} className="text-amber-400 hover:text-amber-300 text-xs">Hold</button></td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stage 3: Batches */}
      {stage === 'batches' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">{batches.length} batches</p>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Batch</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Count</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
              <tbody>{batches.map(b => (<tr key={b.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{b.batch_number}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{b.description || '—'}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{b.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-400 text-xs">{b.payment_count}</td><td className="py-2.5 px-4 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{b.status}</span></td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Batch Modal */}
      {showCreateBatch && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateBatch(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md"><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Create Payment Batch</p><button onClick={() => setShowCreateBatch(false)} className="text-zinc-500 hover:text-white">✕</button></div><div className="space-y-3"><p className="text-xs text-zinc-400">{approvedRequests.length} approved · R{approvedRequests.reduce((s: number, r: any) => s + r.amount, 0).toLocaleString()}</p><select value={batchBankAccount} onChange={(e) => setBatchBankAccount(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select bank account...</option>{bankAccounts.map(b => (<option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>))}</select><input value={batchReference} onChange={(e) => setBatchReference(e.target.value)} placeholder="Reference (e.g. July Supplier Run)" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><button onClick={createBatch} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Create Batch</button></div></div></div>
        </>
      )}
    </div>
  );
}

function HealthCard({ label, value, highlight }: any) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{label}</p>
      <p className={`text-lg font-light ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
