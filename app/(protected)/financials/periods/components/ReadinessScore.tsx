'use client';

import { ReceiptStats, BillingStats } from "@/lib/periods/period-validation";

interface ReadinessScoreProps {
  receiptStats: ReceiptStats;
  billingStats: BillingStats;
  statementStatus: string;
  financialStatus: string;
}

export function ReadinessScore({ receiptStats, billingStats, statementStatus, financialStatus }: ReadinessScoreProps) {
  const checks = [
    { label: 'Cash Book', passed: receiptStats.cashbookBalanced, detail: receiptStats.cashbookBalanced ? 'Balanced ✅' : 'Not balanced ⚠️' },
    { label: 'Unreconciled Items', passed: receiptStats.unreconciled === 0, detail: receiptStats.unreconciled === 0 ? 'None' : `${receiptStats.unreconciled} pending` },
    { label: 'Billing Complete', passed: billingStats.invoicesOutstanding === 0, detail: billingStats.invoicesOutstanding === 0 ? 'Complete' : `${billingStats.invoicesOutstanding} outstanding` },
    { label: 'Statement Period', passed: statementStatus === 'ready_to_close' || statementStatus === 'closed', detail: statementStatus },
    { label: 'Financial Period', passed: financialStatus === 'closed', detail: financialStatus },
  ];

  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);

  const getColor = () => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Readiness Score</p>
        <span className={`text-2xl font-bold ${getColor()}`}>{score}%</span>
      </div>
      <div className="space-y-2">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">{check.label}</span>
            <span className={check.passed ? 'text-emerald-400' : 'text-amber-400'}>
              {check.passed ? '✅' : '⚠️'} {check.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
