'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function OrganisationPage() {
  const [entityId, setEntityId] = useState('');
  const [form, setForm] = useState({
    company_name: '', registration_number: '', vat_number: '', tax_number: '',
    physical_address: '', postal_address: '', telephone: '', email: '', website: '',
    logo_url: '', primary_color: '#000000', accent_color: '#D4AF37',
    font_family: 'Inter', legal_disclaimer: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      const eid = entities?.[0] || ''; setEntityId(eid);
      if (eid) {
        const { data } = await supabase.from('organisations').select('*').eq('entity_id', eid).single();
        if (data) setForm({
          company_name: data.company_name || '', registration_number: data.registration_number || '',
          vat_number: data.vat_number || '', tax_number: data.tax_number || '',
          physical_address: data.physical_address || '', postal_address: data.postal_address || '',
          telephone: data.telephone || '', email: data.email || '', website: data.website || '',
          logo_url: data.logo_url || '', primary_color: data.primary_color || '#000000',
          accent_color: data.accent_color || '#D4AF37', font_family: data.font_family || 'Inter',
          legal_disclaimer: data.legal_disclaimer || '',
        });
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!entityId) return;
    await supabase.from('organisations').upsert({
      entity_id: entityId, ...form, updated_at: new Date().toISOString(),
    }, { onConflict: 'entity_id' });
    // Also sync to invoice_configs for backward compatibility
    await supabase.from('invoice_configs').upsert({
      entity_id: entityId, company_name: form.company_name,
      company_vat_number: form.vat_number, company_address: form.physical_address,
      company_contact: form.telephone, logo_url: form.logo_url,
      registration_number: form.registration_number,
    }, { onConflict: 'entity_id' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Organisation</h1>
        <p className="text-sm text-zinc-500 mt-1">Company identity used across all documents and communications.</p>
      </div>
      <div className="space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Company Logo</label>
          <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center">
            <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="Logo URL" className="w-full max-w-xs rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white text-center outline-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Company Name</label>
          <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Registration Number</label><input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">VAT Number</label><input value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Physical Address</label>
          <input value={form.physical_address} onChange={(e) => setForm({ ...form, physical_address: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Postal Address</label>
          <input value={form.postal_address} onChange={(e) => setForm({ ...form, postal_address: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Telephone</label><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Primary Colour</label><input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-20 h-10 rounded border border-white/[0.08] bg-zinc-900" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Accent Colour</label><input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="w-20 h-10 rounded border border-white/[0.08] bg-zinc-900" /></div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Font</label>
          <select value={form.font_family} onChange={(e) => setForm({ ...form, font_family: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
            <option value="Inter">Inter</option><option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Georgia">Georgia</option>
          </select>
        </div>
        <button onClick={handleSave} className="rounded-lg bg-white px-6 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all">
          {saved ? '✓ Saved' : 'Save Organisation'}
        </button>
      </div>
    </div>
  );
}
