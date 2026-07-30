import { Wrench } from 'lucide-react';

export function MaintenanceCard() {
  return (
    <div className="absolute animate-float rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm p-5 shadow-lg shadow-black/30" style={{ left: 515, top: 230, width: 250, transform: 'rotate(1deg)', animationDelay: '0.9s' }}>
      <div className="flex items-center gap-2 mb-3">
        <Wrench className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-[10px] text-zinc-400 font-light">Maintenance</span>
      </div>
      <div className="space-y-2 text-[10px] font-light">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
          <span className="text-amber-400/80">#142 Blocked Drain</span>
        </div>
        <p className="text-zinc-500 ml-3.5">Assigned · 2 days ago</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
          <span className="text-zinc-300">#143 AC Repair</span>
        </div>
        <p className="text-zinc-500 ml-3.5">In Progress</p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="text-zinc-500">#144 Lift Service</span>
        </div>
        <p className="text-zinc-600 ml-3.5">Scheduled</p>
      </div>
    </div>
  );
}
