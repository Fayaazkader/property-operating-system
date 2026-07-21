'use client';

interface Props { phase: string; }

const phases = [
  { key: 'open', label: 'Open' },
  { key: 'receipting', label: 'Receipting' },
  { key: 'allocation', label: 'Allocation' },
  { key: 'billing_run', label: 'Billing' },
  { key: 'billing_complete', label: 'Billing Done' },
  { key: 'exception_review', label: 'Review' },
  { key: 'ready_to_close', label: 'Ready' },
  { key: 'closed', label: 'Closed' },
];

export function PeriodWorkflow({ phase }: Props) {
  const currentIdx = phases.findIndex(s => s.key === phase);
  const displayPhases = phases.filter((_, i) => i === 0 || i === 3 || i === 6 || i === 7);
  const displayIdx = displayPhases.findIndex(s => s.key === phase);
  return (
    <div className="flex items-center gap-2">
      {displayPhases.map((step, i) => {
        const actualIdx = phases.findIndex(s => s.key === step.key);
        const isComplete = actualIdx <= currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium ${isComplete ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              {step.label}
            </div>
            {i < displayPhases.length - 1 && <div className={`w-8 h-px ${i < displayIdx ? 'bg-emerald-400/50' : 'bg-zinc-700'}`} />}
          </div>
        );
      })}
    </div>
  );
}
