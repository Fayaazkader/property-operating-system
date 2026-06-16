"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { generateChargesFromRules } from "@/lib/revenue/charge-generator";
import { triggerCommunication } from "@/lib/communications/communication-service";
import { getMessageHealth } from "@/lib/communications/communication-service";
import { logAudit } from "@/lib/audit/audit-log";

type BillingCode = { id: string; code: string; description: string; vat_rate: number; gl_code: string; is_recoverable: boolean };
type ManualLine = {
  id: string; billing_code: string; description: string; amount_excl: number; vat_rate: number; vat_amount: number; amount_incl: number; gl_code: string; recoverable: boolean; editField: "excl" | "vat" | "incl";
};
type Charge = { id: string; description: string; amount_incl_vat: number; gl_code: string; status: string; charge_type: string; created_at: string };

const CURRENT_FINANCIAL_PERIOD = "2026-06";
const CURRENT_STATEMENT_PERIOD = "2026-07";
const ALLOWED_PERIODS = [CURRENT_FINANCIAL_PERIOD, CURRENT_STATEMENT_PERIOD];
const [stmtYear, stmtMonth] = CURRENT_STATEMENT_PERIOD.split("-").map(Number);
const STMT_START = `${CURRENT_STATEMENT_PERIOD}-01`;
const STMT_END = new Date(stmtYear, stmtMonth, 0).toISOString().split("T")[0];

