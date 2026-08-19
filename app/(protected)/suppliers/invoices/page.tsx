'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { Plus } from 'lucide-react';
import CaptureInvoiceModal from '@/app/components/suppliers/CaptureInvoiceModal';

export default function InvoicesPage() {
  const [entityId, setEntityId] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
    const [showCapture, setShowCapture] = useState(false);

   async function init() {
  setLoading(true);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { setLoading(false); return; }

  const { data: accessRows } = await supabase
    .from('user_entity_access')
    .select('entity_id')
    .eq('user_id', session.user.id);

  const entityIdList = accessRows?.map(r => r.entity_id) || [];
  if (!entityIdList.length) { setLoading(false); return; }

  setEntityId(entityIdList[0]);
  const { data } = await supabase
    .from('supplier_invoices_new')
    .select('*, supplier:supplier_id(supplier_name)')
    .in('entity_id', entityIdList)
    .order('created_at', { ascending: false })
    .limit(50);
  setInvoices(data || []);
  setLoading(false);
}
    useEffect(() => {
    init();
  }, []);

  const filtered = invoices.filter(i => {
  if (filter !== 'all' && i.lifecycle_status !== filter) return false;
  if (search && !i.invoice_number?.toLowerCase().includes(search.toLowerCase()) && !i.supplier?.supplier_name?.toLowerCase().includes(search.toLowerCase())) return false;
  return true;
});

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
           <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Invoices</h1>
        <button
          onClick={() => setShowCapture(true)}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Capture Invoice
        </button>
      </div>
            <div className="flex gap-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'posted', label: 'Posted' },
          { key: 'credit_note', label: 'Credit Notes' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs transition-all ${filter === tab.key ? 'bg-white text-black font-medium' : 'text-zinc-500 hover:text-white border border-white/[0.08]'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
      {!filtered.length ? <p className="text-sm text-zinc-500 py-8 text-center">No invoices found.</p> : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice #</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
            <tbody>{filtered.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : inv.lifecycle_status === 'pending' ? 'bg-amber-500/10 text-amber-400' : inv.lifecycle_status === 'credit_note' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>{inv.lifecycle_status}</span></td></tr>))}</tbody>
          </table>
        </div>
      )}
            {showCapture && (
        <CaptureInvoiceModal
          entityId={entityId}
          onClose={() => setShowCapture(false)}
          onCaptured={() => {
            setShowCapture(false);
            init();
          }}
        />
      )}
    </div>
  );
}
