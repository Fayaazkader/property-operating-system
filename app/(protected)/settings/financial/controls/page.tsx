'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FinancialControlsPage() {
  const [form, setForm] = useState({ approval_limit_amount: '50000', auto_allocation_enabled: false, tolerance_percentage: '1.00', invoice_number_prefix: 'INV', credit_note_number_prefix: 'CN', journal_number_prefix: 'JNL' });
  const [entityId, setEntityId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data } = await supabase.from('financial_controls').select('*').eq('entity_id', eid).single();
        if (data) setForm({ approval_limit_amount: String(data.approval_limit_amount || 50000), auto_allocation_enabled: data.auto_allocation_enabled || false, tolerance_percentage: String(data.tolerance_percentage || 1.00), invoice_number_prefix: data.invoice_number_prefix || 'INV', credit_note_number_prefix: data.credit_note_number_prefix || 'CN', journal_number_prefix: data.journal_number_prefix || 'JNL' });
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!entityId) return;
    await supabase.from('financial_controls').upsert({ entity_id: entityId, approval_limit_amount: parseFloat(form.approval_limit_amount), auto_allocation_enabled: form.auto_allocation_enabled, tolerance_percentage: parseFloat(form.tolerance_percentage), invoice_number_prefix: form.invoice_number_prefix, credit_note_number_prefix: form.credit_note_number_prefix, journal_number_prefix: form.journal_number_prefix }, { onConflict: 'entity_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Financial Controls</h1>{saved && <span className="text-xs text-emerald-400">✓ Saved</span>}</div>
      <div className="space-y-4">
        <div><label className="text-[10px] text-zinc-500 block mb-1">Approval Limit (R)</label><input value={form.approval_limit_amount} onChange={(e) => setForm({...form, approval_limit_amount: e.target.value})} type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <div><label className="text-[10px] text-zinc-500 block mb-1">Auto-Allocation Tolerance %</label><input value={form.tolerance_percentage} onChange={(e) => setForm({...form, tolerance_percentage: e.target.value})} type="number" step="0.01" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <label className="flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" checked={form.auto_allocation_enabled} onChange={(e) => setForm({...form, auto_allocation_enabled: e.target.checked})} />Enable Auto-Allocation</label>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Number Sequences</p>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-[10px] text-zinc-500 block mb-1">Invoice Prefix</label><input value={form.invoice_number_prefix} onChange={(e) => setForm({...form, invoice_number_prefix: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div><label className="text-[10px] text-zinc-500 block mb-1">Credit Note Prefix</label><input value={form.credit_note_number_prefix} onChange={(e) => setForm({...form, credit_note_number_prefix: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div><label className="text-[10px] text-zinc-500 block mb-1">Journal Prefix</label><input value={form.journal_number_prefix} onChange={(e) => setForm({...form, journal_number_prefix: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        </div>
        <button onClick={handleSave} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save Controls</button>
      </div>
    </div>
  );
}
