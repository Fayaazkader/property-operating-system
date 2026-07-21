'use client';

import { PageHeader } from "@/app/components/layout/PageHeader";
import { usePeriodData } from "./hooks/usePeriodData";
import { PeriodWorkflow } from "./components/PeriodWorkflow";
import { ReadinessScore } from "./components/ReadinessScore";
import { GovernanceCenter } from "./components/GovernanceCenter";
import { PeriodTimeline } from "./components/PeriodTimeline";

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
    loadData,
    startBillingRun,
    closeStatement,
    closeFinancial,
  } = usePeriodData();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-[var(--bg-elevated)] rounded mb-4" />
          <div className="h-20 bg-[var(--bg-elevated)] rounded" />
          <div className="grid grid-cols-12 gap-6 mt-6">
            <div className="col-span-8 space-y-6">
              <div className="h-32 bg-[var(--bg-elevated)] rounded" />
              <div className="h-32 bg-[var(--bg-elevated)] rounded" />
            </div>
            <div className="col-span-4 space-y-6">
              <div className="h-64 bg-[var(--bg-elevated)] rounded" />
              <div className="h-48 bg-[var(--bg-elevated)] rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 pt-8 pb-12">
      <PageHeader 
        title="Period Governance" 
        subtitle="Manage statement and financial periods"
      />

      <PeriodWorkflow status={statementStatus} />

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-8 space-y-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Statement Period</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Current: {statementPeriod}</p>
                <p className="text-xs text-[var(--text-muted)]">Next: {nextStatementPeriod}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {billingStats.invoicesGenerated} / {billingStats.totalTenants} invoices
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Financial Period</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Current: {financialPeriod}</p>
                <p className="text-xs text-[var(--text-muted)]">Next: {nextFinancialPeriod}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  R{receiptStats.allocated.toLocaleString()} allocated
                </p>
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
        </div>
      </div>
    </div>
  );
}
