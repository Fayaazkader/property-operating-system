'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const PREFIX_LABELS: Record<string, string> = { A: 'Asset', L: 'Liability', Q: 'Equity', I: 'Income', E: 'Expense' };

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [entityId, setEntityId] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ gl_code: '', account_name: '', account_type: 'expense', category: '', vat_category: 'standard', vat_rate: '15', is_active: true });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data } = await supabase.from('chart_of_accounts').select('*').eq('entity_id', eid).order('gl_code');
        setAccounts(data || []);
      }
    }
    load();
  }, []);

  async function handleAdd() {
    if (!entityId || !form.gl_code || !form.account_name) return;
    const prefix = form.account_type === 'asset' ? 'A' : form.account_type === 'liability' ? 'L' : form.account_type === 'equity' ? 'Q' : form.account_type === 'income' ? 'I' : 'E';
    await supabase.from('chart_of_accounts').insert({ entity_id: entityId, gl_code: form.gl_code, account_name: form.account_name, account_type: form.account_type, category: form.category, vat_category: form.vat_category, vat_rate: parseFloat(form.vat_rate), is_active: form.is_active, account_code_prefix: prefix });
    setShowAdd(false); setForm({ gl_code: '', account_name: '', account_type: 'expense', category: '', vat_category: 'standard', vat_rate: '15', is_active: true });
    const { data } = await supabase.from('chart_of_accounts').select('*').eq('entity_id', entityId).order('gl_code');
    setAccounts(data || []);
  }

  const filtered = accounts.filter(a => {
    if (search) { const q = search.toLowerCase(); if (!a.gl_code?.toLowerCase().includes(q) && !a.account_name?.toLowerCase().includes(q)) return false; }
    if (filterType && a.account_type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Chart of Accounts</h1><button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Account</button></div>
      <div className="flex gap-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code or name..." className="flex-1 rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-white outline-none" /><select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-white outline-none"><option value="">All Types</option><option value="asset">Assets</option><option value="liability">Liabilities</option><option value="equity">Equity</option><option value="income">Income</option><option value="expense">Expenses</option></select></div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Code</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Active</th></tr></thead><tbody>{filtered.map(a => (<tr key={a.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs font-mono">{a.account_code_prefix} • {a.gl_code}</td><td className="py-2.5 px-4 text-white font-light">{a.account_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs capitalize">{a.account_type}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{a.vat_category} {a.vat_rate > 0 ? `${a.vat_rate}%` : ''}</td><td className="py-2.5 px-4 text-center"><span className={`text-xs ${a.is_active ? 'text-emerald-400' : 'text-zinc-600'}`}>{a.is_active ? '✓' : '—'}</span></td></tr>))}</tbody></table></div>

      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Add Account</p><button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white">✕</button></div><div className="space-y-3">
            <select value={form.account_type} onChange={(e) => setForm({...form, account_type: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="income">Income</option><option value="expense">Expense</option></select>
            <input value={form.gl_code} onChange={(e) => setForm({...form, gl_code: e.target.value})} placeholder="GL Code (numbers only, e.g. 4000)" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />
            <input value={form.account_name} onChange={(e) => setForm({...form, account_name: e.target.value})} placeholder="Account Name" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />
            <input value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} placeholder="Category (e.g. Rental Income)" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" />
            <div className="grid grid-cols-2 gap-2"><select value={form.vat_category} onChange={(e) => setForm({...form, vat_category: e.target.value})} className="rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none"><option value="standard">Standard Rated</option><option value="zero_rated">Zero Rated</option><option value="exempt">Exempt</option><option value="non_vatable">Non-VAT</option></select><input value={form.vat_rate} onChange={(e) => setForm({...form, vat_rate: e.target.value})} placeholder="VAT %" type="number" className="rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /></div>
            <button onClick={handleAdd} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Add Account</button>
          </div></div></div>
        </>
      )}
    </div>
  );
}
