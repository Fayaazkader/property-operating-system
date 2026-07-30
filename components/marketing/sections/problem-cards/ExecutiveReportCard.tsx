import { FileText } from 'lucide-react';
import { ProblemCard } from './ProblemCard';

export function ExecutiveReportCard({ scale = 1 }: { scale?: number }) {
  return (
    <ProblemCard style={{ left: 40, top: 345, width: 230, transform: `rotate(-2deg) scale(${scale})`, animationDelay: '1.2s' }}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-3.5 h-3.5 text-red-400/70" />
        <span className="text-[10px] text-zinc-400 font-light">Executive Report.pdf</span>
      </div>
      <p className="text-[10px] text-zinc-500 mb-2">Portfolio Performance</p>
      <div className="space-y-1.5">
        <div><div className="flex justify-between text-[10px] text-zinc-400"><span>NOI</span><span>R1.2m</span></div><div className="h-1 bg-white/[0.06] rounded-full mt-0.5"><div className="h-1 bg-emerald-500/40 rounded-full" style={{width:'85%'}} /></div></div>
        <div><div className="flex justify-between text-[10px] text-zinc-400"><span>Occupancy</span><span>94%</span></div><div className="h-1 bg-white/[0.06] rounded-full mt-0.5"><div className="h-1 bg-blue-500/40 rounded-full" style={{width:'94%'}} /></div></div>
        <div><div className="flex justify-between text-[10px] text-zinc-400"><span>Revenue</span><span>R842k</span></div><div className="h-1 bg-white/[0.06] rounded-full mt-0.5"><div className="h-1 bg-purple-500/40 rounded-full" style={{width:'78%'}} /></div></div>
        <div><div className="flex justify-between text-[10px]"><span className="text-amber-400/80">Arrears</span><span className="text-amber-400/80">R120k</span></div><div className="h-1 bg-white/[0.06] rounded-full mt-0.5"><div className="h-1 bg-amber-500/40 rounded-full" style={{width:'15%'}} /></div></div>
      </div>
      <p className="text-[9px] text-zinc-600 mt-3">Generated: 31 July 2026</p>
    </ProblemCard>
  );
}
