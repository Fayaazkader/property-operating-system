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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ property_id: '', account_number: '', account_name: '', meter_number: '' });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    async function load() {
      const { data: supp } = await supabase.from('suppliers').select('*').eq('id', id).single();
      setSupplier(supp);
      if (supp) setForm(supp);
      const [ledgerData, accountsData] = await Promise.all([
        apApi.getSupplierLedger(id as string),
        supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', id),
      ]);
      setLedger(ledgerData);
      setAccounts(accountsData.data || []);
      const invs = ledgerData?.invoices || [];
      setStats({ totalInvoices: invs.length, totalAmount: invs.reduce((s: number, i: any) => s + (i.total_amount || 0), 0), averageInvoice: invs.length ? Math.round(invs.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) / invs.length) : 0 });
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave() {
    await supabase.from('suppliers').update(form).eq('id', id);
    setSupplier(form);
    setShowEdit(false);
  }

  if (loading) return <div className="text-zinc-500 p-8">Loading...</div>;
  if (!supplier) return <div className="text-zinc-500 p-8">Supplier not found.</div>;

  const tabs = ['overview', 'services', 'invoices', 'ledger', 'payments'];

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
          <button onClick={() => setShowEdit(true)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Edit</button>
          <button onClick={() => window.print()} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Print</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {tabs.map(t => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-light capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t}</button>))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Details</p><div className="space-y-1 text-xs">{supplier.trading_name && <p className="text-zinc-400">Trading: {supplier.trading_name}</p>}{supplier.registered_name && <p className="text-zinc-400">Registered: {supplier.registered_name}</p>}{supplier.registration_number && <p className="text-zinc-400">Reg: {supplier.registration_number}</p>}{supplier.vat_number && <p className="text-zinc-400">VAT: {supplier.vat_number}</p>}{supplier.tax_number && <p className="text-zinc-400">Tax: {supplier.tax_number}</p>}</div></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Contact & Banking</p><div className="space-y-1 text-xs">{supplier.email && <p className="text-zinc-400">Email: {supplier.email}</p>}{supplier.phone && <p className="text-zinc-400">Phone: {supplier.phone}</p>}{supplier.contact_person && <p className="text-zinc-400">Contact: {supplier.contact_person}</p>}{supplier.bank_name && <p className="text-zinc-400 mt-2">Bank: {supplier.bank_name}</p>}{supplier.bank_account && <p className="text-zinc-400">Account: {supplier.bank_account}</p>}</div></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Statistics</p>{stats && <div className="space-y-2 text-xs"><div className="flex justify-between"><span className="text-zinc-500">Invoices</span><span className="text-white">{stats.totalInvoices}</span></div><div className="flex justify-between"><span className="text-zinc-500">Total</span><span className="text-white">R{stats.totalAmount?.toLocaleString()}</span></div><div className="flex justify-between"><span className="text-zinc-500">Average</span><span className="text-white">R{stats.averageInvoice?.toLocaleString()}</span></div></div>}</div>
        </div>
      )}

      {tab === 'services' && (
        <div className="flex justify-end mb-3"><button onClick={() => setShowLink(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Link New Service</button></div>
        <div className="space-y-3">
          {accounts.map((a: any) => (<div key={a.id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 flex justify-between items-center"><div><p className="text-sm text-white font-light">{a.account_number}</p><p className="text-xs text-zinc-500">{a.property?.property_name || '—'} · {a.account_name || 'No name'}</p></div>{a.meter_number && <span className="text-[10px] text-zinc-500">Meter: {a.meter_number}</span>}</div>))}
        </div>
      )}

      {tab === 'invoices' && ledger?.invoices && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-2 px-4 text-[10px] text-zinc-500 uppercase">Date</th><th className="text-left py-2 px-4 text-[10px] text-zinc-500 uppercase">Invoice #</th><th className="text-right py-2 px-4 text-[10px] text-zinc-500 uppercase">Amount</th><th className="text-center py-2 px-4 text-[10px] text-zinc-500 uppercase">Status</th></tr></thead><tbody>{ledger.invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td><td className="py-2 px-4 text-white text-xs">{inv.invoice_number}</td><td className="py-2 px-4 text-right text-white text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2 px-4 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{inv.lifecycle_status || inv.status}</span></td></tr>))}</tbody></table></div>
      )}

      {showEdit && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Edit Supplier</p><button onClick={() => setShowEdit(false)} className="text-zinc-500 hover:text-white">✕</button></div>
              <div className="space-y-3">
                <input value={form.supplier_name || ''} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="Supplier Name" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                <div className="grid grid-cols-2 gap-2"><input value={form.trading_name || ''} onChange={(e) => setForm({ ...form, trading_name: e.target.value })} placeholder="Trading Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.registered_name || ''} onChange={(e) => setForm({ ...form, registered_name: e.target.value })} placeholder="Registered Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                <div className="grid grid-cols-3 gap-2"><input value={form.registration_number || ''} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Reg #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.vat_number || ''} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} placeholder="VAT #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.tax_number || ''} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} placeholder="Tax #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                <select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Category</option><option value="municipality">Municipality</option><option value="utility">Utility</option><option value="contractor">Contractor</option><option value="security">Security</option><option value="cleaning">Cleaning</option><option value="insurance">Insurance</option><option value="legal">Legal</option><option value="maintenance">Maintenance</option><option value="other">Other</option></select>
                <div className="grid grid-cols-2 gap-2"><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                <div className="grid grid-cols-3 gap-2"><input value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Bank" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.bank_account || ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="Account" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.bank_branch || ''} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} placeholder="Branch" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
                <button onClick={handleSave} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save Changes</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
