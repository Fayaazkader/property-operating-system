'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Building2, AlertTriangle, TrendingDown, TrendingUp, Target, Clock, DollarSign } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';

import { Suspense } from 'react';

function OccupancyReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityFilter = searchParams.get("entity") || "";
  const propertyFilter = searchParams.get("property") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [propertyFilter2, setPropertyFilter2] = useState<string>("all");

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

  const trendArrow = (current: number, previous: number, inverse: boolean = false) => {
    const delta = current - previous;
    const up = inverse ? delta < 0 : delta > 0;
    return { arrow: up ? "↑" : "↓", color: up ? "text-emerald-400" : "text-red-400", delta: Math.abs(delta) };
  };

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="p-8 text-[var(--text-muted)]">No data available</div>;

  const { occupancy = [], segmentation = {}, risks = [], trend = {}, pipeline = {}, revenueAtRisk = {}, summary = {} } = data;

  const propertyTypes = ["all", "below_target", ...new Set(occupancy.map((p: any) => p.property_type?.toLowerCase()).filter(Boolean))];

  const filteredOccupancy = propertyFilter2 === "all" 
    ? occupancy 
    : propertyFilter2 === "below_target" 
      ? occupancy.filter((p: any) => p.below_target)
      : occupancy.filter((p: any) => p.property_type?.toLowerCase() === propertyFilter2);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-12">
      {/* 1. Header */}
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

      {/* 2. Executive KPIs */}
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

      {/* 3. Portfolio Trend */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Portfolio Trend</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Occupancy</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{trend.occupancy?.current || 0}%</p>
            <p className="text-xs">{(() => { const t = trendArrow(trend.occupancy?.current || 0, trend.occupancy?.previous || 0); return <span className={t.color}>{t.arrow} {t.delta}% vs last month</span>; })()}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Vacancy Cost</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{formatRands(trend.vacancyCost?.current)}/mo</p>
            <p className="text-xs">{(() => { const t = trendArrow(trend.vacancyCost?.current || 0, trend.vacancyCost?.previous || 0, true); return <span className={t.color}>{t.arrow} {formatRands(t.delta)} vs last month</span>; })()}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Vacant GLA</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{trend.vacantGLA?.current?.toLocaleString() || 0}m²</p>
            <p className="text-xs">{(() => { const t = trendArrow(trend.vacantGLA?.current || 0, trend.vacantGLA?.previous || 0, true); return <span className={t.color}>{t.arrow} {t.delta}m² vs last month</span>; })()}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Below Target</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{trend.belowTarget?.current || 0}</p>
            <p className="text-xs">{(() => { const t = trendArrow(trend.belowTarget?.current || 0, trend.belowTarget?.previous || 0, true); return <span className={t.color}>{t.arrow} {t.delta} vs last month</span>; })()}</p>
          </div>
        </div>
      </div>

      {/* 4. Occupancy by Asset Class */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Occupancy by Asset Class</h2>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(segmentation).map(([type, seg]: [string, any], i: number) => {
            const pct = seg.total > 0 ? Math.round((seg.occupied / seg.total) * 100) : 0;
            return (
              <div key={`seg-${i}`} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.1em]">{type}</p>
                <p className={`text-2xl font-bold mt-1 ${pct >= 90 ? 'text-emerald-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{seg.occupied}/{seg.total} units · {seg.gla?.toLocaleString() || 0}m²</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Leasing Pipeline */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Clock className="w-4 h-4" /> Leasing Pipeline</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{pipeline.underOffer?.toLocaleString()}m²</p><p className="text-xs text-[var(--text-muted)]">Under Offer</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{pipeline.inNegotiation?.toLocaleString()}m²</p><p className="text-xs text-[var(--text-muted)]">In Negotiation</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{pipeline.fitout?.toLocaleString()}m²</p><p className="text-xs text-[var(--text-muted)]">Fitout</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{pipeline.pendingOccupation?.toLocaleString()}m²</p><p className="text-xs text-[var(--text-muted)]">Pending Occupation</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3 text-center"><p className="text-lg font-bold text-emerald-400">{formatRands(pipeline.potentialRecovery)}/mo</p><p className="text-xs text-[var(--text-muted)]">Potential Recovery</p></div>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 text-center"><p className="text-lg font-bold text-amber-400">{formatRands(summary.totalVacancyCost - (pipeline.potentialRecovery || 0))}/mo</p><p className="text-xs text-[var(--text-muted)]">Net Vacancy Exposure</p></div>
        </div>
      </div>

      {/* 6. Revenue at Risk */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-400" /> Revenue at Risk</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4"><p className="text-2xl font-bold text-red-400">{formatRands(revenueAtRisk.vacancyExposure)}</p><p className="text-xs text-[var(--text-muted)] mt-1">Current Vacancy Exposure (Annual)</p></div>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4"><p className="text-2xl font-bold text-amber-400">{formatRands(revenueAtRisk.expiringRevenue)}</p><p className="text-xs text-[var(--text-muted)] mt-1">Expiring within 12 Months</p></div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4"><p className="text-2xl font-bold text-red-400">{formatRands(revenueAtRisk.total)}</p><p className="text-xs text-[var(--text-muted)] mt-1">Total Revenue at Risk (Annual)</p></div>
        </div>
      </div>

      {/* 7. Portfolio Risks */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Portfolio Risks</h2>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
            <div className="space-y-1">
              {(showAllRisks ? risks : risks.slice(0, 3)).map((r: string, i: number) => (
                <p key={`risk-${i}`} className="text-sm text-amber-400/80">⚠ {r}</p>
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

      {/* 8. Below Target */}
      {summary.belowTarget > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-400" /> Below Target ({summary.belowTarget} properties)</h2>
          <div className="grid grid-cols-3 gap-3">
            {occupancy.filter((p: any) => p.below_target).slice(0, 6).map((p: any, i: number) => (
              <div key={`below-${i}`} className="rounded-xl border border-red-500/10 bg-red-500/5 p-3">
                <p className="text-xs font-medium text-[var(--text-primary)]">{p.property_name}</p>
                <p className="text-lg font-bold text-red-400 mt-1">{p.occupancy_pct}%</p>
                <p className="text-xs text-[var(--text-muted)]">{p.vacant} vacant · {formatRands(p.estimated_vacancy_cost)}/mo</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. Property Detail */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Property Detail</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Filter:</span>
            {propertyTypes.map((v: any) => (
              <button key={`filter-${v}`} onClick={() => setPropertyFilter2(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${propertyFilter2 === v ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>
                {v === "all" ? "All" : v === "below_target" ? "Below Target" : v.charAt(0).toUpperCase() + v.slice(1)}
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
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Occupancy</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">GLA</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Expiring 12m</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Effective Risk</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Vacancy Cost</th>
                  <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase">Annual Exposure</th>
                </tr>
              </thead>
              <tbody>
                {filteredOccupancy.map((p: any, i: number) => (
                  <tr key={`prop-${i}`} onClick={() => router.push(`/properties/${p.property_id}`)} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer">
                    <td className="py-2 px-3"><p className="text-[var(--text-primary)] font-medium text-xs">{p.property_name}</p><p className="text-[10px] text-[var(--text-muted)]">{p.entity_name}</p></td>
                    <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{p.property_type}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs"><span className={p.occupancy_pct >= 90 ? 'text-emerald-400' : p.occupancy_pct >= 80 ? 'text-amber-400' : 'text-red-400'}>{p.occupancy_pct}%</span></td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{p.total_gla}m²</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400">{p.expiring_12m_pct}%</td>
                    <td className="py-2 px-3 text-right tabular-nums text-xs"><span className={p.effective_risk > 30 ? 'text-red-400 font-medium' : p.effective_risk > 15 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>{p.effective_risk}%</span></td>
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
export default function OccupancyReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading...</div>}>
      <OccupancyReportContent />
    </Suspense>
  );
}
