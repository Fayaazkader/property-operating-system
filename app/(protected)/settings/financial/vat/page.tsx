'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_VAT = [
  { code: 'STD', name: 'Standard Rated', rate: 15, category: 'standard' },
  { code: 'ZERO', name: 'Zero Rated', rate: 0, category: 'zero_rated' },
  { code: 'EXEMPT', name: 'Exempt', rate: 0, category: 'exempt' },
  { code: 'NON-VAT', name: 'Non-VAT / Residential', rate: 0, category: 'non_vatable' },
];

export default function VatPage() {
  const [entityId, setEntityId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);
      const { data } = await supabase.from('chart_of_accounts').select('id, gl_code, account_name, vat_category, vat_rate').eq('entity_id', entities[0]).order('gl_code');
      setAccounts(data || []);
    }
    load();
  }, []);

  async function updateVat(accountId: string, category: string) {
    const vatCode = DEFAULT_VAT.find(v => v.category === category);
    await supabase.from('chart_of_accounts').update({ vat_category: category, vat_rate: vatCode?.rate || 0 }).eq('id', accountId);
    setAccounts(accounts.map(a => a.id === accountId ? { ...a, vat_category: category, vat_rate: vatCode?.rate || 0 } : a));
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">VAT Configuration</h1>
        <p className="text-sm text-zinc-500 mt-1">VAT codes are applied to GL accounts. Changing a code updates all linked accounts.</p>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-3">
        <p className="text-xs text-zinc-400 uppercase tracking-wider">VAT Codes</p>
        <div className="grid grid-cols-4 gap-3">
          {DEFAULT_VAT.map(v => (
            <div key={v.code} className="rounded-lg border border-white/[0.06] p-3 text-center">
              <p className="text-sm text-white font-medium">{v.code}</p>
              <p className="text-xs text-zinc-500">{v.name}</p>
              <p className="text-lg text-white font-light mt-1">{v.rate}%</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Code</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Account</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT Code</th></tr></thead>
          <tbody>
            {accounts.slice(0, 20).map(a => (
              <tr key={a.id} className="border-b border-white/[0.03]">
                <td className="py-2.5 px-4 text-zinc-400 text-xs font-mono">{a.gl_code}</td>
                <td className="py-2.5 px-4 text-white font-light text-xs">{a.account_name}</td>
                <td className="py-2.5 px-4">
                  <select value={a.vat_category || 'non_vatable'} onChange={(e) => updateVat(a.id, e.target.value)} className="rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-xs text-white outline-none">
                    {DEFAULT_VAT.map(v => (<option key={v.code} value={v.category}>{v.code} — {v.name}</option>))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
