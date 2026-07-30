import { Table2 } from 'lucide-react';
import { ProblemCard } from './ProblemCard';

export function LeaseRegisterCard({ scale = 1 }: { scale?: number }) {
  return (
    <ProblemCard className="animate-float" style={{ width: 260, transform: `rotate(-1.5deg) scale(${scale})`, animationDelay: '0s' }}>
      <div className="flex items-center gap-2 mb-3">
        <Table2 className="w-3.5 h-3.5 text-emerald-400/70" />
        <span className="text-[10px] text-zinc-400 font-light">Lease Register.xlsx</span>
      </div>
      <table className="w-full text-[10px] text-zinc-300 font-light">
        <thead><tr className="text-zinc-500 border-b border-white/[0.06]"><td className="py-1">Tenant</td><td className="py-1">Start</td><td className="py-1">End</td><td className="py-1 text-right">Rental</td></tr></thead>
        <tbody>
          <tr><td className="py-0.5">Sandton</td><td className="py-0.5">Jan 26</td><td className="py-0.5">Jun 28</td><td className="py-0.5 text-right">R52k</td></tr>
          <tr><td className="py-0.5">Rosebank</td><td className="py-0.5">Jul 25</td><td className="py-0.5">Jun 30</td><td className="py-0.5 text-right">R48k</td></tr>
          <tr><td className="py-0.5">Alice Ln</td><td className="py-0.5">Mar 24</td><td className="py-0.5">Mar 27</td><td className="py-0.5 text-right">R32k</td></tr>
        </tbody>
      </table>
    </ProblemCard>
  );
}
