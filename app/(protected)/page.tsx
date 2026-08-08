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
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/landing'); return; }

        const { data: entities, error } = await supabase.rpc('auth_entities');
        console.log("auth_entities:", entities, error);
        
        if (!entities || !entities.length) {
          console.log("No entities found — exiting");
          setLoading(false);
          return;
        }
        
        console.log("Continuing with entity:", entities[0]);
        setEntityId(entities[0]);

        const today = new Date().toISOString().split('T')[0];
        console.log("Querying revenue_outlooks for:", entities[0], today);
        
        const { data } = await supabase
          .from('revenue_outlooks')
          .select('*')
          .eq('entity_id', entities[0])
          .eq('snapshot_date', today)
          .single();

        if (data) {
          console.log("Outlook found:", data);
          setOutlook(data);
        } else {
          console.log("No outlook, generating live...");
          try {
            const { revenueAssuranceEngine } = await import('@/lib/revenue-command/assurance-engine');
            await revenueAssuranceEngine.generateRevenueOutlook(entities[0]);
            const { data: fresh } = await supabase
              .from('revenue_outlooks')
              .select('*')
              .eq('entity_id', entities[0])
              .eq('snapshot_date', today)
              .single();
            if (fresh) { console.log("Fresh outlook:", fresh); setOutlook(fresh); }
          } catch (e) { console.error("Generate outlook error:", e); }
        }

        console.log("Querying revenue_states...");
        const { data: states } = await supabase
          .from('revenue_states')
          .select('state')
          .eq('entity_id', entities[0]);
        const counts: Record<string, number> = {};
        for (const s of (states || [])) { counts[s.state] = (counts[s.state] || 0) + 1; }
        setStateSummary(counts);
        console.log("States:", counts);

        console.log("Querying activity_feed...");
        const { data: activity } = await supabase
          .from('activity_feed')
          .select('*')
          .eq('entity_id', entities[0])
          .order('occurred_at', { ascending: false })
          .limit(10);
        setActivityFeed(activity || []);
        console.log("Activity:", activity?.length, "items");

      } catch (err) {
        console.error('Init error:', err);
      }
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-8 pt-12 pb-24">
      
      <MorningBrief entityId={entityId} />

      <div className="space-y-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Revenue Outlook</p>
        {outlook ? (
          <>
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
          </>
        ) : null}
      </div>

      {Object.keys(stateSummary).length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Portfolio State</p>
          <div className="flex gap-4 flex-wrap">
            {['healthy','watching','at_risk','intervening','recovering','protected','legal'].map(state => (
              <div key={state} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  state === 'healthy' ? 'bg-emerald-400' : state === 'watching' ? 'bg-blue-400' :
                  state === 'at_risk' ? 'bg-amber-400' : state === 'intervening' ? 'bg-orange-400' :
                  state === 'recovering' ? 'bg-cyan-400' : state === 'protected' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="text-xs text-zinc-400 capitalize">{state.replace('_',' ')}</span>
                <span className="text-xs text-white font-medium">{stateSummary[state] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activityFeed.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Recent Activity</p>
          <div className="rounded-xl border border-white/[0.05] overflow-hidden">
            {activityFeed.map((event: any, i: number) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b border-white/[0.03] last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  event.signal_category === 'financial' ? 'bg-emerald-400' : event.signal_category === 'behaviour' ? 'bg-amber-400' :
                  event.signal_category === 'communication' ? 'bg-blue-400' : event.signal_category === 'legal' ? 'bg-red-400' : 'bg-zinc-600'
                }`} />
                <p className="text-sm text-zinc-300 font-light flex-1">{event.description || event.event_type}</p>
                <span className="text-[11px] text-zinc-600">{event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={open} className="w-full rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-3.5 text-sm text-zinc-500 text-left hover:border-white/10 hover:bg-white/[0.02] transition-all font-light">
        Search tenants, leases, statements, receipts...
      </button>
    </div>
  );
}
