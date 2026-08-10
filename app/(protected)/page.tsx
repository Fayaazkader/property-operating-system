'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCommandPalette } from '@/lib/platform/CommandPaletteContext';
import Link from 'next/link';
import { 
  TrendingUp, Wrench, Zap, ClipboardCheck, FileText, Users, 
  Calendar, Building2, Search, ChevronRight, ArrowRight
} from 'lucide-react';

export default function OperationsHub() {
  const router = useRouter();
  const { open } = useCommandPalette();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [visible, setVisible] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [liveData, setLiveData] = useState<Record<string, any>>({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/landing'); return; }
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      if (profile?.display_name) setDisplayName(profile.display_name);

      // Load live data
      try {
        const { data: entities } = await supabase.rpc('auth_entities');
        if (entities?.length) {
          const entityId = entities[0];
          const [
            { count: activeLeases }, { count: openIssues }, { count: emergencyIssues },
            { data: recoveries }, { count: upcomingInsp }, { count: pendingProcurement },
          ] = await Promise.all([
            supabase.from('leases').select('*', { count: 'exact', head: true }).eq('owner_entity_id', entityId).eq('lease_status', 'Active'),
            supabase.from('maintenance_issues').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).in('status', ['reported', 'classified', 'in_progress']),
            supabase.from('maintenance_issues').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('priority', 'emergency').in('status', ['reported', 'classified']),
            supabase.from('recoveries').select('recovered_amount, actual_expense').eq('entity_id', entityId),
            supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'scheduled').eq('scheduled_date', new Date().toISOString().split('T')[0]),
            supabase.from('procurement_spend_requests').select('*', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'submitted'),
          ]);

          const totalRecovered = (recoveries || []).reduce((s: number, r: any) => s + (r.recovered_amount || 0), 0);
          const totalActual = (recoveries || []).reduce((s: number, r: any) => s + (r.actual_expense || 0), 0);
          const recoveryRate = totalActual > 0 ? Math.round((totalRecovered / totalActual) * 100) : 0;

          setLiveData({
            revenue: { leases: activeLeases || 0 },
            maintenance: { open: openIssues || 0, emergency: emergencyIssues || 0 },
            utilities: { recoveryRate },
            inspections: { today: upcomingInsp || 0 },
            procurement: { pending: pendingProcurement || 0 },
          });
        }
      } catch {}

      setLoading(false);
      setTimeout(() => setVisible(true), 100);
    }
    init();

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const attentionCount = (liveData.maintenance?.emergency || 0) + (liveData.procurement?.pending || 0);

  const modules = [
    { 
      key: 'revenue', label: 'Revenue', icon: TrendingUp, 
      value: liveData.revenue?.leases ? `${liveData.revenue.leases} leases` : '—',
      preview: liveData.revenue?.leases ? `${liveData.revenue.leases} active leases` : 'No data yet',
      status: 'Healthy', statusColor: 'text-emerald-400', href: '/financials/revenue' 
    },
    { 
      key: 'maintenance', label: 'Maintenance', icon: Wrench, 
      value: liveData.maintenance?.open ? `${liveData.maintenance.open} open` : '—',
      preview: liveData.maintenance?.emergency ? `${liveData.maintenance.emergency} emergency` : 'All clear',
      status: liveData.maintenance?.emergency ? 'Attention' : 'Healthy', 
      statusColor: liveData.maintenance?.emergency ? 'text-amber-400' : 'text-emerald-400', 
      href: '/maintenance' 
    },
    { 
      key: 'utilities', label: 'Utilities', icon: Zap, 
      value: liveData.utilities?.recoveryRate ? `${liveData.utilities.recoveryRate}%` : '—',
      preview: 'Recovery rate',
      status: (liveData.utilities?.recoveryRate || 0) >= 90 ? 'Healthy' : 'Attention',
      statusColor: (liveData.utilities?.recoveryRate || 0) >= 90 ? 'text-emerald-400' : 'text-amber-400',
      href: '/utilities' 
    },
    { 
      key: 'inspections', label: 'Inspections', icon: ClipboardCheck, 
      value: liveData.inspections?.today ? `${liveData.inspections.today} today` : '—',
      preview: liveData.inspections?.today ? 'Scheduled today' : 'None scheduled',
      status: liveData.inspections?.today ? 'Due' : 'Clear', 
      statusColor: liveData.inspections?.today ? 'text-blue-400' : 'text-zinc-400', 
      href: '/inspections' 
    },
    { 
      key: 'procurement', label: 'Procurement', icon: FileText, 
      value: liveData.procurement?.pending ? `${liveData.procurement.pending} pending` : '—',
      preview: liveData.procurement?.pending ? 'Awaiting approval' : 'All approved',
      status: liveData.procurement?.pending ? 'Attention' : 'Healthy',
      statusColor: liveData.procurement?.pending ? 'text-amber-400' : 'text-emerald-400',
      href: '/procurement' 
    },
    { key: 'suppliers', label: 'Suppliers', icon: Users, value: '—', preview: 'Supplier network', status: 'Active', statusColor: 'text-zinc-400', href: '/suppliers' },
    { key: 'leasing', label: 'Leasing', icon: Building2, value: '—', preview: 'Lease management', status: 'Active', statusColor: 'text-zinc-400', href: '/leasing' },
    { key: 'calendar', label: 'Calendar', icon: Calendar, value: '—', preview: 'Schedule', status: 'Active', statusColor: 'text-zinc-400', href: '/calendar' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      
      {/* HERO — Compressed */}
      <section className={`px-8 pt-20 pb-8 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-light tracking-[-0.02em] text-white">
            {greeting}{displayName ? `, ${displayName}` : ''}.
          </h1>
          <p className="text-base text-zinc-500 font-light mt-2">
            Portfolio {attentionCount > 0 ? <span className="text-amber-400">{attentionCount} things require attention</span> : <span className="text-emerald-400">healthy</span>}.
          </p>
        </div>
      </section>

      {/* OPERATIONS MATRIX — Alive modules */}
      <section className="px-8 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-3">
            {modules.map((mod, i) => (
              <Link
                key={mod.key}
                href={mod.href}
                className={`group relative rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/[0.08] hover:scale-[1.02]`}
                style={{ 
                  opacity: visible ? 1 : 0, 
                  transform: visible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.08 + i * 0.04}s`,
                }}
                onMouseEnter={() => setHoveredModule(mod.key)}
                onMouseLeave={() => setHoveredModule(null)}
              >
                {/* Ambient glow */}
                <div className={`absolute inset-0 rounded-2xl transition-opacity duration-700 ${hoveredModule === mod.key ? 'opacity-100' : 'opacity-0'}`}
                  style={{ background: `radial-gradient(500px circle at center, rgba(255,255,255,0.02), transparent 70%)` }} />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <mod.icon className={`w-4 h-4 transition-colors duration-500 ${hoveredModule === mod.key ? 'text-white' : 'text-zinc-500'}`} />
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{mod.label}</p>
                  </div>

                  {/* Main value */}
                  <p className="text-2xl font-light tracking-[-0.02em] text-white mb-1">{mod.value}</p>
                  
                  {/* Mini preview — expands on hover */}
                  <div className={`transition-all duration-500 overflow-hidden ${hoveredModule === mod.key ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <p className="text-[11px] text-zinc-500 font-light">{mod.preview}</p>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      mod.statusColor === 'text-emerald-400' ? 'bg-emerald-400' : 
                      mod.statusColor === 'text-amber-400' ? 'bg-amber-400' : 'bg-zinc-500'
                    }`} />
                    <span className={`text-[10px] font-light ${mod.statusColor}`}>{mod.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFOLIO HEALTH */}
      <section className={`px-8 py-12 transition-all duration-1000 ${scrollY > 150 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-6">Portfolio Health</p>
          <div className="space-y-3">
            {[
              { label: 'Revenue', pct: 94, color: 'bg-emerald-400' },
              { label: 'Maintenance', pct: 81, color: 'bg-amber-400' },
              { label: 'Compliance', pct: 90, color: 'bg-emerald-400' },
              { label: 'Utilities', pct: 97, color: 'bg-emerald-400' },
              { label: 'Procurement', pct: 74, color: 'bg-amber-400' },
            ].map((bar, i) => (
              <div key={bar.label} className="flex items-center gap-6">
                <span className="text-xs text-zinc-400 w-28 font-light">{bar.label}</span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={`h-full ${bar.color} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: scrollY > 150 ? `${bar.pct}%` : '0%', transitionDelay: `${i * 0.12}s` }} />
                </div>
                <span className="text-xs text-zinc-500 w-10 text-right font-light tabular-nums">{bar.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className={`px-8 py-12 transition-all duration-1000 ${scrollY > 350 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-6">Activity Timeline</p>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.04]" />
            <div className="space-y-5">
              {[
                { time: '09:20', event: 'Tenant notified', module: 'communications', detail: 'Lease renewal reminder sent' },
                { time: '09:14', event: 'Revenue updated', module: 'revenue', detail: 'Recovery improved at Rosebank' },
                { time: '09:11', event: 'Recovery recalculated', module: 'utilities', detail: 'Water allocation adjusted' },
                { time: '09:02', event: 'Maintenance completed', module: 'maintenance', detail: 'Plumbing repair — Building A' },
              ].map((item, i) => (
                <div key={i} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                    item.module === 'revenue' ? 'bg-emerald-400' : item.module === 'maintenance' ? 'bg-amber-400' :
                    item.module === 'utilities' ? 'bg-blue-400' : 'bg-purple-400'
                  }`} />
                  <p className="text-[11px] text-zinc-600">{item.time}</p>
                  <p className="text-sm text-white font-light mt-0.5">{item.event}</p>
                  <p className="text-[11px] text-zinc-500 font-light mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <section className="px-8 py-12 pb-32">
        <div className="max-w-6xl mx-auto">
          <button onClick={open}
            className="w-full rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-4 text-sm text-zinc-500 text-left hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300 font-light">
            <Search className="w-4 h-4 inline-block mr-2 text-zinc-600" />
            Search anything across your portfolio...
          </button>
        </div>
      </section>
    </div>
  );
}
