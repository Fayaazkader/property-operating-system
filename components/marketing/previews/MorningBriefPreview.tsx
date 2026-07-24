export function MorningBriefPreview() {
  return (
    <div className="absolute top-24 -right-20 w-[620px] hidden xl:block opacity-50 pointer-events-none">
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-[1px] shadow-2xl shadow-black/50">
        <div className="rounded-2xl bg-black/80 backdrop-blur-md p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            </div>
            <span className="text-[10px] text-zinc-500 ml-2 font-light">Morning Brief — Today</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-[9px] uppercase tracking-wider text-zinc-600">Occupancy</p><p className="text-2xl font-light text-white">94<span className="text-zinc-500 text-sm">%</span></p></div>
            <div><p className="text-[9px] uppercase tracking-wider text-zinc-600">Revenue</p><p className="text-2xl font-light text-white">R842<span className="text-zinc-500 text-sm">k</span></p></div>
            <div><p className="text-[9px] uppercase tracking-wider text-zinc-600">Attention</p><p className="text-2xl font-light text-amber-400/80">3</p></div>
          </div>
          <div className="border-t border-white/[0.04] pt-3 space-y-1.5">
            <div className="flex justify-between text-[11px]"><span className="text-zinc-500">Leases expiring</span><span className="text-amber-400/70">3</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-zinc-500">Payments collected</span><span className="text-zinc-400">312</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-zinc-500">Supplier awaiting</span><span className="text-zinc-400">1</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
