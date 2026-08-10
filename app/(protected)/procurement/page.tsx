'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, FileText, CheckCircle, Clock, DollarSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ProcurementWorkspace() {
  const [spendRequests, setSpendRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const entityId = entities[0];

      const { data } = await supabase.from('procurement_spend_requests').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50);
      setSpendRequests(data || []);
      setStats({ pending: (data || []).filter(s => s.status === 'submitted').length, approved: (data || []).filter(s => s.status === 'approved').length, total: (data || []).length });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="p-8 lg:p-10 max-w-6xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Procurement</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            {stats.pending > 0 ? `${stats.pending} awaiting approval` : `${stats.total} spend requests`}
          </h1>
        </div>
        <Link href="/procurement/new" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
          <Plus className="w-3.5 h-3.5" /> New Request
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-400' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Total', value: stats.total, icon: FileText, color: 'text-zinc-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon className={`w-4 h-4 ${s.color}`} /><p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{s.label}</p></div>
            <p className={`text-2xl font-light ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.05] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Request</th><th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Category</th><th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>
            {spendRequests.length === 0 ? <tr><td colSpan={4} className="py-12 text-center text-xs text-zinc-500">No spend requests yet.</td></tr> : spendRequests.map(sr => (
              <tr key={sr.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer">
                <td className="py-2 px-4 text-white font-light text-xs">{sr.title}</td>
                <td className="py-2 px-4 text-zinc-400 text-xs">{sr.category || '—'}</td>
                <td className="py-2 px-4 text-right text-white text-xs">R{(sr.estimated_amount || 0).toLocaleString()}</td>
                <td className="py-2 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${sr.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : sr.status === 'submitted' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{sr.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
