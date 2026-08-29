'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { 
  TrendingUp, Wrench, Zap, ClipboardCheck, FileText, Users, 
  Calendar, Building2, Search, Settings, DollarSign, ArrowRight,
  FileCheck, Receipt, CreditCard, Landmark, BarChart3, MessageSquare,
  Shield, Home, Briefcase, PenLine
} from 'lucide-react';

export default function OperationsHub() {
    const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [visible, setVisible] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});

  useEffect(() => {
  async function init() {
    console.log("[OperationsHub] INIT START");

    try {
      console.log("[OperationsHub] Getting session...");
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log("[OperationsHub] Session:", !!session);
      console.log("[OperationsHub] Session error:", sessionError);

      if (!session) {
        console.log("[OperationsHub] NO SESSION");
        setLoading(false);
        return;
      }

      console.log("[OperationsHub] Loading profile...");

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single();

      console.log("[OperationsHub] Profile:", profile);
      console.log("[OperationsHub] Profile error:", profileError);

      if (profile?.display_name) {
        setDisplayName(profile.display_name);
      }

      console.log("[OperationsHub] Loading entities...");

      const {
        data: entities,
        error: entityError,
      } = await supabase.rpc("auth_entities");

      console.log("[OperationsHub] Entities:", entities);
      console.log("[OperationsHub] Entity error:", entityError);

      if (entityError) {
        console.error(
          "[OperationsHub] ENTITY RPC FAILED:",
          entityError
        );
      }

      if (entities?.length) {
        const entityId = entities[0];

        console.log("[OperationsHub] Entity ID:", entityId);
        console.log("[OperationsHub] Loading dashboard data...");

        const [
          { count: activeLeases, error: activeLeasesError },
          { data: leases, error: leasesError },
          { count: openIssues, error: openIssuesError },
          { count: emergencyIssues, error: emergencyIssuesError },
          { data: recoveries, error: recoveriesError },
          { count: overdueInsp, error: overdueInspError },
          { count: todayInsp, error: todayInspError },
          { count: pendingProc, error: pendingProcError },
          { data: activity, error: activityError },
        ] = await Promise.all([
          supabase
            .from("leases")
            .select("*", { count: "exact", head: true })
            .eq("owner_entity_id", entityId)
            .eq("lease_status", "Active"),

          supabase
            .from("leases")
            .select("monthly_rental, lease_end_date")
            .eq("owner_entity_id", entityId)
            .eq("lease_status", "Active"),

          supabase
            .from("maintenance_issues")
            .select("*", { count: "exact", head: true })
            .eq("entity_id", entityId)
            .in("status", ["reported", "classified", "in_progress"]),

          supabase
            .from("maintenance_issues")
            .select("*", { count: "exact", head: true })
            .eq("entity_id", entityId)
            .eq("priority", "emergency")
            .in("status", ["reported", "classified"]),

          supabase
  .from("recoveries")
  .select("recovered_amount, actual_amount"),

          supabase
            .from("inspections")
            .select("*", { count: "exact", head: true })
            .eq("entity_id", entityId)
            .eq("status", "scheduled")
            .lt(
              "scheduled_date",
              new Date().toISOString().split("T")[0]
            ),

          supabase
            .from("inspections")
            .select("*", { count: "exact", head: true })
            .eq("entity_id", entityId)
            .eq("status", "scheduled")
            .gte(
              "scheduled_date",
              new Date().toISOString().split("T")[0]
            ),

          supabase
            .from("procurement_spend_requests")
            .select("*", { count: "exact", head: true })
            .eq("entity_id", entityId)
            .eq("status", "submitted"),

          supabase
            .from("activity_feed")
            .select("*")
            .eq("entity_id", entityId)
            .order("occurred_at", { ascending: false })
            .limit(10),
        ]);

        console.log("[OperationsHub] Dashboard query results:", {
          activeLeases,
          activeLeasesError,
          leasesError,
          openIssues,
          openIssuesError,
          emergencyIssues,
          emergencyIssuesError,
          recoveriesError,
          overdueInsp,
          overdueInspError,
          todayInsp,
          todayInspError,
          pendingProc,
          pendingProcError,
          activityError,
        });

        const totalRevenue = (leases || []).reduce(
          (s: number, l: any) => s + (l.monthly_rental || 0),
          0
        );

        const expiringSoon = (leases || []).filter(
          (l: any) =>
            l.lease_end_date &&
            new Date(l.lease_end_date).getTime() - Date.now() <
              90 * 86400000
        ).length;

        const totalRecovered = (recoveries || []).reduce(
          (s: number, r: any) => s + (r.recovered_amount || 0),
          0
        );

        const totalRecovered = (recoveries || []).reduce(
  (s: number, r: any) => s + Number(r.recovered_amount || 0),
  0
);

const totalActual = (recoveries || []).reduce(
  (s: number, r: any) => s + Number(r.actual_amount || 0),
  0
);

const avgRecoveryRate =
  totalActual > 0
    ? Math.round((totalRecovered / totalActual) * 100)
    : 0;

        setLiveData({
          revenue: {
            leases: activeLeases || 0,
            total: totalRevenue,
            expiring: expiringSoon,
          },
          maintenance: {
            open: openIssues || 0,
            emergency: emergencyIssues || 0,
          },
          utilities: {
            recovered: totalRecovered,
            rate: avgRecoveryRate,
          },
          inspections: {
            overdue: overdueInsp || 0,
            upcoming: todayInsp || 0,
          },
          procurement: {
            pending: pendingProc || 0,
          },
        });

        setHealthScores({
          Revenue: activeLeases ? 95 : 0,
          Maintenance: emergencyIssues
            ? Math.max(30, 100 - emergencyIssues * 20)
            : openIssues
              ? 80
              : 100,
          Compliance: overdueInsp
            ? Math.max(40, 100 - overdueInsp * 15)
            : 95,
          Utilities: avgRecoveryRate || 0,
          Procurement: pendingProc
            ? Math.max(40, 100 - pendingProc * 25)
            : 90,
        });

        setActivityFeed(activity || []);
      } else {
        console.log("[OperationsHub] NO ENTITIES");
      }

      console.log("[OperationsHub] SETTING LOADING FALSE");

      setLoading(false);

      setTimeout(() => {
        console.log("[OperationsHub] SETTING VISIBLE TRUE");
        setVisible(true);
      }, 80);

    } catch (error) {
      console.error(
        "[OperationsHub] INITIALIZATION CRASH:",
        error
      );

      setLoading(false);
      setVisible(true);
    }
  }

  init();
}, []);

  if (loading) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Module portals — each expands to show EVERYTHING related
  const modules = [
    {
      key: 'revenue', label: 'Revenue', icon: TrendingUp, span: 2,
      value: liveData.revenue?.leases ? `${liveData.revenue.leases} leases` : '—',
      detail: liveData.revenue?.total ? `R${(liveData.revenue.total / 1000).toFixed(0)}k monthly` : 'Import your portfolio',
      insight: liveData.revenue?.expiring ? `${liveData.revenue.expiring} expiring soon` : 'Portfolio stable',
      statusColor: 'text-emerald-400',
      links: [
        { label: 'Revenue Ops', href: '/financials/revenue', icon: TrendingUp },
        { label: 'Statements', href: '/financials/revenue', icon: FileCheck },
        { label: 'Invoices', href: '/financials/revenue', icon: Receipt },
        { label: 'Receipts', href: '/financials/cash-book', icon: CreditCard },
        { label: 'Cash Book', href: '/financials/cash-book', icon: Landmark },
        { label: 'Financials', href: '/financials', icon: BarChart3 },
        { label: 'Leases', href: '/leases', icon: FileText },
        { label: 'Tenants', href: '/tenants', icon: Users },
        { label: 'Properties', href: '/properties', icon: Building2 },
      ]
    },
    {
      key: 'maintenance', label: 'Maintenance', icon: Wrench,
      value: liveData.maintenance?.open ? `${liveData.maintenance.open} open` : '—',
      detail: liveData.maintenance?.emergency ? `${liveData.maintenance.emergency} emergency` : 'All clear',
      insight: liveData.maintenance?.open ? 'Needs attention' : 'Operational',
      statusColor: liveData.maintenance?.emergency ? 'text-amber-400' : 'text-emerald-400',
      links: [
        { label: 'Issues', href: '/maintenance', icon: Wrench },
        { label: 'Work Orders', href: '/maintenance', icon: FileCheck },
        { label: 'Suppliers', href: '/suppliers', icon: Users },
        { label: 'Inspections', href: '/inspections', icon: ClipboardCheck },
        { label: 'Assets', href: '/maintenance/assets', icon: Building2 },
        { label: 'Preventative', href: '/maintenance/preventative', icon: Calendar },
        { label: 'Procurement', href: '/procurement', icon: FileText },
      ]
    },
    {
      key: 'utilities', label: 'Utilities', icon: Zap,
      value: liveData.utilities?.rate ? `${liveData.utilities.rate}%` : '—',
      detail: liveData.utilities?.recovered ? `R${(liveData.utilities.recovered / 1000).toFixed(0)}k recovered` : 'No data',
      insight: (liveData.utilities?.rate || 0) >= 90 ? 'Healthy recovery' : 'Review needed',
      statusColor: (liveData.utilities?.rate || 0) >= 90 ? 'text-emerald-400' : 'text-amber-400',
      links: [
        { label: 'Recoveries', href: '/utilities', icon: Zap },
        { label: 'Properties', href: '/properties', icon: Building2 },
        { label: 'Leases', href: '/leases', icon: FileText },
        { label: 'Financials', href: '/financials', icon: BarChart3 },
        { label: 'Reports', href: '/reports', icon: FileCheck },
      ]
    },
    {
      key: 'inspections', label: 'Inspections', icon: ClipboardCheck,
      value: liveData.inspections?.overdue ? `${liveData.inspections.overdue} overdue` : '—',
      detail: liveData.inspections?.upcoming ? `${liveData.inspections.upcoming} upcoming` : 'None scheduled',
      insight: liveData.inspections?.overdue ? 'Action required' : 'On track',
      statusColor: liveData.inspections?.overdue ? 'text-red-400' : 'text-emerald-400',
      links: [
        { label: 'Inspections', href: '/inspections', icon: ClipboardCheck },
        { label: 'Compliance', href: '/inspections', icon: Shield },
        { label: 'Properties', href: '/properties', icon: Building2 },
        { label: 'Maintenance', href: '/maintenance', icon: Wrench },
        { label: 'Assets', href: '/maintenance/assets', icon: Building2 },
      ]
    },
    {
      key: 'procurement', label: 'Procurement', icon: FileText,
      value: liveData.procurement?.pending ? `${liveData.procurement.pending} pending` : '—',
      detail: 'Awaiting approval',
      insight: liveData.procurement?.pending ? `${liveData.procurement.pending} spend requests` : 'All approved',
      statusColor: liveData.procurement?.pending ? 'text-amber-400' : 'text-emerald-400',
      links: [
        { label: 'Spend Requests', href: '/procurement', icon: FileText },
        { label: 'RFQs', href: '/procurement', icon: FileCheck },
        { label: 'Purchase Orders', href: '/procurement', icon: Receipt },
        { label: 'Suppliers', href: '/suppliers', icon: Users },
        { label: 'Financials', href: '/financials', icon: BarChart3 },
      ]
    },
    {
      key: 'financials', label: 'Financials', icon: DollarSign,
      value: '—', detail: 'Financial platform', insight: 'Trial balance · GL · VAT',
      statusColor: 'text-zinc-400',
      links: [
        { label: 'Trial Balance', href: '/financials', icon: BarChart3 },
        { label: 'Income Statement', href: '/financials', icon: FileCheck },
        { label: 'VAT', href: '/financials', icon: Receipt },
        { label: 'Cash Book', href: '/financials/cash-book', icon: Landmark },
        { label: 'Periods', href: '/financials/periods', icon: Calendar },
        { label: 'Reports', href: '/reports', icon: FileText },
      ]
    },
    {
      key: 'leasing', label: 'Leasing', icon: Building2,
      value: '—', detail: 'Lease management', insight: 'Tenants · Properties',
      statusColor: 'text-zinc-400',
      links: [
        { label: 'Leases', href: '/leases', icon: FileText },
        { label: 'Tenants', href: '/tenants', icon: Users },
        { label: 'Properties', href: '/properties', icon: Building2 },
        { label: 'Brokerage', href: '/brokerage', icon: Briefcase },
        { label: 'Signatures', href: '/signatures', icon: PenLine },
      ]
    },
    {
      key: 'communications', label: 'Communications', icon: MessageSquare,
      value: '—', detail: 'WhatsApp · Email', insight: 'Tenant messaging',
      statusColor: 'text-zinc-400',
      links: [
        { label: 'Communications', href: '/communications', icon: MessageSquare },
        { label: 'Tenants', href: '/tenants', icon: Users },
        { label: 'Suppliers', href: '/suppliers', icon: Briefcase },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      
      {/* HEADER STRIP */}
      <section className={`px-8 pt-16 pb-6 transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
                {greeting}{displayName ? `, ${displayName}` : ''}.
              </h1>
            </div>
            <Link href="/settings" className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all">
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* MODULE GRID — Portal cards */}
      <section className="px-8 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-3">
            {modules.map((mod, i) => (
              <div key={mod.key}
                className={`relative rounded-2xl border border-white/[0.04] bg-white/[0.01] transition-all duration-500 ${
                  expandedModule === mod.key ? 'col-span-4 bg-white/[0.03] border-white/[0.08] ring-1 ring-white/[0.06] shadow-2xl shadow-white/[0.02]' : mod.span === 2 ? 'col-span-2' : ''
                }`}
                style={{ 
                  opacity: visible ? 1 : 0, 
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.06 + i * 0.04}s`,
                }}
              >
                {/* Collapsed view */}
                <div 
                  onClick={() => setExpandedModule(expandedModule === mod.key ? null : mod.key)}
                  className="p-5 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <mod.icon className="w-4 h-4 text-zinc-500" />
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{mod.label}</p>
                  </div>
                  <p className="text-2xl font-light tracking-[-0.02em] text-white mb-1">{mod.value}</p>
                  <p className="text-[11px] text-zinc-500 font-light mb-1">{mod.detail}</p>
                  <p className={`text-[10px] font-light ${mod.statusColor}`}>{mod.insight}</p>
                </div>

                {/* Expanded — Portal to everything related */}
                {expandedModule === mod.key && (
                  <div className="px-5 pb-5 border-t border-white/[0.04] pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3">{mod.label} Command</p>
                    
                    {/* Operational Summary */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">Status</p>
                        <p className={`text-xs font-light mt-0.5 ${mod.statusColor}`}>{mod.insight}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">Overview</p>
                        <p className="text-xs font-light text-white mt-0.5">{mod.value}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">Detail</p>
                        <p className="text-xs font-light text-zinc-400 mt-0.5">{mod.detail}</p>
                      </div>
                    </div>

                    <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600 mb-2 mt-1">Related</p>
                    <div className="grid grid-cols-3 gap-2">
                      {mod.links.map((link, j) => (
                        <Link
                          key={j}
                          href={link.href}
                          className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3 py-2.5 text-xs text-zinc-400 hover:text-white hover:border-white/[0.08] hover:bg-white/[0.02] transition-all group"
                        >
                          <link.icon className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                          <span className="flex-1 font-light">{link.label}</span>
                          <ArrowRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTFOLIO HEALTH */}
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
                  }`} style={{ width: visible ? `${pct}%` : '0%', transitionDelay: `${i * 0.12}s` }} />
                </div>
                <span className="text-xs text-zinc-500 w-10 text-right font-light">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACTIVITY */}
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
                      event.signal_category === 'financial' ? 'bg-emerald-400' : 'bg-zinc-500'
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
