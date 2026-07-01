'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Filter } from "lucide-react";
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";

export default function ArrearsReportPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewBy, setViewBy] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [entities, setEntities] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    async function loadFilters() {
      const { data: ent } = await supabase.from("entities").select("id, entity_name").order("entity_name");
      const { data: props } = await supabase.from("properties").select("id, property_name").order("property_name");
      if (ent) setEntities(ent);
      if (props) setProperties(props);
    }
    loadFilters();
    loadReport();
  }, [selectedEntity, selectedProperty]);

  async function loadReport() {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedEntity) params.set("entity", selectedEntity);
    if (selectedProperty) params.set("property", selectedProperty);
    const res = await fetch(`/api/intelligence/reports/arrears?${params}`);
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

  const { arrears, summary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"><ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" /></button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Arrears Report</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">{summary.accountsInArrears} accounts in arrears</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
        <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
          <option value="">All Entities</option>
          {entities.map((e: any) => <option key={e.id} value={e.id}>{e.entity_name}</option>)}
        </select>
        <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none">
          <option value="">All Properties</option>
          {properties.map((p: any) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">{formatRands(summary.totalArrears)}</p><p className="text-xs text-[var(--text-muted)]">Total Arrears</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(summary.totalCurrent)}</p><p className="text-xs text-[var(--text-muted)]">Current</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">{formatRands(summary.total30)}</p><p className="text-xs text-[var(--text-muted)]">30 Days</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-amber-400">{formatRands(summary.total60)}</p><p className="text-xs text-[var(--text-muted)]">60 Days</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-red-400">{formatRands(summary.total90)}</p><p className="text-xs text-[var(--text-muted)]">90 Days</p></div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-red-400">{formatRands(summary.total120)}</p><p className="text-xs text-[var(--text-muted)]">120+ Days</p></div>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
                <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Property</th>
                <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Lease</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Rental</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Balance</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Current</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">30d</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">60d</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">90d</th>
                <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">120d+</th>
              </tr>
            </thead>
            <tbody>
              {arrears.map((a: any, i: number) => (
                <tr key={i} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="py-2 px-3"><p className="text-[var(--text-primary)] font-medium text-xs">{a.tenant_name}</p><p className="text-[10px] text-[var(--text-muted)]">{a.tenant_code}</p></td>
                  <td className="py-2 px-3 text-xs text-[var(--text-secondary)]">{a.property_name}</td>
                  <td className="py-2 px-3 text-xs text-[var(--text-muted)]">{a.lease_id}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-primary)]">{formatRands(a.monthly_rental)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400 font-medium">{formatRands(a.balance)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{formatRands(a.aging.current)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{formatRands(a.aging.d30)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-[var(--text-muted)]">{formatRands(a.aging.d60)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-amber-400">{formatRands(a.aging.d90)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-xs text-red-400">{formatRands(a.aging.d120)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
