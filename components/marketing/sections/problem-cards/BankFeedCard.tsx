import { Landmark } from 'lucide-react';
import { ProblemCard } from './ProblemCard';

export function BankFeedCard({ scale = 1 }: { scale?: number }) {
  return (
    <ProblemCard style={{ left: 120, top: 155, width: 220, transform: `rotate(0deg) scale(${scale})`, animationDelay: '0.6s' }}>
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-3.5 h-3.5 text-purple-400/70" />
        <span className="text-[10px] text-zinc-400 font-light">Bank Feed</span>
      </div>
      <table className="w-full text-[10px] font-light">
        <thead><tr className="text-zinc-500 border-b border-white/[0.06]"><td className="py-1">Date</td><td className="py-1">Ref</td><td className="py-1 text-right">Amount</td></tr></thead>
        <tbody>
          <tr className="text-zinc-300"><td className="py-0.5">15 Jul</td><td className="py-0.5">INV1024</td><td className="py-0.5 text-right text-emerald-400/70">+52k</td></tr>
          <tr className="text-zinc-300"><td className="py-0.5">15 Jul</td><td className="py-0.5">DEP884</td><td className="py-0.5 text-right text-emerald-400/70">+18k</td></tr>
          <tr className="text-zinc-300"><td className="py-0.5">14 Jul</td><td className="py-0.5">EFT442</td><td className="py-0.5 text-right text-red-400/60">-7.5k</td></tr>
        </tbody>
      </table>
      <div className="mt-2 pt-2 border-t border-white/[0.06] flex justify-between text-[10px]">
        <span className="text-zinc-500">Matched</span><span className="text-emerald-400/70">2</span>
        <span className="text-zinc-500 ml-3">Unmatched</span><span className="text-amber-400/70">1</span>
      </div>
    </ProblemCard>
  );
}
