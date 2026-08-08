'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCommandPalette } from '@/lib/platform/CommandPaletteContext';
import MorningBrief from '@/app/components/command-centre/MorningBrief';

export default function RevenueCommandCentre() {
  const router = useRouter();
  const { open } = useCommandPalette();
  const [loading, setLoading] = useState(true);
  const [entityId, setEntityId] = useState('');
  const [outlook, setOutlook] = useState<any>(null);
  const [stateSummary, setStateSummary] = useState<Record<string, number>>({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/landing'); return; }

      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);

      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('revenue_outlooks')
        .select('*')
        .eq('entity_id', entities[0])
        .eq('snapshot_date', today)
        .single();

      if (data) setOutlook(data);

      const { data: states } = await supabase
        .from('revenue_states')
        .select('state')
        .eq('entity_id', entities[0]);

      const counts: Record<string, number> = {};
      for (const s of (states || [])) {
        counts[s.state] = (counts[s.state] || 0) + 1;
      }
      setStateSummary(counts);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-8 pt-12 pb-24">
      
      {/* MORNING BRIEF — existing component */}
      <MorningBrief entityId={entityId} />

      {/* REVENUE OUTLOOK */}
      {outlook ? (
        <div className="space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Revenue Outlook</p>
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2 rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Expected Today</p>
              <p className="text-3xl font-light text-white">R{(outlook.expected_today || 0).toLocaleString()}</p>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-xs text-zinc-500">Collected: R{(outlook.collected_today || 0).toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Confidence: {Math.round((outlook.collection_confidence || 0) * 100)}%</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Protected</p>
              <p className="text-2xl font-light text-emerald-400">R{(outlook.protected_revenue || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">At Risk</p>
              <p className="text-2xl font-light text-amber-400">R{(outlook.at_risk || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Actions</p>
              <p className="text-2xl font-light text-white">{outlook.actions_taken || 0}</p>
            </div>
          </div>

          {/* Top Priority */}
          {outlook.top_priorities?.[0] && (
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-amber-400/70 mb-1">Top Priority</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{outlook.top_priorities[0].tenant_name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    R{outlook.top_priorities[0].amount?.toLocaleString()} at risk · {outlook.top_priorities[0].risk === 'high' ? 'Urgent' : 'Monitor'}
                  </p>
                </div>
                <Link href="/tenants" className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black hover:bg-gray-100">
                  {outlook.top_priorities[0].action || 'Review'}
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-6 text-center">
          <p className="text-sm text-zinc-500 font-light">Revenue outlook will appear here.</p>
          <p className="text-xs text-zinc-600 mt-1">Run a daily revenue assessment to populate your command centre.</p>
        </div>
      )}

      {/* REVENUE STATES */}
      {Object.keys(stateSummary).length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Portfolio State</p>
          <div className="flex gap-4 flex-wrap">
            {[
              { state: 'healthy', label: 'Healthy', color: 'bg-emerald-400' },
              { state: 'watching', label: 'Watching', color: 'bg-blue-400' },
              { state: 'at_risk', label: 'At Risk', color: 'bg-amber-400' },
              { state: 'intervening', label: 'Intervening', color: 'bg-orange-400' },
              { state: 'recovering', label: 'Recovering', color: 'bg-cyan-400' },
              { state: 'protected', label: 'Protected', color: 'bg-green-400' },
              { state: 'legal', label: 'Legal', color: 'bg-red-400' },
            ].map(s => (
              <div key={s.state} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-xs text-zinc-400">{s.label}</span>
                <span className="text-xs text-white font-medium">{stateSummary[s.state] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH */}
      <button onClick={open} className="w-full rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-3.5 text-sm text-zinc-500 text-left hover:border-white/10 hover:bg-white/[0.02] transition-all font-light">
        Search tenants, leases, statements, receipts...
      </button>
    </div>
  );
}
