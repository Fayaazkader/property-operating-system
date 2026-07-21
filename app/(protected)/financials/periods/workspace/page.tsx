'use client';

import { useState } from "react";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { usePeriodData } from "../hooks/usePeriodData";
import { PeriodWorkflow } from "../components/PeriodWorkflow";
import { ReadinessScore } from "../components/ReadinessScore";
import { GovernanceCenter } from "../components/GovernanceCenter";
import { TreasuryOutlook } from "../components/TreasuryOutlook";
import { PeriodTimeline } from "../components/PeriodTimeline";

export default function PeriodWorkspacePage() {
  const {
    loading,
    statementPeriod,
    statementStatus,
    financialPeriod,
    financialStatus,
    nextStatementPeriod,
    nextFinancialPeriod,
    receiptStats,
    billingStats,
    billingRunStartedAt,
    billingRunStartedBy,
    startBillingRun,
    simulateProgress,
    closeStatement,
    closeFinancial,
    loadData,
  } = usePeriodData();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <PageHeader 
        title="Period Governance" 
        subtitle="Manage statement and financial periods"
      />

      {statementStatus === "billing_run" && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold">⚡ {statementPeriod} Billing Run Active</p>
              <p className="text-xs text-amber-400/70 mt-1">Started: {billingRunStartedAt} by {billingRunStartedBy}</p>
            </div>
            <button 
              onClick={simulateProgress}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            >
              Simulate Progress
            </button>
          </div>
        </div>
      )}

      <PeriodWorkflow status={statementStatus} periodName={statementPeriod} />

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-8 space-y-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Statement Period</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Current: {statementPeriod}</p>
                <p className="text-xs text-[var(--text-muted)]">Next: {nextStatementPeriod}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {billingStats.invoicesGenerated} / {billingStats.totalTenants} invoices
                </p>
                {billingStats.billingExceptions > 0 && (
                  <p className="text-xs text-amber-400">{billingStats.billingExceptions} exceptions</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Financial Period</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Current: {financialPeriod}</p>
                <p className="text-xs text-[var(--text-muted)]">Next: {nextFinancialPeriod}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  R{receiptStats.allocated.toLocaleString()} allocated
                </p>
                {receiptStats.unreconciled > 0 && (
                  <p className="text-xs text-amber-400">{receiptStats.unreconciled} unreconciled</p>
                )}
              </div>
            </div>
          </div>

          <PeriodTimeline periodName={statementPeriod} />
        </div>

        {/* Sidebar */}
        <div className="col-span-4 space-y-6">
          <ReadinessScore 
            receiptStats={receiptStats}
            billingStats={billingStats}
            statementStatus={statementStatus}
            financialStatus={financialStatus}
          />

          <GovernanceCenter
            statementStatus={statementStatus}
            financialStatus={financialStatus}
            onStartBilling={startBillingRun}
            onCloseStatement={closeStatement}
            onCloseFinancial={closeFinancial}
            statementPeriod={statementPeriod}
            financialPeriod={financialPeriod}
            billingStats={billingStats}
          />

          <TreasuryOutlook />
        </div>
      </div>
    </div>
  );
}
