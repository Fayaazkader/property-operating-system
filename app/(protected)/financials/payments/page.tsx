'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PaymentHubPage() {
  const [entityId, setEntityId] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ready' | 'requests' | 'batches'>('ready');
  const [showCreateBatch, setShowCreateBatch] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const eid = entities[0]; setEntityId(eid);
      await loadData(eid);
      setLoading(false);
    }
    init();
  }, []);

  async function loadData(eid: string) {
    const [invData, reqData, batchData] = await Promise.all([
      supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', eid).eq('lifecycle_status', 'posted').order('due_date'),
      supabase.from('payment_requests').select('*, invoice:invoice_id(invoice_number, total_amount), supplier:supplier_id(supplier_name)').eq('entity_id', eid).order('created_at', { ascending: false }),
      supabase.from('payment_batches').select('*').eq('entity_id', eid).order('created_at', { ascending: false }),
    ]);
    setInvoices(invData.data || []);
    setRequests(reqData.data || []);
    setBatches(batchData.data || []);
  }

  async function createRequests() {
    for (const invId of selectedInvoices) {
      const inv = invoices.find(i => i.id === invId);
      if (inv) {
        await supabase.from('payment_requests').insert({
          entity_id: entityId, invoice_id: invId, supplier_id: inv.supplier_id,
          amount: inv.total_amount, status: 'draft', due_date: inv.due_date,
          payment_method: 'eft',
        });
      }
    }
    setSelectedInvoices([]);
    await loadData(entityId);
  }

  async function updateRequestStatus(id: string, status: string) {
    await supabase.from('payment_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    await loadData(entityId);
  }

  async function createBatch() {
    const approved = requests.filter(r => r.status === 'approved');
    if (!approved.length) return;

    const total = approved.reduce((s: number, r: any) => s + r.amount, 0);
    const batchNumber = `PB-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: batch } = await supabase.from('payment_batches').insert({
      entity_id: entityId, batch_number: batchNumber, description: 'Payment Batch',
      total_amount: total, payment_count: approved.length, status: 'draft',
    }).select('*').single();

    if (batch) {
      await supabase.from('payment_requests').update({ batch_id: batch.id, status: 'batched' }).in('id', approved.map(r => r.id));
    }
    setShowCreateBatch(false);
    await loadData(entityId);
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;

  const totalSelected = invoices.filter(i => selectedInvoices.includes(i.id)).reduce((s, i) => s + (i.total_amount || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Payment Hub</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Treasury Workspace</h1>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {(['ready', 'requests', 'batches'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-light capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t === 'ready' ? 'Ready to Pay' : t === 'requests' ? 'Payment Requests' : 'Batches'}</button>
        ))}
      </div>

      {tab === 'ready' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">{invoices.length} invoices ready</p>
            {selectedInvoices.length > 0 && (
              <button onClick={createRequests} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
                Create Requests ({selectedInvoices.length}) — R{totalSelected.toLocaleString()}
              </button>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-2 w-8"></th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Due</th></tr></thead>
              <tbody>{invoices.map(inv => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-2"><input type="checkbox" checked={selectedInvoices.includes(inv.id)} onChange={() => setSelectedInvoices(prev => prev.includes(inv.id) ? prev.filter(id => id !== inv.id) : [...prev, inv.id])} /></td><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.due_date}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">{requests.length} requests</p>
            {requests.filter(r => r.status === 'approved').length > 0 && (
              <button onClick={() => setShowCreateBatch(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
                Create Batch ({requests.filter(r => r.status === 'approved').length})
              </button>
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead>
              <tbody>{requests.map(r => (<tr key={r.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{r.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{r.invoice?.invoice_number || '—'}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{r.amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'draft' ? 'bg-zinc-800 text-zinc-500' : 'bg-amber-500/10 text-amber-400'}`}>{r.status}</span></td><td className="py-2.5 px-4 text-right">{r.status === 'draft' && <button onClick={() => updateRequestStatus(r.id, 'approved')} className="text-emerald-400 hover:text-emerald-300 text-xs">Approve</button>}{r.status === 'approved' && <button onClick={() => updateRequestStatus(r.id, 'draft')} className="text-amber-400 hover:text-amber-300 text-xs">Unapprove</button>}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">{batches.length} batches</p>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Batch</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Count</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
              <tbody>{batches.map(b => (<tr key={b.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{b.batch_number}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{b.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-400 text-xs">{b.payment_count}</td><td className="py-2.5 px-4 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{b.status}</span></td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateBatch && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateBatch(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md"><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Create Payment Batch</p><button onClick={() => setShowCreateBatch(false)} className="text-zinc-500 hover:text-white">✕</button></div><div className="space-y-3"><p className="text-xs text-zinc-400">{requests.filter(r => r.status === 'approved').length} approved · R{requests.filter(r => r.status === 'approved').reduce((s: number, r: any) => s + r.amount, 0).toLocaleString()}</p><button onClick={createBatch} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Create Batch</button></div></div></div>
        </>
      )}
    </div>
  );
}
