"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Minus, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { triggerCommunication } from "@/lib/communications/communication-service";
import { logAudit } from "@/lib/audit/audit-log";

type Property = {
  id: string;
  property_name: string;
  property_code?: string;
  entity_id?: string;
};

type Tenant = {
  id: string;
  tenant_name: string;
  tenant_code?: string;
  entity_id?: string;
  lease_id?: string;
  property_id?: string;
};

type SplitLine = {
  id: string;
  amount: number;
  type: "Receipt" | "Deposit" | "Other";
  ledger: string;
};

type Transaction = {
  id: string;
  transaction_date: string;
  transaction_description: string;
  transaction_amount: number;
  transaction_reference?: string;
  queue?: string;
  entity_id?: string;
  allocation_status?: string;
  matched_tenant_id?: string;
  matched_invoice_id?: string;
  property_id?: string;
  reconciliation_notes?: string;
  updated_at?: string;
};

interface Props {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onPosted: () => void;
}

export function TransactionReviewModal({ open, transaction, onClose, onPosted }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allocationType, setAllocationType] = useState<"tenant" | "property">("tenant");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedLease, setSelectedLease] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showSplit, setShowSplit] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([
    { id: "1", amount: 0, type: "Receipt", ledger: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const [tenantSearch, setTenantSearch] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [tenantSearchBy, setTenantSearchBy] = useState("tenant_name");
  const [propertySearchBy, setPropertySearchBy] = useState("property_name");
  const [showTenantFilter, setShowTenantFilter] = useState(false);
  const [showPropertyFilter, setShowPropertyFilter] = useState(false);
  const propertyRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);
  const tenantFilterRef = useRef<HTMLDivElement>(null);
  const propertyFilterRef = useRef<HTMLDivElement>(null);

  const transactionAmount = transaction?.transaction_amount || 0;
  const isDeposit = transactionAmount >= 0;
  const isPosted = transaction?.allocation_status === "posted" || transaction?.queue === "posted";
  const splitTotal = splitLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const remaining = transactionAmount - splitTotal;

  const filteredProperties = properties.filter((p) =>
    !propertySearch ||
    p.property_name?.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.property_code?.toLowerCase().includes(propertySearch.toLowerCase())
  );

  const filteredTenants = tenants.filter((t) => {
    if (!tenantSearch) return true;
    const search = tenantSearch.toLowerCase();
    if (tenantSearchBy === "tenant_name") {
      return t.tenant_name?.toLowerCase().includes(search);
    }
    if (tenantSearchBy === "tenant_code") {
      return (t.tenant_code || "").toLowerCase().includes(search);
    }
    if (tenantSearchBy === "property_name") {
      const prop = properties.find(p => p.id === t.property_id);
      return prop?.property_name?.toLowerCase().includes(search) || false;
    }
    return true;
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (propertyRef.current && !propertyRef.current.contains(event.target as Node)) {
        setShowPropertyDropdown(false);
      }
      if (tenantRef.current && !tenantRef.current.contains(event.target as Node)) {
        setShowTenantDropdown(false);
      }
      if (tenantFilterRef.current && !tenantFilterRef.current.contains(event.target as Node)) {
        setShowTenantFilter(false);
      }
      if (propertyFilterRef.current && !propertyFilterRef.current.contains(event.target as Node)) {
        setShowPropertyFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("properties")
        .select("id, property_name, property_code")
        .order("property_name");
      if (data) setProperties(data);
    }
    if (open) load();
  }, [open]);

  useEffect(() => {
    async function loadTenants() {
      const { data: leases } = await supabase
        .from("leases")
        .select("id, lease_id, property_id, tenant_id, tenant_name")
        .not("tenant_id", "is", null);

      if (leases) {
        const mapped = leases.map((lease: any) => ({
          id: lease.tenant_id,
          tenant_name: lease.tenant_name || "Unknown",
          lease_id: lease.lease_id || lease.id,
          property_id: lease.property_id,
        }));
        const unique = new Map();
        mapped.forEach((t: any) => unique.set(t.id, t));
        setTenants(Array.from(unique.values()));
      }
    }
    if (open) loadTenants();
  }, [open]);

  useEffect(() => {
    async function findLease() {
      if (!selectedTenant) { setSelectedLease(""); return; }
      let query = supabase.from("leases").select("id, lease_id").eq("tenant_id", selectedTenant);
      if (selectedProperty) query = query.eq("property_id", selectedProperty);
      const { data } = await query.limit(1);
      if (data && data.length > 0) setSelectedLease(data[0].lease_id || data[0].id);
    }
    findLease();
  }, [selectedTenant, selectedProperty]);

  const handleAddSplitLine = () => {
    setSplitLines([...splitLines, { id: String(Date.now()), amount: 0, type: "Receipt", ledger: "" }]);
  };

  const handleRemoveSplitLine = (id: string) => {
    if (splitLines.length > 1) setSplitLines(splitLines.filter((line) => line.id !== id));
  };

  const handleSplitLineChange = (id: string, field: keyof SplitLine, value: string | number) => {
    setSplitLines(splitLines.map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  };

  const handleFillRemainder = (id: string) => {
    if (remaining > 0) {
      setSplitLines(splitLines.map((line) => (line.id === id ? { ...line, amount: line.amount + remaining } : line)));
    }
  };

  const handleSave = async (status: string) => {
    if (!transaction || isPosted) return;
    setIsSaving(true);
    const updateData: any = {
      allocation_status: status === "posted" ? "posted" : status === "escalated" ? "escalated" : "review",
      queue: status === "posted" ? "posted" : status === "escalated" ? "escalated" : "review",
      matched_tenant_id: allocationType === "tenant" ? selectedTenant || null : null,
      property_id: selectedProperty || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bank_transactions").update(updateData).eq("id", transaction.id);
   if (error) { 
  console.error("Save error:", error); 
} else { 
  await logAudit({
    action: "approve",
    resource_type: "transaction",
    resource_id: transaction?.id || "",
    resource_label: `SYS-${transaction?.id?.slice(0, 8) || "unknown"}`,
    new_values: { status, amount: Math.abs(transactionAmount) },
  });
  onPosted(); 
  onClose(); 
}
        // Trigger receipt communication if posted
    if (status === "posted" && selectedTenant) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("tenant_name")
        .eq("id", selectedTenant)
        .single();

      triggerCommunication({
        tenant_id: selectedTenant,
        event_type: "receipt_issued",
        source_type: "receipt",
        source_id: transaction?.id || "",
        merge_data: {
          tenant_name: tenant?.tenant_name || "Tenant",
          amount: Math.abs(transactionAmount).toLocaleString(),
          reference: `SYS-${transaction?.id?.slice(0, 8) || "unknown"}`,
        },
      });
    }
    setIsSaving(false);
  };

  const isValid = selectedProperty && (allocationType === "tenant" ? selectedTenant : selectedCategory) && (!showSplit || Math.abs(remaining) < 0.01);

  if (!open || !transaction) return null;

  // VIEW MODE — Posted transactions
  if (isPosted) {
    const matchedTenant = tenants.find(t => t.id === transaction.matched_tenant_id);
    const matchedProperty = properties.find(p => p.id === transaction.property_id);

    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black z-10">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Transaction Details</p>
              <p className="text-xs text-zinc-600 mt-0.5 font-mono">SYS-{transaction.id?.slice(0, 8)}</p>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">{transaction.transaction_date}</p>
                <p className="text-white font-medium mt-1">{transaction.transaction_description}</p>
                {transaction.transaction_reference && <p className="text-xs text-zinc-500 mt-0.5">Ref: {transaction.transaction_reference}</p>}
              </div>
              <p className="text-xl font-bold text-white tabular-nums">R{Math.abs(transactionAmount).toLocaleString()}</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-xs text-zinc-500">Status</p>
              <p className="text-sm text-emerald-300 font-medium mt-0.5">Posted & Reconciled</p>
            </div>

            {matchedProperty && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <p className="text-xs text-zinc-500">Property</p>
                <p className="text-sm text-white mt-0.5">{matchedProperty.property_name}</p>
              </div>
            )}

            {matchedTenant && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <p className="text-xs text-zinc-500">Tenant</p>
                <p className="text-sm text-white mt-0.5">{matchedTenant.tenant_name}</p>
                {selectedLease && <p className="text-xs text-zinc-500 mt-0.5">Lease: {selectedLease}</p>}
              </div>
            )}

            {transaction.matched_invoice_id && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <p className="text-xs text-zinc-500">Matched Invoice</p>
                <p className="text-sm text-blue-300 font-mono mt-0.5">{transaction.matched_invoice_id}</p>
              </div>
            )}

            {transaction.reconciliation_notes && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <p className="text-xs text-zinc-500">Match Reason</p>
                <p className="text-sm text-zinc-300 mt-0.5">{transaction.reconciliation_notes}</p>
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <p className="text-xs text-zinc-500">Audit Trail</p>
              <p className="text-sm text-zinc-400 mt-0.5">Posted on {transaction.updated_at ? new Date(transaction.updated_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown"}</p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
            <button onClick={onClose} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Close</button>
          </div>
        </div>
      </div>
    );
  }

  // EDIT MODE — Unreconciled transactions
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-black border border-zinc-800 rounded-3xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black z-20">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Review Transaction</p>
            <p className="text-xs text-zinc-600 mt-0.5 font-mono">SYS-{transaction.id?.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">{transaction.transaction_date}</p>
              <p className="text-white font-medium mt-1">{transaction.transaction_description}</p>
              {transaction.transaction_reference && <p className="text-xs text-zinc-500 mt-0.5">Ref: {transaction.transaction_reference}</p>}
            </div>
            <p className="text-xl font-bold text-white tabular-nums">R{Math.abs(transactionAmount).toLocaleString()}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Allocate to</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAllocationType("tenant")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${allocationType === "tenant" ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>Tenant</button>
              <button type="button" onClick={() => setAllocationType("property")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${allocationType === "property" ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>Property</button>
            </div>
          </div>

          {allocationType === "tenant" && (
            <div ref={tenantRef} className="relative">
              <label className="block text-xs text-zinc-500 mb-1.5">Tenant</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input type="text" value={tenantSearch} onChange={(e) => { setTenantSearch(e.target.value); setSelectedTenant(""); setShowTenantDropdown(true); }} onFocus={() => setShowTenantDropdown(true)} placeholder="Search..." className="w-full rounded-2xl border border-zinc-800 bg-black/40 pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                </div>
                <div className="relative" ref={tenantFilterRef}>
                  <button type="button" onClick={() => setShowTenantFilter(!showTenantFilter)} className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 flex items-center gap-1">
                    {tenantSearchBy === "tenant_name" ? "Tenant Name" : tenantSearchBy === "tenant_code" ? "Tenant Code" : "Property Name"}
                    <span className="text-zinc-500 text-xs ml-1">▼</span>
                  </button>
                  {showTenantFilter && (
                    <div className="absolute right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden min-w-[160px]">
                      {["tenant_name", "tenant_code", "property_name"].map((opt) => (
                        <button key={opt} type="button" onClick={() => { setTenantSearchBy(opt); setShowTenantFilter(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${tenantSearchBy === opt ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}>
                          {opt === "tenant_name" ? "Tenant Name" : opt === "tenant_code" ? "Tenant Code" : "Property Name"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {showTenantDropdown && (
                <div className="absolute z-30 mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-48 overflow-y-auto">
                  {filteredTenants.length === 0 ? <p className="px-4 py-3 text-sm text-zinc-500">No tenants found</p> : filteredTenants.map((t) => (
                    <button key={t.id} type="button" onClick={() => { setSelectedTenant(t.id); setSelectedProperty(t.property_id || ""); setTenantSearch(t.tenant_name); setShowTenantDropdown(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors">
                      <span className="text-zinc-200">{t.tenant_name}</span>
                      <span className="text-zinc-500 text-xs ml-2">{properties.find(p => p.id === t.property_id)?.property_name || ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {allocationType === "property" && (
            <>
              <div ref={propertyRef} className="relative">
                <label className="block text-xs text-zinc-500 mb-1.5">Property</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input type="text" value={propertySearch} onChange={(e) => { setPropertySearch(e.target.value); setSelectedProperty(""); setShowPropertyDropdown(true); }} onFocus={() => setShowPropertyDropdown(true)} placeholder="Search..." className="w-full rounded-2xl border border-zinc-800 bg-black/40 pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                  </div>
                  <div className="relative" ref={propertyFilterRef}>
                    <button type="button" onClick={() => setShowPropertyFilter(!showPropertyFilter)} className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600 flex items-center gap-1">
                      {propertySearchBy === "property_name" ? "Property Name" : "Property Code"}
                      <span className="text-zinc-500 text-xs ml-1">▼</span>
                    </button>
                    {showPropertyFilter && (
                      <div className="absolute right-0 z-40 mt-1 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden min-w-[160px]">
                        {["property_name", "property_code"].map((opt) => (
                          <button key={opt} type="button" onClick={() => { setPropertySearchBy(opt); setShowPropertyFilter(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${propertySearchBy === opt ? "bg-white text-black font-medium" : "text-zinc-300 hover:bg-zinc-800"}`}>
                            {opt === "property_name" ? "Property Name" : "Property Code"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {showPropertyDropdown && (
                  <div className="absolute z-30 mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-48 overflow-y-auto">
                    {filteredProperties.length === 0 ? <p className="px-4 py-3 text-sm text-zinc-500">No properties found</p> : filteredProperties.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setSelectedProperty(p.id); setPropertySearch(p.property_name); setShowPropertyDropdown(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 transition-colors flex items-center justify-between">
                        <span className="text-zinc-200">{p.property_name}</span>
                        {p.property_code && <span className="text-xs text-zinc-500 font-mono">{p.property_code}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Category</label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zinc-600">
                  <option value="">Select category...</option>
                  <option value="insurance">Insurance Recovery</option>
                  <option value="parking">Parking Income</option>
                  <option value="sundry">Sundry Income</option>
                  <option value="interest">Interest Received</option>
                  <option value="refund">Refund / Credit</option>
                  <option value="other">Other Income</option>
                </select>
              </div>
            </>
          )}

          {allocationType === "tenant" && selectedTenant && selectedProperty && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-xs text-zinc-500">Linked Lease</p>
              <p className="text-sm text-emerald-300 font-mono mt-0.5">{selectedLease || "Finding lease..."}</p>
              <p className="text-xs text-zinc-500 mt-1">System will auto-allocate per invoice billing structure</p>
            </div>
          )}

          <div>
            <button type="button" onClick={() => setShowSplit(!showSplit)} className={`text-xs transition-colors ${showSplit ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"}`}>
              {showSplit ? "— Remove Split" : "+ Split Allocation"}
            </button>
          </div>

          {showSplit && (
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <p className="text-xs text-zinc-500">Split Breakdown</p>
              {splitLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <input type="number" step="0.01" value={line.amount || ""} onChange={(e) => handleSplitLineChange(line.id, "amount", parseFloat(e.target.value) || 0)} className="w-28 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600 tabular-nums" placeholder="Amount" />
                  <select value={line.type} onChange={(e) => handleSplitLineChange(line.id, "type", e.target.value)} className="flex-1 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600">
                    <option value="Receipt">Receipt</option>
                    <option value="Deposit">Deposit</option>
                    <option value="Other">Other</option>
                  </select>
                  <input type="text" value={line.ledger} onChange={(e) => handleSplitLineChange(line.id, "ledger", e.target.value)} className="w-32 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-zinc-600" placeholder="Ledger" />
                  <button type="button" onClick={() => handleFillRemainder(line.id)} className="text-xs text-blue-400 hover:text-blue-300 px-1">Fill</button>
                  <button type="button" onClick={() => handleRemoveSplitLine(line.id)} disabled={splitLines.length <= 1} className="p-1 text-zinc-500 hover:text-red-400 disabled:opacity-30"><Minus className="w-3 h-3" /></button>
                </div>
              ))}
              <button type="button" onClick={handleAddSplitLine} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"><Plus className="w-3 h-3" />Add Line</button>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Split Total: R{splitTotal.toLocaleString()}</span>
                {remaining !== 0 && <span className="text-amber-400">Remaining: R{remaining.toLocaleString()}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex justify-between items-center sticky bottom-0 bg-black z-20">
          <button onClick={() => handleSave("escalated")} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20">Escalate</button>
          <div className="flex gap-3">
            <button onClick={() => handleSave("review")} className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white">Save for Later</button>
            <button onClick={() => handleSave("posted")} disabled={!isValid || isSaving} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              {isSaving ? "Posting..." : isDeposit ? "Approve & Receipt" : "Approve & Reconcile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}