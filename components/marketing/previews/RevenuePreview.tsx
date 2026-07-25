export function RevenuePreview() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 space-y-3">
      <div className="flex justify-between text-xs"><span className="text-zinc-500">Active Leases</span><span className="text-white font-medium">247</span></div>
      <div className="flex justify-between text-xs"><span className="text-zinc-500">Invoices This Month</span><span className="text-white font-medium">R842k</span></div>
      <div className="flex justify-between text-xs"><span className="text-zinc-500">Statements Sent</span><span className="text-emerald-400 font-medium">247</span></div>
      <div className="flex justify-between text-xs"><span className="text-zinc-500">Recoveries Billed</span><span className="text-white font-medium">R124k</span></div>
    </div>
  );
}
