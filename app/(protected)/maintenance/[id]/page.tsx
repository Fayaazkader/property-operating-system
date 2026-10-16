'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MaintenanceInvoiceReview } from '@/components/maintenance/MaintenanceInvoiceReview';
import { WorkOrderLifecycle } from '@/components/maintenance/WorkOrderLifecycle';
import { PrepareWorkOrderAction } from '@/components/maintenance/PrepareWorkOrderAction';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, MapPin, User, FileText, Wrench, MessageSquare } from 'lucide-react';

export default function IssueWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [issue, setIssue] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loadError,setLoadError]=useState('');const [generation,setGeneration]=useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active=true;setLoading(true);setLoadError('');
    async function load() {
      try {
        const issueResult=await supabase.from('maintenance_issues').select('*').eq('id',id).single();
        if(issueResult.error||!issueResult.data)throw new Error('Issue unavailable');
        const woResult=await supabase.from('work_orders').select('*').eq('issue_id',id).eq('entity_id',issueResult.data.entity_id);
        if(woResult.error)throw woResult.error;
        const orders=woResult.data??[];let visitData:any[]=[];
        if(orders.length){const visitResult=await supabase.from('supplier_visits').select('*').in('work_order_id',orders.map(w=>w.id));if(visitResult.error)throw visitResult.error;visitData=visitResult.data??[];}
        if(active){setIssue(issueResult.data);setWorkOrders(orders);setVisits(visitData);}
      } catch {if(active)setLoadError('Unable to load this maintenance issue and its work orders. Try again.');}
      finally {if(active)setLoading(false);}
    }
    void load();return()=>{active=false;};
  }, [id,generation]);

  if (loading) return <div className="p-20 text-[var(--text-secondary)] text-center">Loading...</div>;
  if(loadError)return <div className="space-y-4 p-6"><p role="alert">{loadError}</p><button type="button" className="af-control" onClick={()=>setGeneration(n=>n+1)}>Reload issue</button></div>;
  if (!issue) return <div className="p-20 text-[var(--text-secondary)] text-center">Issue not found.</div>;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Left: Issue Detail */}
      <div className="min-w-0 flex-1 p-5 sm:p-8 overflow-y-auto space-y-8">
        <button onClick={() => router.back()} className="af-control flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              issue.priority === 'emergency' ? 'bg-red-500/10 text-red-400' :
              issue.priority === 'urgent' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-[var(--text-secondary)]'
            }`}>{issue.priority}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              issue.status === 'reported' ? 'bg-amber-500/10 text-amber-400' :
              issue.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>{issue.status.replace('_', ' ')}</span>
          </div>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-[var(--text-primary)]">{issue.title}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 font-light">{issue.description || 'No description provided.'}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">Details</p>
            <div className="space-y-2 text-xs font-light">
              <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-[var(--text-secondary)]" /><span className="text-[var(--text-secondary)]">Category:</span><span className="text-[var(--text-primary)] capitalize">{issue.category?.replace('_', ' ')}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-[var(--text-secondary)]" /><span className="text-[var(--text-secondary)]">Reported:</span><span className="text-[var(--text-primary)]">{issue.created_at ? new Date(issue.created_at).toLocaleString('en-ZA') : '-'}</span></div>
              <div className="flex items-center gap-2"><User className="w-3 h-3 text-[var(--text-secondary)]" /><span className="text-[var(--text-secondary)]">Via:</span><span className="text-[var(--text-primary)] capitalize">{issue.reported_via}</span></div>
              <div className="flex items-center gap-2"><Wrench className="w-3 h-3 text-[var(--text-secondary)]" /><span className="text-[var(--text-secondary)]">Responsibility:</span><span className="text-[var(--text-primary)]">{issue.landlord_responsibility ? 'Landlord' : 'Tenant'}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">Work Orders</p>
            {workOrders.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] font-light">No work orders yet.</p>
            ) : (
              workOrders.map(wo => (
                <div key={wo.id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--text-primary)] font-light">{wo.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    wo.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>{wo.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <PrepareWorkOrderAction issueId={String(id)} entityId={issue.entity_id} propertyId={issue.property_id} exists={workOrders.length>0}
            onPrepared={order=>setWorkOrders(previous=>previous.some(w=>w.id===order.id)?previous:[...previous,order])}/>


        </div>
        {workOrders.map(order=><WorkOrderLifecycle key={order.id} order={order} onChanged={()=>setGeneration(n=>n+1)}/>)}
        {workOrders.filter(order=>['verified','closed'].includes(order.status)).map(order=><MaintenanceInvoiceReview key={'finance-'+order.id} order={order} onChanged={()=>setGeneration(n=>n+1)}/>)}
      </div>

      {/* Right: Timeline */}
      <div className="w-full lg:w-72 border-l border-[var(--border-default)] p-6 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6">Timeline</p>
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.04]" />
          <div className="space-y-4">
            <div className="relative pl-5">
              <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-amber-400" />
              <p className="text-[10px] text-[var(--text-secondary)]">{issue.created_at ? new Date(issue.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              <p className="text-xs text-[var(--text-primary)] font-light mt-0.5">Issue Reported</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Via {issue.reported_via}</p>
            </div>
            {visits.map((v: any, i: number) => (
              <div key={i} className="relative pl-5">
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-blue-400" />
                <p className="text-[10px] text-[var(--text-secondary)]">{v.scheduled_at ? new Date(v.scheduled_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-[var(--text-primary)] font-light mt-0.5">Visit {v.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
