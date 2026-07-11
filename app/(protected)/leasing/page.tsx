'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { Plus, Search, Clock, CheckCircle, XCircle, FileText, TrendingUp } from "lucide-react";

const statusLabels: Record<string, string> = {
  awaiting_review: "Awaiting Review",
  under_negotiation: "Under Negotiation",
  awaiting_tenant: "Awaiting Tenant",
  awaiting_landlord: "Awaiting Landlord",
  awaiting_signature: "Awaiting Signature",
  sent_to_tenant: "Sent to Tenant",
  tenant_signed: "Tenant Signed",
  awaiting_landlord_signature: "Awaiting Landlord Sig",
  fully_executed: "Fully Executed",
  ready_for_activation: "Ready for Activation",
  activated: "Activated",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

const statusColors: Record<string, string> = {
  awaiting_review: "bg-blue-500/10 text-blue-300",
  under_negotiation: "bg-amber-500/10 text-amber-300",
  awaiting_signature: "bg-purple-500/10 text-purple-300",
  fully_executed: "bg-emerald-500/10 text-emerald-300",
  activated: "bg-emerald-500/20 text-emerald-400",
  declined: "bg-red-500/10 text-red-300",
  withdrawn: "bg-gray-500/10 text-gray-400",
};

export default function LeasingOperationsPage() {
  const router = useRouter();
  const [intakes, setIntakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase.from("lease_intake").select("*").order("created_at", { ascending: false });
    setIntakes(data || []);
    setLoading(false);
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "awaiting_review", label: "Review" },
    { key: "under_negotiation", label: "Negotiating" },
    { key: "ready_for_activation", label: "Ready" },
    { key: "activated", label: "Activated" },
  ];

  const filtered = intakes.filter(i => {
    if (activeFilter === "active") return !["activated", "declined", "withdrawn"].includes(i.status);
    if (activeFilter !== "all" && activeFilter !== "active") return i.status === activeFilter;
    if (searchTerm) return i.applicant_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return true;
  });

  const counts: Record<string, number> = {
    all: intakes.length,
    active: intakes.filter(i => !["activated", "declined", "withdrawn"].includes(i.status)).length,
    awaiting_review: intakes.filter(i => i.status === "awaiting_review").length,
    under_negotiation: intakes.filter(i => i.status === "under_negotiation").length,
    ready_for_activation: intakes.filter(i => i.status === "ready_for_activation").length,
    activated: intakes.filter(i => i.status === "activated").length,
  };

  const formatRands = (amount: number) => amount ? `R${amount.toLocaleString("en-ZA")}` : "—";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Leasing Operations</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">{intakes.length} opportunities · {counts.active} active</p>
        </div>
        <button onClick={() => router.push("/leasing/new")} className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Intake
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search applicants..." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${activeFilter === f.key ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>
              {f.label} <span className="ml-1 opacity-60">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => (<div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse"><div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3"></div></div>))}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">No lease intakes found</div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Applicant</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Property</th>
                <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Rental</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Status</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => (
                <tr key={item.id} onClick={() => router.push(`/leasing/${item.id}`)} className="border-b border-[var(--border-default)] last:border-0 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-2.5 px-4">
                    <p className="text-[var(--text-primary)] font-medium">{item.applicant_name || "Unnamed"}</p>
                    {item.company_registration && <p className="text-xs text-[var(--text-muted)]">{item.company_registration}</p>}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-secondary)] text-xs">{item.unit_number || "—"}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)]">{formatRands(item.monthly_rental)}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[item.status] || 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
