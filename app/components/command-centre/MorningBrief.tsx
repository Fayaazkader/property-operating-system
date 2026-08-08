'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function MorningBrief({ entityId }: { entityId: string }) {
  const [displayName, setDisplayName] = useState('');
  const [stmtPeriod, setStmtPeriod] = useState<any>(null);
  const [finPeriod, setFinPeriod] = useState<any>(null);
  const [attentionItems, setAttentionItems] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [occupancyPct, setOccupancyPct] = useState(0);
  const [vacancyCount, setVacancyCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();
      if (profile?.display_name) setDisplayName(profile.display_name);

      // Load existing Morning Brief data
      const [
        { data: leases },
        { data: units },
        { data: stmtPeriodData },
        { data: finPeriodData },
      ] = await Promise.all([
        supabase.from('leases').select('monthly_rental, tenant_name, lease_end_date').eq('owner_entity_id', entityId),
        supabase.from('units').select('id, occupancy_status'),
        supabase.from('financial_periods').select('*').eq('entity_id', entityId).eq('period_type', 'statement').order('end_date', { ascending: false }).limit(1).single(),
        supabase.from('financial_periods').select('*').eq('entity_id', entityId).eq('period_type', 'financial').order('end_date', { ascending: false }).limit(1).single(),
      ]);

      setStmtPeriod(stmtPeriodData);
      setFinPeriod(finPeriodData);

      const total = (leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0);
      setTotalRevenue(total);

      const occ = (units || []).filter((u: any) => u.occupancy_status === 'Occupied').length;
      const totalUnits = (units || []).length;
      setOccupancyPct(totalUnits > 0 ? Math.round((occ / totalUnits) * 100) : 0);
      setVacancyCount(totalUnits - occ);

      // Attention items
      const items: any[] = [];
      const critical = (leases || []).filter((l: any) => {
        const end = new Date(l.lease_end_date);
        const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 90;
      });

      if (critical.length > 0) {
        items.push({
          level: 'attention',
          text: `${critical.length} lease${critical.length > 1 ? 's' : ''} expiring within 90 days`,
          detail: `Combined annual value: R${critical.reduce((s: number, l: any) => s + (l.monthly_rental || 0) * 12, 0).toLocaleString()}`,
        });
      }

      setAttentionItems(items);
      setActivityFeed([]);
    }
    load();
  }, [entityId]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Revenue Operations</p>
        <h1 className="text-3xl font-light tracking-[-0.02em] text-white">
          {greeting}{displayName ? `, ${displayName}` : ''}.
        </h1>
      </div>

      {/* Period Indicators */}
      <div className="flex gap-3">
        {stmtPeriod && (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.01] px-3 py-1">
            <div className={`w-1.5 h-1.5 rounded-full ${stmtPeriod.status === 'open' ? 'bg-emerald-400/60' : 'bg-zinc-600'}`} />
            <span className="text-[11px] text-zinc-500">Statement: {stmtPeriod.period_name}</span>
          </div>
        )}
        {finPeriod && (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.01] px-3 py-1">
            <div className={`w-1.5 h-1.5 rounded-full ${finPeriod.status === 'open' ? 'bg-emerald-400/60' : 'bg-zinc-600'}`} />
            <span className="text-[11px] text-zinc-500">Financial: {finPeriod.period_name}</span>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Monthly Revenue</p>
          <p className="text-xl font-light text-white">R{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Occupancy</p>
          <p className="text-xl font-light text-white">{occupancyPct}%</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">{vacancyCount} vacant</p>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">Needs Attention</p>
          <p className={`text-xl font-light ${attentionItems.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {attentionItems.length === 0 ? 'None' : attentionItems.length}
          </p>
        </div>
      </div>

      {/* Attention Items */}
      {attentionItems.length > 0 && (
        <div className="space-y-2">
          {attentionItems.map((item: any, i: number) => (
            <Link key={i} href="/tenants" className="flex items-start gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-white/[0.02] transition-colors">
              <span className="text-amber-400 text-sm mt-0.5">!</span>
              <div>
                <p className="text-sm text-white font-light">{item.text}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{item.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
