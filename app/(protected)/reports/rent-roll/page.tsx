'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download } from "lucide-react";
import { useRouter } from 'next/navigation';

export default function RentRollPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/intelligence/reports/rent-roll");
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, []);

  const formatRands = (amount: number) => `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—";

  if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="p-8 text-[var(--text-muted)]">No data available</div>;

  const { leases, summary } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rent Roll</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">{summary.totalLeases} active leases</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{summary.totalLeases}</p>
          <p className="text-xs text-[var(--text-muted)]">Active Leases</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{formatRands(summary.totalRental)}</p>
          <p className="text-xs text-[var(--text-muted)]">Monthly Rental</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{formatRands(summary.totalArrears)}</p>
          <p className="text-xs text-[var(--text-muted)]">Total Arrears</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{formatRands(summary.totalDeposits)}</p>
          <p className="text-xs text-[var(--text-muted)]">Deposits Held</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Tenant</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Property</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Lease</th>
                <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Rental</th>
                <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Arrears</th>
                <th className="text-right py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Deposit</th>
                <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-normal uppercase tracking-[0.2em]">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l: any) => (
                <tr key={l.id} className="border-b border-[var(--border-default)] last:border-0">
                  <td className="py-2.5 px-4">
                    <p className="text-[var(--text-primary)] font-medium">{l.tenant_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{l.lease_id}</p>
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-secondary)] text-xs">{l.property_name}</td>
                  <td className="py-2.5 px-4 text-xs text-[var(--text-muted)]">{formatDate(l.lease_start_date)} → {formatDate(l.lease_end_date)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)]">{formatRands(l.monthly_rental)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    <span className={l.arrears > 0 ? 'text-amber-400' : 'text-[var(--text-primary)]'}>{formatRands(l.arrears)}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-primary)]">{formatRands(l.deposit_amount || 0)}</td>
                  <td className="py-2.5 px-4 text-xs text-[var(--text-muted)]">{formatDate(l.lease_end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
