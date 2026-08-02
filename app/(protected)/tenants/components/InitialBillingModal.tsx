'use client';

import { useState, useEffect } from 'react';
import { initialBillingService, type InitialCharge, type InitialBillingResult } from '@/lib/revenue/initial-billing-service';

interface Props {
  leaseId: string;
  entityId: string;
  onApprove: (result: InitialBillingResult) => void;
  onSkip: () => void;
  onClose: () => void;
}

export function InitialBillingModal({ leaseId, entityId, onApprove, onSkip, onClose }: Props) {
  const [phase, setPhase] = useState<'loading' | 'review' | 'approving'>('loading');
  const [billing, setBilling] = useState<InitialBillingResult | null>(null);
  const [charges, setCharges] = useState<InitialCharge[]>([]);

  useEffect(() => {
    async function load() {
      const result = await initialBillingService.calculate(leaseId, entityId);
      setBilling(result);
      setCharges(result.charges);
      setPhase('review');
    }
    load();
  }, [leaseId, entityId]);

  function toggleCharge(id: string) {
    setCharges(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  async function handleApprove() {
    if (!billing) return;
    setPhase('approving');
    const approved = await initialBillingService.approve({ ...billing, charges }, billing.entityId);
    const posted = await initialBillingService.postCharges(leaseId, approved.charges);
    onApprove(approved);
  }

  const total = charges.filter(c => c.selected).reduce((s, c) => s + c.amount_incl_vat, 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

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

              {/* Charges table with GL + VAT + Source */}
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase w-8"></th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase">Description</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase">Source</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase">GL</th>
                      <th className="text-right py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase">VAT</th>
                      <th className="text-right py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map(charge => (
                      <tr key={charge.id} className={`border-b border-white/[0.03] transition-all ${charge.selected ? '' : 'opacity-40'}`}>
                        <td className="py-2 px-3">
                          <input type="checkbox" checked={charge.selected} onChange={() => toggleCharge(charge.id)} className="rounded" />
                        </td>
                        <td className="py-2 px-3 text-white font-light">{charge.description}</td>
                        <td className="py-2 px-3 text-zinc-500 font-light text-[10px]">{charge.source_detail}</td>
                        <td className="py-2 px-3 text-zinc-500 font-light">{charge.gl_code}</td>
                        <td className="py-2 px-3 text-right text-zinc-500 font-light">{charge.vat_treatment === 'non_vatable' ? '—' : `${charge.vat_rate}%`}</td>
                        <td className="py-2 px-3 text-right text-white font-light tabular-nums">R{charge.amount_incl_vat.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
                <span className="text-sm text-zinc-400 font-light">Total</span>
                <span className="text-lg text-white font-light tabular-nums">R{total.toLocaleString()}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={handleApprove} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 transition-all">
                  Approve Initial Billing
                </button>
                <button onClick={onSkip} className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm text-zinc-400 hover:text-white transition-all">
                  Skip
                </button>
              </div>
            </div>
          )}

          {phase === 'approving' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" />
                <p className="text-sm text-zinc-400 font-light">Approving billing package...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
