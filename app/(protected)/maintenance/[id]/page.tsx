'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, MapPin, User, FileText, Wrench, MessageSquare } from 'lucide-react';

export default function IssueWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [issue, setIssue] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: issueData } = await supabase.from('maintenance_issues').select('*').eq('id', id).single();
      setIssue(issueData);

      const { data: woData } = await supabase.from('work_orders').select('*').eq('issue_id', id);
      setWorkOrders(woData || []);

      if (woData?.length) {
        const woIds = woData.map((w: any) => w.id);
        const { data: visitData } = await supabase.from('supplier_visits').select('*').in('work_order_id', woIds);
        setVisits(visitData || []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;
  if (!issue) return <div className="p-20 text-zinc-500 text-center">Issue not found.</div>;

  return (
    <div className="flex h-full">
      {/* Left: Issue Detail */}
      <div className="flex-1 p-8 overflow-y-auto space-y-8">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              issue.priority === 'emergency' ? 'bg-red-500/10 text-red-400' :
              issue.priority === 'urgent' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'
            }`}>{issue.priority}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              issue.status === 'reported' ? 'bg-amber-500/10 text-amber-400' :
              issue.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>{issue.status.replace('_', ' ')}</span>
          </div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">{issue.title}</h1>
          <p className="text-sm text-zinc-500 mt-2 font-light">{issue.description || 'No description provided.'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Details</p>
            <div className="space-y-2 text-xs font-light">
              <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-zinc-500" /><span className="text-zinc-400">Category:</span><span className="text-white capitalize">{issue.category?.replace('_', ' ')}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-zinc-500" /><span className="text-zinc-400">Reported:</span><span className="text-white">{issue.created_at ? new Date(issue.created_at).toLocaleString('en-ZA') : '-'}</span></div>
              <div className="flex items-center gap-2"><User className="w-3 h-3 text-zinc-500" /><span className="text-zinc-400">Via:</span><span className="text-white capitalize">{issue.reported_via}</span></div>
              <div className="flex items-center gap-2"><Wrench className="w-3 h-3 text-zinc-500" /><span className="text-zinc-400">Responsibility:</span><span className="text-white">{issue.landlord_responsibility ? 'Landlord' : 'Tenant'}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Work Orders</p>
            {workOrders.length === 0 ? (
              <p className="text-xs text-zinc-500 font-light">No work orders yet.</p>
            ) : (
              workOrders.map(wo => (
                <div key={wo.id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-white font-light">{wo.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    wo.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>{wo.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Create Work Order</button>
          <button className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">Request Quotes</button>
          <button className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">Assign Supplier</button>
        </div>
      </div>

      {/* Right: Timeline */}
      <div className="w-72 border-l border-white/[0.04] p-6 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-6">Timeline</p>
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.04]" />
          <div className="space-y-4">
            <div className="relative pl-5">
              <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-amber-400" />
              <p className="text-[10px] text-zinc-600">{issue.created_at ? new Date(issue.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              <p className="text-xs text-white font-light mt-0.5">Issue Reported</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Via {issue.reported_via}</p>
            </div>
            {visits.map((v: any, i: number) => (
              <div key={i} className="relative pl-5">
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-blue-400" />
                <p className="text-[10px] text-zinc-600">{v.scheduled_at ? new Date(v.scheduled_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-white font-light mt-0.5">Visit {v.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
