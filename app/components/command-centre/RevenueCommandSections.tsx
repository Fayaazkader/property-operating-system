'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function RevenueCommandSections({ entityId }: { entityId: string }) {
  const [outlook, setOutlook] = useState<any>(null);
  const [stateSummary, setStateSummary] = useState<Record<string, number>>({});
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  useEffect(() => {
    if (!entityId) return;
    async function load() {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data } = await supabase
          .from('revenue_outlooks')
          .select('*')
          .eq('entity_id', entityId)
          .eq('snapshot_date', today)
          .single();
        if (data) setOutlook(data);

        const { data: states } = await supabase
          .from('revenue_states')
          .select('state')
          .eq('entity_id', entityId);
        const counts: Record<string, number> = {};
        for (const s of (states || [])) { counts[s.state] = (counts[s.state] || 0) + 1; }
        setStateSummary(counts);

        const { data: activity } = await supabase
          .from('activity_feed')
          .select('*')
          .eq('entity_id', entityId)
          .order('occurred_at', { ascending: false })
          .limit(10);
        setActivityFeed(activity || []);
      } catch (e) { /* silent */ }
    }
    load();
  }, [entityId]);

  return (
    <div className="space-y-8 mt-8">
      
      {/* Revenue Outlook */}
      {outlook && (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Revenue Outlook</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Expected Today</p>
              <p className="text-xl font-light text-white">R{(outlook.expected_today || 0).toLocaleString()}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{(Math.round((outlook.collection_confidence || 0) * 100))}% confidence</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Protected</p>
              <p className="text-xl font-light text-emerald-400">R{(outlook.protected_revenue || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">At Risk</p>
              <p className="text-xl font-light text-amber-400">R{(outlook.at_risk || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Actions Today</p>
              <p className="text-xl font-light text-white">{outlook.actions_taken || 0}</p>
            </div>
          </div>
          {outlook.top_priorities?.[0] && (
            <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4">
              <p className="text-xs font-medium text-amber-400 mb-1">Top Priority: {outlook.top_priorities[0].tenant_name}</p>
              <p className="text-xs text-zinc-400">R{outlook.top_priorities[0].amount?.toLocaleString()} at risk</p>
            </div>
          )}
        </div>
      )}

      {/* Portfolio State */}
      {Object.keys(stateSummary).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Portfolio State</p>
          <div className="flex gap-3 flex-wrap">
            {['healthy','watching','at_risk','intervening','recovering','protected','legal'].map(state => (
              <div key={state} className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  state === 'healthy' ? 'bg-emerald-400' : state === 'watching' ? 'bg-blue-400' :
                  state === 'at_risk' ? 'bg-amber-400' : state === 'intervening' ? 'bg-orange-400' :
                  state === 'recovering' ? 'bg-cyan-400' : state === 'protected' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="text-[11px] text-zinc-400 capitalize">{state.replace('_',' ')}</span>
                <span className="text-[11px] text-white font-medium">{stateSummary[state] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {activityFeed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Recent Activity</p>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            {activityFeed.map((event: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.04] last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  event.signal_category === 'financial' ? 'bg-emerald-400' : event.signal_category === 'behaviour' ? 'bg-amber-400' :
                  event.signal_category === 'communication' ? 'bg-blue-400' : event.signal_category === 'legal' ? 'bg-red-400' : 'bg-zinc-600'
                }`} />
                <p className="text-xs text-zinc-300 font-light flex-1">{event.description || event.event_type}</p>
                <span className="text-[10px] text-zinc-600">{event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
