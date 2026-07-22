'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CashBooksPage() {
  const [entityId, setEntityId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);
      const { data } = await supabase.from('bank_accounts').select('*').eq('entity_id', entities[0]);
      setAccounts(data || []);
    }
    load();
  }, []);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Cash Books</h1><p className="text-sm text-zinc-500 mt-1">Cash books linked to bank accounts for reconciliation.</p></div>
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Add Cash Book</button>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Cash Book</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Bank Account</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Currency</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-b border-white/[0.03]">
                <td className="py-2.5 px-4 text-white font-light">{a.account_name}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{a.bank_name} · {a.account_number}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{a.currency || 'ZAR'}</td>
                <td className="py-2.5 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${a.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{a.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
