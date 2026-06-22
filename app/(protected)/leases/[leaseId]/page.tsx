"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { getTenantTimeline } from "@/lib/communications/communication-service";
import Link from "next/link";

type BillingRule = {
  id: string;
  rule_type: string;
  description: string;
  base_amount: number;
  vat_rate: number;
  gl_code: string;
  frequency: string;
  escalation_percent: number | null;
  status: string;
  effective_from: string;
  effective_to: string | null;
};

type Charge = {
  id: string;
  charge_type: string;
  description: string;
  amount_incl_vat: number;
  gl_code: string;
  status: string;
  billing_period: string;
  created_at: string;
};

export default function LeaseDetailPage() {
  const params = useParams();
  const leaseId = params?.leaseId as string;

  const [lease, setLease] = useState<any>(null);
  const [rules, setRules] = useState<BillingRule[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "billing" | "communications" | "documents">("overview");
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
  useEffect(() => {
    async function fetchData() {
      if (!leaseId) return;
      const { data: leaseData } = await supabase.from("leases").select("*").eq("lease_id", leaseId).single();
      if (leaseData) setLease(leaseData);
      const { data: rulesData } = await supabase.from("billing_rules").select("*").eq("lease_id", leaseData?.id).order("created_at", { ascending: false });
      if (rulesData) setRules(rulesData);
      const { data: chargesData } = await supabase.from("charges").select("*").eq("lease_id", leaseData?.id).eq("is_active", true).order("created_at", { ascending: false }).limit(20);
      if (chargesData) setCharges(chargesData);
      if (leaseData?.tenant_id) {
        const data = await getTenantTimeline(leaseData.tenant_id);
        setTimeline(data);
        const { data: p } = await supabase.from("tenant_communication_prefs").select("*").eq("tenant_id", leaseData.tenant_id);
        if (p) setPrefs(p);
      }
      setLoading(false);
    }
    fetchData();
  }, [leaseId]);

  if (loading) return <div className="mx-auto max-w-7xl px-6 pt-8 pb-12"><p className="text-[var(--text-muted)]">Loading...</p></div>;
  if (!lease) return <div className="mx-auto max-w-7xl px-6 pt-8 pb-12"><p className="text-[var(--text-muted)]">Lease not found.</p></div>;

  const activeRules = rules.filter(r => r.status === "active");
  const inactiveRules = rules.filter(r => r.status !== "active");

  // Financial Summary
  const totalBilled = charges.reduce((s, c) => s + (c.amount_incl_vat || 0), 0);
  const totalCollected = totalBilled;
  const outstanding = 0;
  const depositHeld = lease.deposit_amount || 0;
  const daysToExpiry = lease.lease_end_date ? Math.ceil((new Date(lease.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const nextEscalation = lease.escalation_percent ? `${new Date(new Date().getFullYear(), (new Date(lease.lease_start_date || Date.now()).getMonth())).toLocaleDateString("en-ZA", { month: "long" })} ${new Date().getFullYear() + 1}` : "N/A";

  const prefLabels: Record<string, string> = {
    receipt_issued: "Receipts",
    invoice_distributed: "Invoices",
    statement_available: "Statements",
    lease_expiring: "Lease Renewals",
    payment_overdue: "Overdue Accounts",
    maintenance_scheduled: "Maintenance Updates",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader title={lease.tenant_name || "Lease Detail"} subtitle={`${lease.lease_id} · ${lease.property_name || "No property"}`} />

      {/* Tabs */}
      <div className="flex gap-3">
        {(["overview", "billing", "communications", "documents"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${activeTab === tab ? "bg-white text-black" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}>
            {tab === "billing" ? "Billing Rules" : tab === "communications" ? "Communications" : tab === "documents" ? "Documents" : "Overview"}
          </button>
        ))}
        <Link href={`/leases/${leaseId}/edit`} className="ml-auto rounded-2xl border border-[var(--border-default)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]">Edit Lease</Link>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Lease Health */}
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Lease Health</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Monthly Rent</p>
                <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">R{(lease.monthly_rental || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Outstanding</p>
                <p className="text-xl font-bold text-emerald-400 tabular-nums">R{outstanding.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Next Escalation</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{nextEscalation}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Expiry</p>
                <p className={`text-xl font-bold tabular-nums ${daysToExpiry && daysToExpiry < 60 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>
                  {daysToExpiry ? `${daysToExpiry} Days` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Financial Summary</p>
            <div className="grid grid-cols-4 gap-4">
              <div><p className="text-xs text-[var(--text-muted)]">Total Billed</p><p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">R{totalBilled.toLocaleString()}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Total Collected</p><p className="text-lg font-bold text-emerald-400 tabular-nums">R{totalCollected.toLocaleString()}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Outstanding</p><p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">R{outstanding.toLocaleString()}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Deposit Held</p><p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">R{depositHeld.toLocaleString()}</p></div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/leases/${leaseId}/edit`} className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">✏️ Edit Lease</Link>
            <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">🔄 Renew Lease</button>
            <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">📄 Generate Amendment</button>
            <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">📊 View Statements</button>
            <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)]">👤 View Tenant</button>
          </div>
        </div>
      )}

      {/* Billing Rules Tab */}
      {activeTab === "billing" && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Contractual Billing Rules</p><p className="text-sm text-[var(--text-secondary)] mt-1">What the lease says — permanent rules</p></div>
              <span className="text-xs text-[var(--text-muted)]">{activeRules.length} active</span>
            </div>
            {activeRules.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm py-4">No active billing rules.</p>
            ) : (
              <div className="space-y-2">
                {activeRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">{rule.rule_type}</span>
                      <span className="text-[var(--text-primary)]">{rule.description}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="text-[var(--text-secondary)]">R{rule.base_amount?.toLocaleString()}</span>
                      {rule.escalation_percent ? <span className="text-amber-400">{rule.escalation_percent}% escalation</span> : null}
                      <span className="text-[var(--text-muted)]">{rule.frequency}</span>
                      <span className="text-[var(--text-muted)] font-mono">{rule.gl_code}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {inactiveRules.length > 0 && (
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Inactive / Superseded Rules</p>
              <div className="space-y-2">
                {inactiveRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/50 px-4 py-3 text-sm opacity-60">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">{rule.rule_type}</span>
                      <span className="text-[var(--text-muted)]">{rule.description}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]">{rule.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Generated Charges</p><p className="text-sm text-[var(--text-secondary)] mt-1">What has been billed — temporal transactions</p></div>
              <span className="text-xs text-[var(--text-muted)]">{charges.length} charges</span>
            </div>
            {charges.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm py-4">No charges generated yet.</p>
            ) : (
              <div className="space-y-2">
                {charges.map(charge => (
                  <div key={charge.id} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">{charge.charge_type}</span>
                      <span className="text-[var(--text-primary)]">{charge.description}</span>
                      <span className="text-[var(--text-muted)] text-xs">{charge.billing_period}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="text-[var(--text-primary)] font-medium">R{charge.amount_incl_vat?.toLocaleString()}</span>
                      <span className="text-[var(--text-muted)] font-mono">{charge.gl_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${charge.status === "posted" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{charge.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Communications Tab */}
      {activeTab === "communications" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Communication Preferences</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["receipt_issued", "invoice_distributed", "statement_available", "lease_expiring", "payment_overdue", "maintenance_scheduled"].map(event => {
                const whatsappPref = prefs.find(p => p.event_type === event && p.channel === "whatsapp");
                const isEnabled = whatsappPref ? whatsappPref.is_enabled : true;
                return (
                  <div key={event} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2">
                    <span className="text-xs text-[var(--text-secondary)]">{prefLabels[event] || event}</span>
                    <button
                      onClick={async () => {
                        if (!lease?.tenant_id) return;
                        setSavingPrefs(true);
                        if (whatsappPref) {
                          await supabase.from("tenant_communication_prefs").update({ is_enabled: !isEnabled }).eq("id", whatsappPref.id);
                        } else {
                          await supabase.from("tenant_communication_prefs").insert({ tenant_id: lease.tenant_id, event_type: event, channel: "whatsapp", is_enabled: false });
                        }
                        const { data } = await supabase.from("tenant_communication_prefs").select("*").eq("tenant_id", lease.tenant_id);
                        if (data) setPrefs(data);
                        setSavingPrefs(false);
                      }}
                      disabled={savingPrefs}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${isEnabled ? "bg-emerald-500/10 text-emerald-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
                      {isEnabled ? "WhatsApp ON" : "WhatsApp OFF"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Communication Timeline</p><p className="text-sm text-[var(--text-secondary)] mt-1">All messages across all channels</p></div>
              <span className="text-xs text-[var(--text-muted)]">{timeline.length} messages</span>
            </div>
            {timeline.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm py-4">No communications yet.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((msg) => (
                  <div key={msg.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${msg.channel === "whatsapp" ? "bg-emerald-500/10 text-emerald-300" : msg.channel === "email" ? "bg-blue-500/10 text-blue-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>{msg.channel}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${msg.severity === "CRITICAL" ? "bg-red-500/10 text-red-300" : msg.severity === "ACTION_REQUIRED" ? "bg-amber-500/10 text-amber-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>{msg.severity}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${msg.status === "read" ? "bg-emerald-500/10 text-emerald-300" : msg.status === "delivered" ? "bg-blue-500/10 text-blue-300" : msg.status === "failed" ? "bg-red-500/10 text-red-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>{msg.status}</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)]">{msg.message_body}</p>
                    {msg.reply_text && (
                      <div className="mt-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Reply</p>
                        <p className="text-sm text-[var(--text-secondary)]">{msg.reply_text}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                      {msg.source_type && <span>Source: {msg.source_type} · {msg.source_id}</span>}
                      {msg.retry_count > 0 && <span className="text-amber-400">Retries: {msg.retry_count}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Documents</p>
          <div className="space-y-2 mb-4">
            {[
              { name: "Lease Agreement", status: "Uploaded", date: "12/01/26" },
              { name: "Suretyship", status: "Uploaded", date: "12/01/26" },
              { name: "Bank Guarantee", status: "Pending", date: null },
              { name: "Director Resolution", status: "Uploaded", date: "14/03/26" },
              { name: "Addendum 1", status: "Uploaded", date: "05/06/26" },
            ].map((doc, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span>📄</span>
                  <span className="text-[var(--text-primary)]">{doc.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === "Uploaded" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{doc.status}</span>
                  {doc.date && <span className="text-xs text-[var(--text-muted)]">{doc.date}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-8 text-center">
            <p className="text-[var(--text-muted)]">📄 Drag & drop documents here</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Lease Agreement, Suretyships, Guarantees, Resolutions, Addendums</p>
          </div>
        </div>
      )}
    </div>
  );
}