'use client';
import { useState } from 'react';
export default function OrganisationPage() {
  const [form, setForm] = useState({ company_name: '', registration_number: '', vat_number: '', tax_number: '', physical_address: '', postal_address: '' });
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Organisation</h1>
      <div className="space-y-4">
        <input value={form.company_name} onChange={(e) => setForm({...form, company_name: e.target.value})} placeholder="Company Name" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.registration_number} onChange={(e) => setForm({...form, registration_number: e.target.value})} placeholder="Registration Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
          <input value={form.vat_number} onChange={(e) => setForm({...form, vat_number: e.target.value})} placeholder="VAT Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>
        <input value={form.tax_number} onChange={(e) => setForm({...form, tax_number: e.target.value})} placeholder="Tax Number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <input value={form.physical_address} onChange={(e) => setForm({...form, physical_address: e.target.value})} placeholder="Physical Address" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <input value={form.postal_address} onChange={(e) => setForm({...form, postal_address: e.target.value})} placeholder="Postal Address" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        <button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">Save</button>
      </div>
    </div>
  );
}
