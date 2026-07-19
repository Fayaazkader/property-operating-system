'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function MonthEndPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const result = await apApi.getMonthEndStatus(entities[0]).catch(() => ({ ready: false, pendingCount: 0 }));
      setStatus(result);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Month-End AP Assistant</h1>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs"><span className={status?.hasDrafts ? 'text-emerald-400' : 'text-zinc-500'}>{status?.hasDrafts ? '✓' : '○'}</span><span className={status?.hasDrafts ? 'text-zinc-300' : 'text-zinc-500'}>No Draft Invoices</span></div>
          <div className="flex items-center gap-2 text-xs"><span className={status?.ready ? 'text-emerald-400' : 'text-zinc-500'}>{status?.ready ? '✓' : '○'}</span><span className={status?.ready ? 'text-zinc-300' : 'text-zinc-500'}>Ready for Close</span></div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className={`text-sm font-medium ${status?.ready ? 'text-emerald-400' : 'text-amber-400'}`}>{status?.ready ? '✓ Ready for Close' : `${status?.pendingCount || 0} items need attention`}</p>
        </div>
      </div>
    </div>
  );
}
