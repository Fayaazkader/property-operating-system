'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function RecurringPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: '', glCode: '', amount: '', frequency: 'monthly' });
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);
      const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entities[0]);
      setExpenses(data || []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleAdd() {
    await apApi.createRecurringExpense({ entityId, description: form.description, glCode: form.glCode, amount: parseFloat(form.amount), frequency: form.frequency });
    setShowAdd(false);
    const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId);
    setExpenses(data || []);
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Recurring Expenses</h1>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add</button>
      </div>
      {!expenses.length ? <p className="text-sm text-zinc-500 py-8 text-center">No recurring expenses.</p> : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">GL</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Frequency</th></tr></thead>
            <tbody>{expenses.map(e => (<tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{e.description}</td><td className="py-2.5 px-4 text-zinc-400">{e.gl_code}</td><td className="py-2.5 px-4 text-right text-white tabular-nums">R{e.amount.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-400 capitalize">{e.frequency}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
      )}
      {showAdd && (
        <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Add Recurring Expense</p><button onClick={() => setShowAdd(false)} className="text-zinc-500 hover:text-white">✕</button></div>
            <div className="space-y-3">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
              <input value={form.glCode} onChange={(e) => setForm({ ...form, glCode: e.target.value })} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
              <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none">
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option>
              </select>
              <button onClick={handleAdd} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
