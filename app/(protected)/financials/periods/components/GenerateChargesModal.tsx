'use client';

import { useState } from 'react';
import { freezeChargesService, type FreezeProgress } from '@/lib/revenue/freeze-charges-service';

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
  const [phase, setPhase] = useState<'confirm' | 'running' | 'complete'>('confirm');
  const [progress, setProgress] = useState<FreezeProgress>({ total: 0, processed: 0, currentLease: '', chargesCreated: 0, status: 'idle', errors: [] });

  async function handleGenerate() {
    setPhase('running');
    await freezeChargesService.freezeChargesForPeriod(entityId, periodStart, periodEnd, setProgress);
    setPhase('complete');
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
          
          {phase === 'confirm' && (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-white">Close {periodName} Statement Period</p>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  {leaseCount} active leases will have their charges frozen for this period.
                  This locks current billing rules and prevents further edits to {periodName}.
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 mb-2 font-medium">This will:</p>
                <div className="space-y-1 text-xs text-zinc-400 font-light">
                  <p>• Lock all current rules as charges</p>
                  <p>• Generate final invoices for {periodName}</p>
                  <p>• Prevent further edits to this period</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleGenerate} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">
                  Generate Charges & Close
                </button>
                <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-zinc-400 hover:text-white transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {phase === 'running' && (
            <div className="space-y-6">
              <p className="text-sm font-medium text-white">Generating Charges...</p>
              
              {/* Progress bar */}
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                />
              </div>
              
              <p className="text-xs text-zinc-500 font-light tabular-nums">
                {progress.processed} / {progress.total} leases
              </p>

              {/* Current lease */}
              <div className="max-h-32 overflow-y-auto space-y-1">
                {progress.currentLease && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-light">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Processing: {progress.currentLease}
                  </div>
                )}
                {progress.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-400 font-light">⚠ {err}</div>
                ))}
              </div>

              <p className="text-xs text-zinc-600 font-light">{progress.chargesCreated} charges created so far</p>
            </div>
          )}

          {phase === 'complete' && (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <span className="text-emerald-400 text-xl">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Charges Generated</p>
                <div className="mt-3 space-y-1 text-xs text-zinc-400 font-light">
                  <p>{progress.total} leases processed</p>
                  <p>{progress.chargesCreated} charges created</p>
                </div>
                {progress.errors.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2">{progress.errors.length} warning(s)</p>
                )}
              </div>
              <button onClick={onComplete} className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">
                Close Statement Period
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
