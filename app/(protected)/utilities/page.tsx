'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Zap, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Building2 } from 'lucide-react';

export default function UtilitiesWorkspace() {
  const [recoveries, setRecoveries] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBudgeted: 0, totalActual: 0, totalRecovered: 0, underRecovery: 0, overRecovery: 0 });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const entityId = entities[0];

      const [recData, propData] = await Promise.all([
        supabase.from('recoveries').select('*').eq('entity_id', entityId).order('property_id'),
        supabase.from('properties').select('id, property_name').eq('entity_id', entityId),
      ]);

      const recs = recData.data || [];
      setRecoveries(recs);
      setProperties(propData.data || []);

      const totalBudgeted = recs.reduce((s, r) => s + (r.budgeted_amount || 0), 0);
      const totalActual = recs.reduce((s, r) => s + (r.actual_expense || 0), 0);
      const totalRecovered = recs.reduce((s, r) => s + (r.recovered_amount || 0), 0);
      const underRecovery = recs.filter(r => (r.recovery_rate || 0) < 90 && r.actual_expense > 0).length;
      const overRecovery = recs.filter(r => (r.recovery_rate || 0) > 110).length;

      setStats({ totalBudgeted, totalActual, totalRecovered, underRecovery, overRecovery });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  const propMap = new Map(properties.map(p => [p.id, p.property_name]));
  const categories = [...new Set(recoveries.map(r => r.recovery_category))];

  return (
    <div className="p-8 lg:p-10 max-w-6xl mx-auto space-y-10">
      
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Utilities & Recoveries</p>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
          {stats.totalRecovered > 0 ? `R${stats.totalRecovered.toLocaleString()} recovered` : 'No recoveries yet'}
          {stats.underRecovery > 0 && <span className="text-amber-400"> · {stats.underRecovery} under-recovering</span>}
        </h1>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Budgeted', value: `R${stats.totalBudgeted.toLocaleString()}`, icon: DollarSign, color: 'text-zinc-400' },
          { label: 'Actual Expense', value: `R${stats.totalActual.toLocaleString()}`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Recovered', value: `R${stats.totalRecovered.toLocaleString()}`, icon: TrendingDown, color: stats.totalRecovered >= stats.totalActual ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Recovery Rate', value: stats.totalActual > 0 ? `${Math.round((stats.totalRecovered / stats.totalActual) * 100)}%` : '—', icon: Zap, color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{s.label}</p>
            </div>
            <p className={`text-2xl font-light ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ALERTS */}
      {(stats.underRecovery > 0 || stats.overRecovery > 0) && (
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-white font-light">Recovery anomalies detected</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {stats.underRecovery > 0 && `${stats.underRecovery} under-recovering (< 90%)`}
              {stats.underRecovery > 0 && stats.overRecovery > 0 && ' · '}
              {stats.overRecovery > 0 && `${stats.overRecovery} over-recovering (> 110%)`}
            </p>
          </div>
        </div>
      )}

      {/* BY PROPERTY */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">By Property</p>
        <div className="rounded-xl border border-white/[0.05] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Property</th>
                <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Category</th>
                <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Budgeted</th>
                <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Actual</th>
                <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Recovered</th>
                <th className="text-right py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Rate</th>
              </tr>
            </thead>
            <tbody>
              {recoveries.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-xs text-zinc-500">No recovery data yet.</td></tr>
              ) : (
                recoveries.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer" onClick={() => window.location.href = `/utilities/${r.id}`}>
                    <td className="py-2 px-4 text-white font-light text-xs">{propMap.get(r.property_id) || '—'}</td>
                    <td className="py-2 px-4 text-zinc-400 text-xs capitalize">{r.recovery_category?.replace(/_/g, ' ') || '—'}</td>
                    <td className="py-2 px-4 text-right text-zinc-400 text-xs">R{(r.budgeted_amount || 0).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-zinc-400 text-xs">R{(r.actual_expense || 0).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-white text-xs">R{(r.recovered_amount || 0).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-xs ${(r.recovery_rate || 0) >= 90 ? 'text-emerald-400' : (r.recovery_rate || 0) >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {r.recovery_rate ? `${Math.round(r.recovery_rate)}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
