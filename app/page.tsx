import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { triggerCommunication } from "@/lib/communications/communication-service";

export default async function HomePage() {
  // Fetch real data
  const { data: leases } = await supabase.from("leases").select("*");
  const { data: transactions } = await supabase.from("bank_transactions").select("*").order("created_at", { ascending: false }).limit(5);

  // Calculate KPIs
  const totalRevenue = leases?.reduce((sum, l) => sum + (l.monthly_rental || 0), 0) || 0;
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

  // Arrears — unallocated transactions
  const { data: unallocated } = await supabase.from("bank_transactions").select("transaction_amount").neq("allocation_status", "posted");
  const arrearsTotal = unallocated?.reduce((s, t) => s + Math.abs(t.transaction_amount || 0), 0) || 0;

  // Activity feed
  const recentActivity = transactions?.slice(0, 5).map(tx => ({
    id: tx.id,
    description: tx.transaction_description,
    amount: tx.transaction_amount,
    date: tx.created_at || tx.transaction_date,
    type: tx.transaction_amount >= 0 ? "receipt" : "payment",
  })) || [];

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
  // Trigger lease expiry communications
  for (const lease of criticalLeases) {
    if (lease.tenant_id) {
      triggerCommunication({
        tenant_id: lease.tenant_id,
        event_type: "lease_expiring",
        source_type: "lease",
        source_id: lease.id || lease.lease_id,
        merge_data: {
          tenant_name: lease.tenant_name || "Tenant",
          lease_ref: lease.lease_id || lease.id,
          expiry_date: lease.lease_end_date || lease.expiry_date || "soon",
        },
      });
    }
  }
  if (arrearsTotal > 0) {
    attentionItems.push({
      level: "HIGH",
      text: `Unallocated receipts total R${arrearsTotal.toLocaleString()}`,
      detail: "Requires reconciliation in Cash Book",
      action: "Open Cash Book",
      href: "/financials/cash-book",
    });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const portfolioHealthy = criticalLeases.length === 0 && arrearsTotal < 100000;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 pt-12 pb-20">
      {/* Greeting */}
      <div className="space-y-2">
        <p className="text-sm tracking-[0.2em] uppercase text-[var(--text-muted)]">Portfolio Overview</p>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
          {greeting}, Mohammed
        </h1>
        <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
          {portfolioHealthy
            ? "Your portfolio is healthy. A few items need attention."
            : `${attentionItems.length} items require attention. ${criticalLeases.length} ${criticalLeases.length === 1 ? "is" : "are"} critical.`}
        </p>
      </div>
{/* Search — Signature Feature */}
      <div className="pt-6">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-5 py-4 flex items-center gap-3 text-[var(--text-muted)]">
          <span>🔍</span>
          <span className="text-sm">Ask AssetFlow anything...</span>
          <span className="ml-auto text-xs text-[var(--text-muted)]">⌘K</span>
        </div>
      </div>
      {/* What Needs Attention */}
      {attentionItems.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">What Needs Attention</p>
          <div className="space-y-3">
            {attentionItems.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="block rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 hover:border-[var(--border-hover)] transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className={`text-[10px] tracking-[0.2em] uppercase font-semibold ${
                      item.level === "CRITICAL" ? "text-[var(--danger)]" :
                      item.level === "HIGH" ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
                    }`}>
                      {item.level}
                    </span>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.text}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{item.detail}</p>
                  </div>
                  <span className="text-xs text-[var(--accent)] group-hover:text-[var(--accent-hover)] transition-colors shrink-0 mt-1">
                    {item.action} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Health */}
      <div className="grid grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Revenue</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">R{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-[var(--text-muted)]">Monthly</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Arrears</p>
          <p className={`text-2xl font-semibold tabular-nums ${arrearsTotal > 0 ? "text-[var(--warning)]" : "text-[var(--text-primary)]"}`}>
            R{arrearsTotal.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Unallocated</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Expiring Leases</p>
          <p className={`text-2xl font-semibold tabular-nums ${expiringLeases.length > 0 ? "text-[var(--warning)]" : "text-[var(--text-primary)]"}`}>
            {expiringLeases.length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Within 30 days</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)]">Status</p>
          <p className={`text-2xl font-semibold ${portfolioHealthy ? "text-[var(--accent)]" : "text-[var(--warning)]"}`}>
            {portfolioHealthy ? "Healthy" : "Needs Review"}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Portfolio</p>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-3">Today's Summary</p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {portfolioHealthy
            ? "Portfolio performance remains stable. No critical items require immediate attention. All revenue streams are active and billing is on schedule."
            : `Portfolio requires attention. ${criticalLeases.length} lease${criticalLeases.length > 1 ? 's' : ''} approaching expiry. ${arrearsTotal > 0 ? `Unallocated receipts of R${arrearsTotal.toLocaleString()} need reconciliation.` : ''} Review the items above before the next billing cycle.`}
        </p>
      </div>

      {/* Activity */}
      {recentActivity.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">Activity</p>
          <div className="space-y-1">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border-default)] last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${item.type === "receipt" ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]"}`} />
                  <p className="text-sm text-[var(--text-primary)]">{item.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm tabular-nums text-[var(--text-primary)]">R{Math.abs(item.amount).toLocaleString()}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {item.date ? new Date(item.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <p className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">Actions</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/leases/new" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
            + New Lease
          </Link>
          <Link href="/financials/imports" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
            + Import Bank
          </Link>
          <Link href="/financials/revenue" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
            + Send Statements
          </Link>
          <Link href="/financials/cash-book" className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
            + View Cash Book
          </Link>
        </div>
      </div>

      
    </div>
  );
}