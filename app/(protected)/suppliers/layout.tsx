'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { apIntelligence } from '@/lib/accounts-payable/intelligence';

const navItems = [
  { key: '', label: 'Dashboard' },
  { key: '/approval-queue', label: 'Approval Queue' },
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
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [captureType, setCaptureType] = useState<'invoice' | 'credit_note'>('invoice');
  const [invSupplier, setInvSupplier] = useState('');
  const [invAccountId, setInvAccountId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invDue, setInvDue] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invLines, setInvLines] = useState<Array<{ propertyId: string; glCode: string; description: string; amountExcl: string; vatRate: string; amountIncl: string }>>([{ propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '' }]);
  const [activeField, setActiveField] = useState<{ line: number; field: 'excl' | 'vat' | 'incl' }>({ line: 0, field: 'excl' });
  const [showLinkService, setShowLinkService] = useState(false);
  const [linkForm, setLinkForm] = useState({ property_id: '', account_number: '', account_name: '', meter_number: '', default_gl: '', default_vat: '15' });

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
    const [accounts, suppData] = await Promise.all([
      supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', supplierId),
      supabase.from('suppliers').select('*').eq('id', supplierId).single(),
    ]);
    setSupplierAccounts(accounts.data || []);
    setSelectedSupplier(suppData.data);
    const suggestion = await apIntelligence.getCodingSuggestions(supplierId);
    setCodingSuggestion(suggestion);
    if (suggestion) setInvLines([{ propertyId: suggestion.propertyId || '', glCode: suggestion.glCode, description: '', amountExcl: '', vatRate: suggestion.vatCode === 'non_vatable' ? '0' : '15', amountIncl: '' }]);
  }

  function recalcLine(i: number, field: 'excl' | 'vat' | 'incl', value: string) {
    const lines = [...invLines]; setActiveField({ line: i, field });
    const num = parseFloat(value) || 0; const vatRate = parseFloat(lines[i].vatRate) || 15;
    if (field === 'excl') { lines[i].amountExcl = value; lines[i].amountIncl = (num * (1 + vatRate / 100)).toFixed(2); }
    else if (field === 'incl') { lines[i].amountIncl = value; lines[i].amountExcl = (num / (1 + vatRate / 100)).toFixed(2); }
    else if (field === 'vat') { lines[i].amountExcl = (num / (vatRate / 100)).toFixed(2); lines[i].amountIncl = (parseFloat(lines[i].amountExcl) + num).toFixed(2); }
    setInvLines(lines);
  }

  async function handleLinkService() {
    await supabase.from('supplier_accounts').insert({ entity_id: entityId, supplier_id: invSupplier, property_id: linkForm.property_id, account_number: linkForm.account_number, account_name: linkForm.account_name, meter_number: linkForm.meter_number });
    setShowLinkService(false);
    const { data: accounts } = await supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', invSupplier);
    setSupplierAccounts(accounts || []);
    setLinkForm({ property_id: '', account_number: '', account_name: '', meter_number: '', default_gl: '', default_vat: '15' });
  }

  async function handleCapture() {
    const lines = invLines.map(l => ({ propertyId: l.propertyId || undefined, glCode: l.glCode, description: l.description, amount: parseFloat(l.amountExcl) || 0, vatCode: parseFloat(l.vatRate) === 0 ? 'non_vatable' : 'standard', vatRate: parseFloat(l.vatRate) || 15 }));
    await apApi.captureInvoice({ entityId, supplierId: invSupplier, invoiceNumber: invNumber, invoiceDate: invDate, dueDate: invDue, description: invDescription, lines, source: 'manual', createdBy: 'user' });
    setShowCapture(false);
    resetForm();
  }

  function resetForm() { setInvSupplier(''); setInvAccountId(''); setInvNumber(''); setInvDate(new Date().toISOString().split('T')[0]); setInvDue(''); setInvDescription(''); setInvLines([{ propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '' }]); setSelectedSupplier(null); setSupplierAccounts([]); setCodingSuggestion(null); }
  function addLine() { setInvLines([...invLines, { propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '' }]); }
  function removeLine(i: number) { if (invLines.length > 1) setInvLines(invLines.filter((_, idx) => idx !== i)); }

  const totalExcl = invLines.reduce((s, l) => s + (parseFloat(l.amountExcl) || 0), 0);
  const totalVat = invLines.reduce((s, l) => s + ((parseFloat(l.amountIncl) || 0) - (parseFloat(l.amountExcl) || 0)), 0);
  const totalIncl = invLines.reduce((s, l) => s + (parseFloat(l.amountIncl) || 0), 0);

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

      {/* CAPTURE WORKSPACE */}
      {showCapture && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-light text-white">Capture {captureType === 'invoice' ? 'Invoice' : 'Credit Note'}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Draft</span>
              <span className="text-[10px] text-zinc-600">Manual</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCapture(false)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Cancel</button>
              <button onClick={handleCapture} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Capture</button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT — 65% */}
            <div className="flex-[65] overflow-y-auto p-6 space-y-6 border-r border-white/[0.06]">
              {/* Document Type Toggle */}
              <div className="flex gap-2">
                <button onClick={() => setCaptureType('invoice')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'invoice' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Invoice</button>
                <button onClick={() => setCaptureType('credit_note')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'credit_note' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Credit Note</button>
              </div>

              {/* Supplier */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier</p>
                <select value={invSupplier} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0">
                  <option value="">Search supplier...</option>
                  {suppliers.map(s => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}
                </select>
                {selectedSupplier && (
                  <div className="flex gap-4 text-[10px] text-zinc-500">
                    <span>Category: <span className="text-zinc-300">{selectedSupplier.category || '—'}</span></span>
                    <span>Status: <span className="text-emerald-400">Active</span></span>
                    <span>Terms: <span className="text-zinc-300">{selectedSupplier.default_payment_terms || 30} Days</span></span>
                  </div>
                )}
              </div>

              {/* Linked Service */}
              {supplierAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Linked Service</p>
                  <select value={invAccountId} onChange={(e) => setInvAccountId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0">
                    <option value="">Select service...</option>
                    {supplierAccounts.map((a: any) => (<option key={a.id} value={a.id}>{a.account_number} — {a.property?.property_name || 'No property'} {a.meter_number ? `· Meter ${a.meter_number}` : ''}</option>))}
                  </select>
                </div>
              )}
              <button onClick={() => setShowLinkService(true)} className="text-[10px] text-zinc-500 hover:text-white">+ Link New Service</button>

              {/* Invoice Info */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Invoice Information</p>
                <div className="grid grid-cols-4 gap-2">
                  <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="Invoice #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                  <input value={invDate} onChange={(e) => setInvDate(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                  <input value={invDue} onChange={(e) => setInvDue(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                  <input placeholder="Supplier Ref" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                </div>
                <input value={invDescription} onChange={(e) => setInvDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
              </div>

              {/* AI Suggestion */}
              {codingSuggestion && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-emerald-400">✓ GL {codingSuggestion.glCode} suggested</span>
                    <span className="text-zinc-500 ml-3">· {codingSuggestion.vatCode}</span>
                    <span className="text-zinc-500 ml-3">· {codingSuggestion.confidence}% confidence</span>
                    <span className="text-zinc-500 ml-3">· Based on {codingSuggestion.basedOn} invoices</span>
                  </div>
                </div>
              )}

              {/* Line Items — Spreadsheet style */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Line Items</p>
                <div className="grid grid-cols-[1fr_80px_1fr_1fr_60px_1fr_40px] gap-1 text-[10px] uppercase tracking-wider text-zinc-600 px-2 mb-1">
                  <span>Property</span><span>GL</span><span>Description</span><span>Ex VAT</span><span>VAT%</span><span>Incl VAT</span><span></span>
                </div>
                {invLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_1fr_1fr_60px_1fr_40px] gap-1 items-center">
                    <select value={line.propertyId} onChange={(e) => { const l = [...invLines]; l[i].propertyId = e.target.value; setInvLines(l); }} className="rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0">
                      <option value="">—</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
                    </select>
                    <input value={line.glCode} onChange={(e) => { const l = [...invLines]; l[i].glCode = e.target.value; setInvLines(l); }} placeholder="GL" className="rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 text-center" />
                    <input value={line.description} onChange={(e) => { const l = [...invLines]; l[i].description = e.target.value; setInvLines(l); }} placeholder="Description" className="rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0" />
                    <input value={line.amountExcl} onChange={(e) => recalcLine(i, 'excl', e.target.value)} placeholder="0.00" className={`rounded border bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:ring-0 text-right ${activeField.line === i && activeField.field === 'excl' ? 'border-white/30' : 'border-white/[0.06]'}`} />
                    <input value={line.vatRate} onChange={(e) => { const l = [...invLines]; l[i].vatRate = e.target.value; recalcLine(i, 'excl', l[i].amountExcl || '0'); }} placeholder="15" className="rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 text-center" />
                    <input value={line.amountIncl} onChange={(e) => recalcLine(i, 'incl', e.target.value)} placeholder="0.00" className={`rounded border bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:ring-0 text-right ${activeField.line === i && activeField.field === 'incl' ? 'border-white/30' : 'border-white/[0.06]'}`} />
                    <button onClick={() => removeLine(i)} className="text-zinc-600 hover:text-red-400 text-xs">×</button>
                  </div>
                ))}
                <button onClick={addLine} className="w-full text-left text-xs text-zinc-500 hover:text-white py-1">+ Add Line</button>
              </div>

              {/* Totals — pinned */}
              <div className="border-t border-white/[0.06] pt-3 flex justify-end gap-8 text-sm">
                <div className="text-right"><p className="text-[9px] text-zinc-500">Ex VAT</p><p className="text-white tabular-nums">R{totalExcl.toLocaleString()}</p></div>
                <div className="text-right"><p className="text-[9px] text-zinc-500">VAT</p><p className="text-white tabular-nums">R{totalVat.toLocaleString()}</p></div>
                <div className="text-right"><p className="text-[9px] text-zinc-500">Total</p><p className="text-white font-medium tabular-nums">R{totalIncl.toLocaleString()}</p></div>
              </div>
            </div>

            {/* RIGHT — 35% */}
            <div className="flex-[35] overflow-y-auto p-6 space-y-6 bg-zinc-1000">
              {/* Supplier Summary */}
              {selectedSupplier && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier</p>
                  <p className="text-sm text-white font-medium">{selectedSupplier.supplier_name}</p>
                  <div className="text-xs text-zinc-500 space-y-1">
                    <p>Category: {selectedSupplier.category || '—'}</p>
                    {selectedSupplier.vat_number && <p>VAT: {selectedSupplier.vat_number}</p>}
                    {selectedSupplier.email && <p>{selectedSupplier.email}</p>}
                  </div>
                </div>
              )}

              {/* Document Preview Placeholder */}
              <div className="rounded-lg border border-dashed border-white/[0.1] h-48 flex items-center justify-center">
                <p className="text-xs text-zinc-600">Drop PDF here for OCR preview</p>
              </div>

              {/* AI Confidence */}
              {codingSuggestion && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400">AI Confidence</p>
                  <div className="text-xs text-zinc-400 space-y-0.5">
                    <p>✓ Supplier recognised</p>
                    <p>✓ GL suggested: {codingSuggestion.glCode}</p>
                    <p>✓ VAT: {codingSuggestion.vatCode}</p>
                    <p className="text-emerald-400 font-medium">{codingSuggestion.confidence}% confidence</p>
                  </div>
                </div>
              )}

              {/* Warnings */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-amber-400">Warnings</p>
                {!selectedSupplier && <p className="text-xs text-zinc-400">⚠ No supplier selected</p>}
                {invLines.some(l => !l.glCode) && <p className="text-xs text-zinc-400">⚠ Missing GL codes</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LINK SERVICE MODAL */}
      {showLinkService && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={() => setShowLinkService(false)} />
          <div className="fixed inset-4 z-[70] flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Link New Service</p><button onClick={() => setShowLinkService(false)} className="text-zinc-500 hover:text-white">✕</button></div>
              <div className="space-y-3">
                <select value={linkForm.property_id} onChange={(e) => setLinkForm({ ...linkForm, property_id: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select property...</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select>
                <input value={linkForm.account_number} onChange={(e) => setLinkForm({ ...linkForm, account_number: e.target.value })} placeholder="Reference Number *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                <input value={linkForm.account_name} onChange={(e) => setLinkForm({ ...linkForm, account_name: e.target.value })} placeholder="Account Name" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                <input value={linkForm.meter_number} onChange={(e) => setLinkForm({ ...linkForm, meter_number: e.target.value })} placeholder="Meter Number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                <button onClick={handleLinkService} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save Service</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
