"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { triggerCommunication } from "@/lib/communications/communication-service";
import { generateChargesForPeriod } from "@/lib/revenue/charge-generator";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { getMessageHealth } from "@/lib/communications/communication-service";
type GLCodes = { id: string; code: string; description: string; category: string };
type BillingCode = { id: string; code: string; description: string; vat_rate: number; gl_code: string; is_recoverable: boolean };
type ManualLine = {
  id: string; billing_code: string; description: string; amount_excl: number; vat_rate: number; vat_amount: number; amount_incl: number; gl_code: string; recoverable: boolean; editField: "excl" | "vat" | "incl";
};
type Charge = { id: string; description: string; amount_incl_vat: number; gl_code: string; status: string; charge_type: string; created_at: string };

const CURRENT_FINANCIAL_PERIOD = "2026-06";
const CURRENT_STATEMENT_PERIOD = "2026-07";
const ALLOWED_PERIODS = [CURRENT_FINANCIAL_PERIOD, CURRENT_STATEMENT_PERIOD];

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
        className={`w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm outline-none focus:border-zinc-600 flex items-center justify-between ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
        <span className={selected ? "text-white" : "text-zinc-500"}>{selected ? selected.label : placeholder}</span>
        <span className="text-zinc-500 text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.id} type="button" onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === opt.id ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}>{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RevenueOperationsPage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [glCodes, setGlCodes] = useState<GLCodes[]>([]);
  const [billingCodes, setBillingCodes] = useState<BillingCode[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
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
const [allTenants, setAllTenants] = useState<any[]>([]);
const allTenantOptions = allTenants.map(t => ({ id: t.id, label: t.tenant_name }));
const [previewTenant, setPreviewTenant] = useState<any>(null);
const [showFullPreview, setShowFullPreview] = useState(false);
const [messageHealth, setMessageHealth] = useState<any>(null);
  // Distribution state
  const [distributionStarted, setDistributionStarted] = useState(false);
  const [showDistributeConfirm, setShowDistributeConfirm] = useState(false);
  const [showClosePeriodConfirm, setShowClosePeriodConfirm] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
const [bulkEventType, setBulkEventType] = useState("payment_overdue");
const [bulkSending, setBulkSending] = useState(false);
  const [billingStats] = useState({ totalTenants: 214, billed: 0, outstanding: 214, blocked: 0, blockedReasons: [] as { reason: string; count: number }[] });

  const userRole = "finance_manager";
  const canPostDirectly = ["finance_manager", "portfolio_manager"].includes(userRole);

  useEffect(() => {
    async function load() {
      const { data: gl } = await supabase.from("gl_codes").select("*").eq("is_active", true).order("code");
      const { data: codes } = await supabase.from("billing_codes").select("*").eq("is_active", true).order("code");
      const { data: props } = await supabase.from("properties").select("id, property_name").order("property_name");
      if (gl) setGlCodes(gl);
      if (codes) setBillingCodes(codes);
      if (props) setProperties(props);
    }
    load();
  }, []);
    useEffect(() => {
    async function autoGenerateCharges() {
      const { data: existingCharges } = await supabase
        .from("charges")
        .select("id")
        .eq("billing_period", CURRENT_STATEMENT_PERIOD)
        .limit(1);

      if (!existingCharges || existingCharges.length === 0) {
        const periodStart = "2026-07-01";
        const periodEnd = "2026-07-31";
        await generateChargesForPeriod(periodStart, periodEnd);
      }
    }
    autoGenerateCharges();
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
  const [escalationsDue, setEscalationsDue] = useState<any[]>([]);

useEffect(() => {
  async function checkEscalations() {
    const { detectEscalationsDue } = await import("@/lib/revenue/escalation-engine");
    const due = await detectEscalationsDue();
    setEscalationsDue(due);
  }
  checkEscalations();
}, []);

  async function loadCharges() {
    if (!selectedTenant) { setWorksheet([]); setPendingCharges([]); return; }
    const { data: charges } = await supabase.from("charges").select("*").eq("tenant_id", selectedTenant).eq("is_active", true);
    if (charges) {
      setWorksheet(charges.filter((c: any) => c.status === "posted"));
      setPendingCharges(charges.filter((c: any) => c.status === "pending_review" || c.status === "pending_approval"));
    }
  }

  useEffect(() => { loadCharges(); }, [selectedTenant]);

    useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (codeRef.current && !codeRef.current.contains(e.target as Node)) setShowCodeDropdown(null); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  async function loadHealth() {
    const health = await getMessageHealth();
    setMessageHealth(health);
  }
  loadHealth();
}, [distributionStarted, loading]);
useEffect(() => {
  getMessageHealth().then(data => {
    console.log("Message health data:", data);
    setMessageHealth(data);
  });
}, []);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  function selectBillingCode(lineId: string, bc: BillingCode) {
    setManualLines(manualLines.map(line => {
      if (line.id !== lineId) return line;
      return { ...line, billing_code: bc.code, description: bc.description, vat_rate: bc.vat_rate, gl_code: bc.gl_code, recoverable: bc.is_recoverable };
    }));
    setShowCodeDropdown(null); setCodeSearch("");
  }

  function updateManualAmount(lineId: string, field: "excl" | "vat" | "incl", value: number) {
    setManualLines(manualLines.map(line => {
      if (line.id !== lineId) return line;
      const rate = line.vat_rate / 100;
      let excl = line.amount_excl, vat = line.vat_amount, incl = line.amount_incl;
      if (field === "excl") { excl = value; vat = value * rate; incl = value + vat; }
      else if (field === "vat") { vat = value; excl = value / rate; incl = excl + vat; }
      else if (field === "incl") { incl = value; excl = value / (1 + rate); vat = incl - excl; }
      return { ...line, amount_excl: Math.round(excl * 100) / 100, vat_amount: Math.round(vat * 100) / 100, amount_incl: Math.round(incl * 100) / 100, editField: field };
    }));
  }

  function updateManualDescription(lineId: string, desc: string) {
    setManualLines(manualLines.map(l => l.id === lineId ? { ...l, description: desc } : l));
  }

  function addManualLine() {
    setManualLines([...manualLines, { id: String(Date.now()), billing_code: "", description: "", amount_excl: 0, vat_rate: 15, vat_amount: 0, amount_incl: 0, gl_code: "", recoverable: false, editField: "excl" }]);
  }

  function removeManualLine(id: string) {
    if (manualLines.length > 1) setManualLines(manualLines.filter(l => l.id !== id));
  }

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
    await loadCharges();
    setLoading(false);
  }

  async function handleApprovePending(chargeId: string) {
    await supabase.from("charges").update({ status: "posted", posted_at: new Date().toISOString() }).eq("id", chargeId);
    showToast("success", "Charge approved and posted.");
    await loadCharges();
  }

  function handleDistribute() {
    setShowDistributeConfirm(true);
  }

  function confirmDistribute() {
    setDistributionStarted(true);
    setShowDistributeConfirm(false);
    showToast("success", "Statements distributed. Receipting paused until period closes. You may continue adding charges and regenerating statements.");
    // Trigger communications for distributed invoices
triggerCommunication({
  tenant_id: "00000000-0000-0000-0000-000000000011", // Shoprite
  event_type: "invoice_distributed",
  source_type: "invoice",
  source_id: "INV-2026-045",
  merge_data: {
    tenant_name: "Shoprite SA",
    period: "July 2026",
    total: "97,500",
    link: "https://assetflow.app/invoices/INV-2026-045",
  },
}).then(id => console.log("Communication sent:", id));
  }

  function handleClosePeriod() {
    setShowClosePeriodConfirm(true);
  }

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
  const propertyOptions = properties.map(p => ({ id: p.id, label: p.property_name }));
  const tenantOptions = tenants.map(t => ({ id: t.id, label: t.tenant_name }));
  const periodOptions = ALLOWED_PERIODS.map(p => ({ id: p, label: p }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{toast.text}</div>
        </div>
      )}

      <PageHeader title="Revenue Operations" subtitle="Billing worksheets, manual charges, and statement distribution." />
{escalationsDue.length > 0 && (
  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4">
    <p className="text-xs uppercase tracking-[0.2em] text-blue-300 font-semibold">
      ⚡ {escalationsDue.length} Escalations Due — {new Date().toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
    </p>
    

    <div className="mt-2 space-y-1">
      {escalationsDue.map((esc, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">{esc.tenant_name} — {esc.rule_type}</span>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">R{esc.current_amount?.toLocaleString()} →</span>
            <span className="text-white font-medium">R{esc.new_amount?.toLocaleString()}</span>
            <span className="text-blue-400">({esc.escalation_percent}%)</span>
            <button className="text-xs text-emerald-400 hover:text-emerald-300 ml-2">Apply</button>
            <button className="text-xs text-zinc-500 hover:text-zinc-300">Skip</button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
      {messageHealth && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Message Health — Today</p>
          <div className="grid grid-cols-5 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <p className="text-2xl font-bold text-white">{messageHealth.today_total}</p>
              <p className="text-xs text-zinc-500">Sent</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{messageHealth.delivered}</p>
              <p className="text-xs text-zinc-500">Delivered</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{messageHealth.read}</p>
              <p className="text-xs text-zinc-500">Read</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{messageHealth.failed}</p>
              <p className="text-xs text-zinc-500">Failed</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{messageHealth.pending_retries}</p>
              <p className="text-xs text-zinc-500">Retrying</p>
            </div>
          </div>
        </div>
      )}

      {/* Receipting Locked Banner */}
      {/* Receipting Locked Banner */}
      {distributionStarted && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold">July statements distributed · Receipting paused</p>
          <p className="text-xs text-amber-400/70 mt-1">You may continue adding charges and regenerating statements. Receipting re-enables when the period is closed.</p>
        </div>
      )}

            {/* Billing Progress KPI Bar */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Billing Progress — {CURRENT_STATEMENT_PERIOD}</p>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <CustomDropdown
                value={filterType}
                options={[
                  { id: "all", label: "All Properties" },
                  { id: "property", label: "By Property" },
                  { id: "tenant", label: "By Tenant" },
                ]}
                onChange={(id) => { setFilterType(id); setFilterValue(""); }}
                placeholder="Filter..."
              />
            </div>
            {filterType === "property" && (
              <div className="w-56">
                <CustomDropdown
                  value={filterValue}
                  options={propertyOptions}
                  onChange={setFilterValue}
                  placeholder="Select property..."
                />
              </div>
            )}
            {filterType === "tenant" && (
              <div className="w-56">
                <CustomDropdown
                  value={filterValue}
                  options={allTenantOptions}
                  onChange={setFilterValue}
                  placeholder="Select tenant..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-2xl font-bold text-white">{billingStats.totalTenants}</p>
            <p className="text-xs text-zinc-500 mt-1">Total Tenants</p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-2xl font-bold text-blue-300">{billingStats.billed}</p>
            <p className="text-xs text-zinc-500 mt-1">Billed</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-2xl font-bold text-amber-300">{billingStats.outstanding}</p>
            <p className="text-xs text-zinc-500 mt-1">Outstanding</p>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-2xl font-bold text-red-300">{billingStats.blocked}</p>
            <p className="text-xs text-zinc-500 mt-1">Blocked</p>
          </div>
        </div>

        {/* Distribution description */}
        <p className="text-xs text-zinc-500 mt-4">
          {filterType === "all" && "Distributing to all tenants across all properties."}
          {filterType === "property" && (filterValue ? `Distributing to ${properties.find(p => p.id === filterValue)?.property_name || "selected property"}.` : "Select a property to distribute.")}
          {filterType === "tenant" && (filterValue ? `Distributing to ${allTenants.find(t => t.id === filterValue)?.tenant_name || "selected tenant"}.` : "Select a tenant to distribute.")}
        </p>
        {filterValue && filterType !== "all" && (
  <button
    onClick={() => setShowFullPreview(true)}
    className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
  >
    📋 Preview Distribution Report
  </button>
)}
<button
  onClick={() => setShowBulkSend(true)}
  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
>
  Bulk Arrears Reminder
</button>
      
        {/* Actions */}
        <div className="flex gap-3 mt-4">
          {!distributionStarted ? (
            <button onClick={handleDistribute} disabled={!filterValue && filterType !== "all"}
              className="flex-1 rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
              Distribute {filterType === "all" ? CURRENT_STATEMENT_PERIOD : filterType === "property" ? "Property" : "Tenant"} Statements
            </button>
          ) : billingStats.outstanding === 0 ? (
            <button onClick={handleClosePeriod} className="flex-1 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
              Close {CURRENT_STATEMENT_PERIOD} Period — Re-enable Receipting
            </button>
            
          ) : (
            <button onClick={handleDistribute} disabled={!filterValue && filterType !== "all"}
              className="flex-1 rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
              Distribute More Statements
            </button>
          )}
        </div>
        {distributionStarted && (
          <p className="text-xs text-zinc-600 mt-2 text-center">Receipting locked. Close period to re-enable.</p>
        )}
      </div>

      {/* New Manual Charge */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">New Manual Charge</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Property</label>
            <CustomDropdown value={selectedProperty} options={propertyOptions} onChange={(id) => { setSelectedProperty(id); setSelectedTenant(""); }} placeholder="Select property..." />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Tenant</label>
            <CustomDropdown value={selectedTenant} options={tenantOptions} onChange={setSelectedTenant} placeholder="Select tenant..." disabled={!selectedProperty} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Billing Period</label>
            <CustomDropdown value={selectedPeriod} options={periodOptions} onChange={setSelectedPeriod} placeholder="Select period..." />
            <p className="text-xs text-zinc-600 mt-1">Financial period: {CURRENT_FINANCIAL_PERIOD}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500 uppercase tracking-[0.15em]">
          <span className="w-40">Code</span><span className="flex-1">Description</span>
          <span className="w-24 text-right">Excl. VAT</span><span className="w-24 text-right">VAT</span><span className="w-24 text-right">Incl. VAT</span><span className="w-6"></span>
        </div>

        <div className="space-y-2 mb-4">
          {manualLines.map((line) => (
            <div key={line.id} className="flex items-center gap-2">
              <div className="relative w-40" ref={codeRef}>
                <button type="button" onClick={() => setShowCodeDropdown(showCodeDropdown === line.id ? null : line.id)}
                  className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-left outline-none focus:border-zinc-600">
                  {line.billing_code ? <span className="text-white font-mono">{line.billing_code}</span> : <span className="text-zinc-500">Add code...</span>}
                </button>
                {showCodeDropdown === line.id && (
                  <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <div className="p-2">
                      <input type="text" value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} placeholder="Search code or description..." autoFocus
                        className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    </div>
                    {filteredCodes.map(bc => (
                      <button key={bc.id} type="button" onClick={() => selectBillingCode(line.id, bc)}
                        className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${line.billing_code === bc.code ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}>
                        <span className="font-mono">{bc.code}</span><span className="text-zinc-500 ml-2">— {bc.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input type="text" value={line.description} onChange={(e) => updateManualDescription(line.id, e.target.value)} placeholder="Add description..."
                className="flex-1 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 placeholder:text-zinc-600" />
              <input type="number" step="0.01" value={line.amount_excl || ""} onChange={(e) => updateManualAmount(line.id, "excl", parseFloat(e.target.value) || 0)}
                className="w-24 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 tabular-nums text-right" placeholder="0.00" />
              <input type="number" step="0.01" value={line.vat_amount || ""} onChange={(e) => updateManualAmount(line.id, "vat", parseFloat(e.target.value) || 0)}
                className="w-24 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 tabular-nums text-right" placeholder="0.00" />
              <input type="number" step="0.01" value={line.amount_incl || ""} onChange={(e) => updateManualAmount(line.id, "incl", parseFloat(e.target.value) || 0)}
                className="w-24 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 tabular-nums text-right" placeholder="0.00" />
              <button onClick={() => removeManualLine(line.id)} disabled={manualLines.length <= 1} className="p-2 text-zinc-500 hover:text-red-400 disabled:opacity-30 text-xs">✕</button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addManualLine} className="text-xs text-blue-400 hover:text-blue-300">+ Add Row</button>
          <div className="text-xs text-zinc-500 tabular-nums">Excl: R{manualTotalExcl.toLocaleString()} · VAT: R{manualTotalVat.toLocaleString()} · Incl: R{manualTotalIncl.toLocaleString()}</div>
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

      {/* Pending Review */}
      {pendingCharges.length > 0 && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300 mb-4">Pending Review — {pendingCharges.length} charges</p>
          {pendingCharges.map((charge) => (
            <div key={charge.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 text-sm">
              <div><span className="text-white">{charge.description}</span><span className="text-zinc-500 text-xs ml-2 font-mono">({charge.gl_code})</span><span className="text-zinc-600 text-xs ml-2">{new Date(charge.created_at).toLocaleDateString()}</span></div>
              <div className="flex items-center gap-4">
                <span className="text-white tabular-nums font-medium">R{charge.amount_incl_vat?.toLocaleString()}</span>
                <button onClick={() => handleApprovePending(charge.id)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Approve & Post</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Billing Worksheet */}
      {selectedTenant && worksheet.length > 0 && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Billing Worksheet — {tenants.find(t => t.id === selectedTenant)?.tenant_name}</p>
          <div className="space-y-1 mb-4">
            {worksheet.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{item.charge_type === "adhoc" ? "Manual" : "Auto"}</span>
                  <span className="text-zinc-300">{item.description}</span><span className="text-zinc-600 text-xs font-mono">({item.gl_code})</span>
                </div>
                <div className="flex items-center gap-6 tabular-nums">
                  <span className="text-zinc-400 w-24 text-right">R{(item.amount_incl_vat / 1.15).toLocaleString()}</span>
                  <span className="text-zinc-500 w-20 text-right">R{(item.amount_incl_vat - item.amount_incl_vat / 1.15).toLocaleString()}</span>
                  <span className="text-white w-24 text-right font-medium">R{item.amount_incl_vat?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-zinc-700 pt-3 text-sm tabular-nums">
            <div className="flex items-center gap-6">
              <span className="text-zinc-400">Subtotal: <span className="text-white">R{wsExcl.toLocaleString()}</span></span>
              <span className="text-zinc-400">VAT: <span className="text-white">R{wsVat.toLocaleString()}</span></span>
              <span className="text-zinc-400">Total: <span className="text-white font-bold text-lg">R{wsIncl.toLocaleString()}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Distribute Confirmation Modal */}
      {showDistributeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowDistributeConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-md mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-white mb-2">Distribute {CURRENT_STATEMENT_PERIOD} Statements?</p>
            <p className="text-xs text-zinc-500 mb-4">Pre-distribution checks:</p>
            <div className="space-y-2 mb-4">
              {[{ label: "Unallocated receipts", ok: true }, { label: "Draft charges", ok: true }, { label: "Pending utility imports", ok: false, detail: "1 pending" }].map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{check.ok ? "✅" : "⚠️"}</span>
                  <span className={check.ok ? "text-zinc-300" : "text-amber-400"}>{check.label}</span>
                  {check.detail && <span className="text-xs text-zinc-500">({check.detail})</span>}
                </div>
              ))}
            </div>
            <p className="text-sm text-zinc-400 mb-4">Receipting will be paused until the period is closed. You may continue adding charges and regenerating statements.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDistributeConfirm(false)} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Cancel</button>
              <button onClick={confirmDistribute} className="rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500">Distribute Statements</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Period Confirmation Modal */}
      {showClosePeriodConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowClosePeriodConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-md mx-4 shadow-2xl p-6">
            <p className="text-sm font-semibold text-white mb-2">Close {CURRENT_STATEMENT_PERIOD} Statement Period?</p>
            <p className="text-sm text-zinc-400 mb-4">This will finalize all {CURRENT_STATEMENT_PERIOD} invoices, open the next period, and re-enable receipting.</p>
            <p className="text-xs text-amber-400 mb-4">⚠️ This cannot be undone. Invoices become immutable.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowClosePeriodConfirm(false)} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Cancel</button>
              <button onClick={confirmClosePeriod} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">Close Period & Re-enable Receipting</button>
            </div>
          </div>
        </div>
      )}
      {/* Full Distribution Preview Modal */}
{showFullPreview && (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowFullPreview(false)}>
    <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black z-10">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Distribution Preview</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {filterType === "property" ? properties.find(p => p.id === filterValue)?.property_name : allTenants.find(t => t.id === filterValue)?.tenant_name} — {CURRENT_STATEMENT_PERIOD}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white">
            🖨️ Print
          </button>
          <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white">
            📥 Export PDF
          </button>
          <button onClick={() => setShowFullPreview(false)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl">✕</button>
        </div>
      </div>

      {/* Consolidated Summary */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Billing Summary — {CURRENT_STATEMENT_PERIOD}</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Rental Income", excl: 192000, vat: 28800, incl: 220800 },
            { label: "Parking", excl: 6000, vat: 900, incl: 6900 },
            { label: "Electricity Recovery", excl: 8000, vat: 1200, incl: 9200 },
            { label: "Water Recovery", excl: 3000, vat: 450, incl: 3450 },
          ].map((row, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">{row.label}</p>
              <p className="text-lg font-bold text-white mt-1 tabular-nums">R{row.incl.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Excl: R{row.excl.toLocaleString()} · VAT: R{row.vat.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4 pt-3 border-t border-zinc-800">
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-1">Grand Total</p>
            <p className="text-3xl font-bold text-white tabular-nums">R240,350</p>
            <p className="text-xs text-zinc-500 mt-1">Excl VAT: R209,000 &nbsp;·&nbsp; VAT: R31,350 &nbsp;·&nbsp; Incl VAT: R240,350</p>
          </div>
        </div>
      </div>

      {/* Tenant-by-Tenant Breakdown */}
      <div className="px-6 py-5 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tenant Breakdown</p>
        {[
          { name: "Shoprite SA", lease: "LEASE-012", charges: [
            { desc: "Monthly Rental", code: "4100-001", excl: 85000, vat: 12750, incl: 97750 },
            { desc: "Parking (4 bays)", code: "4200-001", excl: 4000, vat: 600, incl: 4600 },
            { desc: "Electricity Recovery", code: "4300-001", excl: 8000, vat: 1200, incl: 9200 },
          ]},
          { name: "Woolworths", lease: "LEASE-003", charges: [
            { desc: "Monthly Rental", code: "4100-001", excl: 62000, vat: 9300, incl: 71300 },
            { desc: "Water Recovery", code: "4300-002", excl: 3000, vat: 450, incl: 3450 },
          ]},
          { name: "Clicks", lease: "LEASE-002", charges: [
            { desc: "Monthly Rental", code: "4100-001", excl: 45000, vat: 6750, incl: 51750 },
            { desc: "Parking (2 bays)", code: "4200-001", excl: 2000, vat: 300, incl: 2300 },
          ]},
        ].map((tenant, ti) => {
          const tExcl = tenant.charges.reduce((s, c) => s + c.excl, 0);
          const tVat = tenant.charges.reduce((s, c) => s + c.vat, 0);
          const tIncl = tenant.charges.reduce((s, c) => s + c.incl, 0);
          return (
            <div key={ti}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{tenant.name}</p>
                  <p className="text-xs text-zinc-500">{tenant.lease}</p>
                </div>
                <div className="flex items-center gap-4 text-xs tabular-nums">
                  <span className="text-zinc-500">Excl: <span className="text-zinc-300">R{tExcl.toLocaleString()}</span></span>
                  <span className="text-zinc-500">VAT: <span className="text-zinc-300">R{tVat.toLocaleString()}</span></span>
                  <span className="text-white font-medium">R{tIncl.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-1">
                {tenant.charges.map((c, ci) => (
                  <div key={ci} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/30">
                    <div>
                      <span className="text-zinc-400">{c.desc}</span>
                      <span className="text-zinc-600 font-mono ml-2">{c.code}</span>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums">
                      <span className="text-zinc-500 w-20 text-right">R{c.excl.toLocaleString()}</span>
                      <span className="text-zinc-500 w-20 text-right">R{c.vat.toLocaleString()}</span>
                      <span className="text-zinc-300 w-24 text-right">R{c.incl.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 sticky bottom-0 flex justify-between items-center">
        <p className="text-xs text-zinc-500">This preview will be saved and can be accessed from the billing history.</p>
        <button onClick={() => setShowFullPreview(false)} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Close</button>
      </div>
    </div>
  </div>
)}
      {/* Invoice Detail Modal */}
{previewTenant && (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewTenant(null)}>
    <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black z-10">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Invoice Preview</p>
          <p className="text-xs text-zinc-600 mt-0.5">{CURRENT_STATEMENT_PERIOD} — {previewTenant.name}</p>
        </div>
        <button onClick={() => setPreviewTenant(null)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl">✕</button>
      </div>

      <div className="px-6 py-5 space-y-3">
        {[
          { code: "4100-001", desc: "Monthly Rental", excl: 85000, vat: 12750, incl: 97750 },
          { code: "4200-001", desc: "Parking (4 bays)", excl: 4000, vat: 600, incl: 4600 },
          { code: "4300-001", desc: "Utility Recovery — Electricity", excl: 8000, vat: 1200, incl: 9200 },
        ].map((line, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-zinc-800/50">
            <div>
              <span className="text-zinc-300">{line.desc}</span>
              <span className="text-zinc-600 text-xs font-mono ml-2">{line.code}</span>
            </div>
            <div className="flex items-center gap-4 tabular-nums text-xs">
              <span className="text-zinc-500 w-20 text-right">R{line.excl.toLocaleString()}</span>
              <span className="text-zinc-500 w-20 text-right">R{line.vat.toLocaleString()}</span>
              <span className="text-white w-24 text-right font-medium">R{line.incl.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950">
        <div className="flex justify-end text-sm tabular-nums space-x-6">
          <span className="text-zinc-400">Subtotal: <span className="text-white">R{previewTenant.excl?.toLocaleString()}</span></span>
          <span className="text-zinc-400">VAT: <span className="text-white">R{previewTenant.vat?.toLocaleString()}</span></span>
          <span className="text-zinc-400">Total: <span className="text-white font-bold text-lg">R{previewTenant.incl?.toLocaleString()}</span></span>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
        <button onClick={() => setPreviewTenant(null)} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Close</button>
      </div>
    </div>
  </div>
)}
{/* Bulk Send Modal */}
{showBulkSend && (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowBulkSend(false)}>
    <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-md mx-4 shadow-2xl p-6">
      <p className="text-sm font-semibold text-white mb-2">Bulk Communication</p>
      <p className="text-xs text-zinc-500 mb-4">Send arrears reminders to all tenants with outstanding balances.</p>
      
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Event Type</label>
          <select value={bulkEventType} onChange={(e) => setBulkEventType(e.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600">
            <option value="payment_overdue">Arrears Reminder</option>
            <option value="lease_expiring">Lease Expiry Warning</option>
            <option value="statement_available">Statement Available</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        This will send messages to all tenants with {bulkEventType === "payment_overdue" ? "outstanding balances" : "active leases"}. 
        Only tenants with WhatsApp enabled will receive messages.
      </p>

      <div className="flex gap-3 justify-end">
        <button onClick={() => setShowBulkSend(false)} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">
          Cancel
        </button>
        <button
          onClick={async () => {
            setBulkSending(true);
            const { data: tenants } = await supabase
              .from("tenants")
              .select("id, tenant_name")
              .eq("whatsapp_enabled", true);
            
            let sent = 0;
            if (tenants) {
              for (const tenant of tenants) {
                await triggerCommunication({
                  tenant_id: tenant.id,
                  event_type: bulkEventType,
                  source_type: "bulk",
                  source_id: `BULK-${Date.now()}`,
                  merge_data: {
                    tenant_name: tenant.tenant_name,
                    amount: "outstanding",
                    period: "current",
                    link: "https://assetflow.app/statements",
                    lease_ref: "your lease",
                    expiry_date: "soon",
                  },
                });
                sent++;
              }
            }
            showToast("success", `Sent to ${sent} tenants.`);
            setBulkSending(false);
            setShowBulkSend(false);
          }}
          disabled={bulkSending}
          className="rounded-2xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
        >
          {bulkSending ? "Sending..." : "Send to All"}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}