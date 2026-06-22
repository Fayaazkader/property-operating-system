"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { extractRulesFromLease } from "@/lib/revenue/rule-extractor";
import { PageHeader } from "@/app/components/layout/PageHeader";

export default function EditLeasePage() {
  const params = useParams();
  const router = useRouter();
  const leaseId = params?.leaseId as string;
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [tenantName, setTenantName] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [monthlyRental, setMonthlyRental] = useState("");
  const [escalationPercent, setEscalationPercent] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [parkingBays, setParkingBays] = useState("");
  const [parkingRate, setParkingRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [leaseType, setLeaseType] = useState("Retail");
  const [noticePeriod, setNoticePeriod] = useState("90");
  const [gla, setGla] = useState("");
  const [securityLevy, setSecurityLevy] = useState("");
  const [marketingLevy, setMarketingLevy] = useState("");
  const [renewalOption, setRenewalOption] = useState(false);

  const LEASE_TYPES = ["Retail", "Office", "Industrial", "Storage", "Residential", "Advertising", "Telecommunications"];

  useEffect(() => {
    async function load() {
      if (!leaseId) return;
      const { data } = await supabase.from("leases").select("*").eq("lease_id", leaseId).single();
      if (data) {
        setTenantName(data.tenant_name || "");
        setPropertyName(data.property_name || "");
        setMonthlyRental(data.monthly_rental?.toString() || "");
        setEscalationPercent(data.escalation_percent?.toString() || "");
        setDepositAmount(data.deposit_amount?.toString() || "");
        setParkingBays(data.parking_bays?.toString() || "");
        setParkingRate(data.parking_rate?.toString() || "");
        setStartDate(data.lease_start_date || "");
        setEndDate(data.lease_end_date || "");
        setVatNumber(data.vat_number || "");
        setRegistrationNumber(data.company_registration || "");
        setTaxNumber(data.tax_number || "");
        setIndustry(data.industry || "");
        setLeaseType(data.lease_type || "Retail");
        setNoticePeriod(data.notice_period_days?.toString() || "90");
        setGla(data.gla_sqm?.toString() || "");
        setSecurityLevy(data.security_levy?.toString() || "");
        setMarketingLevy(data.marketing_levy?.toString() || "");
        setRenewalOption(data.renewal_option || false);
      }
      setPageLoading(false);
    }
    load();
  }, [leaseId]);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUpdate() {
    setLoading(true);
    const { error } = await supabase
      .from("leases")
      .update({
        tenant_name: tenantName,
        property_name: propertyName,
        monthly_rental: monthlyRental ? parseFloat(monthlyRental) : null,
        escalation_percent: escalationPercent ? parseFloat(escalationPercent) : null,
        deposit_amount: depositAmount ? parseFloat(depositAmount) : null,
        parking_bays: parkingBays ? parseInt(parkingBays) : null,
        parking_rate: parkingRate ? parseFloat(parkingRate) : null,
        lease_start_date: startDate || null,
        lease_end_date: endDate || null,
        vat_number: vatNumber || null,
        company_registration: registrationNumber || null,
        lease_type: leaseType,
        notice_period_days: noticePeriod ? parseInt(noticePeriod) : 90,
        gla_sqm: gla ? parseFloat(gla) : null,
        security_levy: securityLevy ? parseFloat(securityLevy) : null,
        marketing_levy: marketingLevy ? parseFloat(marketingLevy) : null,
      })
      .eq("lease_id", leaseId);

    if (error) {
      showToast("error", error.message);
    } else {
      const { data: lease } = await supabase.from("leases").select("id").eq("lease_id", leaseId).single();
      if (lease) {
        await supabase.from("billing_rules").update({ status: "superseded" }).eq("lease_id", lease.id).eq("status", "active");
        await extractRulesFromLease(lease.id);
      }
      showToast("success", "Lease updated successfully");
      setTimeout(() => router.push(`/leases/${leaseId}`), 800);
    }
    setLoading(false);
  }

  if (pageLoading) {
    return <div className="mx-auto max-w-3xl px-6 pt-8 pb-12"><p className="text-[var(--text-muted)]">Loading...</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 pt-8 pb-12">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{toast.text}</div>
        </div>
      )}

      <PageHeader title="Edit Lease" subtitle={`Editing ${leaseId}`} />

      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Tenant Name</label>
            <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Property Name</label>
            <input type="text" value={propertyName} onChange={(e) => setPropertyName(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Monthly Rental</label>
            <input type="number" value={monthlyRental} onChange={(e) => setMonthlyRental(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Escalation %</label>
            <input type="number" value={escalationPercent} onChange={(e) => setEscalationPercent(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Deposit Amount</label>
            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Parking Bays</label>
            <input type="number" value={parkingBays} onChange={(e) => setParkingBays(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Parking Rate (R/bay)</label>
            <input type="number" value={parkingRate} onChange={(e) => setParkingRate(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Lease Type</label>
            <select value={leaseType} onChange={(e) => setLeaseType(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]">
              {LEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">VAT Number</label>
            <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Registration Number</label>
            <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Tax Number</label>
            <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Industry</label>
            <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Notice Period (Days)</label>
            <input type="number" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">GLA (sqm)</label>
            <input type="number" value={gla} onChange={(e) => setGla(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Security Levy (R)</label>
            <input type="number" value={securityLevy} onChange={(e) => setSecurityLevy(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Marketing Levy (R)</label>
            <input type="number" value={marketingLevy} onChange={(e) => setMarketingLevy(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums" />
          </div>
        </div>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={renewalOption} onChange={(e) => setRenewalOption(e.target.checked)} className="rounded" />
          <span className="text-sm text-[var(--text-primary)]">Renewal Option Available</span>
        </label>

        <button onClick={handleUpdate} disabled={loading}
          className="w-full rounded-2xl bg-[var(--text-primary)] text-black px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
          {loading ? "Saving..." : "Update Lease"}
        </button>
      </div>
    </div>
  );
}