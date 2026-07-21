'use client';

interface PeriodTimelineProps {
  periodName: string;
}

export function PeriodTimeline({ periodName }: PeriodTimelineProps) {
  // Placeholder — will consume Timeline service
  const events = [
    { label: `${periodName} opened`, date: '2026-07-01', type: 'open' },
    { label: 'Billing run started', date: '2026-07-15', type: 'billing' },
    { label: 'Invoices generated', date: '2026-07-20', type: 'billing' },
  ];

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Timeline</p>
      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] mt-1.5" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">{event.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{event.date}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2 italic">Timeline service integration coming soon</p>
    </div>
  );
}
