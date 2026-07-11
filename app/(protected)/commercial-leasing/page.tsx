'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { Plus, Search, TrendingUp, Users, DollarSign, Clock, CheckCircle, FileText } from "lucide-react";

const statusLabels: Record<string, string> = {
  prospecting: "Prospecting", offer_received: "Offer Received", commercial_review: "Commercial Review",
  negotiation: "Negotiation", drafting: "Drafting", internal_approval: "Internal Approval",
  sent_for_signature: "Sent for Signature", tenant_signed: "Tenant Signed", landlord_signed: "Landlord Signed",
  executed: "Executed", ready_for_activation: "Ready for Activation", activated: "Activated",
  trading: "Trading", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired",
};

const statusColors: Record<string, string> = {
  prospecting: "bg-blue-500/10 text-blue-300",
  negotiation: "bg-amber-500/10 text-amber-300",
  drafting: "bg-purple-500/10 text-purple-300",
  executed: "bg-emerald-500/10 text-emerald-300",
  activated: "bg-emerald-500/20 text-emerald-400",
  trading: "bg-emerald-500/30 text-emerald-500",
  declined: "bg-red-500/10 text-red-300",
};

export default function CommercialLeasingPage() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: opps } = await supabase.from("leasing_opportunities").select("*, brokers(broker_name, agency_name)").order("created_at", { ascending: false });
    const { data: brks } = await supabase.from("brokers").select("*").order("broker_name");
    setOpportunities(opps || []);
    setBrokers(brks || []);
    setLoading(false);
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "negotiation", label: "Negotiating" },
    { key: "sent_for_signature", label: "Awaiting Signature" },
    { key: "ready_for_activation", label: "Ready" },
    { key: "trading", label: "Trading" },
  ];

  const counts: Record<string, number> = {
    all: opportunities.length,
    active: opportunities.filter(o => !["activated", "trading", "declined", "withdrawn", "expired"].includes(o.status)).length,
    negotiation: opportunities.filter(o => o.status === "negotiation").length,
    sent_for_signature: opportunities.filter(o => ["sent_for_signature", "tenant_signed", "landlord_signed"].includes(o.status)).length,
    ready_for_activation: opportunities.filter(o => o.status === "ready_for_activation").length,
    trading: opportunities.filter(o => o.status === "trading").length,
  };

  const filtered = opportunities.filter(o => {
    if (activeFilter === "active") return !["activated", "trading", "declined", "withdrawn", "expired"].includes(o.status);
    if (activeFilter !== "all" && activeFilter !== "active") return o.status === activeFilter;
    if (searchTerm) return o.prospect_name?.toLowerCase().includes(searchTerm.toLowerCase()) || o.opportunity_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return true;
  });

  const totalPipeline = opportunities.filter(o => !["declined", "withdrawn", "expired"].includes(o.status)).reduce((s, o) => s + (o.monthly_rental || 0), 0);
  const totalCommission = opportunities.filter(o => o.commission_status === "pending" || o.commission_status === "due").reduce((s, o) => s + (o.commission_amount || 0), 0);

  const formatRands = (amount: number) => amount ? `R${amount.toLocaleString("en-ZA")}` : "—";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Commercial Leasing</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">{opportunities.length} opportunities · {counts.active} active · Pipeline: {formatRands(totalPipeline)}/mo</p>
        </div>
        <button onClick={() => router.push("/commercial-leasing/new")} className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Opportunity
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{counts.active}</p><p className="text-xs text-[var(--text-muted)]">Active Deals</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-emerald-400">{formatRands(totalPipeline)}</p><p className="text-xs text-[var(--text-muted)]">Pipeline Value/mo</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">{counts.sent_for_signature}</p><p className="text-xs text-[var(--text-muted)]">Awaiting Signature</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-purple-400">{brokers.length}</p><p className="text-xs text-[var(--text-muted)]">Brokers</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(totalCommission)}</p><p className="text-xs text-[var(--text-muted)]">Commission Due</p></div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search opportunities..." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${activeFilter === f.key ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>
              {f.label} <span className="ml-1 opacity-60">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => (<div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse"><div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3"></div></div>))}</div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Opportunity</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Broker</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Property</th>
                <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Rental</th>
                <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Commission</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} onClick={() => router.push(`/commercial-leasing/${o.id}`)} className="border-b border-[var(--border-default)] last:border-0 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-2.5 px-4">
                    <p className="text-[var(--text-primary)] font-medium">{o.prospect_name || "Unnamed"}</p>
                    <p className="text-xs text-[var(--text-muted)]">{o.opportunity_code}</p>
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-secondary)] text-xs">{o.brokers?.broker_name || "—"}</td>
                  <td className="py-2.5 px-4 text-[var(--text-secondary)] text-xs">{o.unit_number || "—"}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)]">{formatRands(o.monthly_rental)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-xs">
                    {o.commission_percent ? `${o.commission_percent}%` : "—"} 
                    {o.commission_status === "due" && <span className="text-amber-400 ml-1">Due</span>}
                    {o.commission_status === "paid" && <span className="text-emerald-400 ml-1">Paid</span>}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[o.status] || 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
