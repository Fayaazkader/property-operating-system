'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Filter } from "lucide-react";
import { useRouter } from 'next/navigation';

export default function RentRollPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [entities, setEntities] = useState<any[]>([]);

  useEffect(() => {
    async function loadEntities() {
      const res = await fetch("/api/intelligence/tenants?page=0&pageSize=100");
      const json = await res.json();
      // Use properties API for entities instead
      setEntities([]);
    }
    loadEntities();
    loadReport();
  }, [entityFilter, statusFilter]);

  async function loadReport() {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/intelligence/reports/rent-roll?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const formatRands = (amount: number) => `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const formatDays = (d: number | null) => d === null ? "—" : d > 365 ? `${(d/365).toFixed(1)}yrs` : `${d} days`;

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="p-8 text-[var(--text-muted)]">No data available</div>;

  const { leases, summary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rent Roll</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">{summary.totalLeases} leases · As at {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
          <option value="Active">Active Leases</option>
          <option value="Expired">Expired</option>
          <option value="">All Statuses</option>
        </select>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{summary.totalLeases}</p>
          <p className="text-xs text-[var(--text-muted)]">Active Leases</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{formatRands(summary.totalMonthlyRental)}</p>
          <p className="text-xs text-[var(--text-muted)]">Monthly Rental</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(summary.totalAnnualRental)}</p>
          <p className="text-xs text-[var(--text-muted)]">Annual Rental</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{formatRands(summary.totalArrears)}</p>
          <p className="text-xs text-[var(--text-muted)]">Total Arrears</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{summary.waleMonths} months</p>
          <p className="text-xs text-[var(--text-muted)]">WALE</p>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{summary.totalGLA.toLocaleString()}m²</p>
          <p className="text-xs text-[var(--text-muted)]">Total GLA</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">R{summary.averageRatePerSqm}/m²</p>
          <p className="text-xs text-[var(--text-muted)]">Avg Rate</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{formatRands(summary.totalDeposits)}</p>
          <p className="text-xs text-[var(--text-muted)]">Deposits Held</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{summary.topTenant}</p>
          <p className="text-xs text-[var(--text-muted)]">Top Tenant</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{summary.concentrationPct}%</p>
          <p className="text-xs text-[var(--text-muted)]">Concentration</p>
        </div>
      </div>

      {/* Rent Roll Table */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
                <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Property</th>
                <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Lease Period</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">GLA</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Rate/m²</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Monthly</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Annual</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Arrears</th>
                <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l: any, i: number) => (
                <tr key={i} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-2 px-3">
                    <p className="text-[var(--text-primary)] font-medium text-xs">{l.tenant_name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{l.tenant_code} · {l.registered_name !== l.tenant_name ? l.registered_name : l.tenant_industry}</p>
                  </td>
                  <td className="py-2 px-3">
                    <p className="text-[var(--text-secondary)] text-xs">{l.property_name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{l.property_type} · {l.region}</p>
                  </td>
                  <td className="py-2 px-3 text-xs text-[var(--text-muted)]">
                    {formatDate(l.lease_start)} → {formatDate(l.lease_expiry)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{l.unit_gla > 0 ? `${l.unit_gla}m²` : "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{l.rental_rate_per_sqm > 0 ? `R${l.rental_rate_per_sqm}` : "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)] font-medium">{formatRands(l.monthly_rental)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)]">{formatRands(l.annual_value)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs">
                    <span className={l.arrears > 0 ? 'text-amber-400 font-medium' : 'text-[var(--text-primary)]'}>{formatRands(l.arrears)}</span>
                  </td>
                  <td className="py-2 px-3 text-center text-xs">
                    <span className={l.days_remaining && l.days_remaining < 90 ? 'text-red-400' : l.days_remaining && l.days_remaining < 180 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>
                      {formatDays(l.days_remaining)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
