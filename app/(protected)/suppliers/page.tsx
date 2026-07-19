'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { apIntelligence } from '@/lib/accounts-payable/intelligence';

export default function APDashboardPage() {
  const [entityId, setEntityId] = useState('');
  const [data, setData] = useState<any>({});
  const [approvalCount, setApprovalCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const eid = entities[0]; setEntityId(eid);
      const [outstanding, aging, monthEnd, queue, warnings] = await Promise.all([
        apApi.getOutstandingAP(eid).catch(() => 0),
        apApi.getAging(eid).catch(() => ({})),
        apApi.getMonthEndStatus(eid).catch(() => ({ ready: false })),
        apApi.getApprovalQueue(eid).catch(() => []),
        apIntelligence.getWarnings(eid).catch(() => []),
      ]);
      setData({ outstandingAP: outstanding, aging, monthEnd });
      setApprovalCount((queue || []).length);
      setWarningCount((warnings || []).length);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Accounts Payable</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <KPI label="Outstanding AP" value={`R${(data.outstandingAP || 0).toLocaleString()}`} />
        <KPI label="Awaiting Approval" value={approvalCount} highlight />
        <KPI label="Warnings" value={warningCount} highlight={warningCount > 0} />
        <KPI label="Month-End" value={data.monthEnd?.ready ? 'Ready' : 'Pending'} />
      </div>
      {data.aging && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging</p>
          <div className="grid grid-cols-5 gap-3 text-center text-xs">
            {[{ label: 'Current', value: data.aging.current }, { label: '1-30', value: data.aging.days30 }, { label: '31-60', value: data.aging.days60 }, { label: '61-90', value: data.aging.days90 }, { label: '120+', value: data.aging.days120 }].map(b => (
              <div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
                <p className="text-zinc-500">{b.label}</p>
                <p className={`text-sm font-medium mt-1 ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, highlight }: any) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">{label}</p>
      <p className={`text-xl font-light ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
