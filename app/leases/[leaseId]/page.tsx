"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { PageHeader } from "../../components/layout/PageHeader";
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
  const [activeTab, setActiveTab] = useState<"details" | "billing">("details");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!leaseId) return;

      const { data: leaseData } = await supabase
        .from("leases")
        .select("*")
        .eq("lease_id", leaseId)
        .single();

      if (leaseData) setLease(leaseData);

      const { data: rulesData } = await supabase
        .from("billing_rules")
        .select("*")
        .eq("lease_id", leaseData?.id)
        .order("created_at", { ascending: false });

      if (rulesData) setRules(rulesData);

      const { data: chargesData } = await supabase
        .from("charges")
        .select("*")
        .eq("lease_id", leaseData?.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (chargesData) setCharges(chargesData);

      setLoading(false);
    }
    fetchData();
  }, [leaseId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
        <p className="text-zinc-500">Lease not found.</p>
      </div>
    );
  }

  const activeRules = rules.filter(r => r.status === "active");
  const inactiveRules = rules.filter(r => r.status !== "active");

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <PageHeader
        title={lease.tenant_name || "Lease Detail"}
        subtitle={`${lease.lease_id} · ${lease.property_name || "No property"}`}
      />

      {/* Tabs */}
      <div className="flex gap-3">
        {(["details", "billing"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${
              activeTab === tab
                ? "bg-white text-black"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            {tab === "billing" ? "Billing Rules" : "Details"}
          </button>
        ))}
        <Link
          href={`/leases/${leaseId}/edit`}
          className="ml-auto rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white"
        >
          Edit Lease
        </Link>
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Lease ID</p>
              <p className="text-white font-mono">{lease.lease_id}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Tenant</p>
              <p className="text-white">{lease.tenant_name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Property</p>
              <p className="text-white">{lease.property_name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Monthly Rental</p>
              <p className="text-white tabular-nums">R{lease.monthly_rental?.toLocaleString() || "0"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Escalation</p>
              <p className="text-white">{lease.escalation_percent || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Deposit</p>
              <p className="text-white tabular-nums">R{lease.deposit_amount?.toLocaleString() || "0"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Start Date</p>
              <p className="text-white">{lease.lease_start_date || lease.commencement_date || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">End Date</p>
              <p className="text-white">{lease.lease_end_date || lease.expiry_date || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Parking Bays</p>
              <p className="text-white">{lease.parking_bays || 0}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] mb-1">Status</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                lease.lease_status === "Active" ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"
              }`}>{lease.lease_status || "Unknown"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Billing Rules Tab */}
      {activeTab === "billing" && (
        <div className="space-y-8">
          {/* Contractual Rules */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Contractual Billing Rules</p>
                <p className="text-sm text-zinc-400 mt-1">What the lease says — permanent rules</p>
              </div>
              <span className="text-xs text-zinc-500">{activeRules.length} active</span>
            </div>

            {activeRules.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4">No active billing rules. Rules are extracted automatically when the lease is created or updated.</p>
            ) : (
              <div className="space-y-2">
                {activeRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{rule.rule_type}</span>
                      <span className="text-white">{rule.description}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="text-zinc-400">R{rule.base_amount?.toLocaleString()}</span>
                      {rule.escalation_percent ? (
                        <span className="text-amber-400">{rule.escalation_percent}% escalation</span>
                      ) : null}
                      <span className="text-zinc-500">{rule.frequency}</span>
                      <span className="text-zinc-600 font-mono">{rule.gl_code}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Rules */}
          {inactiveRules.length > 0 && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Inactive / Superseded Rules</p>
              <div className="space-y-2">
                {inactiveRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm opacity-60">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">{rule.rule_type}</span>
                      <span className="text-zinc-500">{rule.description}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{rule.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Charges */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Generated Charges</p>
                <p className="text-sm text-zinc-400 mt-1">What has been billed — temporal transactions</p>
              </div>
              <span className="text-xs text-zinc-500">{charges.length} charges</span>
            </div>

            {charges.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4">No charges generated yet. Charges are created automatically when a statement period opens.</p>
            ) : (
              <div className="space-y-2">
                {charges.map(charge => (
                  <div key={charge.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{charge.charge_type}</span>
                      <span className="text-white">{charge.description}</span>
                      <span className="text-zinc-500 text-xs">{charge.billing_period}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="text-white font-medium">R{charge.amount_incl_vat?.toLocaleString()}</span>
                      <span className="text-zinc-600 font-mono">{charge.gl_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${charge.status === "posted" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{charge.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}