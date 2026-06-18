'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../components/layout/PageHeader";
import { exportToCSV } from "../../lib/utils";

type Lease = {
  id: string;
  lease_id: string;
  tenant_name: string;
  property_name: string;
  monthly_rental: number;
  escalation_percent: number;
  deposit_amount: number;
  lease_start_date: string;
  lease_end_date: string;
  lease_status: string;
  lease_type: string;
  parking_bays: number;
  gla_sqm: number;
  managing_entity_id: string;
};

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "expiring" | "expired" | "renewals">("all");
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);

  useEffect(() => {
  async function load() {
    try {
      // 1. Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('=== LEASES DEBUG ===');

      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Get the user's entities
      const { data: userEntities } = await supabase
        .from('user_entities')
        .select('entity_id')
        .eq('user_id', user.id);

      const entityIds = userEntities?.map(e => e.entity_id) || [];
      console.log('Entity IDs:', entityIds);

      if (entityIds.length === 0) {
        setLoading(false);
        return;
      }

      // 3. Get ALL leases
      const { data: allLeases, error } = await supabase
        .from("leases")
        .select("*")
        .order("created_at", { ascending: false });

      console.log('All leases from DB:', allLeases?.length);
      
      // 4. Filter in JavaScript
      const filtered = allLeases?.filter(l => 
        entityIds.includes(l.managing_entity_id)
      );
      
      console.log('Filtered leases:', filtered?.length);
      setLeases(filtered || []);
      
    } catch (error) {
      console.error('Error loading leases:', error);
    } finally {
      setLoading(false);
    }
  }
  load();
}, []);

  // Filter by search
  const searched = leases.filter(l => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (l.lease_id || "").toLowerCase().includes(s) ||
      (l.tenant_name || "").toLowerCase().includes(s) ||
      (l.property_name || "").toLowerCase().includes(s)
    );
  });

  // Filter by tab
  const filtered = searched.filter(l => {
    const now = new Date();
    const end = new Date(l.lease_end_date);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (activeTab === "active") return l.lease_status === "Active" && diff > 90;
    if (activeTab === "expiring") return l.lease_status === "Active" && diff <= 90 && diff > 0;
    if (activeTab === "expired") return diff <= 0 || l.lease_status === "Expired";
    if (activeTab === "renewals") return l.lease_status === "Active" && diff <= 180 && diff > 0;
    return true;
  });

  // Lease Health KPIs
  const activeCount = leases.filter(l => l.lease_status === "Active").length;
  const expiringCount = leases.filter(l => {
    if (l.lease_status !== "Active" || !l.lease_end_date) return false;
    const diff = Math.ceil((new Date(l.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff <= 90 && diff > 0;
  }).length;
  const expiredCount = leases.filter(l => {
    if (!l.lease_end_date) return false;
    return new Date(l.lease_end_date) < new Date() || l.lease_status === "Expired";
  }).length;
  const revenueDueForRenewal = leases
    .filter(l => {
      if (l.lease_status !== "Active" || !l.lease_end_date) return false;
      const diff = Math.ceil((new Date(l.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff <= 90 && diff > 0;
    })
    .reduce((s, l) => s + (l.monthly_rental || 0) * 12, 0);

  function getHealth(lease: Lease): { label: string; color: string } {
    if (!lease.lease_end_date) return { label: "Unknown", color: "text-[var(--text-muted)]" };
    const diff = Math.ceil((new Date(lease.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 0 || lease.lease_status === "Expired") return { label: "Expired", color: "text-[var(--danger)]" };
    if (diff <= 30) return { label: "Critical", color: "text-[var(--danger)]" };
    if (diff <= 90) return { label: "Expiring Soon", color: "text-[var(--warning)]" };
    if (!lease.deposit_amount) return { label: "Missing Deposit", color: "text-[var(--warning)]" };
    return { label: "Healthy", color: "text-emerald-400" };
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <PageHeader title="Leases" subtitle="Manage your lease portfolio" />
        <Link href="/leases/new" className="rounded-2xl bg-[var(--text-primary)] text-black px-5 py-3 text-sm font-semibold hover:opacity-90">
          + New Lease
        </Link>
        <button onClick={() => exportToCSV(filtered, "leases")} className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)] ml-3">
          📥 Export
        </button>
      </div>

      {/* Lease Health */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{activeCount}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Active Leases</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-2xl font-bold text-amber-400">{expiringCount}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Expiring in 90 Days</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-2xl font-bold text-red-400">{expiredCount}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Expired</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-2xl font-bold text-amber-400">R{revenueDueForRenewal.toLocaleString()}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Revenue Due for Renewal</p>
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-4 flex-wrap">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Find a lease, tenant, property, or lease ID..."
          className="flex-1 min-w-[300px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] placeholder:text-[var(--text-muted)]"
        />
        <div className="flex gap-2">
          {(["all", "active", "expiring", "expired", "renewals"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize transition ${
                activeTab === tab ? "bg-white text-black" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20"><p className="text-[var(--text-muted)]">Loading leases...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <p className="text-[var(--text-muted)]">No leases found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Lease</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Tenant</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Property</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Monthly Rent</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Expiry</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Health</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lease) => {
                const health = getHealth(lease);
                return (
                  <tr
                    key={lease.id}
                    onClick={() => setSelectedLease(lease)}
                    className="border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] font-mono">{lease.lease_id}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{lease.tenant_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{lease.property_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] text-right tabular-nums">R{(lease.monthly_rental || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        lease.lease_status === "Active" ? "bg-emerald-500/10 text-emerald-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                      }`}>{lease.lease_status || "Unknown"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{lease.lease_end_date || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className={health.color}>{health.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Side Panel — Lease Intelligence */}
      {selectedLease && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end" onClick={() => setSelectedLease(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-black border-l border-[var(--border-default)] h-full overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Lease Intelligence</p>
                <p className="text-sm font-mono text-[var(--text-primary)] mt-0.5">{selectedLease.lease_id}</p>
              </div>
              <button onClick={() => setSelectedLease(null)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Tenant</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{selectedLease.tenant_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Property</p>
                <p className="text-sm text-[var(--text-primary)]">{selectedLease.property_name || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Monthly Rent</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">R{(selectedLease.monthly_rental || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Escalation</p>
                  <p className="text-sm text-[var(--text-primary)]">{selectedLease.escalation_percent || 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Deposit</p>
                  <p className="text-sm text-[var(--text-primary)] tabular-nums">R{(selectedLease.deposit_amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Expiry</p>
                  <p className="text-sm text-[var(--text-primary)]">{selectedLease.lease_end_date || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Parking Bays</p>
                  <p className="text-sm text-[var(--text-primary)]">{selectedLease.parking_bays || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">GLA</p>
                  <p className="text-sm text-[var(--text-primary)]">{selectedLease.gla_sqm || "—"} sqm</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Outstanding Balance</p>
                  <p className="text-sm text-[var(--text-muted)]">—</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Next Escalation</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {selectedLease.escalation_percent && selectedLease.lease_start_date
                      ? new Date(new Date(selectedLease.lease_start_date).setFullYear(new Date().getFullYear())).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border-default)]">
                <Link href={`/leases/${selectedLease.lease_id}`} className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)]">View</Link>
                <Link href={`/leases/${selectedLease.lease_id}/edit`} className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)]">Edit</Link>
                <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)]">Documents</button>
                <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)]">Billing Rules</button>
                <button className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-hover)]">Communications</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}