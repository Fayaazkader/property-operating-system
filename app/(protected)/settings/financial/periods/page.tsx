'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FinancialPeriodsPage() {
  const [entityId, setEntityId] = useState('');
  const [periods, setPeriods] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);
      const { data } = await supabase.from('financial_periods').select('*').eq('entity_id', entities[0]).order('period_start', { ascending: false }).limit(24);
      setPeriods(data || []);
    }
    load();
  }, []);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Financial Periods</h1><p className="text-sm text-zinc-500 mt-1">Statement, financial, and year-end periods.</p></div>
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Create Period</button>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Period</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Dates</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.id} className="border-b border-white/[0.03]">
                <td className="py-2.5 px-4 text-white font-light">{p.period_name}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs capitalize">{p.period_type}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{p.period_start?.split('T')[0]} → {p.period_end?.split('T')[0]}</td>
                <td className="py-2.5 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'closed' ? 'bg-zinc-800 text-zinc-500' : 'bg-amber-500/10 text-amber-400'}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
