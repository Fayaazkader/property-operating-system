'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, TrendingDown, TrendingUp, AlertTriangle, DollarSign, Building2 } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from "@/lib/supabase";

export default function RentRollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityFilter = searchParams.get("entity") || "";
  const propertyFilter = searchParams.get("property") || "";
  const regionFilter = searchParams.get("region") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [properties, setProperties] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("properties").select("id, property_name").order("property_name").then(({ data: props }) => {
      if (props) setProperties(props);
    });
    supabase.from("entities").select("id, entity_name").order("entity_name").then(({ data: ent }) => {
      if (ent) setEntities(ent);
    });
  }, []);

  useEffect(() => { loadReport(); }, [statusFilter, entityFilter, propertyFilter, regionFilter]);

  async function loadReport() {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    if (entityFilter) params.set("entity", entityFilter);
    if (propertyFilter) params.set("property", propertyFilter);
    if (regionFilter) params.set("region", regionFilter);
    const res = await fetch(`/api/intelligence/reports/rent-roll?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const formatRands = (amount: number) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "R0.00";
    if (Math.abs(amount) >= 1000000) return `R${(amount / 1000000).toFixed(2)}m`;
    return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const formatDays = (d: number | null) => d === null ? "—" : d > 365 ? `${(d/365).toFixed(1)}yrs` : `${d} days`;

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="p-8 text-[var(--text-muted)]">No data available</div>;

  const { leases = [], summary = {} } = data;
  const expiring12mo = leases.filter((l: any) => l.days_remaining !== null && l.days_remaining <= 365 && l.days_remaining > 0);
  const expiringRevenue = expiring12mo.reduce((s: number, l: any) => s + l.annual_value, 0);
  const arrearsLeases = leases.filter((l: any) => l.arrears > 0);

  const propertyRevenue: Record<string, number> = {};
  leases.forEach((l: any) => { propertyRevenue[l.property_name] = (propertyRevenue[l.property_name] || 0) + l.monthly_rental; });
  const topProperties = Object.entries(propertyRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const tenantRevenue: Record<string, number> = {};
  leases.forEach((l: any) => { tenantRevenue[l.tenant_name] = (tenantRevenue[l.tenant_name] || 0) + l.monthly_rental; });
  const topTenants = Object.entries(tenantRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const sectorRevenue: Record<string, number> = {};
  leases.forEach((l: any) => { sectorRevenue[l.tenant_industry || "Other"] = (sectorRevenue[l.tenant_industry || "Other"] || 0) + l.monthly_rental; });
  const topSectors = Object.entries(sectorRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const scopeLabel = propertyFilter 
    ? properties.find(p => p.id === propertyFilter)?.property_name 
    : entityFilter 
      ? entities.find(e => e.id === entityFilter)?.entity_name 
      : "";

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"><ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" /></button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Rent Roll
              {scopeLabel && <span className="text-[var(--text-muted)] font-normal"> — {scopeLabel}</span>}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">As at {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })} · {summary.totalLeases || 0} active leases</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
            <option value="Active">Active Leases</option><option value="Expired">Expired</option>
          </select>
          <button className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"><Download className="w-4 h-4" /> Export</button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><DollarSign className="w-4 h-4" /> Contracted Income</h2>
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4"><p className="text-2xl font-bold text-emerald-400">{formatRands(summary.totalAnnualRental)}</p><p className="text-xs text-[var(--text-muted)] mt-1">Annual Revenue</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{summary.waleMonths || 0} months</p><p className="text-xs text-[var(--text-muted)] mt-1">WALE</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{summary.totalLeases || 0}</p><p className="text-xs text-[var(--text-muted)] mt-1">Active Leases</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{summary.totalGLA?.toLocaleString() || 0}m²</p><p className="text-xs text-[var(--text-muted)] mt-1">Total GLA</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">R{summary.averageRatePerSqm || 0}/m²</p><p className="text-xs text-[var(--text-muted)] mt-1">Average Rate</p></div>
        </div>
      </div>

      {(expiringRevenue > 0 || summary.totalArrears > 0) && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Risk Exposure</h2>
          <div className="grid grid-cols-3 gap-3">
            {expiringRevenue > 0 && (
              <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4"><p className="text-2xl font-bold text-red-400">{formatRands(expiringRevenue)}</p><p className="text-xs text-[var(--text-muted)] mt-1">{expiring12mo.length} leases expiring within 12 months</p></div>
            )}
            {summary.totalArrears > 0 && (
              <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4"><p className="text-2xl font-bold text-amber-400">{formatRands(summary.totalArrears)}</p><p className="text-xs text-[var(--text-muted)] mt-1">{arrearsLeases.length} accounts in arrears</p></div>
            )}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{summary.concentrationPct || 0}%</p><p className="text-xs text-[var(--text-muted)] mt-1">Top tenant: {summary.topTenant || "—"}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2 flex items-center gap-2"><Building2 className="w-3 h-3" /> By Property</h3>
          <div className="space-y-1">{topProperties.map(([name, rev]) => (<div key={name} className="flex justify-between text-xs"><span className="text-[var(--text-primary)]">{name}</span><span className="text-[var(--text-muted)]">{formatRands(rev)}</span></div>))}</div>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> By Tenant</h3>
          <div className="space-y-1">{topTenants.map(([name, rev]) => (<div key={name} className="flex justify-between text-xs"><span className="text-[var(--text-primary)]">{name}</span><span className="text-[var(--text-muted)]">{formatRands(rev)}</span></div>))}</div>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-2 flex items-center gap-2"><TrendingDown className="w-3 h-3" /> By Sector</h3>
          <div className="space-y-1">{topSectors.map(([name, rev]) => (<div key={name} className="flex justify-between text-xs"><span className="text-[var(--text-primary)]">{name}</span><span className="text-[var(--text-muted)]">{formatRands(rev)}</span></div>))}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Lease Detail</h2>
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Tenant</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Property</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Lease Period</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">GLA</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Rate/m²</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Monthly</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Annual</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Arrears</th>
                  <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {leases.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="py-2 px-3"><p className="text-[var(--text-primary)] font-medium text-xs">{l.tenant_name}</p><p className="text-[10px] text-[var(--text-muted)]">{l.tenant_code}</p></td>
                    <td className="py-2 px-3 text-xs text-[var(--text-secondary)]">{l.property_name}</td>
                    <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{formatDate(l.lease_start)} → {formatDate(l.lease_expiry)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{l.unit_gla > 0 ? `${l.unit_gla}m²` : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{l.rental_rate_per_sqm > 0 ? `R${l.rental_rate_per_sqm}` : "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)] font-medium">{formatRands(l.monthly_rental)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)]">{formatRands(l.annual_value)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs"><span className={l.arrears > 0 ? 'text-amber-400 font-medium' : 'text-[var(--text-primary)]'}>{formatRands(l.arrears)}</span></td>
                    <td className="py-2 px-3 text-center text-xs"><span className={l.days_remaining && l.days_remaining < 90 ? 'text-red-400' : l.days_remaining && l.days_remaining < 180 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>{formatDays(l.days_remaining)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}