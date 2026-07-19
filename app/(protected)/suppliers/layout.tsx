'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { apIntelligence } from '@/lib/accounts-payable/intelligence';

const navItems = [
  { key: '', label: 'Dashboard' },
  { key: '/invoices', label: 'Invoices' },
  { key: '/suppliers', label: 'Suppliers' },
  { key: '/credit-notes', label: 'Credit Notes' },
  { key: '/recurring', label: 'Recurring' },
  { key: '/aging', label: 'Aging' },
  { key: '/payments', label: 'Payment History' },
  { key: '/month-end', label: 'Month-End' },
  { key: '/reconciliation', label: 'Reconciliation' },
];

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showCapture, setShowCapture] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<any[]>([]);
  const [codingSuggestion, setCodingSuggestion] = useState<any>(null);
  const [captureType, setCaptureType] = useState<'invoice' | 'credit_note'>('invoice');
  const [invSupplier, setInvSupplier] = useState('');
  const [invAccountId, setInvAccountId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invDue, setInvDue] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invLines, setInvLines] = useState<Array<{ propertyId: string; glCode: string; description: string; amountExcl: string; vatRate: string; amountIncl: string; editField: 'excl' | 'vat' | 'incl' }>>([{ propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);
      const [suppList, propList] = await Promise.all([
        supabase.from('suppliers').select('*').eq('entity_id', entities[0]).order('supplier_name'),
        supabase.from('properties').select('id, property_name').eq('entity_id', entities[0]),
      ]);
      setSuppliers(suppList.data || []);
      setProperties(propList.data || []);
    }
    init();
  }, []);

  async function handleSupplierSelect(supplierId: string) {
    setInvSupplier(supplierId);
    setInvAccountId('');
    const { data: accounts } = await supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', supplierId);
    setSupplierAccounts(accounts || []);
    const suggestion = await apIntelligence.getCodingSuggestions(supplierId);
    setCodingSuggestion(suggestion);
    if (suggestion) setInvLines([{ propertyId: suggestion.propertyId || '', glCode: suggestion.glCode, description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]);
  }

  function recalcLine(i: number, field: 'excl' | 'vat' | 'incl', value: string) {
    const lines = [...invLines]; lines[i].editField = field;
    const num = parseFloat(value) || 0; const vatRate = parseFloat(lines[i].vatRate) || 15;
    if (field === 'excl') { lines[i].amountExcl = value; lines[i].amountIncl = (num * (1 + vatRate / 100)).toFixed(2); }
    else if (field === 'incl') { lines[i].amountIncl = value; lines[i].amountExcl = (num / (1 + vatRate / 100)).toFixed(2); }
    setInvLines(lines);
  }

  async function handleCapture() {
    const lines = invLines.map(l => ({ propertyId: l.propertyId || undefined, glCode: l.glCode, description: l.description, amount: parseFloat(l.amountExcl) || 0, vatCode: parseFloat(l.vatRate) === 0 ? 'non_vatable' : 'standard', vatRate: parseFloat(l.vatRate) || 15 }));
    await apApi.captureInvoice({ entityId, supplierId: invSupplier, invoiceNumber: invNumber, invoiceDate: invDate, dueDate: invDue, description: invDescription, lines, source: 'manual', createdBy: 'user' });
    setShowCapture(false);
    setInvSupplier(''); setInvAccountId(''); setInvNumber(''); setInvDate(new Date().toISOString().split('T')[0]); setInvDue(''); setInvDescription('');
    setInvLines([{ propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]);
    setCodingSuggestion(null);
  }

  function addLine() { setInvLines([...invLines, { propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]); }
  function removeLine(i: number) { setInvLines(invLines.filter((_, idx) => idx !== i)); }

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/[0.06] p-4 space-y-1 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-3">Accounts Payable</p>
        {navItems.map(item => (
          <Link key={item.key} href={`/suppliers${item.key}`}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-light transition-colors ${pathname === `/suppliers${item.key}` ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-end mb-6">
          <button onClick={() => setShowCapture(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Capture</button>
        </div>
        {children}
      </div>

      {showCapture && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCapture(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{captureType === 'invoice' ? 'Capture Invoice' : 'Capture Credit Note'}</p><button onClick={() => setShowCapture(false)} className="text-zinc-500 hover:text-white">✕</button></div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setCaptureType('invoice')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'invoice' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Invoice</button>
                  <button onClick={() => setCaptureType('credit_note')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'credit_note' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Credit Note</button>
                </div>
                <select value={invSupplier} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none">
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}
                </select>
                {supplierAccounts.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500">Linked Account Reference</label>
                    <select value={invAccountId} onChange={(e) => setInvAccountId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none">
                      <option value="">Select account...</option>
                      {supplierAccounts.map((a: any) => (<option key={a.id} value={a.id}>{a.account_number} — {a.property?.property_name || 'No property'}</option>))}
                    </select>
                  </div>
                )}
                {codingSuggestion && (<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400">Suggested: GL {codingSuggestion.glCode} · {codingSuggestion.confidence}% confidence</div>)}
                <div className="grid grid-cols-4 gap-2">
                  <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="Invoice #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
                  <input value={invDate} onChange={(e) => setInvDate(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
                  <input value={invDue} onChange={(e) => setInvDue(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
                </div>
                <input value={invDescription} onChange={(e) => setInvDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Line Items</p>
                {invLines.map((line, i) => (
                  <div key={i} className="space-y-2 border border-white/[0.06] rounded-lg p-3">
                    <div className="flex gap-2">
                      <select value={line.propertyId} onChange={(e) => { const l = [...invLines]; l[i].propertyId = e.target.value; setInvLines(l); }} className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none"><option value="">Property</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select>
                      <input value={line.glCode} onChange={(e) => { const l = [...invLines]; l[i].glCode = e.target.value; setInvLines(l); }} placeholder="GL Code" className="w-20 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
                    </div>
                    <input value={line.description} onChange={(e) => { const l = [...invLines]; l[i].description = e.target.value; setInvLines(l); }} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><label className="text-[9px] text-zinc-600 block mb-0.5">Ex VAT</label><input value={line.amountExcl} onChange={(e) => recalcLine(i, 'excl', e.target.value)} placeholder="0.00" className={`w-full rounded-lg border bg-zinc-900 px-2 py-2 text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none ${line.editField === 'excl' ? 'border-white/30' : 'border-white/[0.08]'}`} /></div>
                      <div><label className="text-[9px] text-zinc-600 block mb-0.5">VAT %</label><input value={line.vatRate} onChange={(e) => { const l = [...invLines]; l[i].vatRate = e.target.value; recalcLine(i, 'excl', l[i].amountExcl); }} placeholder="15" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" /></div>
                      <div><label className="text-[9px] text-zinc-600 block mb-0.5">Incl VAT</label><input value={line.amountIncl} onChange={(e) => recalcLine(i, 'incl', e.target.value)} placeholder="0.00" className={`w-full rounded-lg border bg-zinc-900 px-2 py-2 text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none ${line.editField === 'incl' ? 'border-white/30' : 'border-white/[0.08]'}`} /></div>
                    </div>
                    {invLines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-400 text-[10px]">Remove</button>}
                  </div>
                ))}
                <button onClick={addLine} className="w-full rounded-lg border border-dashed border-white/[0.1] py-2 text-xs text-zinc-500 hover:text-white">+ Add Line</button>
                <button onClick={handleCapture} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Capture</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
