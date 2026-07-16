'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculatePulse } from "@/lib/intelligence/pulse";
import { useCommandPalette } from "@/lib/platform/CommandPaletteContext";

export default function HomePage() {
  const router = useRouter();
  const { open } = useCommandPalette();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [data, setData] = useState<any>({
    leases: [], transactions: [], recentLeases: [], communications: [],
    unallocated: [], vacantUnits: [], stmtPeriod: null, finPeriod: null,
    totalUnits: 0, occupiedUnits: 0, commsDelivered: 0, commsSent: 0, commsRead: 0,
  });
  
  

  useEffect(() => {
    async function checkAuthAndLoad() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/landing'); return; }
      const { data: profile } = await supabase.from("profiles").select("display_name, first_login").eq("id", session.user.id).single();
if (profile?.display_name) setDisplayName(profile.display_name);
if (profile?.first_login) setIsFirstLogin(true);


      const { data: entityIds } = await supabase.rpc('auth_entities');
      const entityIdList = entityIds || [];

      const { data: bankAccounts } = entityIdList.length > 0 
        ? await supabase.from("bank_accounts").select("id").in("entity_id", entityIdList) : { data: [] };
      const bankAccountIds = bankAccounts?.map(a => a.id) || [];

      const { data: entityTenants } = entityIdList.length > 0
        ? await supabase.from("tenants").select("id").in("entity_id", entityIdList) : { data: [] };
      const tenantIds = entityTenants?.map(t => t.id) || [];

      const { data: unitsData } = await supabase.from("units").select("id, occupancy_status");
      const totalUnits = unitsData?.length || 0;
      const occupiedUnits = unitsData?.filter(u => u.occupancy_status === 'Occupied').length || 0;

      const { data: commsData } = tenantIds.length > 0
        ? await supabase.from("communications").select("status").in("tenant_id", tenantIds)
        : { data: [] };
      const commsSent = commsData?.length || 0;
      const commsDelivered = commsData?.filter(c => c.status === 'delivered' || c.status === 'read').length || 0;
      const commsRead = commsData?.filter(c => c.status === 'read').length || 0;

      const [leasesRes, transactionsRes, recentLeasesRes, communicationsRes, unallocatedRes, vacantUnitsRes, stmtPeriodRes, finPeriodRes] = await Promise.all([
        entityIdList.length > 0 ? supabase.from("leases").select("*").in("owner_entity_id", entityIdList) : { data: [] },
        bankAccountIds.length > 0 ? supabase.from("bank_transactions").select("*").in("bank_account_id", bankAccountIds).order("created_at", { ascending: false }).limit(10) : { data: [] },
        entityIdList.length > 0 ? supabase.from("leases").select("*").in("owner_entity_id", entityIdList).order("created_at", { ascending: false }).limit(5) : { data: [] },
        tenantIds.length > 0 ? supabase.from("communications").select("*").in("tenant_id", tenantIds).order("created_at", { ascending: false }).limit(5) : { data: [] },
        bankAccountIds.length > 0 ? supabase.from("bank_transactions").select("transaction_amount").neq("allocation_status", "posted").in("bank_account_id", bankAccountIds) : { data: [] },
        supabase.from("units").select("id, unit_number, gla_sqm, current_rental_rate, occupancy_status").eq("occupancy_status", "Vacant"),
        supabase.from("statement_periods").select("status, period_name").eq("status", "open").order("period_start", { ascending: false }).limit(1).single(),
        supabase.from("statement_periods").select("status, period_name").order("period_start", { ascending: false }).limit(1).single(),
      ]);

      setData({
        leases: leasesRes.data || [], transactions: transactionsRes.data || [],
        recentLeases: recentLeasesRes.data || [], communications: communicationsRes.data || [],
        unallocated: unallocatedRes.data || [], vacantUnits: vacantUnitsRes.data || [],
        stmtPeriod: stmtPeriodRes.data || null, finPeriod: finPeriodRes.data || null,
        totalUnits, occupiedUnits, commsSent, commsDelivered, commsRead,
      });
      setLoading(false);
    }
    checkAuthAndLoad();
  }, [router]);

  if (loading) return <div className="mx-auto max-w-7xl px-6 pt-20 pb-12 text-center"><p className="text-[var(--text-muted)]">Loading...</p></div>;

  const { leases, transactions, recentLeases, communications, unallocated, vacantUnits, stmtPeriod, finPeriod, totalUnits, occupiedUnits, commsSent, commsDelivered, commsRead } = data;

  const totalContractedRevenue = leases?.reduce((sum: number, l: any) => sum + (l.monthly_rental || 0), 0) || 0;
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const commsHealthPct = commsSent > 0 ? Math.round((commsDelivered / commsSent) * 100) : 100;

  const expiringLeases = leases?.filter((l: any) => {
    if (!l.lease_end_date && !l.expiry_date) return false;
    const end = new Date(l.lease_end_date || l.expiry_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff <= 30 && diff > 0;
  }) || [];
  const criticalLeases = expiringLeases.filter((l: any) => {
    const end = new Date(l.lease_end_date || l.expiry_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff <= 14;
  });

  const revenueAtRisk = criticalLeases.reduce((sum: number, l: any) => sum + ((l.monthly_rental || 0) * 12), 0);
  const unallocatedTotal = unallocated?.reduce((s: number, t: any) => s + Math.abs(t.transaction_amount || 0), 0) || 0;
  const vacancyCost = vacantUnits?.reduce((s: number, u: any) => s + ((u.current_rental_rate || 0) || (u.gla_sqm || 0) * 100), 0) || 0;
  const vacancyCount = vacantUnits?.length || 0;
  const arrearsTotal = 0;

  const pulse = calculatePulse(totalContractedRevenue, totalContractedRevenue * 0.95, occupancyPct, occupancyPct + 1, arrearsTotal, arrearsTotal * 0.8, vacancyCount, vacancyCount - 1);

  const expiryBuckets = [
    { label: "Critical", min: 0, max: 30, color: "bg-red-500", count: 0 },
    { label: "Warning", min: 30, max: 90, color: "bg-amber-500", count: 0 },
    { label: "Upcoming", min: 90, max: 180, color: "bg-amber-400", count: 0 },
    { label: "Healthy", min: 180, max: Infinity, color: "bg-emerald-500", count: 0 },
  ];
  leases?.forEach((l: any) => {
    if (!l.lease_end_date && !l.expiry_date) return;
    const end = new Date(l.lease_end_date || l.expiry_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    for (const bucket of expiryBuckets) { if (diff > bucket.min && diff <= bucket.max) { bucket.count++; break; } }
  });
  const maxBucketCount = Math.max(...expiryBuckets.map(b => b.count), 1);

  const leakageItems: { text: string; amount: number }[] = [];
  leases?.forEach((l: any) => {
    if ((l.parking_bays || 0) > 0 && (!l.parking_rate || l.parking_rate === 0)) {
      leakageItems.push({ text: `${l.tenant_name || "Unknown"} — ${l.parking_bays} parking bays with no rate`, amount: (l.parking_bays || 0) * (l.parking_rate || 350) });
    }
  });
  const totalLeakage = leakageItems.reduce((s, i) => s + i.amount, 0);

  const activityFeed: { type: string; text: string; amount?: number; date: string }[] = [];
  transactions?.slice(0, 3).forEach((tx: any) => activityFeed.push({ type: tx.transaction_amount >= 0 ? "receipt" : "payment", text: tx.transaction_description || "Transaction", amount: tx.transaction_amount, date: tx.created_at || tx.transaction_date || "" }));
  recentLeases?.slice(0, 2).forEach((l: any) => activityFeed.push({ type: "lease", text: `Lease created: ${l.tenant_name || "Unknown"}`, date: l.created_at || "" }));
  communications?.slice(0, 2).forEach((c: any) => activityFeed.push({ type: "communication", text: `${c.event_type?.replace(/_/g, " ")} sent to tenant`, date: c.created_at || "" }));
  activityFeed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const attentionItems: { level: string; text: string; detail: string; action: string; href: string }[] = [];
  criticalLeases.forEach((l: any) => attentionItems.push({ level: "CRITICAL", text: `${l.tenant_name || "Unknown"} lease expires in ${Math.ceil((new Date(l.lease_end_date || l.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`, detail: `Annual revenue at risk: R${((l.monthly_rental || 0) * 12).toLocaleString()}`, action: "Review", href: "/tenants" }));
  if (unallocatedTotal > 0) attentionItems.push({ level: "HIGH", text: `Unallocated receipts: R${unallocatedTotal.toLocaleString()}`, detail: "Requires reconciliation", action: "Open Cash Book", href: "/financials/cash-book" });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const portfolioHealthy = criticalLeases.length === 0 && unallocatedTotal < 100000;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-6 pt-12 pb-20">
      <div className="space-y-2">
        <p className="text-sm tracking-[0.2em] uppercase text-[var(--text-muted)]">Morning Brief</p>
        <h1 className="text-4xl font-light tracking-[-0.02em] text-[var(--text-primary)]">
  {greeting}{displayName ? `, ${displayName}` : ""}
</h1>
{isFirstLogin && (
  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
    <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-3">Getting Started</p>
    <div className="space-y-2">
      {[
        { label: "Explore the Morning Brief", done: true },
        { label: "View your tenants and properties", done: false, href: "/tenants" },
        { label: "Review billing in Revenue Ops", done: false, href: "/financials/revenue" },
        { label: "Check your Cash Book", done: false, href: "/financials/cash-book" },
        { label: "Try searching with ⌘K", done: false },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <span className={item.done ? "text-emerald-400" : "text-[var(--text-muted)]"}>{item.done ? "✓" : "○"}</span>
          {item.href ? (
            <Link href={item.href} className="text-[var(--text-primary)] hover:underline">{item.label}</Link>
          ) : (
            <span className="text-[var(--text-primary)]">{item.label}</span>
          )}
        </div>
      ))}
    </div>
    <button 
      onClick={async () => {
        await supabase.from("profiles").update({ first_login: false }).eq("id", (await supabase.auth.getUser()).data.user?.id);
        setIsFirstLogin(false);
      }}
      className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
    >
      Dismiss
    </button>
  </div>
)}
        <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
          {portfolioHealthy ? "Your portfolio is healthy. A few items need attention." : `${attentionItems.length} items require attention. ${criticalLeases.length} ${criticalLeases.length === 1 ? "is" : "are"} critical.`}
        </p>
        <div className="pt-2">
          <button onClick={open} className="w-full rounded-xl border border-[var(--border-default)] bg-white/[0.01] px-4 py-3 text-sm text-[var(--text-muted)] text-left hover:border-[var(--border-hover)] transition-colors">
            🔍 Search tenants, leases, statements, receipts...
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {stmtPeriod && (
          <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] px-4 py-2 text-xs">
            <span className="text-[var(--text-muted)]">Statement: </span>
            <span className={stmtPeriod.status === "open" ? "text-emerald-400" : "text-[var(--text-muted)]"}>{stmtPeriod.period_name} · {stmtPeriod.status === "open" ? "Open" : "Closed"}</span>
          </div>
        )}
        {finPeriod && (
          <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] px-4 py-2 text-xs">
            <span className="text-[var(--text-muted)]">Financial: </span>
            <span className={finPeriod.status === "open" ? "text-emerald-400" : "text-[var(--text-muted)]"}>{finPeriod.period_name} · {finPeriod.status === "open" ? "Open" : "Closed"}</span>
          </div>
        )}
      </div>

      {attentionItems.length > 0 && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs tracking-[0.2em] uppercase text-blue-300 mb-1">Don't Forget</p>
          <p className="text-sm text-[var(--text-primary)]">{attentionItems.length} thing{attentionItems.length !== 1 ? 's' : ''} need attention this week</p>
          <div className="mt-2 space-y-1">{attentionItems.slice(0, 5).map((item, i) => (<p key={i} className="text-xs text-blue-400/70">• {item.text}</p>))}</div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Monthly Revenue</p><p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">R{totalContractedRevenue.toLocaleString()}</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Occupancy</p><p className="text-xl font-bold text-[var(--text-primary)]">{occupancyPct}%</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Arrears</p><p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">R{arrearsTotal.toLocaleString()}</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Vacancy Cost</p><p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">R{Math.round(vacancyCost).toLocaleString()}/mo</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Comms Health</p><p className={`text-xl font-bold ${commsHealthPct >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>{commsHealthPct}%</p><p className="text-xs text-[var(--text-muted)]">{commsDelivered}/{commsSent} del · {commsRead} read</p></div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-white/[0.01] p-4">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-2">Portfolio Pulse</p>
        <div className="flex gap-6 text-sm flex-wrap">
          <span className={pulse.revenue.trend === 'up' ? 'text-emerald-400' : 'text-amber-400'}>{pulse.revenue.trend === 'up' ? '▲' : '▼'} Revenue {pulse.revenue.variance > 0 ? '+' : ''}{pulse.revenue.variance}%</span>
          <span className={pulse.occupancy.trend === 'up' ? 'text-emerald-400' : 'text-amber-400'}>{pulse.occupancy.trend === 'up' ? '▲' : '▼'} Occupancy {pulse.occupancy.variance > 0 ? '+' : ''}{pulse.occupancy.variance}%</span>
          <span className={pulse.arrears.trend === 'down' ? 'text-emerald-400' : 'text-amber-400'}>{pulse.arrears.trend === 'up' ? '▲' : '▼'} Arrears {pulse.arrears.variance > 0 ? '+' : ''}{pulse.arrears.variance}%</span>
          <span className={pulse.vacancy.trend === 'down' ? 'text-emerald-400' : 'text-amber-400'}>{pulse.vacancy.trend === 'up' ? '▲' : '▼'} Vacancy {pulse.vacancy.variance > 0 ? '+' : ''}{pulse.vacancy.variance} units</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">Trend data building — accuracy improves as history accumulates</p>
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-3">My Work</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-[var(--text-primary)]">Open Tasks</span><span className="text-[var(--text-primary)] font-medium">{transactions.filter((t: any) => t.allocation_status !== 'posted' && t.queue !== 'posted').length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-[var(--text-primary)]">Approvals Waiting</span><span className="text-amber-400 font-medium">{transactions.filter((t: any) => t.queue === 'review').length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-[var(--text-primary)]">Lease Reviews</span><span className="text-[var(--text-primary)] font-medium">{expiringLeases.length}</span></div>
        </div>
      </div>

      {attentionItems.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">What Needs Attention</p>
          <div className="space-y-3">
            {attentionItems.map((item, i) => (
              <Link key={i} href={item.href} className="block rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5 hover:border-[var(--border-hover)] transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className={`text-[10px] tracking-[0.2em] uppercase font-semibold ${item.level === "CRITICAL" ? "text-[var(--danger)]" : item.level === "HIGH" ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`}>{item.level}</span>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.text}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{item.detail}</p>
                  </div>
                  <span className="text-xs text-[var(--accent)] group-hover:text-[var(--accent-hover)] transition-colors shrink-0 mt-1">{item.action} →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {revenueAtRisk > 0 && (
          <Link href="/tenants" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 hover:border-red-500/40 transition-all">
            <p className="text-xs tracking-[0.2em] uppercase text-red-300 mb-1">Revenue at Risk</p><p className="text-2xl font-bold text-red-300 tabular-nums">R{revenueAtRisk.toLocaleString()}</p><p className="text-xs text-red-400/70 mt-2">{criticalLeases.length} lease{criticalLeases.length !== 1 ? 's' : ''} expiring within 14 days</p>
          </Link>
        )}
        <Link href="/properties" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 hover:border-amber-500/40 transition-all">
          <p className="text-xs tracking-[0.2em] uppercase text-amber-300 mb-1">Vacancy Cost Clock</p><p className="text-2xl font-bold text-amber-300 tabular-nums">R{vacancyCost.toLocaleString()}</p><p className="text-xs text-amber-400/70 mt-2">{vacancyCount} unit{vacancyCount !== 1 ? 's' : ''} vacant · Daily loss: R{Math.round(vacancyCost / 30).toLocaleString()}</p>
        </Link>
        {totalLeakage > 0 ? (
          <Link href="/financials/revenue" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 hover:border-amber-500/40 transition-all">
            <p className="text-xs tracking-[0.2em] uppercase text-amber-300 mb-1">Revenue Leakage</p><p className="text-2xl font-bold text-amber-300 tabular-nums">R{totalLeakage.toLocaleString()}</p>
            <div className="mt-2 space-y-1">{leakageItems.slice(0, 3).map((item, i) => (<p key={i} className="text-xs text-amber-400/70">{item.text} · R{item.amount.toLocaleString()}</p>))}</div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"><p className="text-xs tracking-[0.2em] uppercase text-emerald-300 mb-1">Revenue Leakage</p><p className="text-2xl font-bold text-emerald-300">R0</p><p className="text-xs text-emerald-400/70 mt-2">No leakage detected ✅</p></div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-5">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-4">Lease Expiry Heat Map</p>
        <div className="space-y-2">
          {expiryBuckets.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)] w-20">{bucket.label}</span>
              <div className="flex-1 h-6 bg-[var(--bg-elevated)] rounded-full overflow-hidden"><div className={`h-full ${bucket.color} rounded-full transition-all`} style={{ width: `${(bucket.count / maxBucketCount) * 100}%`, minWidth: bucket.count > 0 ? "8px" : "0" }} /></div>
              <span className="text-xs text-[var(--text-primary)] w-8 text-right tabular-nums">{bucket.count}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">{leases?.length || 0} total leases · {expiringLeases.length} expiring within 90 days</p>
      </div>

      {activityFeed.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">Activity</p>
          <div className="space-y-1">
            {activityFeed.slice(0, 8).map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border-default)] last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${item.type === "receipt" ? "bg-[var(--accent)]" : item.type === "lease" ? "bg-blue-400" : item.type === "communication" ? "bg-emerald-400" : "bg-[var(--text-muted)]"}`} />
                  <p className="text-sm text-[var(--text-primary)]">{item.text}</p>
                </div>
                <div className="flex items-center gap-4">
                  {item.amount && <span className="text-sm tabular-nums text-[var(--text-primary)]">R{Math.abs(item.amount).toLocaleString()}</span>}
                  <span className="text-xs text-[var(--text-muted)]">{item.date ? new Date(item.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}