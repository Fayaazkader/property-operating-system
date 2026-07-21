'use client';

export function TreasuryOutlook() {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Treasury Outlook</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Cash Today</span>
          <span className="text-[var(--text-primary)] font-medium">R8.4m</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Upcoming Obligations</span>
          <span className="text-amber-400 font-medium">R4.2m</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">30-Day Forecast</span>
          <span className="text-emerald-400 font-medium">Positive</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2 italic">Treasury Intelligence integration coming soon</p>
      </div>
    </div>
  );
}
