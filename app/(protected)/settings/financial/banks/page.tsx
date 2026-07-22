'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function BanksPage() {
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
        <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Banks</h1><p className="text-sm text-zinc-500 mt-1">Bank accounts linked to your entities.</p></div>
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Add Bank</button>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Bank</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Account Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Number</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Branch</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-b border-white/[0.03]">
                <td className="py-2.5 px-4 text-white font-light">{a.bank_name}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{a.account_name}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs font-mono">{a.account_number}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs capitalize">{a.account_type}</td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{a.branch_code || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
