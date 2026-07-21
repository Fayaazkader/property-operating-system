'use client';

interface PeriodWorkflowProps {
  status: 'open' | 'billing_run' | 'ready_to_close' | 'closed';
}

export function PeriodWorkflow({ status }: PeriodWorkflowProps) {
  const steps = [
    { id: 'open', label: 'Open' },
    { id: 'billing_run', label: 'Billing Run' },
    { id: 'ready_to_close', label: 'Ready to Close' },
    { id: 'closed', label: 'Closed' },
  ];

  const currentIndex = steps.findIndex(s => s.id === status);

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                idx <= currentIndex 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-default)]'
              }`}>
                {idx < currentIndex ? '✓' : idx + 1}
              </div>
              <span className={`text-xs mt-1 ${
                idx <= currentIndex ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-px mx-4 ${
                idx < currentIndex ? 'bg-emerald-500/30' : 'bg-[var(--border-default)]'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
