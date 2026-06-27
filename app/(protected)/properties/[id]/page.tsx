'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, TrendingUp, AlertTriangle, FileText, Calendar, Download, Home, Activity, Shield, Wrench, DollarSign, Users } from "lucide-react";
import { calculatePropertyHealth } from "@/lib/intelligence/properties/health";

export default function PropertyWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/intelligence/properties/${id}/workspace`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data?.property) return <div className="p-8 text-[var(--text-muted)]">Property not found</div>;

  const { property, leases, activeLeases, units, financial, occupancy, expiring, communications } = data;
  const health = calculatePropertyHealth(occupancy, financial, expiring, activeLeases);
  const formatRands = (amount: number) => `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

  const annualizedRevenue = financial.monthlyRevenue * 12;
  const vacancyExposure = occupancy.vacant * (activeLeases.length > 0 ? financial.monthlyRevenue / activeLeases.length : 0);
  const monthlyCosts = 0;
  const noi = financial.monthlyRevenue - monthlyCosts;
  const noiMargin = financial.monthlyRevenue > 0 ? Math.round((noi / financial.monthlyRevenue) * 100) : 0;
  const revenuePerSqm = property.total_gla_sqm > 0 ? Math.round(financial.monthlyRevenue / property.total_gla_sqm) : 0;
  const avgRentalPerSqm = property.total_gla_sqm > 0 && activeLeases.length > 0 ? Math.round((financial.monthlyRevenue / activeLeases.length) / (property.total_gla_sqm / activeLeases.length)) : 0;

  const tabs = [
    { key: "summary", label: "Summary" },
    { key: "asset", label: "Asset" },
    { key: "accommodation", label: "Accommodation" },
    { key: "financial", label: "Financial" },
    { key: "operations", label: "Operations" },
    { key: "documents", label: "Documents" },
    { key: "audit", label: "Audit" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors mt-1"><ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" /></button>
        <div className="flex-1">
          <p className="text-xs font-mono text-[var(--text-muted)]">{property.property_code || property.id.slice(0, 8)}</p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{property.property_name}</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
            <span>{property.entity_name}</span><span>·</span>
            <span>{property.property_type || "Property"}</span><span>·</span>
            <span>{property.city}, {property.province}</span><span>·</span>
            <span className="text-[var(--text-primary)]">{property.property_status || "Active"}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><Download className="w-3 h-3" /> Rent Roll</button>
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><TrendingUp className="w-3 h-3" /> Revenue Report</button>
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><Home className="w-3 h-3" /> View Units</button>
        <button className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors"><FileText className="w-3 h-3" /> Add Document</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{occupancy.occupancy}%</p><p className="text-xs text-[var(--text-muted)]">Occupancy</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(financial.monthlyRevenue)}</p><p className="text-xs text-[var(--text-muted)]">Monthly Rev</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(annualizedRevenue)}</p><p className="text-xs text-[var(--text-muted)]">Annualized</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className={`text-lg font-bold ${financial.arrears > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatRands(financial.arrears)}</p><p className="text-xs text-[var(--text-muted)]">Arrears</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className={`text-lg font-bold ${vacancyExposure > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{formatRands(vacancyExposure)}</p><p className="text-xs text-[var(--text-muted)]">Vacancy Exposure</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className={`text-lg font-bold ${expiring.length > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{expiring.length}</p><p className="text-xs text-[var(--text-muted)]">Expiring</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)] overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${activeTab === tab.key ? 'border-[var(--text-primary)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>{tab.label}</button>
        ))}
      </div>

      <div>
        {/* Summary */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            {/* Asset Health Score — Item 2 */}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Activity className="w-4 h-4" /> Asset Health</h3>
                <span className={`text-2xl font-bold ${health.score >= 80 ? 'text-emerald-400' : health.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{health.score}/100</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-xs">
                {health.breakdown.map(b => (
                  <div key={b.category} className="text-center">
                    <span className={b.status === 'good' ? 'text-emerald-400' : b.status === 'warning' ? 'text-amber-400' : 'text-red-400'}>{b.category}</span>
                    <p className="text-[var(--text-primary)]">{b.points}/{b.maxPoints}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tenant Concentration — Item 5 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Tenant Concentration</h3>
                <div className="space-y-2 text-sm">
                  {health.tenantConcentration.map(tc => (
                    <div key={tc.tenantName} className="flex justify-between">
                      <span className="text-[var(--text-primary)]">{tc.tenantName}</span>
                      <span className={tc.percentage > 30 ? 'text-red-400' : tc.percentage > 15 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>{tc.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Operational Health</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Open Tasks</span><span className="text-[var(--text-primary)]">—</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Maintenance</span><span className="text-[var(--text-primary)]">—</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Unread Comms</span><span className="text-[var(--text-primary)]">{communications?.filter((c: any) => c.status === 'sent').length || 0}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Compliance</span><span className="text-[var(--text-primary)]">—</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Pending Renewals</span><span className="text-[var(--text-primary)]">{expiring.length}</span></div>
                </div>
              </div>
            </div>

            {/* Risks */}
            {(occupancy.vacant > 0 || financial.arrears > 0 || expiring.length > 0) && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h3 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Risks</h3>
                <div className="space-y-1 text-sm">
                  {occupancy.vacant > 0 && <p className="text-amber-400/80">{occupancy.vacant} vacant — {formatRands(vacancyExposure)}/mo lost</p>}
                  {financial.arrears > 0 && <p className="text-amber-400/80">{formatRands(financial.arrears)} in arrears</p>}
                  {expiring.length > 0 && <p className="text-amber-400/80">{expiring.length} leases expiring within 90 days</p>}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Recent Activity</h3>
              <div className="space-y-1">
                {communications?.slice(0, 8).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 text-sm py-1.5">
                    <div className={`w-2 h-2 rounded-full ${c.status === 'delivered' || c.status === 'read' ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`} />
                    <span className="text-[var(--text-primary)]">{c.event_type?.replace(/_/g, " ")}</span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Asset */}
        {activeTab === "asset" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">Ownership & Location</h3>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Code</span><span className="text-[var(--text-primary)]">{property.property_code || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Entity</span><span className="text-[var(--text-primary)]">{property.entity_name}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Portfolio</span><span className="text-[var(--text-primary)]">{property.operational_region || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Type</span><span className="text-[var(--text-primary)]">{property.property_type}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Region</span><span className="text-[var(--text-primary)]">{property.province}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Status</span><span className="text-[var(--text-primary)]">{property.property_status || "Active"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Currency</span><span className="text-[var(--text-primary)]">ZAR</span></div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">Valuation & Acquisition</h3>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Acquired</span><span className="text-[var(--text-primary)]">{property.acquisition_date ? formatDate(property.acquisition_date) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Valuation</span><span className="text-[var(--text-primary)]">{property.valuation_amount ? formatRands(property.valuation_amount) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Insurance Value</span><span className="text-[var(--text-primary)]">—</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Replacement Cost</span><span className="text-[var(--text-primary)]">—</span></div>
              </div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">Measurements</h3>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">GLA</span><span className="text-[var(--text-primary)]">{property.total_gla_sqm ? `${property.total_gla_sqm.toLocaleString()}m²` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Rentable Area</span><span className="text-[var(--text-primary)]">{property.rentable_area_sqm ? `${property.rentable_area_sqm.toLocaleString()}m²` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Land Area</span><span className="text-[var(--text-primary)]">—</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Parking Bays</span><span className="text-[var(--text-primary)]">—</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Accommodation — Item 1 */}
        {activeTab === "accommodation" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Accommodation Hierarchy</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">Commercial</p>
                  <div className="ml-3 space-y-2">
                    <div>
                      <p className="text-xs text-[var(--text-secondary)] mb-1">Retail</p>
                      {activeLeases.map((l: any) => (
                        <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border-default)] last:border-0 ml-2 text-sm">
                          <div>
                            <p className="text-[var(--text-primary)]">Unit — {(l as any).tenants?.tenant_name || "Unknown"}</p>
                            <p className="text-xs text-[var(--text-muted)]">{l.lease_id} · {formatRands(l.monthly_rental)}/mo · Exp: {formatDate(l.lease_end_date)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${l.lease_status === 'Active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>{l.lease_status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {occupancy.vacant > 0 && (
                  <div className="border-t border-[var(--border-default)] pt-3">
                    <p className="text-xs font-medium text-amber-400 uppercase tracking-[0.2em]">{occupancy.vacant} Vacant</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Financial — Item 3 */}
        {activeTab === "financial" && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Monthly Revenue</p><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(financial.monthlyRevenue)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Arrears</p><p className={`text-lg font-bold ${financial.arrears > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatRands(financial.arrears)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">NOI</p><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(noi)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">NOI Margin</p><p className="text-lg font-bold text-[var(--text-primary)]">{noiMargin}%</p></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Annualized</p><p className="text-base font-bold text-[var(--text-primary)]">{formatRands(annualizedRevenue)}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Revenue/m²</p><p className="text-base font-bold text-[var(--text-primary)]">{revenuePerSqm > 0 ? `R${revenuePerSqm}` : "—"}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Avg Rental/m²</p><p className="text-base font-bold text-[var(--text-primary)]">{avgRentalPerSqm > 0 ? `R${avgRentalPerSqm}` : "—"}</p></div>
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-xs text-[var(--text-muted)]">Vacancy Cost</p><p className="text-base font-bold text-amber-400">{formatRands(vacancyExposure)}/mo</p></div>
            </div>
          </div>
        )}

        {/* Operations — Item 6 */}
        {activeTab === "operations" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Home className="w-4 h-4" /> Vacancies</h3>{occupancy.vacant === 0 ? <p className="text-sm text-emerald-400">No vacant units.</p> : <p className="text-sm text-amber-400">{occupancy.vacant} unit{occupancy.vacant !== 1 ? 's' : ''} · {formatRands(vacancyExposure)}/mo</p>}</div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Wrench className="w-4 h-4" /> Maintenance</h3><p className="text-sm text-[var(--text-muted)]">Open: — · Scheduled: — · Completed: —</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> Compliance</h3><p className="text-sm text-[var(--text-muted)]">Fire Certificate · Electrical · Occupancy · Insurance</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> Renewals</h3>{expiring.length === 0 ? <p className="text-sm text-emerald-400">No leases expiring within 90 days.</p> : expiring.map((l: any) => (<p key={l.id} className="text-sm text-amber-400">{(l as any).tenants?.tenant_name} — {formatDate(l.lease_end_date)}</p>))}</div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> Tasks</h3><p className="text-sm text-[var(--text-muted)]">No open tasks</p></div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Contractors</h3><p className="text-sm text-[var(--text-muted)]">No contractors assigned</p></div>
          </div>
        )}

        {/* Documents */}
        {activeTab === "documents" && (
          <div className="grid grid-cols-3 gap-4">
            {["Title Deeds", "Plans", "Insurance", "Compliance", "Municipal", "Contracts", "Photos", "Lease Packs", "Certificates"].map(cat => (
              <div key={cat} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 text-center"><FileText className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" /><p className="text-xs text-[var(--text-primary)]">{cat}</p><p className="text-xs text-[var(--text-muted)] mt-1">No documents</p></div>
            ))}
          </div>
        )}

        {/* Audit — Item 4 */}
        {activeTab === "audit" && (
          <div className="space-y-1">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 mb-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Activity Log</h3>
              <p className="text-xs text-[var(--text-muted)]">Full audit trail — property events, lease changes, document uploads, and communications.</p>
            </div>
            {communications?.slice(0, 20).map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 text-sm py-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                <span className="text-[var(--text-primary)]">{c.event_type?.replace(/_/g, " ")}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(c.created_at)}</span>
                <span className="text-xs text-[var(--text-muted)]">{c.channel}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
