'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  entityId: string;
  initialData?: {
    name?: string;
    vat_number?: string;
    registration_number?: string;
  };
  onCreated: (supplier: any) => void;
  onCancel: () => void;
}

export default function CreateSupplierForm({ entityId, initialData, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    vat_registered: !!initialData?.vat_number,
    vat_number: initialData?.vat_number || '',
    registration_number: initialData?.registration_number || '',
    trading_name: '',
    legal_address: '',
    contact_person: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    bank_name: '',
    bank_account: '',
    bank_branch: '',
    payment_method: 'eft',
    payment_terms_days: 30,
    service_types: [] as string[],
    linked_property_ids: [] as string[],
  });
  const [properties, setProperties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const SERVICE_TYPES = ['Electrical', 'Plumbing', 'Security', 'Cleaning', 'HVAC', 'Lifts', 'Fire', 'General Maintenance', 'Legal', 'Insurance', 'Municipal', 'Other'];

  useState(() => {
    supabase.from('properties').select('id, property_name').eq('entity_id', entityId).then(({ data }) => setProperties(data || []));
  });

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const response = await fetch('/api/property/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ...form,
          entityId,
          categories: form.service_types,
          address: form.legal_address,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create supplier');
      }

      const data = await response.json();
      if (data.data) onCreated(data.data);
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-amber-400 mb-4">Supplier not found — create new supplier</p>
        
        <div className="space-y-3">
          {/* Basic */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Basic Information</p>
            <div className="space-y-2">
              <input type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Supplier name *" />
              <input type="text" value={form.trading_name} onChange={(e) => setForm(prev => ({ ...prev, trading_name: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Trading name (if different)" />
              <textarea value={form.legal_address} onChange={(e) => setForm(prev => ({ ...prev, legal_address: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" rows={2} placeholder="Legal address" />
            </div>
          </div>

          {/* VAT */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">VAT & Registration</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input type="checkbox" checked={form.vat_registered} onChange={(e) => setForm(prev => ({ ...prev, vat_registered: e.target.checked }))}
                  className="rounded" />
                VAT Registered
              </label>
              {form.vat_registered && (
                <input type="text" value={form.vat_number} onChange={(e) => setForm(prev => ({ ...prev, vat_number: e.target.value }))}
                  className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="VAT number" />
              )}
              <input type="text" value={form.registration_number} onChange={(e) => setForm(prev => ({ ...prev, registration_number: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Registration number (optional)" />
            </div>
          </div>

          {/* Service Types */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Service Types</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map(type => (
                <button key={type} onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    service_types: prev.service_types.includes(type)
                      ? prev.service_types.filter(t => t !== type)
                      : [...prev.service_types, type],
                  }));
                }}
                className={`px-3 py-1 rounded-full text-xs transition-all ${form.service_types.includes(type) ? 'bg-white text-black font-medium' : 'border border-white/[0.08] text-zinc-400 hover:text-white'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Contact Details</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={form.contact_person} onChange={(e) => setForm(prev => ({ ...prev, contact_person: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Contact person" />
              <input type="email" value={form.email} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Email" />
              <input type="text" value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Phone" />
              <input type="text" value={form.whatsapp_number} onChange={(e) => setForm(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="WhatsApp" />
            </div>
          </div>

          {/* Payment */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Payment Details</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={form.bank_name} onChange={(e) => setForm(prev => ({ ...prev, bank_name: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Bank name" />
              <input type="text" value={form.bank_account} onChange={(e) => setForm(prev => ({ ...prev, bank_account: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Account number" />
              <input type="text" value={form.bank_branch} onChange={(e) => setForm(prev => ({ ...prev, bank_branch: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Branch code" />
              <select value={form.payment_method} onChange={(e) => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
                <option value="eft">EFT</option>
                <option value="immediate_payment">Immediate Payment</option>
                <option value="debit_order">Debit Order</option>
              </select>
            </div>
            <input type="number" value={form.payment_terms_days} onChange={(e) => setForm(prev => ({ ...prev, payment_terms_days: parseInt(e.target.value) || 30 }))}
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Payment terms (days)" />
          </div>

          {/* Linked Properties */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Linked Properties (optional)</p>
            <div className="flex flex-wrap gap-2">
              {properties.map(p => (
                <button key={p.id} onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    linked_property_ids: prev.linked_property_ids.includes(p.id)
                      ? prev.linked_property_ids.filter(id => id !== p.id)
                      : [...prev.linked_property_ids, p.id],
                  }));
                }}
                className={`px-3 py-1 rounded-full text-xs transition-all ${form.linked_property_ids.includes(p.id) ? 'bg-white text-black font-medium' : 'border border-white/[0.08] text-zinc-400 hover:text-white'}`}>
                  {p.property_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving || !form.name}
          className="flex-1 rounded-full bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40">
          {saving ? 'Creating...' : 'Create Supplier & Continue'}
        </button>
        <button onClick={onCancel} className="rounded-full border border-white/[0.08] px-4 py-2.5 text-sm text-white hover:border-white/20">
          Cancel
        </button>
      </div>
    </div>
  );
}
