export function TrialBalancePreview() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Trial Balance — July 2026</div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-zinc-500">Rental Income</span><span className="text-white tabular-nums">R842,000</span></div>
        <div className="flex justify-between"><span className="text-zinc-500">Operating Expenses</span><span className="text-white tabular-nums">R312,000</span></div>
        <div className="flex justify-between"><span className="text-zinc-500">Net Income</span><span className="text-emerald-400 tabular-nums">R530,000</span></div>
        <div className="border-t border-white/[0.04] pt-2 flex justify-between"><span className="text-zinc-400 font-medium">Balance</span><span className="text-emerald-400 font-medium">✓ Balanced</span></div>
      </div>
    </div>
  );
}
