'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  TrendingUp, Wrench, Zap, ClipboardCheck, FileText, Users, 
  Calendar, Building2, Search, ChevronRight, Home, Settings, Bell
} from 'lucide-react';

export default function OperationsHub() {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [visible, setVisible] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      if (profile?.display_name) setDisplayName(profile.display_name);

      try {
        const { data: entities } = await supabase.rpc('auth_entities');
        if (entities?.length) {
          const entityId = entities[0];

          // Load real data from all modules
          const [
            { count: activeLeases }, { data: leases },
            { count: openIssues }, { count: emergencyIssues },
            { data: recoveries },
            { count: todayInsp }, { count: overdueInsp },
            { count: pendingProc },
            { data: activity },
          ] = await Promise.all([
            supabase.from('leases').select('*', { count: 'exact', head: true }).eq('owner_entity_id', entityId).eq('lease_status', 'Active'),
            supabase.from('leases').select('monthly_rental').eq('owner_entity_id', entityId).eq('lease_status', 'Active'),
            supabase.from('maintenance_issues').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).in('status', ['reported', 'classified', 'in_progress']),
            supabase.from('maintenance_issues').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('priority', 'emergency').in('status', ['reported', 'classified']),
            supabase.from('recoveries').select('recovered_amount, actual_expense, recovery_rate').eq('entity_id', entityId),
            supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'scheduled').lte('scheduled_date', new Date().toISOString().split('T')[0]),
            supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'scheduled').gte('scheduled_date', new Date().toISOString().split('T')[0]),
            supabase.from('procurement_spend_requests').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'submitted'),
            supabase.from('activity_feed').select('*').eq('entity_id', entityId).order('occurred_at', { ascending: false }).limit(10),
          ]);

          const totalRevenue = (leases || []).reduce((s: number, l: any) => s + (l.monthly_rental || 0), 0);
          const totalRecovered = (recoveries || []).reduce((s: number, r: any) => s + (r.recovered_amount || 0), 0);
          const avgRecoveryRate = (recoveries || []).length > 0 
            ? Math.round((recoveries || []).reduce((s: number, r: any) => s + (r.recovery_rate || 0), 0) / (recoveries || []).length) 
            : 0;

          setLiveData({
            revenue: { leases: activeLeases || 0, total: totalRevenue },
            maintenance: { open: openIssues || 0, emergency: emergencyIssues || 0 },
            utilities: { recovered: totalRecovered, rate: avgRecoveryRate },
            inspections: { overdue: overdueInsp || 0, upcoming: todayInsp || 0 },
            procurement: { pending: pendingProc || 0 },
          });

          // Health scores from real data
          setHealthScores({
            'Revenue': activeLeases ? 95 : 0,
            'Maintenance': emergencyIssues ? Math.max(30, 100 - (emergencyIssues * 20)) : (openIssues ? 80 : 100),
            'Compliance': overdueInsp ? Math.max(40, 100 - (overdueInsp * 15)) : 95,
            'Utilities': avgRecoveryRate || 0,
            'Procurement': pendingProc ? Math.max(40, 100 - (pendingProc * 25)) : 90,
          });

          setActivityFeed(activity || []);
        }
      } catch {}

      setLoading(false);
      setTimeout(() => setVisible(true), 80);
    }
    init();
  }, []);

  if (loading) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const attentionCount = (liveData.maintenance?.emergency || 0) + (liveData.procurement?.pending || 0) + (liveData.inspections?.overdue || 0);

  // Module definitions — user can configure which ones appear
  const modules = [
    { 
      key: 'revenue', label: 'Revenue', icon: TrendingUp, span: 2,
      value: liveData.revenue?.leases ? `${liveData.revenue.leases} leases` : '—',
      detail: liveData.revenue?.total ? `R${(liveData.revenue.total / 1000).toFixed(0)}k/mo` : 'No data',
      sub: liveData.revenue?.leases ? 'Active portfolio' : 'Import leases to begin',
      status: 'Healthy', statusColor: 'text-emerald-400', href: '/financials/revenue',
      expanded: { label1: 'Billing', val1: 'Current', label2: 'Next Run', val2: '1 Aug', label3: 'Invoices', val3: '—' }
    },
    { 
      key: 'maintenance', label: 'Maintenance', icon: Wrench,
      value: liveData.maintenance?.open ? `${liveData.maintenance.open} open` : '—',
      detail: liveData.maintenance?.emergency ? `${liveData.maintenance.emergency} emergency` : 'All clear',
      sub: liveData.maintenance?.open ? 'Active work orders' : 'No issues',
      status: liveData.maintenance?.emergency ? 'Attention' : 'Healthy', 
      statusColor: liveData.maintenance?.emergency ? 'text-amber-400' : 'text-emerald-400', 
      href: '/maintenance',
      expanded: { label1: 'Emergency', val1: liveData.maintenance?.emergency || 0, label2: 'Open', val2: liveData.maintenance?.open || 0, label3: 'Avg Response', val3: '—' }
    },
    { 
      key: 'utilities', label: 'Utilities', icon: Zap,
      value: liveData.utilities?.rate ? `${liveData.utilities.rate}%` : '—',
      detail: liveData.utilities?.recovered ? `R${(liveData.utilities.recovered / 1000).toFixed(0)}k recovered` : 'No data',
      sub: 'Recovery rate',
      status: (liveData.utilities?.rate || 0) >= 90 ? 'Healthy' : 'Attention',
      statusColor: (liveData.utilities?.rate || 0) >= 90 ? 'text-emerald-400' : 'text-amber-400',
      href: '/utilities',
      expanded: { label1: 'Recovered', val1: liveData.utilities?.recovered ? `R${(liveData.utilities.recovered / 1000).toFixed(0)}k` : '—', label2: 'Rate', val2: `${liveData.utilities?.rate || 0}%`, label3: 'Leakage', val3: '—' }
    },
    { 
      key: 'inspections', label: 'Inspections', icon: ClipboardCheck,
      value: liveData.inspections?.overdue ? `${liveData.inspections.overdue} overdue` : '—',
      detail: liveData.inspections?.upcoming ? `${liveData.inspections.upcoming} upcoming` : 'None',
      sub: 'Scheduled inspections',
      status: liveData.inspections?.overdue ? 'Overdue' : 'On track', 
      statusColor: liveData.inspections?.overdue ? 'text-red-400' : 'text-emerald-400', 
      href: '/inspections',
      expanded: { label1: 'Overdue', val1: liveData.inspections?.overdue || 0, label2: 'Upcoming', val2: liveData.inspections?.upcoming || 0, label3: 'Completed', val3: '—' }
    },
    { 
      key: 'procurement', label: 'Procurement', icon: FileText,
      value: liveData.procurement?.pending ? `${liveData.procurement.pending} pending` : '—',
      detail: 'Awaiting approval',
      sub: liveData.procurement?.pending ? 'Spend requests' : 'All approved',
      status: liveData.procurement?.pending ? 'Attention' : 'Healthy',
      statusColor: liveData.procurement?.pending ? 'text-amber-400' : 'text-emerald-400',
      href: '/procurement',
      expanded: { label1: 'Pending', val1: liveData.procurement?.pending || 0, label2: 'RFQs', val2: '—', label3: 'POs', val3: '—' }
    },
    { key: 'suppliers', label: 'Suppliers', icon: Users, value: '—', detail: 'Supplier network', sub: 'Active suppliers', status: 'Active', statusColor: 'text-zinc-400', href: '/suppliers', expanded: {} },
    { key: 'leasing', label: 'Leasing', icon: Building2, value: '—', detail: 'Lease management', sub: 'Active leases', status: 'Active', statusColor: 'text-zinc-400', href: '/leasing', expanded: {} },
    { key: 'calendar', label: 'Calendar', icon: Calendar, value: '—', detail: 'Schedule', sub: 'Upcoming events', status: 'Active', statusColor: 'text-zinc-400', href: '/calendar', expanded: {} },
  ];

  return (
    <div className="min-h-screen bg-black">
      
      {/* OPERATIONAL STRIP */}
      <section className={`px-8 pt-16 pb-6 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Home</p>
              <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
                {greeting}{displayName ? `, ${displayName}` : ''}.
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/settings" className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all">
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>
          
          {/* Horizontal strip — at-a-glance */}
          <div className="flex items-center gap-6 py-3 px-5 rounded-xl border border-white/[0.04] bg-white/[0.01] overflow-x-auto">
            {[
              { label: 'Revenue', value: liveData.revenue?.leases ? `${liveData.revenue.leases} leases` : '—', color: 'text-emerald-400' },
              { label: 'Maintenance', value: liveData.maintenance?.emergency ? `${liveData.maintenance.emergency} emerg` : 'Clear', color: liveData.maintenance?.emergency ? 'text-amber-400' : 'text-emerald-400' },
              { label: 'Utilities', value: liveData.utilities?.recovered ? `R${(liveData.utilities.recovered / 1000).toFixed(0)}k` : '—', color: 'text-blue-400' },
              { label: 'Inspections', value: liveData.inspections?.overdue ? `${liveData.inspections.overdue} due` : 'Clear', color: liveData.inspections?.overdue ? 'text-red-400' : 'text-emerald-400' },
              { label: 'Procurement', value: liveData.procurement?.pending ? `${liveData.procurement.pending} pending` : 'Clear', color: liveData.procurement?.pending ? 'text-amber-400' : 'text-emerald-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${item.value === 'Clear' ? 'bg-emerald-400' : item.value === '—' ? 'bg-zinc-600' : 'bg-current'}`} />
                <span className="text-[11px] text-zinc-500 font-light">{item.label}</span>
                <span className={`text-[11px] font-light ${item.color}`}>{item.value}</span>
                {i < 4 && <span className="text-zinc-800">·</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULE MATRIX — Always shows data, no hover dependency */}
      <section className="px-8 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-3 mt-6">
            {modules.map((mod, i) => (
              <Link
                key={mod.key}
                href={mod.href}
                onClick={(e) => {
                  if (expandedModule === mod.key) {
                    e.preventDefault();
                    setExpandedModule(null);
                  } else {
                    setExpandedModule(mod.key);
                  }
                }}
                className={`group relative rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/[0.08] ${mod.span === 2 ? 'col-span-2' : ''}`}
                style={{ 
                  opacity: visible ? 1 : 0, 
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.06 + i * 0.04}s`,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <mod.icon className="w-4 h-4 text-zinc-500" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{mod.label}</p>
                </div>

                {/* Always visible data */}
                <p className="text-2xl font-light tracking-[-0.02em] text-white mb-1">{mod.value}</p>
                <p className="text-[11px] text-zinc-500 font-light mb-1">{mod.detail}</p>
                <p className="text-[10px] text-zinc-600 font-light">{mod.sub}</p>

                {/* Status dot */}
                <div className="flex items-center gap-1.5 mt-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    mod.statusColor === 'text-emerald-400' ? 'bg-emerald-400' : 
                    mod.statusColor === 'text-amber-400' ? 'bg-amber-400' : 
                    mod.statusColor === 'text-red-400' ? 'bg-red-400' : 'bg-zinc-500'
                  }`} />
                  <span className={`text-[10px] font-light ${mod.statusColor}`}>{mod.status}</span>
                </div>

                {/* Expanded detail on click */}
                {expandedModule === mod.key && mod.expanded && Object.keys(mod.expanded).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-3 gap-3 animate-in fade-in duration-300">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">{mod.expanded.label1}</p>
                      <p className="text-sm text-white font-light mt-0.5">{mod.expanded.val1}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">{mod.expanded.label2}</p>
                      <p className="text-sm text-white font-light mt-0.5">{mod.expanded.val2}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">{mod.expanded.label3}</p>
                      <p className="text-sm text-white font-light mt-0.5">{mod.expanded.val3}</p>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFOLIO HEALTH — From intelligence platform */}
      <section className={`px-8 py-12 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-6">Portfolio Health</p>
          <div className="space-y-3">
            {Object.entries(healthScores).map(([label, pct], i) => (
              <div key={label} className="flex items-center gap-6">
                <span className="text-xs text-zinc-400 w-28 font-light">{label}</span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    pct >= 90 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                    style={{ width: visible ? `${pct}%` : '0%', transitionDelay: `${i * 0.12}s` }} />
                </div>
                <span className="text-xs text-zinc-500 w-10 text-right font-light tabular-nums">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACTIVITY TIMELINE — From activity_feed */}
      {activityFeed.length > 0 && (
        <section className={`px-8 py-12 transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="max-w-6xl mx-auto">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-6">Activity</p>
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.04]" />
              <div className="space-y-4">
                {activityFeed.slice(0, 8).map((event: any, i: number) => (
                  <div key={i} className="relative pl-8">
                    <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                      event.signal_category === 'financial' ? 'bg-emerald-400' :
                      event.signal_category === 'maintenance' ? 'bg-amber-400' :
                      event.signal_category === 'utilities' ? 'bg-blue-400' : 'bg-zinc-500'
                    }`} />
                    <p className="text-[11px] text-zinc-600">
                      {event.occurred_at ? new Date(event.occurred_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                    <p className="text-sm text-white font-light mt-0.5">{event.description || event.event_type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SEARCH */}
      <section className="px-8 py-12 pb-32">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-4 text-sm text-zinc-500 font-light">
            <Search className="w-4 h-4 inline-block mr-2 text-zinc-600" />
            Search anything across your portfolio...
          </div>
        </div>
      </section>
    </div>
  );
}
