'use client';

import { PageHeader } from "@/app/components/layout/PageHeader";
import { usePeriodData } from "./hooks/usePeriodData";
import { PeriodWorkflow } from "./components/PeriodWorkflow";
import { ReadinessScore } from "./components/ReadinessScore";
import { GovernanceCenter } from "./components/GovernanceCenter";
import { PeriodTimeline } from "./components/PeriodTimeline";
import { useState } from "react";
import type { PeriodActionResult } from "@/lib/periods/period-actions";

export default function PeriodWorkspacePage() {
  const { loading, entityId, statementPeriod, statementPhase, financialPeriod, financialPhase, activeLeases, invoicesGenerated, unreconciled, cashbookBalanced, tbBalanced, startBillingRun, closeStatement, closeFinancial } = usePeriodData();
  const [actionResult, setActionResult] = useState<PeriodActionResult | null>(null);

  async function handleStartBilling() { setActionResult(await startBillingRun()); }
  async function handleCloseStatement() { setActionResult(await closeStatement()); }
  async function handleCloseFinancial() { setActionResult(await closeFinancial()); }

  if (loading) return <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12"><div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-zinc-800 rounded" /><div className="h-32 bg-zinc-800 rounded-xl" /></div></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <PageHeader title="Period Governance" subtitle="Orchestrate billing cycles and period closures" />
      <PeriodWorkflow phase={statementPhase} />

      {actionResult && (
        <div className={`rounded-xl border p-4 ${actionResult.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
          <p className={`text-sm font-medium ${actionResult.success ? 'text-emerald-400' : 'text-amber-400'}`}>{actionResult.success ? '✓' : '⚠'} {actionResult.message}</p>
          {actionResult.validations && (
            <div className="mt-2 space-y-1">
              {actionResult.validations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs"><span className={v.passed ? 'text-emerald-400' : 'text-red-400'}>{v.passed ? '✓' : '✗'}</span><span className="text-zinc-400">{v.message}</span></div>
              ))}
            </div>
          )}
          <button onClick={() => setActionResult(null)} className="text-xs text-zinc-500 hover:text-white mt-2">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Statement Period</p>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-light text-white">{statementPeriod || '—'}</p><p className="text-[10px] text-zinc-500 mt-1">Current</p></div>
              <div><p className="text-2xl font-light text-white">{activeLeases}</p><p className="text-[10px] text-zinc-500 mt-1">Active Leases</p></div>
              <div><p className="text-2xl font-light text-white">{invoicesGenerated}</p><p className="text-[10px] text-zinc-500 mt-1">Invoices</p></div>
              <div><p className={`text-2xl font-light ${statementPhase === 'closed' ? 'text-zinc-500' : 'text-emerald-400'}`}>{statementPhase}</p><p className="text-[10px] text-zinc-500 mt-1">Phase</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Financial Period</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-light text-white">{financialPeriod || '—'}</p><p className="text-[10px] text-zinc-500 mt-1">Current</p></div>
              <div><p className={`text-2xl font-light ${tbBalanced ? 'text-emerald-400' : 'text-red-400'}`}>{tbBalanced ? 'Balanced' : 'Unbalanced'}</p><p className="text-[10px] text-zinc-500 mt-1">Trial Balance</p></div>
              <div><p className={`text-2xl font-light ${financialPhase === 'closed' ? 'text-zinc-500' : 'text-emerald-400'}`}>{financialPhase}</p><p className="text-[10px] text-zinc-500 mt-1">Phase</p></div>
            </div>
          </div>
          <PeriodTimeline periodName={statementPeriod} entityId={entityId} />
        </div>
        <div className="col-span-4 space-y-6">
          <ReadinessScore activeLeases={activeLeases} invoicesGenerated={invoicesGenerated} unreconciled={unreconciled} cashbookBalanced={cashbookBalanced} tbBalanced={tbBalanced} statementStatus={statementPhase} financialStatus={financialPhase} />
          <GovernanceCenter statementStatus={statementPhase} financialStatus={financialPhase} onStartBilling={handleStartBilling} onCloseStatement={handleCloseStatement} onCloseFinancial={handleCloseFinancial} statementPeriod={statementPeriod} financialPeriod={financialPeriod} />
        </div>
      </div>
    </div>
  );
}
