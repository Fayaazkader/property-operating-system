"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { generateChargesFromRules } from "@/lib/revenue/charge-generator";
import { triggerCommunication } from "@/lib/communications/communication-service";
import { getMessageHealth } from "@/lib/communications/communication-service";
import { logAudit } from "@/lib/audit/audit-log";
import { getCurrentStatementPeriod, getCurrentFinancialPeriod } from "@/lib/revenue/period-utils";
import { useRouter } from "next/navigation";
import ProgressModal from "@/components/ui/ProgressModal";
import PreBillingVerification from "@/components/financials/PreBillingVerification";

type BillingCode = { id: string; code: string; description: string; vat_rate: number; gl_code: string; is_recoverable: boolean };
type ManualLine = {
  id: string; billing_code: string; description: string; amount_excl: number; vat_rate: number; vat_amount: number; amount_incl: number; gl_code: string; recoverable: boolean; editField: "excl" | "vat" | "incl";
};

type ChargeDetail = {
  description: string;
  amount_excl: number;
  vat_amount: number;
  amount_incl: number;
  gl_code: string;
};

type BillingPreviewItem = {
  entity: string;
  property: string;
  tenant: string;
  total: number;
  charges: ChargeDetail[];
};

type LeaseWithRelations = {
  id: string;
  tenant_id: string;
  property_id: string;
  entity_id: string;
  monthly_rental: number;
  lease_status: string;
  tenants: { tenant_name: string } | null;
  properties: { property_name: string; entity_id: string } | null;
  entities: { entity_name: string } | null;
};

