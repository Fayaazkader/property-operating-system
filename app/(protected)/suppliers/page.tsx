'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Building2, Wrench, Zap, Briefcase, Shield, Truck, Scale, Heart } from "lucide-react";

const supplierTypeIcons: Record<string, any> = {
  security: Shield, cleaning: Heart, maintenance: Wrench, engineering: Wrench,
  utilities: Zap, legal: Scale, financial: Briefcase, insurance: Shield,
  municipality: Building2, metering: Zap, contractor: Truck,
};

export default function SuppliersPage() {
  const router = useRouter();
  const [data, setData] = useState<any>({ suppliers: [], total: 0, summary: null });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => { loadData(); }, [page, filter, searchTerm]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), filter });
    if (searchTerm) params.set("search", searchTerm);
    const res = await fetch(`/api/intelligence/suppliers?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const { suppliers, total, summary } = data;
  const totalPages = Math.ceil(total / pageSize);

  const filters = [
    { key: "all", label: "All", count: summary?.total || 0 },
    { key: "contractors", label: "Contractors", count: summary?.contractors || 0 },
    { key: "utilities", label: "Utilities", count: summary?.utilities || 0 },
    { key: "services", label: "Services", count: summary?.professionalServices || 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Suppliers</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">{total} suppliers · Showing {Math.min((page * pageSize) + 1, total)}-{Math.min((page + 1) * pageSize, total)}</p>
        </div>
        <button onClick={() => router.push("/suppliers/new")} className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Supplier
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.total}</p><p className="text-xs text-[var(--text-muted)]">Total</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.contractors}</p><p className="text-xs text-[var(--text-muted)]">Contractors</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.utilities}</p><p className="text-xs text-[var(--text-muted)]">Utilities</p></div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center"><p className="text-lg font-bold text-[var(--text-primary)]">{summary.professionalServices}</p><p className="text-xs text-[var(--text-muted)]">Services</p></div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }} placeholder="Search suppliers..." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)]" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(0); }} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${filter === f.key ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}>
              {f.label} <span className="ml-1 opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => (<div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse"><div className="h-4 bg-[var(--bg-elevated)] rounded w-1/3 mb-2"></div><div className="h-3 bg-[var(--bg-elevated)] rounded w-1/2"></div></div>))}</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]"><Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No suppliers found</p></div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Supplier</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Category</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Properties</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Contact</th>
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s: any) => {
                  const iconKey = (s.industry || s.supplier_type || '').toLowerCase().replace(/[^a-z]/g, '');
                  const Icon = supplierTypeIcons[iconKey] || Building2;
                  return (
                    <tr key={s.id} onClick={() => router.push(`/suppliers/${s.id}`)} className="border-b border-[var(--border-default)] last:border-0 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                          <div>
                            <p className="text-[var(--text-primary)] font-medium">{s.supplier_name || "Unnamed"}</p>
                            <p className="text-[10px] font-mono text-[var(--text-muted)]">{s.code || `SUP-${s.id?.slice(0, 8)}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4"><span className="text-xs text-[var(--text-secondary)]">{s.industry || s.supplier_type || "—"}</span></td>
                      <td className="py-2.5 px-4"><span className="text-xs text-[var(--text-muted)]">{s.property_count || "—"}</span></td>
                      <td className="py-2.5 px-4">
                        {s.email && <p className="text-xs text-[var(--text-muted)]">{s.email}</p>}
                        {s.phone && <p className="text-xs text-[var(--text-muted)]">{s.phone}</p>}
                      </td>
                      <td className="py-2.5 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">Active</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--text-muted)]">Page {page + 1} of {totalPages}</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-elevated)] disabled:opacity-30">← Prev</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + i;
                  return <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === pageNum ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>{pageNum + 1}</button>;
                })}
                {totalPages > 5 && page < totalPages - 3 && <span className="text-xs text-[var(--text-muted)]">...{totalPages}</span>}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-elevated)] disabled:opacity-30">Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