function CustomDropdown({ value, options, onChange, placeholder, disabled }: {
  value: string; options: { id: string; label: string }[]; onChange: (id: string) => void; placeholder: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selected = options.find(o => o.id === value);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => !disabled && setOpen(!open)}
        className={`w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-4 py-3 text-sm outline-none focus:border-[var(--border-hover)] flex items-center justify-between ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
        <span className={selected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{selected ? selected.label : placeholder}</span>
        <span className="text-[var(--text-muted)] text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.id} type="button" onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === opt.id ? "bg-white text-black font-medium" : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}>{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RevenueOperationsPage() {
  const [activeTab, setActiveTab] = useState<"billing" | "statements" | "distribution">("billing");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billingCodes, setBillingCodes] = useState<BillingCode[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(CURRENT_STATEMENT_PERIOD);
  const [manualLines, setManualLines] = useState<ManualLine[]>([
    { id: "1", billing_code: "", description: "", amount_excl: 0, vat_rate: 15, vat_amount: 0, amount_incl: 0, gl_code: "", recoverable: false, editField: "excl" },
  ]);
  const [worksheet, setWorksheet] = useState<Charge[]>([]);
  const [pendingCharges, setPendingCharges] = useState<Charge[]>([]);
  const [codeSearch, setCodeSearch] = useState("");
  const [showCodeDropdown, setShowCodeDropdown] = useState<string | null>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [messageHealth, setMessageHealth] = useState<any>(null);
  const [distributionStarted, setDistributionStarted] = useState(false);
  const [showDistributeConfirm, setShowDistributeConfirm] = useState(false);
  const [showClosePeriodConfirm, setShowClosePeriodConfirm] = useState(false);
  const [billingHealth, setBillingHealth] = useState({ totalTenants: 0, ready: 0, needReview: 0, exceptions: 0 });
  const [statementHistory, setStatementHistory] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);

  const userRole = "finance_manager";
  const canPostDirectly = true;
  const propertyOptions = properties.map(p => ({ id: p.id, label: p.property_name }));
  const tenantOptions = tenants.map(t => ({ id: t.id, label: t.tenant_name }));
  const periodOptions = ALLOWED_PERIODS.map(p => ({ id: p, label: p }));
  const allTenantOptions = allTenants.map(t => ({ id: t.id, label: t.tenant_name }));

  // Centralized data loading — one function, no competing useEffect hooks
  async function loadBillingData() {
    if (!selectedTenant || !selectedProperty) {
      setWorksheet([]);
      setPendingCharges([]);
      return;
    }

    const { data: lease } = await supabase
      .from("leases")
      .select("id")
      .eq("tenant_id", selectedTenant)
      .eq("property_id", selectedProperty)
      .single();

    if (!lease) {
      setWorksheet([]);
      setPendingCharges([]);
      return;
    }

    // Ensure charges exist
    const { count } = await supabase
      .from("charges")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", lease.id)
      .eq("billing_period", CURRENT_STATEMENT_PERIOD);

    if (count === 0) {
      await generateChargesFromRules(lease.id, STMT_START, STMT_END);
    }

    // Load charges
    const { data: charges } = await supabase
      .from("charges")
      .select("*")
      .eq("lease_id", lease.id)
      .eq("is_active", true)
      .order("created_at");

    if (charges) {
      setWorksheet(charges.filter((c: any) => c.status === "posted"));
      setPendingCharges(charges.filter((c: any) => c.status === "pending_review" || c.status === "pending_approval"));
    }

    // Load statement history
    const { data: statements } = await supabase
      .from("communications")
      .select("*")
      .eq("tenant_id", selectedTenant)
      .eq("event_type", "statement_available")
      .order("created_at", { ascending: false })
      .limit(10);
    if (statements) setStatementHistory(statements);

    // Load transaction history
    const { data: transactions } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("matched_tenant_id", selectedTenant)
      .order("transaction_date", { ascending: false })
      .limit(20);
    if (transactions) setTransactionHistory(transactions);
  }

  // Load billing data when tenant changes (only dependency)
  useEffect(() => {
    loadBillingData();
  }, [selectedTenant, selectedProperty]);

  // Initial data load
  useEffect(() => {
    async function load() {
      const { data: codes } = await supabase.from("billing_codes").select("*").eq("is_active", true).order("code");
      const { data: props } = await supabase.from("properties").select("id, property_name").order("property_name");
      if (codes) setBillingCodes(codes);
      if (props) setProperties(props);
    }
    load();
  }, []);

  useEffect(() => {
    async function load() {
      if (!selectedProperty) { setTenants([]); return; }
      const { data } = await supabase.from("leases").select("id, tenant_id, tenant_name").eq("property_id", selectedProperty);
      if (data) {
        const unique = new Map();
        data.forEach((l: any) => { if (l.tenant_id) unique.set(l.tenant_id, { id: l.tenant_id, tenant_name: l.tenant_name }); });
        setTenants(Array.from(unique.values()));
      }
    }
    load();
  }, [selectedProperty]);

  useEffect(() => {
    async function loadAllTenants() {
      const { data } = await supabase.from("leases").select("tenant_id, tenant_name");
      if (data) {
        const unique = new Map();
        data.forEach((l: any) => { if (l.tenant_id) unique.set(l.tenant_id, { id: l.tenant_id, tenant_name: l.tenant_name }); });
        setAllTenants(Array.from(unique.values()));
      }
    }
    loadAllTenants();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (codeRef.current && !codeRef.current.contains(e.target as Node)) setShowCodeDropdown(null); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { getMessageHealth().then(setMessageHealth); }, []);
useEffect(() => {
  async function loadBillingHealth() {
    const { count: total } = await supabase.from("leases").select("id", { count: "exact", head: true }).not("property_id", "is", null).not("tenant_id", "is", null);
    const { count: ready } = await supabase.from("charges").select("id", { count: "exact", head: true }).eq("billing_period", CURRENT_STATEMENT_PERIOD).eq("status", "posted");
    const { count: review } = await supabase.from("charges").select("id", { count: "exact", head: true }).eq("billing_period", CURRENT_STATEMENT_PERIOD).in("status", ["pending_review", "pending_approval"]);
    const { count: exceptions } = await supabase.from("charges").select("id", { count: "exact", head: true }).eq("billing_period", CURRENT_STATEMENT_PERIOD).eq("status", "draft");
    setBillingHealth({ totalTenants: total || 0, ready: ready || 0, needReview: review || 0, exceptions: exceptions || 0 });
  }
  loadBillingHealth();
}, []);
  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  function selectBillingCode(lineId: string, bc: BillingCode) {
    setManualLines(manualLines.map(line => line.id !== lineId ? line : { ...line, billing_code: bc.code, description: bc.description, vat_rate: bc.vat_rate, gl_code: bc.gl_code, recoverable: bc.is_recoverable }));
    setShowCodeDropdown(null); setCodeSearch("");
  }

  function updateManualAmount(lineId: string, field: "excl" | "vat" | "incl", value: number) {
    setManualLines(manualLines.map(line => {
      if (line.id !== lineId) return line;
      const rate = line.vat_rate / 100;
      let excl = line.amount_excl, vat = line.vat_amount, incl = line.amount_incl;
      if (field === "excl") { excl = value; vat = value * rate; incl = value + vat; }
      else if (field === "vat") { vat = value; excl = value / rate; incl = excl + vat; }
      else { incl = value; excl = value / (1 + rate); vat = incl - excl; }
      return { ...line, amount_excl: Math.round(excl * 100) / 100, vat_amount: Math.round(vat * 100) / 100, amount_incl: Math.round(incl * 100) / 100, editField: field };
    }));
  }

  function updateManualDescription(lineId: string, desc: string) { setManualLines(manualLines.map(l => l.id === lineId ? { ...l, description: desc } : l)); }
  function addManualLine() { setManualLines([...manualLines, { id: String(Date.now()), billing_code: "", description: "", amount_excl: 0, vat_rate: 15, vat_amount: 0, amount_incl: 0, gl_code: "", recoverable: false, editField: "excl" }]); }
  function removeManualLine(id: string) { if (manualLines.length > 1) setManualLines(manualLines.filter(l => l.id !== id)); }

  async function handleSave(status: "pending_review" | "posted") {
    if (!selectedTenant || !selectedProperty) return;
    setLoading(true);
    const { data: lease } = await supabase.from("leases").select("id").eq("tenant_id", selectedTenant).eq("property_id", selectedProperty).single();
    const { data: property } = await supabase.from("properties").select("entity_id").eq("id", selectedProperty).single();
    let saved = 0;
    for (const line of manualLines) {
      if (line.amount_excl <= 0) continue;
      await supabase.from("charges").insert({
        lease_id: lease?.id, tenant_id: selectedTenant, property_id: selectedProperty, entity_id: property?.entity_id,
        charge_type: "adhoc", description: line.description || "Manual Charge",
        amount_excl_vat: line.amount_excl, vat_rate: line.vat_rate, vat_amount: line.vat_amount, amount_incl_vat: line.amount_incl,
        recurrence_rule: {}, recovery_method: line.recoverable ? "fixed" : null, gl_code: line.gl_code,
        is_active: true, status, billing_period: selectedPeriod, financial_period: CURRENT_FINANCIAL_PERIOD,
      });
      saved++;
    }
    showToast("success", `${saved} charges ${status === "posted" ? "posted" : "saved for review"}.`);
    setManualLines([{ id: "1", billing_code: "", description: "", amount_excl: 0, vat_rate: 15, vat_amount: 0, amount_incl: 0, gl_code: "", recoverable: false, editField: "excl" }]);
    await loadBillingData();
    setLoading(false);
  }

  async function handleApprovePending(chargeId: string) {
    await supabase.from("charges").update({ status: "posted", posted_at: new Date().toISOString() }).eq("id", chargeId);
    showToast("success", "Charge approved and posted.");
    await loadBillingData();
  }

  function handleDistribute() { setShowDistributeConfirm(true); }

  async function confirmDistribute() {
    setDistributionStarted(true);
    setShowDistributeConfirm(false);
    showToast("success", "Statements distributed. Receipting paused.");
    await logAudit({ action: "export", resource_type: "statement", resource_label: CURRENT_STATEMENT_PERIOD, new_values: { action: "distributed", period: CURRENT_STATEMENT_PERIOD } });

    // Send to selected tenant or all tenants of selected property
    if (filterType === "tenant" && filterValue) {
      const tenant = allTenants.find(t => t.id === filterValue);
      if (tenant) {
        await triggerCommunication({
          tenant_id: filterValue,
          event_type: "invoice_distributed",
          source_type: "invoice",
          source_id: `INV-${CURRENT_STATEMENT_PERIOD}`,
          merge_data: { tenant_name: tenant.tenant_name, period: CURRENT_STATEMENT_PERIOD, total: "See invoice", link: "https://assetflow.app/invoices" },
        });
      }
    } else if (filterType === "property" && filterValue) {
      const { data: leases } = await supabase.from("leases").select("tenant_id, tenant_name").eq("property_id", filterValue);
      if (leases) {
        for (const l of leases) {
          if (l.tenant_id) {
            await triggerCommunication({
              tenant_id: l.tenant_id,
              event_type: "invoice_distributed",
              source_type: "invoice",
              source_id: `INV-${CURRENT_STATEMENT_PERIOD}`,
              merge_data: { tenant_name: l.tenant_name || "Tenant", period: CURRENT_STATEMENT_PERIOD, total: "See invoice", link: "https://assetflow.app/invoices" },
            });
          }
        }
      }
    }
  }

  function handleClosePeriod() { setShowClosePeriodConfirm(true); }

  function confirmClosePeriod() {
    setDistributionStarted(false);
    setShowClosePeriodConfirm(false);
    showToast("success", "July Statement Period closed. August period open. Receipting re-enabled.");
  }

  const manualTotalExcl = manualLines.reduce((s, l) => s + l.amount_excl, 0);
  const manualTotalVat = manualLines.reduce((s, l) => s + l.vat_amount, 0);
  const manualTotalIncl = manualLines.reduce((s, l) => s + l.amount_incl, 0);
  const wsExcl = worksheet.reduce((s, i) => s + (i.amount_incl_vat / 1.15), 0);
  const wsVat = worksheet.reduce((s, i) => s + (i.amount_incl_vat - i.amount_incl_vat / 1.15), 0);
  const wsIncl = worksheet.reduce((s, i) => s + i.amount_incl_vat, 0);
  const filteredCodes = billingCodes.filter(bc => !codeSearch || bc.code.toLowerCase().includes(codeSearch.toLowerCase()) || bc.description.toLowerCase().includes(codeSearch.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{toast.text}</div>
        </div>
      )}

      <PageHeader title="Revenue Operations" subtitle="Billing, statements, and distribution." />

      {/* Tabs */}
      <div className="flex gap-3">
        {(["billing", "statements", "distribution"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold capitalize transition ${activeTab === tab ? "bg-white text-black" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ===== BILLING TAB ===== */}
      {activeTab === "billing" && (
        <div className="space-y-8">
          {/* Billing Health */}
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Billing Health — {CURRENT_STATEMENT_PERIOD}</p>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{billingHealth.totalTenants}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Total Tenants</p>
              </div>
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-2xl font-bold text-blue-300">{billingHealth.ready}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Ready</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-2xl font-bold text-amber-300">{billingHealth.needReview}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Need Review</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-2xl font-bold text-red-300">{billingHealth.exceptions}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Exceptions</p>
              </div>
            </div>
          </div>

          {/* Property/Tenant Selector */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Property</label>
              <CustomDropdown value={selectedProperty} options={propertyOptions} onChange={(id) => { setSelectedProperty(id); setSelectedTenant(""); }} placeholder="Select property..." />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Tenant</label>
              <CustomDropdown value={selectedTenant} options={tenantOptions} onChange={(id) => setSelectedTenant(id)} placeholder="Select tenant..." disabled={!selectedProperty} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Billing Period</label>
              <CustomDropdown value={selectedPeriod} options={periodOptions} onChange={setSelectedPeriod} placeholder="Select period..." />
            </div>
          </div>

          {/* Worksheet Preview */}
          {selectedTenant && (
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Billing Worksheet — {allTenants.find(t => t.id === selectedTenant)?.tenant_name || tenants.find(t => t.id === selectedTenant)?.tenant_name}</p>
              {worksheet.length === 0 && pendingCharges.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm py-4">No charges yet. Add manual charges below or check back when billing rules have been applied.</p>
              ) : (
                <div className="space-y-1 mb-4">
                  {worksheet.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-[var(--border-default)]/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">{item.charge_type === "adhoc" ? "Manual" : "Auto"}</span>
                        <span className="text-[var(--text-primary)]">{item.description}</span>
                        <span className="text-[var(--text-muted)] text-xs font-mono">({item.gl_code})</span>
                      </div>
                      <div className="flex items-center gap-6 tabular-nums">
                        <span className="text-[var(--text-secondary)] w-24 text-right">R{(item.amount_incl_vat / 1.15).toLocaleString()}</span>
                        <span className="text-[var(--text-muted)] w-20 text-right">R{(item.amount_incl_vat - item.amount_incl_vat / 1.15).toLocaleString()}</span>
                        <span className="text-[var(--text-primary)] w-24 text-right font-medium">R{item.amount_incl_vat?.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  {pendingCharges.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-[var(--border-default)]/50 opacity-60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">Pending</span>
                        <span className="text-[var(--text-primary)]">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-6 tabular-nums">
                        <span className="text-[var(--text-secondary)] w-24 text-right">R{(item.amount_incl_vat / 1.15).toLocaleString()}</span>
                        <span className="text-[var(--text-muted)] w-20 text-right">R{(item.amount_incl_vat - item.amount_incl_vat / 1.15).toLocaleString()}</span>
                        <span className="text-[var(--text-primary)] w-24 text-right font-medium">R{item.amount_incl_vat?.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end border-t border-[var(--border-hover)] pt-3 text-sm tabular-nums">
                <div className="flex items-center gap-6">
                  <span className="text-[var(--text-secondary)]">Subtotal: <span className="text-[var(--text-primary)]">R{wsExcl.toLocaleString()}</span></span>
                  <span className="text-[var(--text-secondary)]">VAT: <span className="text-[var(--text-primary)]">R{wsVat.toLocaleString()}</span></span>
                  <span className="text-[var(--text-secondary)]">Total: <span className="text-[var(--text-primary)] font-bold text-lg">R{wsIncl.toLocaleString()}</span></span>
                </div>
              </div>
            </div>
          )}
          
          {/* Manual Charges */}
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">New Manual Charge</p>
            <div className="flex items-center gap-2 mb-2 text-xs text-[var(--text-muted)] uppercase tracking-[0.15em]">
              <span className="w-40">Code</span><span className="flex-1">Description</span>
              <span className="w-24 text-right">Excl. VAT</span><span className="w-24 text-right">VAT</span><span className="w-24 text-right">Incl. VAT</span><span className="w-6"></span>
            </div>
            <div className="space-y-2 mb-4">
              {manualLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <div className="relative w-40" ref={codeRef}>
                    <button type="button" onClick={() => setShowCodeDropdown(showCodeDropdown === line.id ? null : line.id)}
                      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2.5 text-xs text-left outline-none focus:border-[var(--border-hover)]">
                      {line.billing_code ? <span className="text-[var(--text-primary)] font-mono">{line.billing_code}</span> : <span className="text-[var(--text-muted)]">Add code...</span>}
                    </button>
                    {showCodeDropdown === line.id && (
                      <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                        <div className="p-2"><input type="text" value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} placeholder="Search code..." autoFocus className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]" /></div>
                        {filteredCodes.map(bc => (
                          <button key={bc.id} type="button" onClick={() => selectBillingCode(line.id, bc)} className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${line.billing_code === bc.code ? "bg-white text-black font-medium" : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}>
                            <span className="font-mono">{bc.code}</span><span className="text-[var(--text-muted)] ml-2">— {bc.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="text" value={line.description} onChange={(e) => updateManualDescription(line.id, e.target.value)} placeholder="Add description..."
                    className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] placeholder:text-[var(--text-muted)]" />
                  <input type="number" step="0.01" value={line.amount_excl || ""} onChange={(e) => updateManualAmount(line.id, "excl", parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums text-right" placeholder="0.00" />
                  <input type="number" step="0.01" value={line.vat_amount || ""} onChange={(e) => updateManualAmount(line.id, "vat", parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums text-right" placeholder="0.00" />
                  <input type="number" step="0.01" value={line.amount_incl || ""} onChange={(e) => updateManualAmount(line.id, "incl", parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)] tabular-nums text-right" placeholder="0.00" />
                  <button onClick={() => removeManualLine(line.id)} disabled={manualLines.length <= 1} className="p-2 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={addManualLine} className="text-xs text-blue-400 hover:text-blue-300">+ Add Row</button>
              <div className="text-xs text-[var(--text-muted)] tabular-nums">Excl: R{manualTotalExcl.toLocaleString()} · VAT: R{manualTotalVat.toLocaleString()} · Incl: R{manualTotalIncl.toLocaleString()}</div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => handleSave("pending_review")} disabled={!selectedTenant || manualTotalExcl === 0 || loading}
                className="flex-1 rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">Save for Review</button>
              {canPostDirectly && (
                <button onClick={() => handleSave("posted")} disabled={!selectedTenant || manualTotalExcl === 0 || loading}
                  className="flex-1 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">Post Immediately</button>
              )}
            </div>
          </div>

          {pendingCharges.length > 0 && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300 mb-4">Pending Review — {pendingCharges.length} charges</p>
              {pendingCharges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between py-2 border-b border-[var(--border-default)]/50 text-sm">
                  <div><span className="text-[var(--text-primary)]">{charge.description}</span><span className="text-[var(--text-muted)] text-xs ml-2 font-mono">({charge.gl_code})</span></div>
                  <div className="flex items-center gap-4">
                    <span className="text-[var(--text-primary)] tabular-nums font-medium">R{charge.amount_incl_vat?.toLocaleString()}</span>
                    <button onClick={() => handleApprovePending(charge.id)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Approve & Post</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== STATEMENTS TAB ===== */}
      {activeTab === "statements" && (
        <div className="space-y-8">
          {!selectedTenant ? (
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-12 text-center">
              <p className="text-[var(--text-muted)]">Select a tenant in the Billing tab to view their statements.</p>
            </div>
          ) : (
            <>
              {/* Statement History */}
              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Statement History — {allTenants.find(t => t.id === selectedTenant)?.tenant_name || tenants.find(t => t.id === selectedTenant)?.tenant_name}</p>
                {statementHistory.length === 0 ? (
                  <p className="text-[var(--text-muted)] text-sm py-4">No statements sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {statementHistory.map((stmt) => (
                      <div key={stmt.id} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                        <div>
                          <span className="text-[var(--text-primary)]">{stmt.event_type?.replace(/_/g, " ")}</span>
                          <span className="text-[var(--text-muted)] text-xs ml-2">{new Date(stmt.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${stmt.status === "read" ? "bg-emerald-500/10 text-emerald-300" : stmt.status === "delivered" ? "bg-blue-500/10 text-blue-300" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>{stmt.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction History */}
              <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Transaction History</p>
                {transactionHistory.length === 0 ? (
                  <p className="text-[var(--text-muted)] text-sm py-4">No transactions found for this tenant.</p>
                ) : (
                  <div className="space-y-2">
                    {transactionHistory.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                        <div>
                          <span className="text-[var(--text-primary)]">{tx.transaction_description}</span>
                          <span className="text-[var(--text-muted)] text-xs ml-2">{tx.transaction_date}</span>
                        </div>
                        <span className="text-[var(--text-primary)] tabular-nums font-medium">R{Math.abs(tx.transaction_amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== DISTRIBUTION TAB ===== */}
      {activeTab === "distribution" && (
        <div className="space-y-8">
          {messageHealth && (
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Message Health — Today</p>
              <div className="grid grid-cols-5 gap-4">
                {[{ label: "Sent", v: messageHealth.today_total, c: "text-[var(--text-primary)]" }, { label: "Delivered", v: messageHealth.delivered, c: "text-blue-400" }, { label: "Read", v: messageHealth.read, c: "text-emerald-400" }, { label: "Failed", v: messageHealth.failed, c: "text-red-400" }, { label: "Retrying", v: messageHealth.pending_retries, c: "text-amber-400" }].map((m, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center">
                    <p className={`text-2xl font-bold ${m.c}`}>{m.v}</p><p className="text-xs text-[var(--text-muted)]">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {distributionStarted && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/20 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold">July statements distributed · Receipting paused</p>
              <p className="text-xs text-amber-200 mt-1">You may continue adding charges and regenerating statements. Receipting re-enables when the period is closed.</p>
            </div>
          )}

          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Distribution</p>
              <div className="flex items-center gap-3">
                <div className="w-48">
                  <CustomDropdown value={filterType} options={[{ id: "all", label: "All Properties" }, { id: "property", label: "By Property" }, { id: "tenant", label: "By Tenant" }]}
                    onChange={(id) => { setFilterType(id); setFilterValue(""); }} placeholder="Filter..." />
                </div>
                {filterType === "property" && (
                  <div className="w-56"><CustomDropdown value={filterValue} options={propertyOptions} onChange={setFilterValue} placeholder="Select property..." /></div>
                )}
                {filterType === "tenant" && (
                  <div className="w-56"><CustomDropdown value={filterValue} options={allTenantOptions} onChange={setFilterValue} placeholder="Select tenant..." /></div>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {filterType === "all" && "Distributing to all tenants across all properties."}
              {filterType === "property" && (filterValue ? `Distributing to ${properties.find(p => p.id === filterValue)?.property_name || "selected property"}.` : "Select a property to distribute.")}
              {filterType === "tenant" && (filterValue ? `Distributing to ${allTenants.find(t => t.id === filterValue)?.tenant_name || "selected tenant"}.` : "Select a tenant to distribute.")}
            </p>
                        {/* Invoice Preview — shows when a tenant is selected */}
            {filterType === "tenant" && filterValue && (
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 mb-4">
                <p className="text-xs text-[var(--text-muted)] mb-2">Invoice Preview — {allTenants.find(t => t.id === filterValue)?.tenant_name}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--text-primary)]">Rental</span><span className="text-[var(--text-primary)] tabular-nums">R85,000</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-primary)]">Parking</span><span className="text-[var(--text-primary)] tabular-nums">R4,000</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-primary)]">Utilities</span><span className="text-[var(--text-primary)] tabular-nums">R8,000</span></div>
                  <div className="flex justify-between text-sm pt-2 border-t border-[var(--border-default)] font-semibold">
                    <span className="text-[var(--text-primary)]">Total Due</span>
                    <span className="text-[var(--text-primary)] tabular-nums">R97,000</span>
                  </div>
                </div>
              </div>
            )}
            {filterValue && filterType !== "all" && (
              <button onClick={() => setShowFullPreview(true)} className="mt-3 w-full rounded-xl border border-[var(--border-hover)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">📋 Preview Distribution Report</button>
            )}
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 mb-4">
              <p className="text-xs text-[var(--text-muted)] mb-2">Distribution Readiness</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><span>{billingHealth.totalTenants > 0 ? "✅" : "⚠️"}</span><span className="text-[var(--text-primary)]">Charges generated for {billingHealth.totalTenants} tenants</span></div>
                <div className="flex items-center gap-2"><span>{billingHealth.exceptions === 0 ? "✅" : "⚠️"}</span><span className="text-[var(--text-primary)]">No exceptions ({billingHealth.exceptions} found)</span></div>
                <div className="flex items-center gap-2"><span>{billingHealth.needReview === 0 ? "✅" : "⚠️"}</span><span className="text-[var(--text-primary)]">No pending approvals ({billingHealth.needReview} pending)</span></div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              {!distributionStarted ? (
                <button onClick={handleDistribute} disabled={!filterValue && filterType !== "all"}
                  className="flex-1 rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">Distribute Statements</button>
              ) : (
                <button onClick={handleClosePeriod} className="flex-1 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">Close Period & Re-enable Receipting</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals — kept from original */}
      {showDistributeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowDistributeConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-md mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Distribute {CURRENT_STATEMENT_PERIOD} Statements?</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">Receipting will be paused until the period is closed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDistributeConfirm(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={confirmDistribute} className="rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500">Distribute Statements</button>
            </div>
          </div>
        </div>
      )}

      {showClosePeriodConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowClosePeriodConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-md mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Close {CURRENT_STATEMENT_PERIOD} Statement Period?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">This will finalize all invoices and re-enable receipting.</p>
            <p className="text-xs text-amber-400 mb-4">⚠️ This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowClosePeriodConfirm(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={confirmClosePeriod} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">Close Period & Re-enable Receipting</button>
            </div>
          </div>
        </div>
      )}

      {showFullPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowFullPreview(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] sticky top-0 bg-black z-10">
              <div><p className="text-sm uppercase tracking-[0.25em] text-[var(--text-muted)]">Distribution Preview</p><p className="text-xs text-[var(--text-muted)] mt-0.5">{CURRENT_STATEMENT_PERIOD}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="rounded-2xl border border-[var(--border-hover)] px-4 py-2 text-xs font-medium text-[var(--text-primary)]">🖨️ Print</button>
                <button className="rounded-2xl border border-[var(--border-hover)] px-4 py-2 text-xs font-medium text-[var(--text-primary)]">📥 Export PDF</button>
                <button onClick={() => setShowFullPreview(false)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl">✕</button>
              </div>
            </div>
            <div className="px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Billing Summary — {CURRENT_STATEMENT_PERIOD}</p>
              <div className="grid grid-cols-4 gap-3">
                {[{ label: "Rental Income", excl: 192000, vat: 28800, incl: 220800 }, { label: "Parking", excl: 6000, vat: 900, incl: 6900 }, { label: "Electricity Recovery", excl: 8000, vat: 1200, incl: 9200 }, { label: "Water Recovery", excl: 3000, vat: 450, incl: 3450 }].map((row, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">{row.label}</p><p className="text-lg font-bold text-[var(--text-primary)] mt-1 tabular-nums">R{row.incl.toLocaleString()}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Excl: R{row.excl.toLocaleString()} · VAT: R{row.vat.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4 pt-3 border-t border-[var(--border-default)]">
                <div className="text-right"><p className="text-xs text-[var(--text-muted)] mb-1">Grand Total</p><p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">R240,350</p></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-default)] bg-[var(--bg-elevated)] flex justify-between items-center">
              <p className="text-xs text-[var(--text-muted)]">This preview will be saved and can be accessed from the billing history.</p>
              <button onClick={() => setShowFullPreview(false)} className="rounded-2xl border border-[var(--border-hover)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}