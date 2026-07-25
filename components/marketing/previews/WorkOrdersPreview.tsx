export function WorkOrdersPreview() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5 space-y-2">
      <div className="flex items-center justify-between text-xs"><span className="text-zinc-500">#142 Blocked Drain</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">In Progress</span></div>
      <div className="flex items-center justify-between text-xs"><span className="text-zinc-500">#143 AC Repair</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Completed</span></div>
      <div className="flex items-center justify-between text-xs"><span className="text-zinc-500">Fire Compliance Check</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Scheduled</span></div>
      <div className="flex items-center justify-between text-xs"><span className="text-zinc-500">Generator Service</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Due Soon</span></div>
    </div>
  );
}
