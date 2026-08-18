'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Search } from 'lucide-react';

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

const SERVICE_TYPES = ['Electrical', 'Plumbing', 'Security', 'Cleaning', 'HVAC', 'Lifts', 'Fire', 'General Maintenance', 'Legal', 'Insurance', 'Municipal', 'Other'];

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
  }, [entityId]);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertySearch, setPropertySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  useEffect(() => {
    supabase.from('properties').select('id, property_name').eq('entity_id', entityId).then(({ data }) => setProperties(data || []));
  }, [entityId]);

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
      }, [entityId]);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create supplier');
      }

      const data = await response.json();
      if (data.data) {
        setCreated(true);
        setTimeout(() => onCreated(data.data), 800);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const filteredProperties = properties.filter(p => 
    !propertySearch || p.property_name.toLowerCase().includes(propertySearch.toLowerCase())
  );

  if (created) {
    return (
      <div className="py-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
          <CheckCircle className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-base font-medium text-white">Supplier created</p>
        <p className="text-sm text-zinc-400 mt-1">
          {form.name} has been added to your supplier master.
        </p>
        <p className="text-xs text-zinc-600 mt-4">Continuing to invoice capture...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 px-4 py-3">
        <p className="text-xs text-amber-400">Supplier not found — create new supplier</p>
      </div>

      {/* SECTION: Legal Identity */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-1">Legal Identity</p>
        <p className="text-[11px] text-zinc-600 mb-3">Registration and tax information</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Supplier Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Trading Name</label>
            <input type="text" value={form.trading_name} onChange={(e) => setForm(prev => ({ ...prev, trading_name: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" placeholder="If different from legal name" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Legal Address</label>
            <textarea value={form.legal_address} onChange={(e) => setForm(prev => ({ ...prev, legal_address: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" rows={2} />
          </div>
        </div>
      </div>

      {/* SECTION: Tax & Registration */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-1">Tax & Registration</p>
        <p className="text-[11px] text-zinc-600 mb-3">VAT and company registration</p>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input type="checkbox" checked={form.vat_registered} onChange={(e) => setForm(prev => ({ ...prev, vat_registered: e.target.checked }))}
              className="rounded" />
            VAT Registered
          </label>
          {form.vat_registered && (
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">VAT Number</label>
              <input type="text" value={form.vat_number} onChange={(e) => setForm(prev => ({ ...prev, vat_number: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
            </div>
          )}
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Registration Number</label>
            <input type="text" value={form.registration_number} onChange={(e) => setForm(prev => ({ ...prev, registration_number: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
        </div>
      </div>

      {/* SECTION: Services */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-1">Services</p>
        <p className="text-[11px] text-zinc-600 mb-3">What this supplier provides</p>
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
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${form.service_types.includes(type) ? 'bg-white text-black font-medium' : 'border border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION: Contacts */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-1">Contacts</p>
        <p className="text-[11px] text-zinc-600 mb-3">Who AssetFlow communicates with</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Contact Person</label>
            <input type="text" value={form.contact_person} onChange={(e) => setForm(prev => ({ ...prev, contact_person: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">WhatsApp</label>
            <input type="text" value={form.whatsapp_number} onChange={(e) => setForm(prev => ({ ...prev, whatsapp_number: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
        </div>
      </div>

      {/* SECTION: Payment Details */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-1">Payment Details</p>
        <p className="text-[11px] text-zinc-600 mb-3">How the supplier is paid</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Bank Name</label>
            <input type="text" value={form.bank_name} onChange={(e) => setForm(prev => ({ ...prev, bank_name: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Account Number</label>
            <input type="text" value={form.bank_account} onChange={(e) => setForm(prev => ({ ...prev, bank_account: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Branch Code</label>
            <input type="text" value={form.bank_branch} onChange={(e) => setForm(prev => ({ ...prev, bank_branch: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Payment Method</label>
            <select value={form.payment_method} onChange={(e) => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
              <option value="eft">EFT</option>
              <option value="immediate_payment">Immediate Payment</option>
              <option value="debit_order">Debit Order</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-[11px] text-zinc-500 mb-1">Payment Terms (days)</label>
          <input type="number" value={form.payment_terms_days} onChange={(e) => setForm(prev => ({ ...prev, payment_terms_days: parseInt(e.target.value) || 30 }))}
            className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>
      </div>

      {/* SECTION: Linked Properties */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-1">Property Relationships</p>
        <p className="text-[11px] text-zinc-600 mb-3">Where this supplier operates</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
            placeholder="Search properties..." />
        </div>
        {form.linked_property_ids.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.linked_property_ids.map(id => {
              const prop = properties.find(p => p.id === id);
              return (
                <button key={id} onClick={() => setForm(prev => ({ ...prev, linked_property_ids: prev.linked_property_ids.filter(pid => pid !== id) }))}
                  className="px-3 py-1 rounded-full bg-white text-black text-xs font-medium">
                  {prop?.property_name} ✕
                </button>
              );
            })}
          </div>
        )}
        <div className="max-h-40 overflow-y-auto space-y-1">
          {filteredProperties.slice(0, 10).map(p => (
            <button key={p.id} onClick={() => {
              if (!form.linked_property_ids.includes(p.id)) {
                setForm(prev => ({ ...prev, linked_property_ids: [...prev.linked_property_ids, p.id] }));
              }
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.03] transition-colors">
              {p.property_name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSubmit} disabled={saving || !form.name}
          className="flex-1 rounded-full bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all">
          {saving ? 'Creating...' : 'Create Supplier & Continue'}
        </button>
        <button onClick={onCancel} className="rounded-full border border-white/[0.08] px-5 py-3 text-sm text-white hover:border-white/20 transition-all">
          Cancel
        </button>
      </div>
    </div>
  );
}
