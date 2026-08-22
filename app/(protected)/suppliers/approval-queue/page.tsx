'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { permissionService } from '@/lib/rbac/permission-service';

export default function ApprovalQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityId, setEntityId] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);
      await loadQueue(entities[0]);
      setLoading(false);
    }
    init();
  }, []);

  async function loadQueue(eid: string) {
    const data = await apApi.getApprovalQueue(eid);
    setQueue(data || []);
  }

  async function handleApprove(id: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id || !entityId) {
    alert('Unable to verify your access.');
    return;
  }

  const permission = await permissionService.can(
  session.user.id,
  entityId,
  'invoices.approve'
);

if (!permission.allowed) {
  alert('You do not have permission to approve supplier invoices.');
  return;
}

 await apApi.approveInvoice(id, session.user.id, entityId);
  await loadQueue(entityId);
}
  async function handleReject(id: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id || !entityId) {
    alert('Unable to verify your access.');
    return;
  }

  const permission = await permissionService.can(
    session.user.id,
    entityId,
    'invoices.approve'
  );

  if (!permission.allowed) {
    alert('You do not have permission to approve or reject supplier invoices.');
    return;
  }

  await apApi.rejectInvoice(id, 'Rejected');
  await loadQueue(entityId);
}

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Approval Queue</h1>
      {!queue.length ? <p className="text-sm text-zinc-500 py-8 text-center">No invoices awaiting approval.</p> : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead>
            <tbody>{queue.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-right"><button onClick={() => handleApprove(inv.id)} className="text-emerald-400 hover:text-emerald-300 text-xs mr-2">Approve</button><button onClick={() => handleReject(inv.id)} className="text-red-400 hover:text-red-300 text-xs">Reject</button></td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
