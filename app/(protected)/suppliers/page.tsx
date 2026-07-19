'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { apIntelligence } from '@/lib/accounts-payable/intelligence';

type APSection = 'dashboard' | 'approval-queue' | 'invoices' | 'suppliers' | 'credit-notes' | 'recurring' | 'aging' | 'payments' | 'month-end' | 'reconciliation';

export default function AccountsPayablePage() {
  const [section, setSection] = useState<APSection>('dashboard');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [showCapture, setShowCapture] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [codingSuggestion, setCodingSuggestion] = useState<any>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ supplier_name: '', email: '', phone: '', vat_number: '', contact_person: '' });
  const [editSupplierId, setEditSupplierId] = useState('');

  // Invoice search
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconSupplier, setReconSupplier] = useState('');
  const [reconLines, setReconLines] = useState('');
  const [reconResult, setReconResult] = useState<any>(null);

  const [invSupplier, setInvSupplier] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState('');
  const [invDue, setInvDue] = useState('');
  const [invLines, setInvLines] = useState<Array<{ propertyId: string; glCode: string; description: string; amount: string; vatCode: string }>>([
    { propertyId: '', glCode: '', description: '', amount: '', vatCode: 'standard' }
  ]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const eid = entities[0]; setEntityId(eid);
      const [suppList, propList, warnList, queueList, invList, cnList, payList] = await Promise.all([
        supabase.from('suppliers').select('*').eq('entity_id', eid).order('supplier_name'),
        supabase.from('properties').select('id, property_name').eq('entity_id', eid),
        apIntelligence.getWarnings(eid),
        apApi.getApprovalQueue(eid),
        supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', eid).order('created_at', { ascending: false }).limit(50),
        supabase.from('supplier_credit_notes').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', eid).order('created_at', { ascending: false }).limit(50),
        supabase.from('sub_ledger_entries').select('*').eq('entity_id', eid).eq('ledger_type', 'supplier').order('posted_at', { ascending: false }).limit(50),
      ]);
      setSuppliers(suppList.data || []); setProperties(propList.data || []);
      setWarnings(warnList); setApprovalQueue(queueList);
      setAllInvoices(invList.data || []); setCreditNotes(cnList.data || []);
      setPaymentHistory(payList.data || []);
      await loadDashboard(eid);
      setLoading(false);
    }
    init();
  }, []);

  async function loadDashboard(eid: string) {
    const [outstanding, aging, monthEnd] = await Promise.all([
      apApi.getOutstandingAP(eid).catch(() => 0),
      apApi.getAging(eid).catch(() => ({})),
      apApi.getMonthEndStatus(eid).catch(() => ({ ready: false, pendingCount: 0 })),
    ]);
    setData({ outstandingAP: outstanding, aging, monthEnd });
  }

  async function handleSupplierSelect(supplierId: string) {
    setInvSupplier(supplierId);
    const suggestion = await apIntelligence.getCodingSuggestions(supplierId);
    setCodingSuggestion(suggestion);
    if (suggestion) setInvLines([{ propertyId: suggestion.propertyId || '', glCode: suggestion.glCode, description: '', amount: '', vatCode: suggestion.vatCode }]);
  }

  async function handleCapture() {
    await apApi.captureInvoice({ entityId, supplierId: invSupplier, invoiceNumber: invNumber, invoiceDate: invDate, dueDate: invDue, lines: invLines.map(l => ({ propertyId: l.propertyId || undefined, glCode: l.glCode, description: l.description, amount: parseFloat(l.amount), vatCode: l.vatCode })), source: 'manual', createdBy: 'user' });
    setShowCapture(false); resetForm();
    await refreshData();
  }

  async function handleApprove(invoiceId: string) { await apApi.approveInvoice(invoiceId, 'user'); await refreshData(); }
  async function handleReject(invoiceId: string) { await apApi.rejectInvoice(invoiceId, 'Rejected'); await refreshData(); }

  async function handleSaveSupplier() {
    if (editSupplierId) {
      await supabase.from('suppliers').update(supplierForm).eq('id', editSupplierId);
    } else {
      await supabase.from('suppliers').insert({ ...supplierForm, entity_id: entityId });
    }
    setShowSupplierForm(false); setEditSupplierId(''); setSupplierForm({ supplier_name: '', email: '', phone: '', vat_number: '', contact_person: '' });
    const { data } = await supabase.from('suppliers').select('*').eq('entity_id', entityId).order('supplier_name');
    setSuppliers(data || []);
  }

  function editSupplier(s: any) { setEditSupplierId(s.id); setSupplierForm({ supplier_name: s.supplier_name, email: s.email || '', phone: s.phone || '', vat_number: s.vat_number || '', contact_person: s.contact_person || '' }); setShowSupplierForm(true); }

  async function handleReconcile() {
    if (!reconSupplier || !reconLines) return;
    const lines = reconLines.split('\n').filter(l => l.trim()).map(l => {
      const parts = l.split(',').map(p => p.trim());
      return { date: parts[0] || '', description: parts[1] || '', debit: parseFloat(parts[2]) || 0, credit: parseFloat(parts[3]) || 0 };
    });
    const result = await apApi.getSupplierLedger(reconSupplier);
    setReconResult({ ledger: result, statementLines: lines });
  }

  async function refreshData() {
    const [queueList, invList, cnList, payList, warnList] = await Promise.all([
      apApi.getApprovalQueue(entityId),
      supabase.from('supplier_invoices_new').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50),
      supabase.from('supplier_credit_notes').select('*, supplier:supplier_id(supplier_name)').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50),
      supabase.from('sub_ledger_entries').select('*').eq('entity_id', entityId).eq('ledger_type', 'supplier').order('posted_at', { ascending: false }).limit(50),
      apIntelligence.getWarnings(entityId),
    ]);
    setApprovalQueue(queueList); setAllInvoices(invList.data || []); setCreditNotes(cnList.data || []); setPaymentHistory(payList.data || []); setWarnings(warnList);
    await loadDashboard(entityId);
  }

  function resetForm() { setInvSupplier(''); setInvNumber(''); setInvDate(''); setInvDue(''); setInvLines([{ propertyId: '', glCode: '', description: '', amount: '', vatCode: 'standard' }]); setCodingSuggestion(null); }
  function addLine() { setInvLines([...invLines, { propertyId: '', glCode: '', description: '', amount: '', vatCode: 'standard' }]); }
  function removeLine(i: number) { setInvLines(invLines.filter((_, idx) => idx !== i)); }

  const navItems: Array<{ key: APSection; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' }, { key: 'approval-queue', label: 'Approval Queue' },
    { key: 'invoices', label: 'Invoices' }, { key: 'suppliers', label: 'Suppliers' },
    { key: 'credit-notes', label: 'Credit Notes' }, { key: 'recurring', label: 'Recurring' },
    { key: 'aging', label: 'Aging' }, { key: 'payments', label: 'Payment History' },
    { key: 'month-end', label: 'Month-End' }, { key: 'reconciliation', label: 'Reconciliation' },
  ];

  const filteredInvoices = allInvoices.filter(i => !invoiceSearch || i.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) || i.supplier?.supplier_name?.toLowerCase().includes(invoiceSearch.toLowerCase()));

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/[0.06] p-4 space-y-1 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 px-3 mb-3">Accounts Payable</p>
        {navItems.map(item => (<button key={item.key} onClick={() => setSection(item.key)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-light transition-colors ${section === item.key ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>{item.label}</button>))}
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Accounts Payable</h1>
          <button onClick={() => setShowCapture(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Capture Invoice</button>
        </div>

        {warnings.length > 0 && (<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6"><p className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">⚠ Attention</p>{warnings.slice(0, 5).map((w: any, i: number) => (<div key={i} className="flex justify-between text-xs"><span className="text-zinc-300">{w.message}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${w.severity === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{w.severity}</span></div>))}</div>)}

        {section === 'dashboard' && <DashboardPanel data={data} approvalCount={approvalQueue.length} warningCount={warnings.length} />}
        {section === 'approval-queue' && <ApprovalQueue invoices={approvalQueue} onApprove={handleApprove} onReject={handleReject} />}
        {section === 'invoices' && <InvoicesList invoices={filteredInvoices} search={invoiceSearch} setSearch={setInvoiceSearch} />}
        {section === 'suppliers' && <SuppliersList suppliers={suppliers} onEdit={editSupplier} onAdd={() => { setEditSupplierId(''); setSupplierForm({ supplier_name: '', email: '', phone: '', vat_number: '', contact_person: '' }); setShowSupplierForm(true); }} />}
        {section === 'credit-notes' && <CreditNotesList creditNotes={creditNotes} />}
        {section === 'recurring' && <RecurringExpenses entityId={entityId} />}
        {section === 'aging' && data.aging && <AgingDetail aging={data.aging} />}
        {section === 'payments' && <PaymentHistoryList payments={paymentHistory} />}
        {section === 'month-end' && <MonthEndAssistant status={data.monthEnd} />}
        {section === 'reconciliation' && <ReconciliationPanel suppliers={suppliers} reconSupplier={reconSupplier} setReconSupplier={setReconSupplier} reconLines={reconLines} setReconLines={setReconLines} reconResult={reconResult} onReconcile={handleReconcile} />}
      </div>

      {/* CAPTURE MODAL */}
      {showCapture && (<Modal title="Capture Invoice" onClose={() => setShowCapture(false)}><div className="space-y-3 max-h-[70vh] overflow-y-auto"><select value={invSupplier} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select supplier...</option>{suppliers.map(s => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}</select>{codingSuggestion && (<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400">Suggested: GL {codingSuggestion.glCode} · {codingSuggestion.vatCode} · {codingSuggestion.confidence}% confidence</div>)}<div className="flex gap-3"><input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="Invoice #" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={invDate} onChange={(e) => setInvDate(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={invDue} onChange={(e) => setInvDue(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div><p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Line Items</p>{invLines.map((line, i) => (<div key={i} className="space-y-2 border border-white/[0.06] rounded-lg p-3"><div className="flex gap-2"><select value={line.propertyId} onChange={(e) => { const l = [...invLines]; l[i].propertyId = e.target.value; setInvLines(l); }} className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none"><option value="">Property</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select><input value={line.glCode} onChange={(e) => { const l = [...invLines]; l[i].glCode = e.target.value; setInvLines(l); }} placeholder="GL" className="w-20 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" /></div><input value={line.description} onChange={(e) => { const l = [...invLines]; l[i].description = e.target.value; setInvLines(l); }} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" /><div className="flex gap-2"><input value={line.amount} onChange={(e) => { const l = [...invLines]; l[i].amount = e.target.value; setInvLines(l); }} placeholder="Amount" type="number" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" /><select value={line.vatCode} onChange={(e) => { const l = [...invLines]; l[i].vatCode = e.target.value; setInvLines(l); }} className="w-32 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none"><option value="standard">VAT 15%</option><option value="zero_rated">Zero Rated</option><option value="exempt">Exempt</option><option value="non_vatable">No VAT</option></select>{invLines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-400 text-xs px-2">✕</button>}</div></div>))}<button onClick={addLine} className="w-full rounded-lg border border-dashed border-white/[0.1] py-2 text-xs text-zinc-500 hover:text-white">+ Add Line</button><button onClick={handleCapture} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Capture Invoice</button></div></Modal>)}

      {/* SUPPLIER FORM MODAL */}
      {showSupplierForm && (<Modal title={editSupplierId ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setShowSupplierForm(false)}><div className="space-y-3"><input value={supplierForm.supplier_name} onChange={(e) => setSupplierForm({ ...supplierForm, supplier_name: e.target.value })} placeholder="Supplier Name *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="Email" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="Phone" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={supplierForm.vat_number} onChange={(e) => setSupplierForm({ ...supplierForm, vat_number: e.target.value })} placeholder="VAT Number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={supplierForm.contact_person} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} placeholder="Contact Person" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><button onClick={handleSaveSupplier} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">{editSupplierId ? 'Update' : 'Add Supplier'}</button></div></Modal>)}
    </div>
  );
}

function DashboardPanel({ data, approvalCount, warningCount }: any) {
  return (<div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><KPI label="Outstanding AP" value={`R${(data.outstandingAP || 0).toLocaleString()}`} /><KPI label="Awaiting Approval" value={approvalCount} highlight /><KPI label="Warnings" value={warningCount} highlight={warningCount > 0} /><KPI label="Month-End" value={data.monthEnd?.ready ? 'Ready' : 'Pending'} /></div>{data.aging && <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging</p><div className="grid grid-cols-5 gap-3 text-center text-xs">{[{ label: 'Current', value: data.aging.current }, { label: '1-30', value: data.aging.days30 }, { label: '31-60', value: data.aging.days60 }, { label: '61-90', value: data.aging.days90 }, { label: '120+', value: data.aging.days120 }].map(b => (<div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-zinc-500">{b.label}</p><p className={`text-sm font-medium mt-1 ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p></div>))}</div></div>}</div>);
}

function KPI({ label, value, highlight }: any) { return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">{label}</p><p className={`text-xl font-light ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p></div>); }

function ApprovalQueue({ invoices, onApprove, onReject }: any) {
  if (!invoices?.length) return <p className="text-sm text-zinc-500 py-8 text-center">No invoices awaiting approval.</p>;
  return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead><tbody>{invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-right"><button onClick={() => onApprove(inv.id)} className="text-emerald-400 hover:text-emerald-300 text-xs mr-2">Approve</button><button onClick={() => onReject(inv.id)} className="text-red-400 hover:text-red-300 text-xs">Reject</button></td></tr>))}</tbody></table></div>);
}

function InvoicesList({ invoices, search, setSearch }: any) {
  return (<div className="space-y-4"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice number or supplier..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />{!invoices?.length ? <p className="text-sm text-zinc-500 py-8 text-center">No invoices found.</p> : (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice #</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead><tbody>{invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{inv.lifecycle_status}</span></td></tr>))}</tbody></table></div>)}</div>);
}

function SuppliersList({ suppliers, onEdit, onAdd }: any) {
  return (<div className="space-y-4"><div className="flex justify-end"><button onClick={onAdd} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Supplier</button></div><div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Contact</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead><tbody>{suppliers.map((s: any) => (<tr key={s.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{s.supplier_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.email || s.phone || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.vat_number || '—'}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td><td className="py-2.5 px-4 text-right"><button onClick={() => onEdit(s)} className="text-xs text-zinc-400 hover:text-white">Edit</button></td></tr>))}</tbody></table></div></div>);
}

function CreditNotesList({ creditNotes }: any) {
  if (!creditNotes?.length) return <p className="text-sm text-zinc-500 py-8 text-center">No credit notes.</p>;
  return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">CN #</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Reason</th></tr></thead><tbody>{creditNotes.map((cn: any) => (<tr key={cn.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{cn.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{cn.credit_note_number}</td><td className="py-2.5 px-4 text-right text-emerald-400 tabular-nums text-xs">R{cn.amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{cn.reason || '—'}</td></tr>))}</tbody></table></div>);
}

function RecurringExpenses({ entityId }: any) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: '', glCode: '', amount: '', frequency: 'monthly' });
  useEffect(() => { async function load() { const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId); setExpenses(data || []); } load(); }, [entityId]);
  async function handleAdd() { await apApi.createRecurringExpense({ entityId, description: form.description, glCode: form.glCode, amount: parseFloat(form.amount), frequency: form.frequency }); setShowAdd(false); const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId); setExpenses(data || []); }
  return (<div className="space-y-4"><div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add</button></div>{!expenses.length ? <p className="text-sm text-zinc-500 py-8 text-center">No recurring expenses.</p> : (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">GL</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Frequency</th></tr></thead><tbody>{expenses.map(e => (<tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{e.description}</td><td className="py-2.5 px-4 text-zinc-400">{e.gl_code}</td><td className="py-2.5 px-4 text-right text-white tabular-nums">R{e.amount.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-400 capitalize">{e.frequency}</td></tr>))}</tbody></table></div>)}{showAdd && <Modal title="Add Recurring Expense" onClose={() => setShowAdd(false)}><div className="space-y-3"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.glCode} onChange={(e) => setForm({ ...form, glCode: e.target.value })} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select><button onClick={handleAdd} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save</button></div></Modal>}</div>);
}

function AgingDetail({ aging }: any) {
  return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging Detail</p><div className="grid grid-cols-5 gap-3 text-center">{[{ label: 'Current', value: aging.current }, { label: '1-30 Days', value: aging.days30 }, { label: '31-60', value: aging.days60 }, { label: '61-90', value: aging.days90 }, { label: '120+', value: aging.days120 }].map(b => (<div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-xs text-zinc-500 mb-2">{b.label}</p><p className={`text-2xl font-light ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p></div>))}</div></div>);
}

function PaymentHistoryList({ payments }: any) {
  if (!payments?.length) return <p className="text-sm text-zinc-500 py-8 text-center">No payment history. Payments are managed in Cash Book.</p>;
  return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Balance</th></tr></thead><tbody>{payments.map((p: any, i: number) => (<tr key={i} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-zinc-400 text-xs">{p.posted_at?.split('T')[0]}</td><td className="py-2.5 px-4 text-white font-light text-xs">{p.description}</td><td className="py-2.5 px-4 text-right text-zinc-300 text-xs tabular-nums">R{(p.debit_amount || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-zinc-300 text-xs tabular-nums">R{(p.credit_amount || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-white text-xs tabular-nums">R{(p.running_balance || 0).toLocaleString()}</td></tr>))}</tbody></table></div>);
}

function MonthEndAssistant({ status }: any) {
  if (!status) return <p className="text-sm text-zinc-500 py-8 text-center">Loading...</p>;
  return (<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6"><p className="text-sm font-medium text-white mb-4">Month-End AP Assistant</p><div className="space-y-2"><CheckItem label="No Draft Invoices" passed={status.hasDrafts} /><CheckItem label="No Duplicate Warnings" passed={status.hasDuplicates !== undefined ? status.hasDuplicates : true} /><CheckItem label="Ready for Close" passed={status.ready} /></div><div className="mt-4 pt-4 border-t border-white/[0.06]"><p className={`text-sm font-medium ${status.ready ? 'text-emerald-400' : 'text-amber-400'}`}>{status.ready ? '✓ Ready for Close' : `${status.pendingCount} items need attention`}</p></div></div>);
}

function CheckItem({ label, passed }: any) { return (<div className="flex items-center gap-2 text-xs"><span className={passed ? 'text-emerald-400' : 'text-zinc-500'}>{passed ? '✓' : '○'}</span><span className={passed ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span></div>); }

function ReconciliationPanel({ suppliers, reconSupplier, setReconSupplier, reconLines, setReconLines, reconResult, onReconcile }: any) {
  return (<div className="space-y-6"><div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier Statement Query</p><select value={reconSupplier} onChange={(e) => setReconSupplier(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select supplier...</option>{suppliers.map((s: any) => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}</select><textarea value={reconLines} onChange={(e) => setReconLines(e.target.value)} placeholder="Paste statement lines: date, description, debit, credit (one per line)" rows={6} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><button onClick={onReconcile} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Compare</button></div>{reconResult && (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-xs text-zinc-400 mb-3">Ledger has {reconResult.ledger?.invoices?.length || 0} invoices · Statement has {reconResult.statementLines?.length || 0} lines</p></div>)}</div>);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (<><div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{title}</p><button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button></div>{children}</div></div></>);
}
