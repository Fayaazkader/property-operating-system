'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const { data } = await supabase.from('sub_ledger_entries').select('*').eq('entity_id', entities[0]).eq('ledger_type', 'supplier').order('posted_at', { ascending: false }).limit(50);
      setPayments(data || []);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Payment History</h1>
      {!payments.length ? <p className="text-sm text-zinc-500 py-8 text-center">No payment history. Payments managed in Cash Book.</p> : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Balance</th></tr></thead>
            <tbody>{payments.map((p: any, i: number) => (<tr key={i} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-zinc-400 text-xs">{p.posted_at?.split('T')[0]}</td><td className="py-2.5 px-4 text-white font-light text-xs">{p.description}</td><td className="py-2.5 px-4 text-right text-zinc-300 text-xs tabular-nums">R{(p.debit_amount || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-zinc-300 text-xs tabular-nums">R{(p.credit_amount || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-white text-xs tabular-nums">R{(p.running_balance || 0).toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
