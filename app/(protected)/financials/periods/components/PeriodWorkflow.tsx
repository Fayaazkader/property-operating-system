'use client';

interface Props {
  phase: string;
}

const phases = [
  { key: 'open', label: 'Open' },
  { key: 'billing_requested', label: 'Billing Requested' },
  { key: 'billing_running', label: 'Billing Running' },
  { key: 'billing_complete', label: 'Billing Complete' },
  { key: 'closed', label: 'Closed' },
];

export function PeriodWorkflow({ phase }: Props) {
  const currentIdx = phases.findIndex((step) => step.key === phase);

  return (
    <div className="flex items-center gap-2">
      {phases.map((step, i) => {
        const actualIdx = i;
        const isComplete = currentIdx >= 0 && actualIdx <= currentIdx;
        const isCurrent = step.key === phase;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium ${
                isCurrent
                  ? 'bg-amber-500/10 text-amber-300'
                  : isComplete
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-600'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isCurrent
                    ? 'bg-amber-400'
                    : isComplete
                      ? 'bg-emerald-400'
                      : 'bg-zinc-600'
                }`}
              />
              {step.label}
            </div>

            {i < phases.length - 1 && (
              <div
                className={`w-8 h-px ${
                  i < currentIdx
                    ? 'bg-emerald-400/50'
                    : 'bg-zinc-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}