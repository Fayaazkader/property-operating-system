'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function InvoicesPage() {
  const [entityId, setEntityId] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);
      const { data } = await supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entities[0]).order('created_at', { ascending: false }).limit(50);
      setInvoices(data || []);
      setLoading(false);
    }
    init();
  }, []);

  const filtered = invoices.filter(i => !search || i.invoice_number?.toLowerCase().includes(search.toLowerCase()) || i.supplier?.supplier_name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Invoices</h1>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
      {!filtered.length ? <p className="text-sm text-zinc-500 py-8 text-center">No invoices found.</p> : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice #</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
            <tbody>{filtered.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{inv.lifecycle_status}</span></td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
