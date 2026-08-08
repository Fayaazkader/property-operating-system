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

      const { data: entityArray } = await supabase.rpc(.auth_entities.);
      const entities = entityArray || [];
      const entities = entityArray || [];
      if (!entities?.length) { setLoading(false);
      } catch (err) {
        console.error("Command Centre init error:", err);
        setLoading(false);
      } return; }
      console.log("Entity from auth:", entities[0]); setEntityId(entities[0]);

      // Load outlook — generate live if no snapshot
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('revenue_outlooks')
        .select('*')
        .eq('entity_id', entities[0])
        .eq('snapshot_date', today)
        .single();

      if (data) {
        setOutlook(data);
      } else {
        // Generate live outlook
        try {
          const { revenueAssuranceEngine } = await import('@/lib/revenue-command/assurance-engine');
          await revenueAssuranceEngine.generateRevenueOutlook(entities[0]);
          const { data: fresh } = await supabase
            .from('revenue_outlooks')
            .select('*')
            .eq('entity_id', entities[0])
            .eq('snapshot_date', today)
            .single();
          if (fresh) setOutlook(fresh);
        } catch {}
      }

      // Load states
      const { data: states } = await supabase
        .from('revenue_states')
        .select('state')
        .eq('entity_id', entities[0]);
      const counts: Record<string, number> = {};
      for (const s of (states || [])) {
        counts[s.state] = (counts[s.state] || 0) + 1;
      }
      setStateSummary(counts);

      // Load activity feed
      const { data: activity } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('entity_id', entities[0])
        .order('occurred_at', { ascending: false })
        .limit(10);
      setActivityFeed(activity || []);

      setLoading(false);
      } catch (err) {
        console.error("Command Centre init error:", err);
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-8 pt-12 pb-24">
      
      {/* MORNING BRIEF — existing component */}
      <MorningBrief entityId={entityId} />

      {/* REVENUE OUTLOOK */}
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
          </>
        ) : (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-6 text-center">
            <p className="text-sm text-zinc-500 font-light">Revenue outlook will appear once billing data is available.</p>
          </div>
        )}
      </div>

      {/* PORTFOLIO STATE */}
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

      {/* ACTIVITY FEED */}
      {activityFeed.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Recent Activity</p>
          <div className="rounded-xl border border-white/[0.05] overflow-hidden">
            {activityFeed.map((event: any, i: number) => (
              <div key={event.id || i} className="flex items-center gap-4 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.01] transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  event.signal_category === 'financial' ? 'bg-emerald-400' :
                  event.signal_category === 'behaviour' ? 'bg-amber-400' :
                  event.signal_category === 'communication' ? 'bg-blue-400' :
                  event.signal_category === 'legal' ? 'bg-red-400' :
                  'bg-zinc-600'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 font-light truncate">{event.description || event.event_type}</p>
                </div>
                <span className="text-[11px] text-zinc-600 font-light flex-shrink-0">
                  {event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
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
