'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function SuppliersListPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [form, setForm] = useState<any>({ supplier_name: '', is_active: true, payment_method: 'eft', default_payment_terms: '30', category: '' });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      setEntityId(entities[0]);
      const { data } = await supabase.from('suppliers').select('*').eq('entity_id', entities[0]).order('supplier_name');
      setSuppliers(data || []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleSave() {
    await supabase.from('suppliers').insert({ ...form, entity_id: entityId });
    setShowAdd(false);
    setForm({ supplier_name: '', is_active: true, payment_method: 'eft', default_payment_terms: '30', category: '' });
    const { data } = await supabase.from('suppliers').select('*').eq('entity_id', entityId).order('supplier_name');
    setSuppliers(data || []);
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Suppliers</h1>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Supplier</button>
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Contact</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>{suppliers.map((s: any) => (<tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer" onClick={() => window.location.href = `/suppliers/suppliers/${s.id}`}><td className="py-2.5 px-4 text-white font-light">{s.supplier_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.email || s.phone || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.vat_number || '—'}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td></tr>))}</tbody>
        </table>
      </div>

      {/* ADD SUPPLIER MODAL — 80% screen */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
                <h1 className="text-lg font-light text-white">Add Supplier</h1>
                <div className="flex gap-2">
                  <button onClick={() => setShowAdd(false)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Cancel</button>
                  <button onClick={handleSave} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Create Supplier</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">General</p>
                    <input value={form.supplier_name || ''} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Supplier Name *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={form.trading_name || ''} onChange={(e) => setForm({ ...form, trading_name: e.target.value })} placeholder="Trading Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                      <input value={form.registered_name || ''} onChange={(e) => setForm({ ...form, registered_name: e.target.value })} placeholder="Registered Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={form.registration_number || ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Reg #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                      <input value={form.vat_number || ''} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} placeholder="VAT #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                      <input value={form.tax_number || ''} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} placeholder="Tax #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                    </div>
                    <select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Category</option><option value="municipality">Municipality</option><option value="utility">Utility</option><option value="contractor">Contractor</option><option value="security">Security</option><option value="cleaning">Cleaning</option><option value="insurance">Insurance</option><option value="maintenance">Maintenance</option><option value="other">Other</option></select>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Contact & Banking</p>
                    <div className="grid grid-cols-2 gap-2"><input value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="Contact Person" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.accounts_contact || ''} onChange={(e) => setForm({ ...form, accounts_contact: e.target.value })} placeholder="Accounts Contact" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                    <div className="grid grid-cols-2 gap-2"><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Banking</p>
                    <div className="grid grid-cols-3 gap-2"><input value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Bank" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.bank_account || ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="Account" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.bank_branch || ''} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} placeholder="Branch" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                    <div className="grid grid-cols-2 gap-2"><select value={form.payment_method || 'eft'} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="eft">EFT</option><option value="debit_order">Debit Order</option><option value="cash">Cash</option></select><input value={form.default_payment_terms || '30'} onChange={(e) => setForm({ ...form, default_payment_terms: e.target.value })} placeholder="Terms (days)" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                    <label className="flex items-center gap-2 text-xs text-zinc-400 pt-2"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
