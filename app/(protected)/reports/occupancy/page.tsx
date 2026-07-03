'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Building2, AlertTriangle, TrendingDown, Target } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';

export default function OccupancyReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityFilter = searchParams.get("entity") || "";
  const propertyFilter = searchParams.get("property") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [viewBy, setViewBy] = useState<string>(entityFilter ? "entity" : propertyFilter ? "property" : "all");

  useEffect(() => { loadReport(); }, [entityFilter, propertyFilter]);

  async function loadReport() {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    if (propertyFilter) params.set("property", propertyFilter);
    const res = await fetch(`/api/intelligence/reports/occupancy?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const formatRands = (amount: number) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "R0.00";
    if (Math.abs(amount) >= 1000000) return `R${(amount / 1000000).toFixed(2)}m`;
    return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="p-8 text-[var(--text-muted)]">No data available</div>;

  const { occupancy = [], segmentation = {}, risks = [], summary = {} } = data;

  // Group properties by entity for the table
  const groupedProperties: Record<string, any[]> = {};
  occupancy.forEach((p: any) => {
    const key = p.entity_name || "Unknown";
    if (!groupedProperties[key]) groupedProperties[key] = [];
    groupedProperties[key].push(p);
  });

  // Determine which properties to show based on viewBy
  let displayProperties = occupancy;
  if (viewBy === "entity" && entityFilter) {
    displayProperties = occupancy.filter((p: any) => p.entity_name === data.occupancy?.find((op: any) => op.entity_name)?.entity_name);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"><ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" /></button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Occupancy Report</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">{summary.totalProperties} properties · As at {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"><Download className="w-4 h-4" /> Export</button>
      </div>

      {/* Executive KPIs */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Target className="w-4 h-4" /> Portfolio Occupancy</h2>
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4"><p className="text-2xl font-bold text-emerald-400">{summary.occupancyPct || 0}%</p><p className="text-xs text-[var(--text-muted)] mt-1">Occupancy Rate</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{summary.totalOccupied || 0}/{summary.totalUnits || 0}</p><p className="text-xs text-[var(--text-muted)] mt-1">Units</p></div>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4"><p className="text-2xl font-bold text-amber-400">{formatRands(summary.totalVacancyCost)}</p><p className="text-xs text-[var(--text-muted)] mt-1">Monthly Vacancy Cost</p></div>
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4"><p className="text-2xl font-bold text-red-400">{formatRands(summary.annualExposure)}</p><p className="text-xs text-[var(--text-muted)] mt-1">Annual Exposure</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4"><p className="text-2xl font-bold text-[var(--text-primary)]">{summary.vacancyPct || 0}%</p><p className="text-xs text-[var(--text-muted)] mt-1">Vacancy Rate</p></div>
        </div>
      </div>

      {/* Occupancy by Asset Class */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Occupancy by Asset Class</h2>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(segmentation).map(([type, seg]: [string, any]) => {
            const pct = seg.total > 0 ? Math.round((seg.occupied / seg.total) * 100) : 0;
            return (
              <div key={type} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.1em]">{type}</p>
                <p className={`text-2xl font-bold mt-1 ${pct >= 90 ? 'text-emerald-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{seg.occupied}/{seg.total} units · {seg.gla?.toLocaleString() || 0}m²</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risks — collapsible */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Portfolio Risks</h2>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
            <div className="space-y-1">
              {(showAllRisks ? risks : risks.slice(0, 3)).map((r: string) => (
                <p key={r} className="text-sm text-amber-400/80">⚠ {r}</p>
              ))}
            </div>
            {risks.length > 3 && (
              <button onClick={() => setShowAllRisks(!showAllRisks)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] mt-2">
                {showAllRisks ? "Show less" : `Show all ${risks.length} risks`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Below Target */}
      {summary.belowTarget > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-400" /> Below Target ({summary.belowTarget} properties)</h2>
          <div className="grid grid-cols-3 gap-3">
            {occupancy.filter((p: any) => p.below_target).slice(0, 6).map((p: any) => (
              <div key={p.property_code || p.property_name} className="rounded-xl border border-red-500/10 bg-red-500/5 p-3">
                <p className="text-xs font-medium text-[var(--text-primary)]">{p.property_name}</p>
                <p className="text-lg font-bold text-red-400 mt-1">{p.occupancy_pct}%</p>
                <p className="text-xs text-[var(--text-muted)]">{p.vacant} vacant · {formatRands(p.estimated_vacancy_cost)}/mo</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property Detail with View By */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Property Detail</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">View By:</span>
            {(["all", "entity", "property", "region"] as const).map(v => (
              <button key={v} onClick={() => setViewBy(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${viewBy === v ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>
                {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Property</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Type</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Units</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Occupied</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Vacant</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Rate</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">GLA</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Vacant GLA</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Vacancy Cost</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Annual Exposure</th>
                </tr>
              </thead>
              <tbody>
                {displayProperties.map((p: any) => (
                  <tr key={p.property_code || p.property_name + p.entity_name} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="py-2 px-3"><p className="text-[var(--text-primary)] font-medium text-xs">{p.property_name}</p><p className="text-[10px] text-[var(--text-muted)]">{p.entity_name}</p></td>
                    <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{p.property_type}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)]">{p.total_units}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-emerald-400">{p.occupied}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400">{p.vacant}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs"><span className={p.occupancy_pct >= 90 ? 'text-emerald-400' : p.occupancy_pct >= 80 ? 'text-amber-400' : 'text-red-400'}>{p.occupancy_pct}%</span></td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{p.total_gla}m²</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400">{p.vacant_gla}m²</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-red-400">{formatRands(p.estimated_vacancy_cost)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-red-400">{formatRands(p.annual_exposure)}</td>
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
