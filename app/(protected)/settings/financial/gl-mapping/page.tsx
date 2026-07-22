'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_MAPPINGS = [
  { key: 'deposit_liability', label: 'Deposit Liability', description: 'Tenant deposits held' },
  { key: 'rental_income_commercial', label: 'Rental Income (Commercial)', description: 'Commercial rental revenue' },
  { key: 'rental_income_residential', label: 'Rental Income (Residential)', description: 'Residential rental revenue' },
  { key: 'accounts_receivable', label: 'Accounts Receivable', description: 'Tenant debtors' },
  { key: 'accounts_payable', label: 'Accounts Payable', description: 'Supplier creditors' },
  { key: 'bank_charges', label: 'Bank Charges', description: 'Bank fees and charges' },
  { key: 'vat_output', label: 'VAT Output', description: 'Output VAT on sales' },
  { key: 'vat_input', label: 'VAT Input', description: 'Input VAT on purchases' },
  { key: 'interest_income', label: 'Interest Income', description: 'Interest earned' },
  { key: 'commission_expense', label: 'Commission Expense', description: 'Broker commissions' },
];

export default function GLMappingPage() {
  const [entityId, setEntityId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);
      const { data: accts } = await supabase.from('chart_of_accounts').select('id, gl_code, account_name, account_type').eq('entity_id', entities[0]).order('gl_code');
      setAccounts(accts || []);
    }
    load();
  }, []);

  async function saveMapping(key: string, accountId: string) {
    setMappings({ ...mappings, [key]: accountId });
    // In production: save to a gl_mappings table
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">GL Mapping</h1>
        <p className="text-sm text-zinc-500 mt-1">Map business concepts to General Ledger accounts.</p>
      </div>
      <div className="space-y-3">
        {DEFAULT_MAPPINGS.map(m => (
          <div key={m.key} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
            <p className="text-sm text-white font-light">{m.label}</p>
            <p className="text-xs text-zinc-500 mb-2">{m.description}</p>
            <select value={mappings[m.key] || ''} onChange={(e) => saveMapping(m.key, e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
              <option value="">Select account...</option>
              {accounts.map(a => (<option key={a.id} value={a.id}>{a.gl_code} — {a.account_name}</option>))}
            </select>
          </div>
        ))}
      </div>
      <button className="rounded-lg bg-white px-6 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save Mappings</button>
    </div>
  );
}
