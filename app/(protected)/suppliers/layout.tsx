'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import SearchableSelect from "@/app/components/ui/SearchableSelect";
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

function fmtNum(val: string): string {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unfmtNum(val: string): string {
  return val.replace(/,/g, '');
}

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showCapture, setShowCapture] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
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
  const [invLines, setInvLines] = useState<Array<{ propertyId: string; propertySearch: string; glCode: string; glSearch: string; description: string; amountExcl: string; vatRate: string; amountIncl: string }>>([{ propertyId: '', propertySearch: '', glCode: '', glSearch: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '' }]);
  const [activeField, setActiveField] = useState<{ line: number; field: 'excl' | 'vat' | 'incl' }>({ line: 0, field: 'excl' });
  const [propSearch, setPropSearch] = useState<Record<number, string>>({});
  const [propResults, setPropResults] = useState<Record<number, any[]>>({});
  const [glSearch, setGlSearch] = useState<Record<number, string>>({});
  const [glResults, setGlResults] = useState<Record<number, any[]>>({});

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
    if (suggestion) {
      const prop = properties.find(p => p.id === suggestion.propertyId);
      setInvLines([{ propertyId: suggestion.propertyId || '', propertySearch: prop?.property_name || '', glCode: suggestion.glCode, glSearch: suggestion.glCode, description: '', amountExcl: '', vatRate: suggestion.vatCode === 'non_vatable' ? '0' : '15', amountIncl: '' }]);
    }
  }

  function handlePropSearch(i: number, q: string) {
    const p = { ...propSearch, [i]: q }; setPropSearch(p);
    if (q.length < 1) { setPropResults({ ...propResults, [i]: [] }); return; }
    const results = properties.filter(p => p.property_name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
    setPropResults({ ...propResults, [i]: results });
  }

  function selectProp(i: number, prop: any) {
    const l = [...invLines]; l[i].propertyId = prop.id; l[i].propertySearch = prop.property_name; setInvLines(l);
    setPropResults({ ...propResults, [i]: [] });
  }

  function handleGLSearch(i: number, q: string) {
    const g = { ...glSearch, [i]: q }; setGlSearch(g);
    const l = [...invLines]; l[i].glCode = q; l[i].glSearch = q; setInvLines(l);
    if (q.length < 2) { setGlResults({ ...glResults, [i]: [] }); return; }
    const results = [{ gl_code: '5200', name: 'Electricity' }, { gl_code: '5210', name: 'Water & Sewer' }, { gl_code: '5100', name: 'Municipal Rates' }, { gl_code: '5400', name: 'Security' }, { gl_code: '5500', name: 'Insurance' }, { gl_code: '5000', name: 'Repairs & Maintenance' }, { gl_code: '5600', name: 'Commission' }, { gl_code: '5300', name: 'Cleaning' }].filter(g => g.gl_code.includes(q) || g.name.toLowerCase().includes(q.toLowerCase()));
    setGlResults({ ...glResults, [i]: results });
  }

  async function selectGL(i: number, gl: any) {
    const l = [...invLines]; l[i].glCode = gl.gl_code; l[i].glSearch = `${gl.gl_code} — ${gl.name}`;
    const { data: coa } = await supabase.from('chart_of_accounts').select('vat_category, vat_rate').eq('entity_id', entityId).eq('gl_code', gl.gl_code).single();
    if (coa) { l[i].vatRate = (coa.vat_category === 'non_vatable' || coa.vat_category === 'exempt') ? '0' : String(coa.vat_rate || 15); }
    setInvLines(l); setGlResults({ ...glResults, [i]: [] });
  }
  function recalcLine(i: number, field: 'excl' | 'vat' | 'incl', value: string) {
    const lines = [...invLines]; setActiveField({ line: i, field });
    const raw = unfmtNum(value); const num = parseFloat(raw) || 0;
    const vatRate = parseFloat(lines[i].vatRate) || 15;
    if (field === 'excl') { lines[i].amountExcl = fmtNum(raw); lines[i].amountIncl = fmtNum(String(num * (1 + vatRate / 100))); }
    else if (field === 'incl') { lines[i].amountIncl = fmtNum(raw); lines[i].amountExcl = fmtNum(String(num / (1 + vatRate / 100))); }
    else if (field === 'vat') { const excl = num / (vatRate / 100); lines[i].amountExcl = fmtNum(String(excl)); lines[i].amountIncl = fmtNum(String(excl + num)); }
    setInvLines(lines);
  }

  function handleDescChange(i: number, val: string) {
    const l = [...invLines]; l[i].description = val || invDescription; setInvLines(l);
  }

  function autoFillDescriptions() {
    setInvLines(invLines.map(l => ({ ...l, description: l.description || invDescription })));
  }

  async function handleCapture() {
    const lines = invLines.map(l => ({ propertyId: l.propertyId || undefined, glCode: l.glCode, description: l.description || invDescription, amount: parseFloat(unfmtNum(l.amountExcl)) || 0, vatCode: parseFloat(l.vatRate) === 0 ? 'non_vatable' : 'standard', vatRate: parseFloat(l.vatRate) || 15 }));
    await apApi.captureInvoice({ entityId, supplierId: invSupplier, invoiceNumber: invNumber, invoiceDate: invDate, dueDate: invDue, description: invDescription, lines, source: 'manual', createdBy: 'user' });
    setShowCapture(false); resetForm();
  }

  function resetForm() { setInvSupplier(''); setInvAccountId(''); setInvNumber(''); setInvDate(new Date().toISOString().split('T')[0]); setInvDue(''); setInvDescription(''); setInvLines([{ propertyId: '', propertySearch: '', glCode: '', glSearch: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '' }]); setSelectedSupplier(null); setSupplierAccounts([]); setCodingSuggestion(null); setPropSearch({}); setPropResults({}); setGlSearch({}); setGlResults({}); }
  function addLine() { setInvLines([...invLines, { propertyId: '', propertySearch: '', glCode: '', glSearch: '', description: invDescription, amountExcl: '', vatRate: '15', amountIncl: '' }]); }
  function removeLine(i: number) { if (invLines.length > 1) setInvLines(invLines.filter((_, idx) => idx !== i)); }

  const totalExcl = invLines.reduce((s, l) => s + (parseFloat(unfmtNum(l.amountExcl)) || 0), 0);
  const totalIncl = invLines.reduce((s, l) => s + (parseFloat(unfmtNum(l.amountIncl)) || 0), 0);
  const totalVat = totalIncl - totalExcl;

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
        <div className="flex justify-end gap-2 mb-6">
          <button onClick={() => setShowBulk(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Bulk Upload</button>
          <button onClick={() => setShowCapture(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Capture</button>
        </div>
        {children}
      </div>

      {/* CAPTURE WORKSPACE */}
      {showCapture && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-light text-white">Capture {captureType === 'invoice' ? 'Invoice' : 'Credit Note'}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Draft</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCapture(false)} className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:border-white/20">Cancel</button>
              <button onClick={handleCapture} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Capture</button>
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-[65] overflow-y-auto p-6 space-y-6 border-r border-white/[0.06]">
              <div className="flex gap-2">
                <button onClick={() => setCaptureType('invoice')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'invoice' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Invoice</button>
                <button onClick={() => setCaptureType('credit_note')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'credit_note' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Credit Note</button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier</p>
                <select value={invSupplier} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0">
                  <option value="">Search supplier...</option>
                  {suppliers.map(s => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}
                </select>
                {selectedSupplier && (
                  <div className="flex gap-4 text-[10px] text-zinc-500">
                    <span>{selectedSupplier.category || '—'}</span>
                    <span className="text-emerald-400">Active</span>
                    <span>{selectedSupplier.default_payment_terms || 30} Days</span>
                  </div>
                )}
              </div>

              {supplierAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Linked Service</p>
                  <select value={invAccountId} onChange={(e) => setInvAccountId(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0">
                    <option value="">Select service...</option>
                    {supplierAccounts.map((a: any) => (<option key={a.id} value={a.id}>{a.account_number} — {a.property?.property_name || 'No property'}</option>))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Invoice Information</p>
                <div className="grid grid-cols-4 gap-2">
                  <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="Invoice #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                  <input value={invDate} onChange={(e) => setInvDate(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                  <input value={invDue} onChange={(e) => setInvDue(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                  <input placeholder="Supplier Ref" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
                </div>
                <input value={invDescription} onChange={(e) => { setInvDescription(e.target.value); autoFillDescriptions(); }} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0" />
              </div>

              {codingSuggestion && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                  <span className="text-emerald-400">✓ GL {codingSuggestion.glCode}</span>
                  <span className="text-zinc-500 ml-3">{codingSuggestion.confidence}% confidence</span>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Line Items</p>
                  <button onClick={autoFillDescriptions} className="text-[10px] text-zinc-500 hover:text-white">Auto-fill descriptions</button>
                </div>
                <div className="grid grid-cols-[1fr_120px_1fr_1fr_60px_1fr_30px] gap-1 text-[10px] uppercase tracking-wider text-zinc-600 px-2 mb-1">
                  <span>Property</span><span>GL</span><span>Description</span><span>Ex VAT</span><span>VAT%</span><span>Incl VAT</span><span></span>
                </div>
                {invLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_1fr_1fr_60px_1fr_30px] gap-1 items-center">
                    <div className="relative">
                      <input value={line.propertySearch} onChange={(e) => handlePropSearch(i, e.target.value)} onFocus={() => handlePropSearch(i, line.propertySearch)} placeholder="Search property..." className="w-full rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0" />
                      {propResults[i]?.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-30">{propResults[i].map((p: any) => (<button key={p.id} onClick={() => selectProp(i, p)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{p.property_name}</button>))}</div>
                      )}
                    </div>
                    <div className="relative">
                      <input value={line.glSearch} onChange={(e) => handleGLSearch(i, e.target.value)} onFocus={() => handleGLSearch(i, line.glSearch)} placeholder="GL" className="w-full rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 text-center" />
                      {glResults[i]?.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-30">{glResults[i].map((g: any) => (<button key={g.gl_code} onClick={() => selectGL(i, g)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{g.gl_code} — {g.name}</button>))}</div>
                      )}
                    </div>
                    <input value={line.description} onChange={(e) => handleDescChange(i, e.target.value)} placeholder={invDescription || "Description"} className="rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0" />
                    <input value={line.amountExcl} onChange={(e) => recalcLine(i, 'excl', e.target.value)} placeholder="0.00" className={`rounded border bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:ring-0 text-right ${activeField.line === i && activeField.field === 'excl' ? 'border-white/30' : 'border-white/[0.06]'}`} />
                    <input value={line.vatRate} onChange={(e) => { const l = [...invLines]; l[i].vatRate = e.target.value; recalcLine(i, 'excl', l[i].amountExcl || '0'); setInvLines(l); }} placeholder="15" className="rounded border border-white/[0.06] bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:border-white/10 focus:ring-0 text-center" />
                    <input value={line.amountIncl} onChange={(e) => recalcLine(i, 'incl', e.target.value)} placeholder="0.00" className={`rounded border bg-zinc-900 px-2 py-2 text-xs text-white outline-none focus:ring-0 text-right ${activeField.line === i && activeField.field === 'incl' ? 'border-white/30' : 'border-white/[0.06]'}`} />
                    <button onClick={() => removeLine(i)} className="text-zinc-600 hover:text-red-400 text-xs">×</button>
                  </div>
                ))}
                <button onClick={addLine} className="w-full text-left text-xs text-zinc-500 hover:text-white py-1">+ Add Line</button>
              </div>

              <div className="border-t border-white/[0.06] pt-3 flex justify-end gap-8 text-sm">
                <div className="text-right"><p className="text-[9px] text-zinc-500">Ex VAT</p><p className="text-white tabular-nums">R{totalExcl.toLocaleString()}</p></div>
                <div className="text-right"><p className="text-[9px] text-zinc-500">VAT</p><p className="text-white tabular-nums">R{totalVat.toLocaleString()}</p></div>
                <div className="text-right"><p className="text-[9px] text-zinc-500">Total</p><p className="text-white font-medium tabular-nums">R{totalIncl.toLocaleString()}</p></div>
              </div>
            </div>

            <div className="flex-[35] overflow-y-auto p-6 space-y-6 bg-zinc-1000">
              {selectedSupplier && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier</p>
                  <p className="text-sm text-white font-medium">{selectedSupplier.supplier_name}</p>
                  <div className="text-xs text-zinc-500">{selectedSupplier.category || '—'}</div>
                </div>
              )}
              <div className="rounded-lg border border-dashed border-white/[0.1] h-40 flex items-center justify-center">
                <p className="text-xs text-zinc-600">Drop PDF for OCR</p>
              </div>
              {codingSuggestion && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">AI Confidence</p>
                  <div className="text-xs text-zinc-400 space-y-0.5">
                    <p>✓ Supplier recognised</p>
                    <p>✓ GL: {codingSuggestion.glCode}</p>
                    <p className="text-emerald-400">{codingSuggestion.confidence}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD */}
      {showBulk && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowBulk(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg">
              <div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Bulk Upload</p><button onClick={() => setShowBulk(false)} className="text-zinc-500 hover:text-white">✕</button></div>
              <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center space-y-3">
                <p className="text-sm text-zinc-400">Drag and drop PDFs, images, or scans</p>
                <p className="text-xs text-zinc-600">OCR processes automatically · Drafts created for review</p>
                <input type="file" multiple accept=".pdf,.jpg,.png,.jpeg" className="text-xs text-zinc-500" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
