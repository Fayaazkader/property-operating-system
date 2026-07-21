'use client';

interface Props {
  activeLeases: number; invoicesGenerated: number; unreconciled: number;
  cashbookBalanced: boolean; tbBalanced: boolean;
  statementStatus: string; financialStatus: string;
}

export function ReadinessScore({ activeLeases, invoicesGenerated, unreconciled, cashbookBalanced, tbBalanced, statementStatus, financialStatus }: Props) {
  const checks = [
    { label: 'Active Leases', passed: activeLeases > 0, value: activeLeases },
    { label: 'Invoices Generated', passed: invoicesGenerated > 0, value: invoicesGenerated },
    { label: 'Cash Book Balanced', passed: cashbookBalanced, value: unreconciled },
    { label: 'TB Balanced', passed: tbBalanced },
    { label: 'Statement Open', passed: statementStatus !== 'closed' },
    { label: 'Financial Open', passed: financialStatus !== 'closed' },
  ];
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Readiness Score</p>
      <p className={`text-3xl font-light mb-4 ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{score}%</p>
      <div className="space-y-1.5">
        {checks.map(c => (
          <div key={c.label} className="flex justify-between text-xs">
            <span className={c.passed ? 'text-zinc-400' : 'text-zinc-600'}>{c.label}</span>
            <span className={c.passed ? 'text-emerald-400' : 'text-zinc-600'}>
              {c.passed ? '✓' : '✗'} {c.value !== undefined ? c.value : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
