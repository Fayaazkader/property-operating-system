'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function InvoiceConfigPage() {
  const [entityId, setEntityId] = useState('');
  const [form, setForm] = useState({
    show_balance_brought_forward: true,
    show_deposit_guarantee: true,
    show_next_period_charges: true,
    show_banking_details: true,
    show_qr_code: false,
    show_ageing: true,
    show_outstanding: true,
    logo_position: 'left',
    paper_size: 'A4',
    header_message: '',
    footer_message: 'Payment due within 7 days. Thank you for your prompt payment.',
    email_subject: 'Your {{period}} Invoice from {{company}}',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data: inv } = await supabase.from('invoice_configs').select('*').eq('entity_id', eid).single();
        const { data: stmt } = await supabase.from('statement_configs').select('*').eq('entity_id', eid).single();
        if (inv) setForm(prev => ({
          ...prev,
          show_balance_brought_forward: inv.show_balance_brought_forward ?? true,
          show_deposit_guarantee: inv.show_deposit_guarantee ?? true,
          header_message: inv.header_message || '',
          footer_message: inv.footer_message || prev.footer_message,
        }));
        if (stmt) setForm(prev => ({ ...prev, show_next_period_charges: stmt.show_next_period_charges ?? true }));
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!entityId) return;
    await supabase.from('invoice_configs').upsert({
      entity_id: entityId,
      show_balance_brought_forward: form.show_balance_brought_forward,
      show_deposit_guarantee: form.show_deposit_guarantee,
      header_message: form.header_message,
      footer_message: form.footer_message,
    }, { onConflict: 'entity_id' });
    await supabase.from('statement_configs').upsert({
      entity_id: entityId,
      show_next_period_charges: form.show_next_period_charges,
    }, { onConflict: 'entity_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Invoice & Statement Configuration</h1>
        <p className="text-sm text-zinc-500 mt-1">Control what appears on tenant-facing documents.</p>
      </div>

      <div className="space-y-6">
        {/* Invoice Display Options */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Invoice Display Options</p>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_balance_brought_forward} onChange={(e) => setForm({ ...form, show_balance_brought_forward: e.target.checked })} className="rounded" />
            Show balance brought forward & receipts
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_deposit_guarantee} onChange={(e) => setForm({ ...form, show_deposit_guarantee: e.target.checked })} className="rounded" />
            Show deposit held
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_banking_details} onChange={(e) => setForm({ ...form, show_banking_details: e.target.checked })} className="rounded" />
            Show banking details
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_qr_code} onChange={(e) => setForm({ ...form, show_qr_code: e.target.checked })} className="rounded" />
            Show payment QR code
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_ageing} onChange={(e) => setForm({ ...form, show_ageing: e.target.checked })} className="rounded" />
            Show ageing summary on statement
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_outstanding} onChange={(e) => setForm({ ...form, show_outstanding: e.target.checked })} className="rounded" />
            Show outstanding invoices on statement
          </label>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Logo Position</label>
              <select value={form.logo_position} onChange={(e) => setForm({ ...form, logo_position: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Paper Size</label>
              <select value={form.paper_size} onChange={(e) => setForm({ ...form, paper_size: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Messages & Templates</p>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Invoice Header Message</label>
            <input value={form.header_message} onChange={(e) => setForm({ ...form, header_message: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="Optional header text" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Invoice Footer Message</label>
            <input value={form.footer_message} onChange={(e) => setForm({ ...form, footer_message: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" placeholder="e.g. Payment due within 7 days" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Email Subject Template</label>
            <input value={form.email_subject} onChange={(e) => setForm({ ...form, email_subject: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <p className="text-[10px] text-zinc-600 mt-1">Variables: {'{{period}}'}, {'{{company}}'}, {'{{tenant}}'}</p>
          </div>
        </div>

        {/* Statement Options */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Statement Options</p>
          <label className="flex items-center gap-3 text-sm text-zinc-300 font-light cursor-pointer">
            <input type="checkbox" checked={form.show_next_period_charges} onChange={(e) => setForm({ ...form, show_next_period_charges: e.target.checked })} className="rounded" />
            Show next period projected charges
          </label>
        </div>

        <button onClick={handleSave} className="rounded-lg bg-white px-6 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">
          {saved ? '✓ Saved' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
