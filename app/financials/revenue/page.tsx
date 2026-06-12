"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";

// Replace the existing header div with:
<PageHeader
  title="Revenue Operations"
  subtitle="Billing worksheets, manual charges, and invoice generation."
/>

type GLCodes = { id: string; code: string; description: string; category: string };
type BillingCode = { id: string; code: string; description: string; vat_rate: number; gl_code: string; is_recoverable: boolean };
type ManualLine = {
  id: string;
  billing_code: string;
  description: string;
  amount_excl: number;
  vat_rate: number;
  vat_amount: number;
  amount_incl: number;
  gl_code: string;
  recoverable: boolean;
  editField: "excl" | "vat" | "incl";
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
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
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
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === opt.id ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}>
              {opt.label}
            </button>
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
    function handleClickOutside(e: MouseEvent) {
      if (codeRef.current && !codeRef.current.contains(e.target as Node)) setShowCodeDropdown(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    setShowCodeDropdown(null);
    setCodeSearch("");
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
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${
            toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"
          }`}>
            {toast.text}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Financial Operations</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Revenue Operations</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">Billing worksheets, manual charges, and invoice generation.</p>
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

        {/* Column Headers */}
        <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500 uppercase tracking-[0.15em]">
          <span className="w-40">Code</span>
          <span className="flex-1">Description</span>
          <span className="w-24 text-right">Excl. VAT</span>
          <span className="w-24 text-right">VAT</span>
          <span className="w-24 text-right">Incl. VAT</span>
          <span className="w-6"></span>
        </div>

        {/* Manual Lines */}
        <div className="space-y-2 mb-4">
          {manualLines.map((line) => (
            <div key={line.id} className="flex items-center gap-2">
              {/* Combined Code Selector */}
              <div className="relative w-40" ref={codeRef}>
                <button type="button" onClick={() => setShowCodeDropdown(showCodeDropdown === line.id ? null : line.id)}
                  className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-left outline-none focus:border-zinc-600">
                  {line.billing_code ? (
                    <span className="text-white font-mono">{line.billing_code}</span>
                  ) : (
                    <span className="text-zinc-500">Add code...</span>
                  )}
                </button>
                {showCodeDropdown === line.id && (
                  <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <div className="p-2">
                      <input type="text" value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)}
                        placeholder="Search code or description..." autoFocus
                        className="w-full rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" />
                    </div>
                    {filteredCodes.map(bc => (
                      <button key={bc.id} type="button" onClick={() => selectBillingCode(line.id, bc)}
                        className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${line.billing_code === bc.code ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}>
                        <span className="font-mono">{bc.code}</span>
                        <span className="text-zinc-500 ml-2">— {bc.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input type="text" value={line.description} onChange={(e) => updateManualDescription(line.id, e.target.value)}
                placeholder="Add description..." className="flex-1 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 placeholder:text-zinc-600" />

              <input type="number" step="0.01" value={line.amount_excl || ""} onChange={(e) => updateManualAmount(line.id, "excl", parseFloat(e.target.value) || 0)}
                className="w-24 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 tabular-nums text-right" placeholder="0.00" />
              <input type="number" step="0.01" value={line.vat_amount || ""} onChange={(e) => updateManualAmount(line.id, "vat", parseFloat(e.target.value) || 0)}
                className="w-24 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 tabular-nums text-right" placeholder="0.00" />
              <input type="number" step="0.01" value={line.amount_incl || ""} onChange={(e) => updateManualAmount(line.id, "incl", parseFloat(e.target.value) || 0)}
                className="w-24 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-zinc-600 tabular-nums text-right" placeholder="0.00" />

              <button onClick={() => removeManualLine(line.id)} disabled={manualLines.length <= 1}
                className="p-2 text-zinc-500 hover:text-red-400 disabled:opacity-30 text-xs">✕</button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addManualLine} className="text-xs text-blue-400 hover:text-blue-300">+ Add Row</button>
          <div className="text-xs text-zinc-500 tabular-nums">
            Excl: R{manualTotalExcl.toLocaleString()} · VAT: R{manualTotalVat.toLocaleString()} · Incl: R{manualTotalIncl.toLocaleString()}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={() => handleSave("pending_review")} disabled={!selectedTenant || manualTotalExcl === 0 || loading}
            className="flex-1 rounded-2xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
            Save for Review
          </button>
          {canPostDirectly && (
            <button onClick={() => handleSave("posted")} disabled={!selectedTenant || manualTotalExcl === 0 || loading}
              className="flex-1 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
              Post Immediately
            </button>
          )}
        </div>
      </div>

      {/* Pending Review */}
      {pendingCharges.length > 0 && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300 mb-4">Pending Review — {pendingCharges.length} charges</p>
          {pendingCharges.map((charge) => (
            <div key={charge.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 text-sm">
              <div>
                <span className="text-white">{charge.description}</span>
                <span className="text-zinc-500 text-xs ml-2 font-mono">({charge.gl_code})</span>
                <span className="text-zinc-600 text-xs ml-2">{new Date(charge.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white tabular-nums font-medium">R{charge.amount_incl_vat?.toLocaleString()}</span>
                <button onClick={() => handleApprovePending(charge.id)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
                  Approve & Post
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Billing Worksheet */}
      {selectedTenant && worksheet.length > 0 && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">
            Billing Worksheet — {tenants.find(t => t.id === selectedTenant)?.tenant_name}
          </p>

          <div className="space-y-1 mb-4">
            {worksheet.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{item.charge_type === "adhoc" ? "Manual" : "Auto"}</span>
                  <span className="text-zinc-300">{item.description}</span>
                  <span className="text-zinc-600 text-xs font-mono">({item.gl_code})</span>
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
    </div>
  );
}