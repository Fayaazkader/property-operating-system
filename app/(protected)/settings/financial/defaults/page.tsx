'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_MAPPINGS = [
  { key: 'default_deposit_gl', label: 'Deposit Liability Account', defaultCode: '2100' },
  { key: 'default_rental_income_gl', label: 'Rental Income Account', defaultCode: '4000' },
  { key: 'default_interest_income_gl', label: 'Interest Income Account', defaultCode: '4200' },
  { key: 'default_bank_charges_gl', label: 'Bank Charges Account', defaultCode: '5700' },
  { key: 'default_vat_output_gl', label: 'VAT Output Account', defaultCode: '2200' },
  { key: 'default_vat_input_gl', label: 'VAT Input Account', defaultCode: '2300' },
  { key: 'default_ar_gl', label: 'Accounts Receivable', defaultCode: '1100' },
  { key: 'default_ap_gl', label: 'Accounts Payable', defaultCode: '2000' },
  { key: 'default_bank_gl', label: 'Default Bank Account', defaultCode: '1000' },
  { key: 'default_penalty_income_gl', label: 'Penalty Income Account', defaultCode: '4400' },
  { key: 'default_commission_expense_gl', label: 'Commission Expense Account', defaultCode: '5600' },
];

export default function FinanceDefaultsPage() {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [entityId, setEntityId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data: config } = await supabase.from('invoice_configs').select('*').eq('entity_id', eid).single();
        const { data: accts } = await supabase.from('chart_of_accounts').select('gl_code, account_name, account_code_prefix').eq('entity_id', eid).order('gl_code');
        setAccounts(accts || []);
        const current: Record<string, string> = {};
        for (const m of DEFAULT_MAPPINGS) { current[m.key] = (config as any)?.[m.key] || m.defaultCode; }
        setMappings(current);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!entityId) return;
    await supabase.from('invoice_configs').upsert({ entity_id: entityId, ...mappings }, { onConflict: 'entity_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Finance Defaults</h1>{saved && <span className="text-xs text-emerald-400">✓ Saved</span>}</div>
      <p className="text-xs text-zinc-500">Default GL accounts used by the Posting Engine. These can be overridden per property or lease.</p>
      <div className="space-y-3">
        {DEFAULT_MAPPINGS.map(m => (
          <div key={m.key}><label className="text-[10px] text-zinc-500 block mb-1">{m.label}</label>
            <select value={mappings[m.key] || ''} onChange={(e) => setMappings({...mappings, [m.key]: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
              {accounts.map(a => (<option key={a.gl_code} value={a.gl_code}>{a.account_code_prefix} • {a.gl_code} — {a.account_name}</option>))}
            </select>
          </div>
        ))}
        <button onClick={handleSave} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save Defaults</button>
      </div>
    </div>
  );
}