export default function RevenueOperationsPage() {
  // ===== STATE =====
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [leasesData, setLeasesData] = useState<any[]>([]);
  const [progressModal, setProgressModal] = useState<{ title: string; steps: any[] } | null>(null);
  const [showPreBillingPreview, setShowPreBillingPreview] = useState(false);
  

  // Scope
  const [viewBy, setViewBy] = useState<"all" | "entity" | "property" | "region" | "propertyType" | "tenantGroup" | "tenant">("all");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedPropertyType, setSelectedPropertyType] = useState("");
  const [selectedTenantGroup, setSelectedTenantGroup] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");

  // Data
  const [entities, setEntities] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<any[]>([]);
  const [tenantGroups, setTenantGroups] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [billingCodes, setBillingCodes] = useState<BillingCode[]>([]);

  // Revenue Health
  const [health, setHealth] = useState({
    activeLeases: 0,
    expectedRevenue: 0,
    billed: 0,
    notBilled: 0,
    sent: 0,
    notSent: 0,
  });

  // Billing Exceptions
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [showExceptions, setShowExceptions] = useState(false);

  // Billing Preview
  const [billingPreviewSummary, setBillingPreviewSummary] = useState<any[]>([]);
  const [billingPreviewDetail, setBillingPreviewDetail] = useState<BillingPreviewItem[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewPeriod, setPreviewPeriod] = useState("current");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Drilldown state
  const [drilldownData, setDrilldownData] = useState<any[]>([]);
  const [drilldownVisible, setDrilldownVisible] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");

  // Period
  const [currentStmtPeriod, setCurrentStmtPeriod] = useState("July 2026");
  const [currentFinPeriod, setCurrentFinPeriod] = useState("June 2026");
  const [stmtStart, setStmtStart] = useState("2026-07-01");
  const [stmtEnd, setStmtEnd] = useState("2026-07-31");
  const [allowedPeriods, setAllowedPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");

  // Manual charge
  const [showNewCharge, setShowNewCharge] = useState(false);
  const [manualLines, setManualLines] = useState<ManualLine[]>([
    { id: "1", billing_code: "", description: "", amount_excl: 0, vat_rate: 15, vat_amount: 0, amount_incl: 0, gl_code: "", recoverable: false, editField: "excl" },
  ]);
  const [codeSearch, setCodeSearch] = useState("");
  const [showCodeDropdown, setShowCodeDropdown] = useState<string | null>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  // Utility import
  const [showUtilityImport, setShowUtilityImport] = useState(false);
  const [utilityFile, setUtilityFile] = useState<File | null>(null);
  const [utilityPreview, setUtilityPreview] = useState<any[]>([]);
  const [utilityExceptions, setUtilityExceptions] = useState<any[]>([]);

  // Statements
  const [showStatements, setShowStatements] = useState(false);
  const [statementResults, setStatementResults] = useState<{ delivered: number; failed: number; pending: number } | null>(null);
const [channelCounts, setChannelCounts] = useState({ email: 0, whatsapp: 0 });
  // Message health
  const [messageHealth, setMessageHealth] = useState<any>(null);
console.log("handleGenerateStatements exists:", typeof handleGenerateStatements);
  // ===== LOAD FUNCTIONS =====
  async function loadScopeData() {
    const { data: entityIds } = await supabase.rpc('auth_entities');
const [entitiesRes, propsRes, regionsRes, typesRes, groupsRes, tenantsRes] = await Promise.all([
  entityIds && entityIds.length > 0 
    ? supabase.from("entities").select("id, entity_name").in("id", entityIds).order("entity_name")
    : { data: [] },
      supabase.from("properties").select("id, property_name, entity_id, city, province, property_type").order("property_name"),
      supabase.from("properties").select("province").order("province"),
      supabase.from("properties").select("property_type").order("property_type"),
      supabase.from("tenant_groups").select("id, group_name").order("group_name"),
      supabase.from("tenants").select("id, tenant_name, entity_id").order("tenant_name"),
    ]);

    if (entitiesRes.data) setEntities(entitiesRes.data);
    if (propsRes.data) setProperties(propsRes.data);
    if (regionsRes.data) {
      const uniqueRegions = [...new Set(regionsRes.data.map((r: any) => r.province).filter(Boolean))];
      setRegions(uniqueRegions.map((r: any) => ({ id: r, name: r })));
    }
    if (typesRes.data) {
      const uniqueTypes = [...new Set(typesRes.data.map((t: any) => t.property_type).filter(Boolean))];
      setPropertyTypes(uniqueTypes.map((t: any) => ({ id: t, name: t })));
    }
    if (groupsRes.data) setTenantGroups(groupsRes.data);
    if (tenantsRes.data) setTenants(tenantsRes.data);

    const { data: codes } = await supabase.from("billing_codes").select("*").eq("is_active", true).order("code");
    if (codes) setBillingCodes(codes);

    const stmt = await getCurrentStatementPeriod();
    const fin = await getCurrentFinancialPeriod();
    setCurrentStmtPeriod(stmt.name);
    setCurrentFinPeriod(fin.name);
    setStmtStart(stmt.start);
    setStmtEnd(stmt.end);
    const periods = [...new Set([fin.name, stmt.name])];
    setAllowedPeriods(periods);
    setSelectedPeriod(stmt.name);

    getMessageHealth().then(setMessageHealth);
  }

  // ===== OPTIMIZED REVENUE HEALTH =====
  async function loadRevenueHealth() {
    const { data: userData } = await supabase.auth.getUser();
console.log("user ID:", userData.user?.id);
  let query = supabase
  .from("leases")
  .select(`
  id,
  tenant_id,
  property_id,
  owner_entity_id,
  monthly_rental,
  lease_status
  
`)
  .eq("lease_status", "Active");
  const { data: userEntityIds } = await supabase.rpc('auth_entities');
if (userEntityIds && userEntityIds.length > 0) {
  query = query.in("owner_entity_id", userEntityIds);
}

console.log("viewBy:", viewBy, "selectedEntity:", selectedEntity);

if (viewBy === "entity" && selectedEntity) {
  query = query.eq("owner_entity_id", selectedEntity);
} else if (viewBy === "property" && selectedProperty) {
      query = query.eq("property_id", selectedProperty);
    } else if (viewBy === "tenant" && selectedTenant) {
      query = query.eq("tenant_id", selectedTenant);
    } else if (viewBy === "region" && selectedRegion) {
      const regionProps = properties.filter(p => p.province === selectedRegion).map(p => p.id);
      if (regionProps.length > 0) query = query.in("property_id", regionProps);
    } else if (viewBy === "propertyType" && selectedPropertyType) {
      const typeProps = properties.filter(p => p.property_type === selectedPropertyType).map(p => p.id);
      if (typeProps.length > 0) query = query.in("property_id", typeProps);
    }
console.log("VIEW BY:", viewBy);
console.log("SELECTED ENTITY:", selectedEntity);
console.log("QUERY FILTER RUNNING");
    const { data: leases, error } = await query;
    setLeasesData(leases || []);
console.log(
  "LEASES RETURNED:",
  leases?.length
);
console.log("LEASES:", leases);

    if (!leases || leases.length === 0) {
      setHealth({ activeLeases: 0, expectedRevenue: 0, billed: 0, notBilled: 0, sent: 0, notSent: 0 });
      setExceptions([]);
      setBillingPreviewSummary([]);
      setBillingPreviewDetail([]);
      
      return;
    }

    const leaseIds = leases.map((l: any) => l.id);
    const tenantIds = leases.map((l: any) => l.tenant_id).filter(Boolean);

    const { data: charges } = await supabase
      .from("charges")
      .select("lease_id, amount_excl_vat, vat_amount, amount_incl_vat, status, billing_period, charge_type, description, gl_code")
      .in("lease_id", leaseIds)
      .eq("billing_period", currentStmtPeriod);

    const { data: communications } = await supabase
      .from("communications")
      .select("tenant_id, source_id")
      .in("tenant_id", tenantIds)
      .eq("event_type", "statement_available")
      .eq("source_id", `INV-${currentStmtPeriod}`);

    const { data: billingRules } = await supabase
  .from("billing_rules")
  .select("lease_id, status, base_amount")
  .in("lease_id", leaseIds);

    const chargeMap = new Map();
    charges?.forEach((c: any) => {
      if (!chargeMap.has(c.lease_id)) chargeMap.set(c.lease_id, []);
      chargeMap.get(c.lease_id).push(c);
    });

    const commMap = new Set(communications?.map((c: any) => c.tenant_id) || []);
    const { data: channelData } = await supabase
  .from("tenants")
  .select("email_enabled, whatsapp_enabled")
  .in("id", tenantIds);

if (channelData) {
  setChannelCounts({
    email: channelData.filter((t: any) => t.email_enabled).length,
    whatsapp: channelData.filter((t: any) => t.whatsapp_enabled).length,
  });
}
    const ruleMap = new Map();
    billingRules?.forEach((r: any) => {
      if (!ruleMap.has(r.lease_id)) ruleMap.set(r.lease_id, []);
      ruleMap.get(r.lease_id).push(r);
    });

    let billed = 0, notBilled = 0, sent = 0, notSent = 0;
    const exceptionList: any[] = [];
    const detailItems: BillingPreviewItem[] = [];
    const summaryTotals: Record<string, number> = {};

    for (const lease of leases) {
      const leaseCharges = chargeMap.get(lease.id) || [];
      const hasCharges = leaseCharges.length > 0;
      const hasCommunications = commMap.has(lease.tenant_id);
      const hasRules = (ruleMap.get(lease.id) || []).some((r: any) => r.status === 'active');
      
     const entityName = (lease as any).entity?.entity_name || "Unknown Entity";
const propertyName = (lease as any).properties?.property_name || "Unknown Property";
const tenantName = (lease as any).tenants?.tenant_name || "Unknown";
      if (hasCharges) {
        billed++;
        if (hasCommunications) {
          sent++;
        } else {
          notSent++;
        }
        leaseCharges.forEach((c: any) => {
          const type = c.charge_type || c.description || "Other";
          summaryTotals[type] = (summaryTotals[type] || 0) + (c.amount_incl_vat || 0);
        });
        const total = leaseCharges.reduce((sum: number, c: any) => sum + (c.amount_incl_vat || 0), 0);
        const chargeDetails: ChargeDetail[] = leaseCharges.map((c: any) => ({
          description: c.description || c.charge_type || "Charge",
          amount_excl: c.amount_excl_vat || 0,
          vat_amount: c.vat_amount || 0,
          amount_incl: c.amount_incl_vat || 0,
          gl_code: c.gl_code || "",
        }));
        detailItems.push({
          entity: entityName,
          property: propertyName,
          tenant: tenantName,
          total,
          charges: chargeDetails,
        });
      } else {
        notBilled++;
        const issue = !hasRules ? "No billing rules" : "No charges generated";
        exceptionList.push({ tenant_name: tenantName, property_name: propertyName, issue });
      }
    }

    const summaryArray = Object.entries(summaryTotals).map(([type, total]) => ({ type, total }));

    setHealth({
      activeLeases: leases.length,
      expectedRevenue: (billingRules || []).filter((r: any) => r.status === 'active').reduce((sum: number, r: any) => sum + (r.base_amount || 0), 0),
      billed,
      notBilled,
      sent,
      notSent,
    });
    setExceptions(exceptionList);
    setBillingPreviewSummary(summaryArray);
    setBillingPreviewDetail(detailItems);
  }

  // ===== DRILLDOWN HANDLER =====
  function handleDrilldown(type: string) {
    let data: any[] = [];
    let title = "";
    if (type === "billed") {
      data = billingPreviewDetail.map(item => ({ tenant: item.tenant, property: item.property, total: item.total }));
      title = `Billed Tenants (${data.length})`;
    } else if (type === "notBilled") {
      data = exceptions.map(exc => ({ tenant: exc.tenant_name, property: exc.property_name, issue: exc.issue }));
      title = `Not Billed (${data.length})`;
    } else if (type === "sent") {
      data = billingPreviewDetail.slice(0, 10).map(item => ({ tenant: item.tenant, property: item.property }));
      title = `Sent Statements (${data.length})`;
    } else if (type === "notSent") {
      data = billingPreviewDetail.slice(0, 10).map(item => ({ tenant: item.tenant, property: item.property }));
      title = `Not Sent (${data.length})`;
    } else {
      data = billingPreviewDetail.slice(0, 10).map(item => ({ tenant: item.tenant, property: item.property, total: item.total }));
      title = "Leases";
    }
    setDrilldownData(data);
    setDrilldownTitle(title);
    setDrilldownVisible(true);
  }

  // ===== EFFECTS =====
  useEffect(() => {
    loadScopeData();
  }, []);

  useEffect(() => {
    loadRevenueHealth();
  }, [viewBy, selectedEntity, selectedProperty, selectedRegion, selectedPropertyType, selectedTenantGroup, selectedTenant, currentStmtPeriod]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (codeRef.current && !codeRef.current.contains(e.target as Node)) setShowCodeDropdown(null); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Refresh period when page gains focus (user may have closed period in another tab)
useEffect(() => {
  const handleFocus = async () => {
    const stmt = await getCurrentStatementPeriod();
    setCurrentStmtPeriod(stmt.name);
    setStmtStart(stmt.start);
    setStmtEnd(stmt.end);
  };
  
  window.addEventListener("focus", handleFocus);
  return () => window.removeEventListener("focus", handleFocus);
}, []);

  // ===== ACTIONS =====
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

  async function handleSaveCharge(status: "draft" | "posted") {
    showToast("success", `Charge ${status === "posted" ? "posted" : "saved as draft"}`);
    setShowNewCharge(false);
  }

  async function handleUtilityImport() {
    showToast("success", "Utility charges imported");
    setShowUtilityImport(false);
  }

  async function handleGenerateStatements() {
  setShowStatements(false);
  
  // Show progress modal
  setProgressModal({
    title: `Generating Statements — ${currentStmtPeriod}`,
    steps: [
      { label: "Fetching billed tenants...", status: "running" },
      { label: "Sending statements...", status: "waiting", count: 0, total: 0 },
    ]
  });

  let leaseQuery = supabase
    .from("leases")
    .select("tenant_id")
    .eq("lease_status", "Active");

if (viewBy === "entity" && selectedEntity) {
  leaseQuery = leaseQuery.eq("owner_entity_id", selectedEntity);
} else if (viewBy === "property" && selectedProperty) {
  leaseQuery = leaseQuery.eq("property_id", selectedProperty);
} else if (viewBy === "tenant" && selectedTenant) {
  leaseQuery = leaseQuery.eq("tenant_id", selectedTenant);
} else if (viewBy === "region" && selectedRegion) {
  const regionProps = properties.filter(p => p.province === selectedRegion).map(p => p.id);
  if (regionProps.length > 0) leaseQuery = leaseQuery.in("property_id", regionProps);
} else if (viewBy === "propertyType" && selectedPropertyType) {
  const typeProps = properties.filter(p => p.property_type === selectedPropertyType).map(p => p.id);
  if (typeProps.length > 0) leaseQuery = leaseQuery.in("property_id", typeProps);
}

const { data: leasesForStatement } = await leaseQuery;
  
  const tenantIds = [...new Set(leasesForStatement?.map((l: any) => l.tenant_id) || [])];
  
  setProgressModal({
    title: `Generating Statements — ${currentStmtPeriod}`,
    steps: [
      { label: "Fetching billed tenants...", status: "done" },
      { label: "Sending statements...", status: "running", count: 0, total: tenantIds.length },
    ]
  });

  let delivered = 0, failed = 0;
console.log("tenantIds:", tenantIds);
   for (let i = 0; i < tenantIds.length; i++) {
    const tenantId = tenantIds[i];
    console.log("Sending to tenant:", tenantId);
    
    try {
      await triggerCommunication({
        tenant_id: tenantId,
        event_type: "statement_available",
        source_type: "statement",
        source_id: `INV-${currentStmtPeriod}`,
        merge_data: { period: currentStmtPeriod },
      });
      delivered++;
    } catch {
      failed++;
    }
    
    setProgressModal({
      title: `Generating Statements — ${currentStmtPeriod}`,
      steps: [
        { label: "Fetching billed tenants...", status: "done" },
        { label: "Sending statements...", status: "running", count: delivered + failed, total: tenantIds.length },
      ]
    });
  }

  const allSuccess = failed === 0;

  setProgressModal({
    title: `Statements — ${currentStmtPeriod}`,
    steps: [
      { label: "Fetching billed tenants...", status: "done" },
      { label: `Sent: ${delivered} | Failed: ${failed}`, status: allSuccess ? "done" : "failed", count: delivered + failed, total: tenantIds.length },
    ]
  });

  logAudit({
    action: "create",
    resource_type: "statement",
    resource_label: `Generated ${delivered} statements for ${currentStmtPeriod}`,
    new_values: { period: currentStmtPeriod, delivered, failed, entity: selectedEntity }
  });

  setStatementResults({ delivered, failed, pending: 0 });
  loadRevenueHealth();
}

  const manualTotalExcl = manualLines.reduce((s, l) => s + l.amount_excl, 0);
  const manualTotalVat = manualLines.reduce((s, l) => s + l.vat_amount, 0);
  const manualTotalIncl = manualLines.reduce((s, l) => s + l.amount_incl, 0);
  const filteredCodes = billingCodes.filter(bc => !codeSearch || bc.code.toLowerCase().includes(codeSearch.toLowerCase()) || bc.description.toLowerCase().includes(codeSearch.toLowerCase()));

  function getScopeLabel(): string {
    if (viewBy === "all") return "All Properties";
    console.log("viewBy:", viewBy, "selectedEntity:", selectedEntity);
    console.log("selectedEntity:", selectedEntity);
    if (viewBy === "entity" && selectedEntity) {
      const entity = entities.find(e => e.id === selectedEntity);
      return entity ? entity.entity_name : "Entity";
    }
    if (viewBy === "property" && selectedProperty) {
      const prop = properties.find(p => p.id === selectedProperty);
      return prop ? prop.property_name : "Property";
    }
    if (viewBy === "region" && selectedRegion) return selectedRegion;
    if (viewBy === "propertyType" && selectedPropertyType) return selectedPropertyType;
    if (viewBy === "tenantGroup" && selectedTenantGroup) return "Group";
    if (viewBy === "tenant" && selectedTenant) {
      const tenant = tenants.find(t => t.id === selectedTenant);
      return tenant ? tenant.tenant_name : "Tenant";
    }
    return "Portfolio";
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`rounded-2xl border px-6 py-4 text-sm font-medium shadow-2xl pointer-events-auto ${toast.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{toast.text}</div>
        </div>
      )}

      <PageHeader title="Revenue Operations" subtitle="Billing, statements, and distribution." />

      {/* 1. WORKSPACE SCOPE */}
      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mr-2">Scope</span>
          {(["all", "entity", "property", "region", "propertyType", "tenantGroup", "tenant"] as const).map((view) => (
            <button
              key={view}
              onClick={() => {
                setViewBy(view);
                if (view === "all") {
                  setSelectedEntity("");
                  setSelectedProperty("");
                  setSelectedRegion("");
                  setSelectedPropertyType("");
                  setSelectedTenantGroup("");
                  setSelectedTenant("");
                }
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                viewBy === view
                  ? "bg-white text-black"
                  : "border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
              }`}
            >
              {view === "propertyType" ? "Type" : view === "all" ? "All" : view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>

        {viewBy !== "all" && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {viewBy === "entity" && (
              <CustomDropdown
              
                value={selectedEntity}
                options={entities.map(e => ({ id: e.id, label: e.entity_name }))}
                onChange={setSelectedEntity}
                placeholder="Select entity..."
              />
              
            )}
            {viewBy === "property" && (
              <CustomDropdown
                value={selectedProperty}
                options={properties.map(p => ({ id: p.id, label: p.property_name }))}
                onChange={setSelectedProperty}
                placeholder="Select property..."
              />
            )}
            {viewBy === "region" && (
              <CustomDropdown
                value={selectedRegion}
                options={regions.map(r => ({ id: r.id, label: r.name }))}
                onChange={setSelectedRegion}
                placeholder="Select region..."
              />
            )}
            {viewBy === "propertyType" && (
              <CustomDropdown
                value={selectedPropertyType}
                options={propertyTypes.map(t => ({ id: t.id, label: t.name }))}
                onChange={setSelectedPropertyType}
                placeholder="Select type..."
              />
            )}
            {viewBy === "tenantGroup" && (
              <CustomDropdown
                value={selectedTenantGroup}
                options={tenantGroups.map(g => ({ id: g.id, label: g.group_name }))}
                onChange={setSelectedTenantGroup}
                placeholder="Select group..."
              />
            )}
            {viewBy === "tenant" && (
              <CustomDropdown
                value={selectedTenant}
                options={tenants.map(t => ({ id: t.id, label: t.tenant_name }))}
                onChange={setSelectedTenant}
                placeholder="Select tenant..."
              />
            )}
            <div>
              <CustomDropdown
                value={selectedPeriod}
                options={allowedPeriods.map(p => ({ id: p, label: p }))}
                onChange={setSelectedPeriod}
                placeholder="Select period..."
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. REVENUE HEALTH */}
      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Revenue Health — {getScopeLabel()}</p>
          <span className="text-xs text-[var(--text-muted)]">{currentStmtPeriod}</span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {[
            { key: "active", label: "Active Leases", value: health.activeLeases, color: "text-[var(--text-primary)]" },
            { key: "expected", label: "Expected Revenue", value: `R${health.expectedRevenue.toLocaleString()}`, color: "text-emerald-400" },
            { key: "billed", label: "Billed", value: health.billed, color: "text-blue-400" },
            { key: "notBilled", label: "Not Billed", value: health.notBilled, color: "text-amber-400" },
            { key: "sent", label: "Sent", value: health.sent, color: "text-indigo-400" },
            { key: "notSent", label: "Not Sent", value: health.notSent, color: "text-red-400" },
          ].map((item) => (
            <div
              key={item.key}
              onClick={() => handleDrilldown(item.key)}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-center cursor-pointer hover:border-[var(--border-hover)] transition"
            >
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. BILLING EXCEPTIONS */}
      {exceptions.length > 0 && (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
          <button
            onClick={() => setShowExceptions(!showExceptions)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-red-400">Billing Exceptions</p>
              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{exceptions.length}</span>
            </div>
            <span className="text-red-400 text-sm">{showExceptions ? "▲" : "▼"}</span>
          </button>
          {showExceptions && (
            <div className="mt-3 space-y-2">
              {exceptions.slice(0, 20).map((exc, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm">
                  <span className="text-[var(--text-primary)]">{exc.tenant_name || "Unknown"}</span>
                  <span className="text-red-300 text-xs">{exc.issue}</span>
                </div>
              ))}
              {exceptions.length > 20 && (
                <p className="text-xs text-[var(--text-muted)]">+{exceptions.length - 20} more exceptions</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. ACTIONS — New Charge & Utility Import */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowNewCharge(true)}
          className="rounded-full border border-[var(--border-default)] px-5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] transition"
        >
          New Charge
        </button>
        <button
          onClick={() => setShowUtilityImport(true)}
          className="rounded-full border border-[var(--border-default)] px-5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] transition"
        >
          Utility Import
        </button>
      </div>

      {/* 5. BILLING PREVIEW */}
      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Billing Preview — {getScopeLabel()}</p>
          <button
            onClick={() => setPreviewExpanded(!previewExpanded)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            {previewExpanded ? "Close Detail" : "View Detail"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Charge Type</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Total (Incl VAT)</th>
              </tr>
            </thead>
            <tbody>
              {billingPreviewSummary.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-[var(--text-muted)]">No charges to preview.</td>
                </tr>
              ) : (
                billingPreviewSummary.map((item, i) => (
                  <tr key={i} className="border-b border-[var(--border-default)]/50">
                    <td className="py-2 px-3 text-[var(--text-primary)]">{item.type}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[var(--text-primary)]">R{item.total.toLocaleString()}</td>
                  </tr>
                ))
              )}
              {billingPreviewSummary.length > 0 && (
                <tr className="border-t-2 border-[var(--border-default)] font-semibold">
                  <td className="py-2 px-3 text-[var(--text-primary)]">Grand Total</td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text-primary)]">
                    R{billingPreviewSummary.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. GENERATE STATEMENTS */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowStatements(true)}
          className="rounded-full border border-[var(--border-default)] px-5 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] transition"
        >
          Generate Statements
        </button>
      </div>

      {/* 7. DISTRIBUTION RESULTS */}
      {statementResults && (
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Distribution Results</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <p className="text-xl font-bold text-emerald-400">{statementResults.delivered}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Delivered</p>
            </div>
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-center">
              <p className="text-xl font-bold text-red-400">{statementResults.failed}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Failed</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <p className="text-xl font-bold text-amber-400">{statementResults.pending}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Pending</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EXPANDED DETAIL VIEW (Detailed line-by-line) */}
      {/* ============================================================ */}
      {previewExpanded && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewExpanded(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-5xl mx-4 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Billing Detail — {getScopeLabel()}</p>
              <div className="flex items-center gap-3">
                <select
                  value={previewPeriod}
                  onChange={(e) => setPreviewPeriod(e.target.value)}
                  className="text-xs rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-1.5 outline-none focus:border-[var(--border-hover)]"
                >
                  <option value="current">Current Period</option>
                  <option value="3month">3 Months</option>
                  <option value="variance">Variance</option>
                </select>
                <button onClick={() => setPreviewExpanded(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {viewBy === "all" ? (
                // Group by Entity → Property
                (() => {
                  const grouped: Record<string, Record<string, BillingPreviewItem[]>> = {};
                  billingPreviewDetail.forEach(item => {
                    if (!grouped[item.entity]) grouped[item.entity] = {};
                    if (!grouped[item.entity][item.property]) grouped[item.entity][item.property] = [];
                    grouped[item.entity][item.property].push(item);
                  });
                  return Object.entries(grouped).map(([entity, properties]) => (
                    <div key={entity} className="mb-6">
                      <p className="text-base font-bold text-white mb-3">{entity}</p>
                      {Object.entries(properties).map(([property, items]) => {
                        const propertyTotal = items.reduce((sum, i) => sum + i.total, 0);
                        return (
                          <div key={property} className="ml-4 mb-4">
                            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{property}</p>
                            <p className="text-xs text-[var(--text-muted)] mb-2">Total: R{propertyTotal.toFixed(2)}</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[var(--border-default)]">
                                  <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                                  <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Description</th>
                                  <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Excl VAT</th>
                                  <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">VAT</th>
                                  <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Incl VAT</th>
                                  <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">GL Code</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => (
                                  item.charges.map((charge, cIdx) => (
                                    <tr key={`${idx}-${cIdx}`} className="border-b border-[var(--border-default)]/50">
                                      {cIdx === 0 && (
                                        <td className="py-1.5 px-3 text-[var(--text-primary)]" rowSpan={item.charges.length}>
                                          {item.tenant}
                                        </td>
                                      )}
                                      <td className="py-1.5 px-3 text-[var(--text-primary)]">{charge.description}</td>
                                      <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.amount_excl.toFixed(2)}</td>
                                      <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.vat_amount.toFixed(2)}</td>
                                      <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.amount_incl.toFixed(2)}</td>
                                      <td className="py-1.5 px-3 text-[var(--text-muted)] font-mono text-xs">{charge.gl_code}</td>
                                    </tr>
                                  ))
                                ))}
                                <tr className="border-t-2 border-[var(--border-default)] font-semibold">
                                  <td colSpan={2} className="py-1.5 px-3 text-right text-[var(--text-primary)]">Property Total</td>
                                  <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                                    R{items.reduce((sum, i) => sum + i.charges.reduce((s, c) => s + c.amount_excl, 0), 0).toFixed(2)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                                    R{items.reduce((sum, i) => sum + i.charges.reduce((s, c) => s + c.vat_amount, 0), 0).toFixed(2)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                                    R{items.reduce((sum, i) => sum + i.total, 0).toFixed(2)}
                                  </td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()
              ) : viewBy === "property" ? (
                // One property, all tenants with line items
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{getScopeLabel()}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-default)]">
                        <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                        <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Description</th>
                        <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Excl VAT</th>
                        <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">VAT</th>
                        <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Incl VAT</th>
                        <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">GL Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingPreviewDetail.map((item, idx) => (
                        item.charges.map((charge, cIdx) => (
                          <tr key={`${idx}-${cIdx}`} className="border-b border-[var(--border-default)]/50">
                            {cIdx === 0 && (
                              <td className="py-1.5 px-3 text-[var(--text-primary)]" rowSpan={item.charges.length}>
                                {item.tenant}
                              </td>
                            )}
                            <td className="py-1.5 px-3 text-[var(--text-primary)]">{charge.description}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.amount_excl.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.vat_amount.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.amount_incl.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-[var(--text-muted)] font-mono text-xs">{charge.gl_code}</td>
                          </tr>
                        ))
                      ))}
                      <tr className="border-t-2 border-[var(--border-default)] font-semibold">
                        <td colSpan={2} className="py-1.5 px-3 text-right text-[var(--text-primary)]">Property Total</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                          R{billingPreviewDetail.reduce((sum, i) => sum + i.charges.reduce((s, c) => s + c.amount_excl, 0), 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                          R{billingPreviewDetail.reduce((sum, i) => sum + i.charges.reduce((s, c) => s + c.vat_amount, 0), 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                          R{billingPreviewDetail.reduce((sum, i) => sum + i.total, 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                // Tenant or other: simple list with line items
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Property</th>
                      <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                      <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Description</th>
                      <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Excl VAT</th>
                      <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">VAT</th>
                      <th className="text-right py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Incl VAT</th>
                      <th className="text-left py-1.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">GL Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingPreviewDetail.map((item, idx) => (
                      item.charges.map((charge, cIdx) => (
                        <tr key={`${idx}-${cIdx}`} className="border-b border-[var(--border-default)]/50">
                          {cIdx === 0 && (
                            <>
                              <td className="py-1.5 px-3 text-[var(--text-primary)]" rowSpan={item.charges.length}>
                                {item.property}
                              </td>
                              <td className="py-1.5 px-3 text-[var(--text-primary)]" rowSpan={item.charges.length}>
                                {item.tenant}
                              </td>
                            </>
                          )}
                          <td className="py-1.5 px-3 text-[var(--text-primary)]">{charge.description}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.amount_excl.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.vat_amount.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)]">R{charge.amount_incl.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)] font-mono text-xs">{charge.gl_code}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DRILLDOWN MODAL */}
      {/* ============================================================ */}
      {drilldownVisible && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setDrilldownVisible(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-2xl mx-4 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{drilldownTitle}</p>
              <button onClick={() => setDrilldownVisible(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>
            <div className="space-y-2">
              {drilldownData.slice(0, 50).map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                  <span className="text-[var(--text-primary)]">{item.tenant || item.tenant_name || "Unknown"}</span>
                  <span className="text-[var(--text-muted)] text-xs">{item.property || item.property_name || ""}</span>
                  {item.total && <span className="text-[var(--text-primary)] tabular-nums">R{item.total.toLocaleString()}</span>}
                  {item.issue && <span className="text-red-300 text-xs">{item.issue}</span>}
                </div>
              ))}
              {drilldownData.length === 0 && (
                <p className="text-center text-[var(--text-muted)] py-4">No data to display.</p>
              )}
              {drilldownData.length > 50 && (
                <p className="text-xs text-[var(--text-muted)]">+{drilldownData.length - 50} more items</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* NEW CHARGE MODAL */}
      {showNewCharge && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowNewCharge(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-2xl mx-4 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">New Manual Charge</p>
              <button onClick={() => setShowNewCharge(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Tenant</label>
                <CustomDropdown
                  value={selectedTenant}
                  options={tenants.map(t => ({ id: t.id, label: t.tenant_name }))}
                  onChange={setSelectedTenant}
                  placeholder="Select tenant..."
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Billing Period</label>
                <CustomDropdown
                  value={selectedPeriod}
                  options={allowedPeriods.map(p => ({ id: p, label: p }))}
                  onChange={setSelectedPeriod}
                  placeholder="Select period..."
                />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {manualLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <div className="relative w-32">
                    <button type="button" onClick={() => setShowCodeDropdown(showCodeDropdown === line.id ? null : line.id)}
                      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2 text-xs text-left outline-none focus:border-[var(--border-hover)]">
                      {line.billing_code ? <span className="text-[var(--text-primary)] font-mono">{line.billing_code}</span> : <span className="text-[var(--text-muted)]">Code...</span>}
                    </button>
                    {showCodeDropdown === line.id && (
                      <div className="absolute left-0 right-0 z-40 mt-1 rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                        <div className="p-2"><input type="text" value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} placeholder="Search..." autoFocus className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-1.5 text-xs outline-none focus:border-[var(--border-hover)]" /></div>
                        {filteredCodes.map(bc => (
                          <button key={bc.id} type="button" onClick={() => selectBillingCode(line.id, bc)} className={`w-full text-left px-4 py-2 text-xs transition-colors ${line.billing_code === bc.code ? "bg-white text-black font-medium" : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}>
                            <span className="font-mono">{bc.code}</span><span className="text-[var(--text-muted)] ml-2">— {bc.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="text" value={line.description} onChange={(e) => updateManualDescription(line.id, e.target.value)} placeholder="Description..." className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-3 py-2 text-xs outline-none focus:border-[var(--border-hover)]" />
                  <input type="number" step="0.01" value={line.amount_excl || ""} onChange={(e) => updateManualAmount(line.id, "excl", parseFloat(e.target.value) || 0)} placeholder="Excl." className="w-20 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-2 py-2 text-xs text-right outline-none focus:border-[var(--border-hover)] tabular-nums" />
                  <input type="number" step="0.01" value={line.vat_amount || ""} onChange={(e) => updateManualAmount(line.id, "vat", parseFloat(e.target.value) || 0)} placeholder="VAT" className="w-16 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-2 py-2 text-xs text-right outline-none focus:border-[var(--border-hover)] tabular-nums" />
                  <input type="number" step="0.01" value={line.amount_incl || ""} onChange={(e) => updateManualAmount(line.id, "incl", parseFloat(e.target.value) || 0)} placeholder="Incl." className="w-20 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 px-2 py-2 text-xs text-right outline-none focus:border-[var(--border-hover)] tabular-nums" />
                  <button onClick={() => removeManualLine(line.id)} disabled={manualLines.length <= 1} className="p-2 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30">✕</button>
                </div>
              ))}
              <button onClick={addManualLine} className="text-xs text-blue-400 hover:text-blue-300">+ Add Row</button>
            </div>

            <div className="flex justify-between items-center border-t border-[var(--border-default)] pt-4">
              <div className="text-xs text-[var(--text-muted)] tabular-nums">
                Excl: R{manualTotalExcl.toLocaleString()} · VAT: R{manualTotalVat.toLocaleString()} · Incl: R{manualTotalIncl.toLocaleString()}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewCharge(false)} className="rounded-2xl border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">Cancel</button>
                <button onClick={() => handleSaveCharge("draft")} className="rounded-2xl border border-amber-500/50 px-6 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors">Save Draft</button>
                <button onClick={() => handleSaveCharge("posted")} className="rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">Post Now</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UTILITY IMPORT MODAL */}
      {showUtilityImport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowUtilityImport(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-2xl mx-4 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Utility Import</p>
              <button onClick={() => setShowUtilityImport(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>
            <div className="border-2 border-dashed border-[var(--border-default)] rounded-2xl p-12 text-center hover:border-[var(--border-hover)] transition-colors">
              <p className="text-[var(--text-primary)] font-medium">Drop your utility CSV here</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">Supports Eskom, municipality, and other utility invoices</p>
              <button className="mt-4 rounded-2xl border border-[var(--border-default)] px-6 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">Browse Files</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300">Matched: 42</span>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300">Exceptions: 3</span>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300">New Properties: 1</span>
              <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-300">New Tenants: 2</span>
            </div>
            <div className="mt-4 flex gap-3 justify-end">
              <button onClick={() => setShowUtilityImport(false)} className="rounded-2xl border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">Cancel</button>
              <button onClick={handleUtilityImport} className="rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">Import & Create Charges</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE STATEMENTS MODAL */}
      {showStatements && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowStatements(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black border border-[var(--border-default)] rounded-3xl w-full max-w-2xl mx-4 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Generate Statements</p>
              <button onClick={() => setShowStatements(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{health.billed}</p>
                  <p className="text-xs text-[var(--text-muted)]">Statements to Send</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{channelCounts.email}</p>
                  <p className="text-xs text-[var(--text-muted)]">Email</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{channelCounts.whatsapp}</p>
                  <p className="text-xs text-[var(--text-muted)]">WhatsApp</p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs text-amber-400">Preview before sending</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{health.billed} statements will be sent to tenants via their preferred channels.</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowStatements(false)} className="rounded-2xl border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">Cancel</button>
             <button onClick={() => { setShowStatements(false); setShowPreBillingPreview(true); }} className="rounded-2xl border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">Preview</button>
              <button onClick={() => { console.log("BUTTON CLICKED"); handleGenerateStatements(); }} className="rounded-2xl bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-colors">Send Statements</button>
            </div>
          </div>
        </div>
      )}
    
{showPreBillingPreview && (
  <PreBillingVerification
    data={billingPreviewDetail}
    viewBy={viewBy}
    scopeLabel={getScopeLabel()}
    period={currentStmtPeriod}
    onClose={() => setShowPreBillingPreview(false)}
  />
)}
      {/* Progress Modal */}
{progressModal && (
  <ProgressModal
    title={progressModal.title}
    steps={progressModal.steps}
    onClose={() => setProgressModal(null)}
  />
)}
    </div>
  );
}

// ===== CUSTOM DROPDOWN =====
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