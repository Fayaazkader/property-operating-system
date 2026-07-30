import { Mail } from 'lucide-react';
import { ProblemCard } from './ProblemCard';

export function TenantInboxCard({ scale = 1 }: { scale?: number }) {
  return (
    <ProblemCard className="animate-float" style={{ width: 240, transform: `rotate(0deg) scale(${scale})`, animationDelay: '1.5s' }}>
      <div className="flex items-center gap-2 mb-3"><Mail className="w-3.5 h-3.5 text-sky-400/70" /><span className="text-[10px] text-zinc-400 font-light">Tenant Inbox</span></div>
      <div className="space-y-2">
        <div className="border-b border-white/[0.04] pb-1.5"><div className="flex justify-between text-[10px]"><span className="text-zinc-300 font-medium">Lease Renewal</span><span className="text-zinc-600">09:41</span></div><p className="text-[9px] text-zinc-500">Sandton Office</p></div>
        <div className="border-b border-white/[0.04] pb-1.5"><div className="flex justify-between text-[10px]"><span className="text-zinc-300 font-medium">Invoice Query</span><span className="text-zinc-600">Yesterday</span></div><p className="text-[9px] text-zinc-500">Rosebank Mall</p></div>
        <div><div className="flex justify-between text-[10px]"><span className="text-zinc-300 font-medium">Maintenance Update</span><span className="text-zinc-600">Yesterday</span></div><p className="text-[9px] text-zinc-500">Alice Lane</p></div>
      </div>
    </ProblemCard>
  );
}
