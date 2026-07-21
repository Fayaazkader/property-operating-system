'use client';

interface Props {
  statementStatus: string; financialStatus: string;
  onStartBilling: () => void; onCloseStatement: () => void; onCloseFinancial: () => void;
  statementPeriod: string; financialPeriod: string;
}

export function GovernanceCenter({ statementStatus, financialStatus, onStartBilling, onCloseStatement, onCloseFinancial, statementPeriod, financialPeriod }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Governance Center</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
          <div><p className="text-sm font-medium text-[var(--text-primary)]">Statement</p><p className="text-xs text-[var(--text-muted)]">{statementPeriod}</p></div>
          <span className={`text-xs px-2 py-1 rounded-full ${statementStatus === 'closed' ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500/10 text-emerald-300'}`}>{statementStatus}</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
          <div><p className="text-sm font-medium text-[var(--text-primary)]">Financial</p><p className="text-xs text-[var(--text-muted)]">{financialPeriod}</p></div>
          <span className={`text-xs px-2 py-1 rounded-full ${financialStatus === 'closed' ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500/10 text-emerald-300'}`}>{financialStatus}</span>
        </div>
        <div className="pt-3 border-t border-[var(--border-default)] space-y-2">
          {statementStatus === 'open' && <button onClick={onStartBilling} className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500">Start Billing Run</button>}
          {statementStatus === 'ready_to_close' && <button onClick={onCloseStatement} className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">Close Statement Period</button>}
          {financialStatus === 'open' && <button onClick={onCloseFinancial} className="w-full rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:bg-zinc-200">Close Financial Period</button>}
        </div>
      </div>
    </div>
  );
}
