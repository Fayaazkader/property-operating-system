'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function SupplierDetailPage() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [form, setForm] = useState<any>({});
  const [linkForm, setLinkForm] = useState({ property_id: '', account_number: '', account_name: '', default_gl: '', default_vat: '15' });

  useEffect(() => {
    async function load() {
      const [supp, propList] = await Promise.all([
        supabase.from('suppliers').select('*').eq('id', id).single(),
        supabase.from('properties').select('id, property_name').order('property_name'),
      ]);
      setSupplier(supp); setProperties(propList.data || []);
      if (supp) setForm(supp);
      const [ledgerData, accountsData] = await Promise.all([
        apApi.getSupplierLedger(id as string),
        supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', id),
      ]);
      setLedger(ledgerData); setAccounts(accountsData.data || []);
      const invs = ledgerData?.invoices || [];
      setStats({ totalInvoices: invs.length, totalAmount: invs.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) });
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() { await supabase.from('suppliers').update(form).eq('id', id); setSupplier(form); setShowEdit(false); }
  async function handleLinkService() {
    await supabase.from('supplier_accounts').upsert({ entity_id: supplier.entity_id, supplier_id: id, property_id: linkForm.property_id, account_number: linkForm.account_number, account_name: linkForm.account_name, default_gl: linkForm.default_gl, default_vat: linkForm.default_vat }, { onConflict: 'supplier_id,property_id,account_number' });
    setShowLink(false); setLinkForm({ property_id: '', account_number: '', account_name: '', default_gl: '', default_vat: '15' });
    const { data } = await supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', id); setAccounts(data || []);
  }

  if (loading) return <div className="text-zinc-500 p-8">Loading...</div>;
  if (!supplier) return <div className="text-zinc-500 p-8">Supplier not found.</div>;

  const tabs = ['overview', 'services', 'invoices'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/suppliers/suppliers" className="text-xs text-zinc-500 hover:text-white">← Suppliers</a>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white mt-1">{supplier.supplier_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{supplier.is_active ? 'Active' : 'Inactive'}</span>
            {supplier.category && <span className="text-[10px] text-zinc-500 capitalize">{supplier.category}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Edit Supplier</button>
          <button onClick={() => window.print()} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Print</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {tabs.map(t => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-light capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t}</button>))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Details</p><div className="space-y-1 text-xs">{supplier.registered_name && <p className="text-zinc-400">{supplier.registered_name}</p>}{supplier.vat_number && <p className="text-zinc-400">VAT: {supplier.vat_number}</p>}{supplier.registration_number && <p className="text-zinc-400">Reg: {supplier.registration_number}</p>}{supplier.category && <p className="text-zinc-400 capitalize">Category: {supplier.category}</p>}</div></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Contact & Banking</p><div className="space-y-1 text-xs">{supplier.email && <p className="text-zinc-400">Email: {supplier.email}</p>}{supplier.phone && <p className="text-zinc-400">Phone: {supplier.phone}</p>}{supplier.bank_name && <p className="text-zinc-400 mt-2">Bank: {supplier.bank_name}</p>}{supplier.bank_account && <p className="text-zinc-400">Account: {supplier.bank_account}</p>}</div></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Statistics</p>{stats && <div className="space-y-2 text-xs"><div className="flex justify-between"><span className="text-zinc-500">Invoices</span><span className="text-white">{stats.totalInvoices}</span></div><div className="flex justify-between"><span className="text-zinc-500">Total</span><span className="text-white">R{stats.totalAmount?.toLocaleString()}</span></div></div>}</div>
        </div>
      )}

      {tab === 'services' && (
        <>
          <div className="flex justify-end mb-3"><button onClick={() => setShowLink(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Link New Service</button></div>
          <div className="space-y-3">{accounts.length === 0 && <p className="text-sm text-zinc-500 py-4 text-center">No linked services.</p>}{accounts.map((a: any) => (<div key={a.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><div className="flex justify-between items-start"><div><p className="text-sm text-white font-light">{a.account_number}</p><p className="text-xs text-zinc-500">{a.property?.property_name || '—'} · {a.account_name || 'No name'}</p></div><div className="text-right text-[10px] text-zinc-500">{a.default_gl && <p>GL: {a.default_gl}</p>}{a.default_vat && <p>VAT: {a.default_vat}%</p>}</div></div></div>))}</div>
        </>
      )}

      {tab === 'invoices' && ledger?.invoices && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-2 px-4 text-[10px] text-zinc-500 uppercase">Date</th><th className="text-left py-2 px-4 text-[10px] text-zinc-500 uppercase">Invoice #</th><th className="text-right py-2 px-4 text-[10px] text-zinc-500 uppercase">Amount</th></tr></thead><tbody>{ledger.invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td><td className="py-2 px-4 text-white text-xs">{inv.invoice_number}</td><td className="py-2 px-4 text-right text-white text-xs">R{inv.total_amount?.toLocaleString()}</td></tr>))}</tbody></table></div>
      )}

      {/* EDIT SUPPLIER — 80% screen */}
      {showEdit && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
                <h1 className="text-lg font-light text-white">Edit Supplier</h1>
                <div className="flex gap-2">
                  <button onClick={() => setShowEdit(false)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Cancel</button>
                  <button onClick={handleSave} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Update Supplier</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">General</p>
                    <input value={form.supplier_name || ''} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Supplier Name *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={form.trading_name || ''} onChange={(e) => setForm({ ...form, trading_name: e.target.value })} placeholder="Trading Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.registered_name || ''} onChange={(e) => setForm({ ...form, registered_name: e.target.value })} placeholder="Registered Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={form.registration_number || ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Reg #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.vat_number || ''} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} placeholder="VAT #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.tax_number || ''} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} placeholder="Tax #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    </div>
                    <select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0">
                      <option value="">Category</option><option value="municipality">Municipality</option><option value="utility">Utility</option><option value="contractor">Contractor</option><option value="security">Security</option><option value="cleaning">Cleaning</option><option value="insurance">Insurance</option><option value="maintenance">Maintenance</option><option value="other">Other</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.payment_method || 'eft'} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0">
                        <option value="eft">EFT</option><option value="debit_order">Debit Order</option><option value="cash">Cash</option>
                      </select>
                      <input value={form.default_payment_terms || '30'} onChange={(e) => setForm({ ...form, default_payment_terms: e.target.value })} placeholder="Payment Terms (days)" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Contact</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="Contact Person" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.accounts_contact || ''} onChange={(e) => setForm({ ...form, accounts_contact: e.target.value })} placeholder="Accounts Contact" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-4">Banking</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Bank" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.bank_account || ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="Account" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                      <input value={form.bank_branch || ''} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} placeholder="Branch" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-400 pt-2">
                      <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* LINK SERVICE */}
      {showLink && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowLink(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md"><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Link New Service</p><button onClick={() => setShowLink(false)} className="text-zinc-500 hover:text-white">✕</button></div><div className="space-y-3"><select value={linkForm.property_id} onChange={(e) => setLinkForm({ ...linkForm, property_id: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select property...</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select><input value={linkForm.account_number} onChange={(e) => setLinkForm({ ...linkForm, account_number: e.target.value })} placeholder="Reference Number *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={linkForm.account_name} onChange={(e) => setLinkForm({ ...linkForm, account_name: e.target.value })} placeholder="Account Name (e.g. Electricity)" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><div className="grid grid-cols-2 gap-2"><input value={linkForm.default_gl} onChange={(e) => setLinkForm({ ...linkForm, default_gl: e.target.value })} placeholder="Default GL" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><select value={linkForm.default_vat} onChange={(e) => setLinkForm({ ...linkForm, default_vat: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="15">VAT 15%</option><option value="0">No VAT</option></select></div><button onClick={handleLinkService} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save Service</button></div></div></div>
        </>
      )}
    </div>
  );
}
