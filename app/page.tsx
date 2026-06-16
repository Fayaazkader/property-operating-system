import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function HomePage() {
  const { data: leases } = await supabase.from("leases").select("*");
  const { data: transactions } = await supabase.from("bank_transactions").select("*").order("created_at", { ascending: false }).limit(10);
  const { data: recentLeases } = await supabase.from("leases").select("*").order("created_at", { ascending: false }).limit(5);
  const { data: communications } = await supabase.from("communications").select("*").order("created_at", { ascending: false }).limit(5);

  // KPIs
  const totalContractedRevenue = leases?.reduce((sum, l) => sum + (l.monthly_rental || 0), 0) || 0;
  const expiringLeases = leases?.filter(l => {
    if (!l.lease_end_date && !l.expiry_date) return false;
    const end = new Date(l.lease_end_date || l.expiry_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff <= 30 && diff > 0;
  }) || [];
  const criticalLeases = expiringLeases.filter(l => {
    const end = new Date(l.lease_end_date || l.expiry_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff <= 14;
  });

  const revenueAtRisk = criticalLeases.reduce((sum, l) => sum + ((l.monthly_rental || 0) * 12), 0);
  const { data: unallocated } = await supabase.from("bank_transactions").select("transaction_amount").neq("allocation_status", "posted");
  const unallocatedTotal = unallocated?.reduce((s, t) => s + Math.abs(t.transaction_amount || 0), 0) || 0;
  const { data: vacantUnits } = await supabase.from("units").select("id, unit_number, gla_sqm, current_rental_rate, occupancy_status").eq("occupancy_status", "Vacant");
  const vacancyCost = vacantUnits?.reduce((s, u) => s + ((u.current_rental_rate || 0) || (u.gla_sqm || 0) * 100), 0) || 0;
  const vacancyCount = vacantUnits?.length || 0;

  // Lease Expiry Heat Map data
  const expiryBuckets = [
    { label: "0-30d", min: 0, max: 30, color: "bg-red-500", count: 0 },
    { label: "30-60d", min: 30, max: 60, color: "bg-amber-500", count: 0 },
    { label: "60-90d", min: 60, max: 90, color: "bg-amber-400", count: 0 },
    { label: "90-180d", min: 90, max: 180, color: "bg-emerald-400", count: 0 },
    { label: "180d+", min: 180, max: Infinity, color: "bg-emerald-500", count: 0 },
  ];
  leases?.forEach(l => {
    if (!l.lease_end_date && !l.expiry_date) return;
    const end = new Date(l.lease_end_date || l.expiry_date);
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    for (const bucket of expiryBuckets) {
      if (diff > bucket.min && diff <= bucket.max) { bucket.count++; break; }
    }
  });
  const maxBucketCount = Math.max(...expiryBuckets.map(b => b.count), 1);

  // Revenue Leakage Detection — real
  const leakageItems: { text: string; amount: number }[] = [];
  leases?.forEach(l => {
    if ((l.parking_bays || 0) > 0 && (!l.parking_rate || l.parking_rate === 0)) {
      leakageItems.push({ text: `${l.tenant_name || "Unknown"} — ${l.parking_bays} parking bays with no rate`, amount: (l.parking_bays || 0) * 1000 });
    }
  });
  const { data: inactiveRules } = await supabase.from("billing_rules").select("*, leases!inner(tenant_name, lease_status)").eq("status", "inactive").eq("leases.lease_status", "Active");
  inactiveRules?.forEach((r: any) => {
    leakageItems.push({ text: `${r.leases?.tenant_name || "Unknown"} — ${r.description} (inactive)`, amount: r.base_amount || 0 });
  });
  // Missing utility charges for active leases (placeholder — real utility imports not built yet)
  const { data: activeLeases } = await supabase.from("leases").select("id, tenant_name").eq("lease_status", "Active");
  if (activeLeases) {
    for (const lease of activeLeases) {
      const { count: utilityCount } = await supabase.from("charges").select("id", { count: "exact", head: true }).eq("lease_id", lease.id).eq("charge_type", "utility_recovery").eq("is_active", true);
      if (utilityCount === 0) {
        leakageItems.push({ text: `${lease.tenant_name || "Unknown"} — No utility recovery charges`, amount: 5000 });
      }
    }
  }
  const totalLeakage = leakageItems.reduce((s, i) => s + i.amount, 0);

  // Period Status
  const { data: stmtPeriod } = await supabase.from("statement_periods").select("status, period_name").eq("status", "open").order("period_start", { ascending: false }).limit(1).single();
  const { data: finPeriod } = await supabase.from("statement_periods").select("status, period_name").order("period_start", { ascending: false }).limit(1).single();

  // Activity Feed
  const activityFeed: { type: string; text: string; amount?: number; date: string }[] = [];
  transactions?.slice(0, 3).forEach(tx => {
    activityFeed.push({ type: tx.transaction_amount >= 0 ? "receipt" : "payment", text: tx.transaction_description || "Transaction", amount: tx.transaction_amount, date: tx.created_at || tx.transaction_date || "" });
  });
  recentLeases?.slice(0, 2).forEach(l => {
    activityFeed.push({ type: "lease", text: `Lease created: ${l.tenant_name || "Unknown"}`, date: l.created_at || "" });
  });
  communications?.slice(0, 2).forEach(c => {
    activityFeed.push({ type: "communication", text: `${c.event_type?.replace(/_/g, " ")} sent to tenant`, date: c.created_at || "" });
  });
  activityFeed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const attentionItems: { level: string; text: string; detail: string; action: string; href: string }[] = [];
  criticalLeases.forEach(l => {
    attentionItems.push({
      level: "CRITICAL",
      text: `${l.tenant_name || "Unknown"} lease expires in ${Math.ceil((new Date(l.lease_end_date || l.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`,
      detail: `Potential annual revenue at risk: R${((l.monthly_rental || 0) * 12).toLocaleString()}`,
      action: "Review Lease",
      href: `/leases/${l.lease_id || l.id}`,
    });
  });
  if (unallocatedTotal > 0) {
    attentionItems.push({
      level: "HIGH",
      text: `Unallocated receipts total R${unallocatedTotal.toLocaleString()}`,
      detail: "Requires reconciliation in Cash Book",
      action: "Open Cash Book",
      href: "/financials/cash-book",
    });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const portfolioHealthy = criticalLeases.length === 0 && unallocatedTotal < 100000;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 pt-12 pb-20">
      <div className="space-y-2">
        <p className="text-sm tracking-[0.2em] uppercase text-[var(--text-muted)]">Morning Brief</p>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">{greeting}</h1>
        <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
          {portfolioHealthy ? "Your portfolio is healthy. A few items need attention." : `${attentionItems.length} items require attention. ${criticalLeases.length} ${criticalLeases.length === 1 ? "is" : "are"} critical.`}
        </p>
      </div>

      {/* Don't Forget */}
      {attentionItems.length > 0 && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs tracking-[0.2em] uppercase text-blue-300 mb-1">Don't Forget</p>
          <p className="text-sm text-[var(--text-primary)]">{attentionItems.length} thing{attentionItems.length !== 1 ? 's' : ''} need attention this week</p>
          <div className="mt-2 space-y-1">
            {attentionItems.slice(0, 5).map((item, i) => (
              <p key={i} className="text-xs text-blue-400/70">• {item.text}</p>
            ))}
          </div>
        </div>
      )}

      {/* Period Status */}
      <div className="flex gap-3">
        {stmtPeriod && (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-xs">
            <span className="text-[var(--text-muted)]">Statement: </span>
            <span className={stmtPeriod.status === "open" ? "text-emerald-400" : "text-[var(--text-muted)]"}>{stmtPeriod.period_name || "July 2026"} · {stmtPeriod.status === "open" ? "Open" : "Closed"}</span>
          </div>
        )}
        {finPeriod && (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-xs">
            <span className="text-[var(--text-muted)]">Financial: </span>
            <span className={finPeriod.status === "open" ? "text-emerald-400" : "text-[var(--text-muted)]"}>{finPeriod.period_name || "June 2026"} · {finPeriod.status === "open" ? "Open" : "Closed"}</span>
          </div>
        )}
      </div>

      {/* What Needs Attention */}
      {attentionItems.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">What Needs Attention</p>
          <div className="space-y-3">
            {attentionItems.map((item, i) => (
              <Link key={i} href={item.href} className="block rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 hover:border-[var(--border-hover)] transition-all group">
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

      {/* Portfolio Health */}
      <div className="grid grid-cols-4 gap-6">
        <div className="space-y-1"><p className="text-xs text-[var(--text-muted)]">Contracted Revenue</p><p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">R{totalContractedRevenue.toLocaleString()}</p><p className="text-xs text-[var(--text-muted)]">Monthly</p></div>
        <div className="space-y-1"><p className="text-xs text-[var(--text-muted)]">Unallocated Receipts</p><p className={`text-2xl font-semibold tabular-nums ${unallocatedTotal > 0 ? "text-[var(--warning)]" : "text-[var(--text-primary)]"}`}>R{unallocatedTotal.toLocaleString()}</p></div>
        <div className="space-y-1"><p className="text-xs text-[var(--text-muted)]">Expiring Leases</p><p className={`text-2xl font-semibold tabular-nums ${expiringLeases.length > 0 ? "text-[var(--warning)]" : "text-[var(--text-primary)]"}`}>{expiringLeases.length}</p><p className="text-xs text-[var(--text-muted)]">{criticalLeases.length} Critical · {expiringLeases.length - criticalLeases.length} Within 30 Days</p></div>
        <div className="space-y-1"><p className="text-xs text-[var(--text-muted)]">Status</p><p className={`text-2xl font-semibold ${portfolioHealthy ? "text-[var(--accent)]" : "text-[var(--warning)]"}`}>{portfolioHealthy ? "Healthy" : "Needs Review"}</p></div>
      </div>

      {/* Revenue At Risk + Vacancy Cost + My Work + Leakage */}
      <div className="grid grid-cols-2 gap-6">
        {revenueAtRisk > 0 && (
          <Link href="/leases" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 hover:border-red-500/40 transition-all">
            <p className="text-xs tracking-[0.2em] uppercase text-red-300 mb-1">Revenue at Risk</p>
            <p className="text-2xl font-bold text-red-300 tabular-nums">R{revenueAtRisk.toLocaleString()}</p>
            <p className="text-xs text-red-400/70 mt-2">{criticalLeases.length} lease{criticalLeases.length !== 1 ? 's' : ''} expiring within 14 days</p>
          </Link>
        )}
        <Link href="/properties" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 hover:border-amber-500/40 transition-all">
          <p className="text-xs tracking-[0.2em] uppercase text-amber-300 mb-1">Vacancy Cost Clock</p>
          <p className="text-2xl font-bold text-amber-300 tabular-nums">R{vacancyCost.toLocaleString()}</p>
          <p className="text-xs text-amber-400/70 mt-2">{vacancyCount} unit{vacancyCount !== 1 ? 's' : ''} vacant · Estimated daily loss: R{Math.round(vacancyCost / 30).toLocaleString()}</p>
        </Link>
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-3">My Work</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-[var(--text-primary)]">Open Tasks</span><span className="text-[var(--text-primary)] font-medium">5</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--text-primary)]">Approvals Waiting</span><span className="text-amber-400 font-medium">2</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--text-primary)]">Lease Reviews</span><span className="text-[var(--text-primary)] font-medium">1</span></div>
          </div>
        </div>
        {totalLeakage > 0 ? (
          <Link href="/financials/revenue" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 hover:border-amber-500/40 transition-all">
            <p className="text-xs tracking-[0.2em] uppercase text-amber-300 mb-1">Revenue Leakage</p>
            <p className="text-2xl font-bold text-amber-300 tabular-nums">R{totalLeakage.toLocaleString()}</p>
            <div className="mt-2 space-y-1">
              {leakageItems.slice(0, 3).map((item, i) => (
                <p key={i} className="text-xs text-amber-400/70">{item.text} · R{item.amount.toLocaleString()}</p>
              ))}
              {leakageItems.length > 3 && <p className="text-xs text-amber-400/50">+{leakageItems.length - 3} more</p>}
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-xs tracking-[0.2em] uppercase text-emerald-300 mb-1">Revenue Leakage</p>
            <p className="text-2xl font-bold text-emerald-300">R0</p>
            <p className="text-xs text-emerald-400/70 mt-2">No leakage detected ✅</p>
          </div>
        )}
      </div>

      {/* Lease Expiry Heat Map */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-4">Lease Expiry Heat Map</p>
        <div className="space-y-2">
          {expiryBuckets.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)] w-16">{bucket.label}</span>
              <div className="flex-1 h-6 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${bucket.color} rounded-full transition-all`}
                  style={{ width: `${(bucket.count / maxBucketCount) * 100}%`, minWidth: bucket.count > 0 ? "8px" : "0" }}
                />
              </div>
              <span className="text-xs text-[var(--text-primary)] w-8 text-right tabular-nums">{bucket.count}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">{leases?.length || 0} total leases · {expiringLeases.length} expiring within 90 days</p>
      </div>

      {/* Activity */}
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

      <div className="space-y-3">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">Actions</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/leases/new" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">+ New Lease</Link>
          <Link href="/financials/imports" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">+ Import Bank</Link>
          <Link href="/financials/revenue" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">+ Send Statements</Link>
          <Link href="/financials/cash-book" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">+ View Cash Book</Link>
        </div>
      </div>
    </div>
  );
}