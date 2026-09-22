'use client';

import { useState, useEffect } from 'react';
import { freezeChargesService, type FreezeProgress } from '@/lib/revenue/freeze-charges-service';
import { subscribe } from '@/lib/platform/events/event-bus';

interface Props {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  periodName: string;
  leaseCount: number;
  onComplete: () => void;
  onClose: () => void;
}

export function GenerateChargesModal({ entityId, periodStart, periodEnd, periodName, leaseCount, onComplete, onClose }: Props) {
  const [phase, setPhase] = useState<'confirm' | 'running' | 'review' | 'complete'>('confirm');
  const [correlationId] = useState(() => crypto.randomUUID());
  const [progress, setProgress] = useState<FreezeProgress>({ total: 0, processed: 0, currentLease: '', chargesCreated: 0, status: 'idle', errors: [] });

  useEffect(() => {
  subscribe(
    'period.charge_lease_progress',
    async (e: any) => {
      setProgress(e.payload);
    }
  );

  subscribe(
    'period.charges_frozen',
    async (e: any) => {
      setProgress(e.payload);
      setPhase('review');
    }
  );

  subscribe(
    'period.charges_freeze_failed',
    async (e: any) => {
      setProgress(e.payload);
      setPhase('review');
    }
  );
}, []);

  async function handleGenerate() {
  setPhase('running');

  try {
    const result = await freezeChargesService.freezeChargesForPeriod(
  entityId,
  periodStart,
  periodEnd,
  periodName,
  correlationId
);

    setProgress(result);
    setPhase('review');
  } catch (error) {
    setProgress({
      total: progress.total,
      processed: progress.processed,
      currentLease: '',
      chargesCreated: progress.chargesCreated,
      status: 'error',
      errors: [
        ...progress.errors,
        error instanceof Error ? error.message : 'Billing run failed unexpectedly.',
      ],
    });
    setPhase('review');
  }
}

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
          
          {phase === 'confirm' && (
            <div className="space-y-6">
              <p className="text-sm font-medium text-white">Generate Charges for {periodName}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{leaseCount} active leases will have their recurring charges generated. Deposit and first month charges are already posted.</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">This will generate:</p>
                <div className="space-y-1 text-xs text-zinc-400 font-light">
                  <p>• Recurring rental charges</p>
                  <p>• Parking charges</p>
                  <p>• Utility recovery placeholders</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleGenerate} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100">Generate Charges</button>
                <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-zinc-400 hover:text-white">Cancel</button>
              </div>
            </div>
          )}

          {phase === 'running' && (
            <div className="space-y-6">
              <p className="text-sm font-medium text-white">Generating Charges...</p>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-zinc-500 font-light tabular-nums">{progress.processed} / {progress.total} leases</p>
              <p className="text-xs text-zinc-600 font-light">{progress.chargesCreated} charges created</p>
            </div>
          )}

          {phase === 'review' && (
  <div className="space-y-6 text-center">
    {progress.status === 'complete' ? (
      <>
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <span className="text-emerald-400 text-xl">✓</span>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Charges Generated</p>
          <div className="mt-3 space-y-1 text-xs text-zinc-400 font-light">
            <p>{progress.total} leases processed</p>
            <p>{progress.chargesCreated} charges created</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">
            Validation
          </p>

          <div className="space-y-1 text-xs">
            <p className="text-emerald-400 font-light">
              ✓ Charges generated for all active leases
            </p>
            <p className="text-emerald-400 font-light">
              ✓ Billing run completed
            </p>
            <p className="text-emerald-400 font-light">
              ✓ No errors
            </p>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100"
        >
          Continue to Close Period
        </button>
      </>
    ) : (
      <>
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <span className="text-red-400 text-xl">!</span>
        </div>

        <div>
          <p className="text-sm font-medium text-white">
            Billing Run Requires Attention
          </p>

          <div className="mt-3 space-y-1 text-xs text-zinc-400 font-light">
            <p>{progress.processed} / {progress.total} leases processed</p>
            <p>{progress.chargesCreated} charges created</p>
            <p className="text-red-400">
              {progress.errors.length} lease(s) failed
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">
            Errors
          </p>

          <div className="space-y-2 text-xs text-red-300">
            {progress.errors.map((error, index) => (
              <p key={`${error}-${index}`}>{error}</p>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          The statement period has not been marked as billing complete.
          Resolve the failed leases before closing the period.
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-xl border border-white/[0.08] py-3 text-sm text-zinc-300 hover:text-white"
        >
          Close
        </button>
      </>
    )}
  </div>
)}
        </div>
      </div>
    </>
  );
}
