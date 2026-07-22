'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function OrganisationPage() {
  const [form, setForm] = useState({ company_name: '', registration_number: '', vat_number: '', tax_number: '', physical_address: '', postal_address: '', telephone: '', email: '', website: '' });
  const [entityId, setEntityId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data: config } = await supabase.from('invoice_configs').select('*').eq('entity_id', eid).single();
        if (config) setForm({ company_name: config.company_name || '', registration_number: config.registration_number || '', vat_number: config.company_vat_number || '', tax_number: '', physical_address: config.company_address || '', postal_address: '', telephone: config.company_contact || '', email: '', website: '' });
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!entityId) return;
    await supabase.from('invoice_configs').upsert({ entity_id: entityId, company_name: form.company_name, registration_number: form.registration_number, company_vat_number: form.vat_number, company_address: form.physical_address, company_contact: form.telephone }, { onConflict: 'entity_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Organisation</h1>{saved && <span className="text-xs text-emerald-400">✓ Saved</span>}</div>
      <div className="space-y-4">
        <input value={form.company_name} onChange={(e) => setForm({...form, company_name: e.target.value})} placeholder="Company Name" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <div className="grid grid-cols-2 gap-2"><input value={form.registration_number} onChange={(e) => setForm({...form, registration_number: e.target.value})} placeholder="Registration Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.vat_number} onChange={(e) => setForm({...form, vat_number: e.target.value})} placeholder="VAT Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <input value={form.tax_number} onChange={(e) => setForm({...form, tax_number: e.target.value})} placeholder="Tax Number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <input value={form.physical_address} onChange={(e) => setForm({...form, physical_address: e.target.value})} placeholder="Physical Address" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <input value={form.postal_address} onChange={(e) => setForm({...form, postal_address: e.target.value})} placeholder="Postal Address" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <div className="grid grid-cols-2 gap-2"><input value={form.telephone} onChange={(e) => setForm({...form, telephone: e.target.value})} placeholder="Telephone" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="Email" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <input value={form.website} onChange={(e) => setForm({...form, website: e.target.value})} placeholder="Website" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <button onClick={handleSave} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save</button>
      </div>
    </div>
  );
}
