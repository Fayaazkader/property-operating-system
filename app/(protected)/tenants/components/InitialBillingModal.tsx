'use client';

import { useState, useEffect } from 'react';
import { initialBillingService, type InitialCharge, type InitialBillingResult } from '@/lib/revenue/initial-billing-service';

interface Props {
  leaseId: string;
  onComplete: (chargesPosted: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

export function InitialBillingModal({ leaseId, onComplete, onSkip, onClose }: Props) {
  const [phase, setPhase] = useState<'loading' | 'review' | 'posting'>('loading');
  const [billing, setBilling] = useState<InitialBillingResult | null>(null);
  const [charges, setCharges] = useState<InitialCharge[]>([]);

  useEffect(() => {
    async function load() {
      const result = await initialBillingService.calculate(leaseId);
      setBilling(result);
      setCharges(result.charges);
      setPhase('review');
    }
    load();
  }, [leaseId]);

  function toggleCharge(id: string) {
    setCharges(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  async function handlePost() {
    setPhase('posting');
    const posted = await initialBillingService.postCharges(leaseId, charges);
    onComplete(posted);
  }

  const total = charges.filter(c => c.selected).reduce((s, c) => s + c.amount_incl_vat, 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>

          {phase === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          )}

          {phase === 'review' && billing && (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-white">Initial Billing</p>
                <p className="text-xs text-zinc-500 mt-1">{billing.tenantName} — {billing.leaseRef}</p>
                <p className="text-xs text-zinc-600">{billing.propertyName}</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 text-xs text-zinc-400 font-light">
                Policy: {billing.policy.source} · Billing Day: {billing.policy.billing_day}th · Deposit: {billing.policy.deposit_months} month(s)
              </div>

              <div className="space-y-2">
                {charges.map(charge => (
                  <label key={charge.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${charge.selected ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.03] opacity-50'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={charge.selected} onChange={() => toggleCharge(charge.id)} className="mt-0.5 rounded" />
                      <div>
                        <p className="text-sm text-white font-light">{charge.description}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Source: {charge.source}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white font-light tabular-nums">R{charge.amount_incl_vat.toLocaleString()}</p>
                      {charge.vat_amount > 0 && <p className="text-[10px] text-zinc-500">incl. VAT R{charge.vat_amount.toLocaleString()}</p>}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
                <span className="text-sm text-zinc-400 font-light">Total</span>
                <span className="text-lg text-white font-light tabular-nums">R{total.toLocaleString()}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={handlePost} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">
                  Confirm & Post
                </button>
                <button onClick={onSkip} className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-zinc-400 hover:text-white transition-all">
                  Skip
                </button>
              </div>
            </div>
          )}

          {phase === 'posting' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" />
                <p className="text-sm text-zinc-400 font-light">Posting charges...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
