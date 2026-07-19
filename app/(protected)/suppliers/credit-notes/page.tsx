'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const { data } = await supabase.from('supplier_credit_notes').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entities[0]).order('created_at', { ascending: false }).limit(50);
      setCreditNotes(data || []);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="text-zinc-500">Loading...</div>;
  if (!creditNotes.length) return <div className="space-y-4"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Credit Notes</h1><p className="text-sm text-zinc-500 py-8 text-center">No credit notes.</p></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Credit Notes</h1>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">CN #</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Reason</th></tr></thead>
          <tbody>{creditNotes.map((cn: any) => (<tr key={cn.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{cn.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{cn.credit_note_number}</td><td className="py-2.5 px-4 text-right text-emerald-400 tabular-nums text-xs">R{cn.amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{cn.reason || '—'}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
