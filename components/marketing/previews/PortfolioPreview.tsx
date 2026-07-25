export function PortfolioPreview() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-[9px] uppercase text-zinc-600 mb-1">Occupancy</p><p className="text-xl font-light text-white">94%</p></div>
        <div><p className="text-[9px] uppercase text-zinc-600 mb-1">NOI</p><p className="text-xl font-light text-white">R530k</p></div>
        <div><p className="text-[9px] uppercase text-zinc-600 mb-1">Arrears</p><p className="text-xl font-light text-amber-400/80">2.1%</p></div>
      </div>
    </div>
  );
}
