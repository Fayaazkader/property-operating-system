'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Building2, TrendingDown } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from "@/lib/supabase";

export default function OccupancyReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityFilter = searchParams.get("entity") || "";
  const propertyFilter = searchParams.get("property") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="p-8 text-[var(--text-muted)]">No data available</div>;

  const { occupancy = [], summary = {} } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"><ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" /></button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Occupancy Report</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">{summary.totalProperties} properties</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.totalProperties || 0}</p><p className="text-xs text-[var(--text-muted)]">Properties</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.totalUnits || 0}</p><p className="text-xs text-[var(--text-muted)]">Total Units</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-emerald-400">{summary.totalOccupied || 0}</p><p className="text-xs text-[var(--text-muted)]">Occupied</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">{summary.totalVacant || 0}</p><p className="text-xs text-[var(--text-muted)]">Vacant</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.occupancyPct || 0}%</p><p className="text-xs text-[var(--text-muted)]">Occupancy Rate</p></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-sm font-semibold text-[var(--text-primary)]">{summary.totalGLA?.toLocaleString() || 0}m²</p><p className="text-xs text-[var(--text-muted)]">Total GLA</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-sm font-semibold text-amber-400">{summary.totalVacantGLA?.toLocaleString() || 0}m²</p><p className="text-xs text-[var(--text-muted)]">Vacant GLA</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-sm font-semibold text-red-400">{formatRands(summary.totalVacancyCost)}</p><p className="text-xs text-[var(--text-muted)]">Monthly Vacancy Cost</p></div>
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
              </tr>
            </thead>
            <tbody>
              {occupancy.map((p: any, i: number) => (
                <tr key={i} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-2 px-3"><p className="text-[var(--text-primary)] font-medium text-xs">{p.property_name}</p><p className="text-[10px] text-[var(--text-muted)]">{p.entity_name}</p></td>
                  <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{p.property_type}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)]">{p.total_units}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-emerald-400">{p.occupied}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400">{p.vacant}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)] font-medium">{p.occupancy_pct}%</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{p.total_gla}m²</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400">{p.vacant_gla}m²</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-red-400">{formatRands(p.estimated_vacancy_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
