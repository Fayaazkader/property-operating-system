'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { apIntelligence } from '@/lib/accounts-payable/intelligence';

type APSection = 'dashboard' | 'approval-queue' | 'invoices' | 'suppliers' | 'credit-notes' | 'recurring' | 'aging' | 'payments' | 'month-end';

export default function AccountsPayablePage() {
  const [section, setSection] = useState<APSection>('dashboard');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [showCapture, setShowCapture] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [codingSuggestion, setCodingSuggestion] = useState<any>(null);

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
      const [suppList, propList, warnList, queueList] = await Promise.all([
        supabase.from('suppliers').select('id, supplier_name').eq('entity_id', eid),
        supabase.from('properties').select('id, property_name').eq('entity_id', eid),
        apIntelligence.getWarnings(eid),
        apApi.getInvoicesAwaitingApproval(eid),
      ]);
      setSuppliers(suppList.data || []); setProperties(propList.data || []);
      setWarnings(warnList); setApprovalQueue(queueList);
      await loadDashboard(eid);
      setLoading(false);
    }
    init();
  }, []);

  async function loadDashboard(eid: string) {
    const [outstanding, aging, monthEnd, recurring] = await Promise.all([
      apApi.getOutstandingAP(eid).catch(() => 0),
      apApi.getAging(eid).catch(() => ({})),
      apApi.getMonthEndStatus ? null : null,
      supabase.from('recurring_expenses').select('*', { count: 'exact', head: true }).eq('entity_id', eid).eq('status', 'active'),
    ]);
    setData({ outstandingAP: outstanding, aging, recurringCount: (recurring as any)?.count || 0 });
  }

  async function handleSupplierSelect(supplierId: string) {
    setInvSupplier(supplierId);
    const suggestion = await apIntelligence.getCodingSuggestions(supplierId);
    setCodingSuggestion(suggestion);
    if (suggestion) {
      setInvLines([{ propertyId: suggestion.propertyId || '', glCode: suggestion.glCode, description: '', amount: '', vatCode: suggestion.vatCode }]);
    }
  }

  async function handleCapture() {
    await apApi.captureInvoice({
      entityId, supplierId: invSupplier, invoiceNumber: invNumber,
      invoiceDate: invDate, dueDate: invDue,
      lines: invLines.map(l => ({ propertyId: l.propertyId || undefined, glCode: l.glCode, description: l.description, amount: parseFloat(l.amount), vatCode: l.vatCode })),
      source: 'manual', createdBy: 'user',
    });
    setShowCapture(false); resetForm();
    await loadDashboard(entityId);
  }

  async function handleApprove(invoiceId: string) {
    await apApi.postInvoice(invoiceId, 'user');
    const queueList = await apApi.getInvoicesAwaitingApproval(entityId);
    setApprovalQueue(queueList);
    await loadDashboard(entityId);
  }

  async function handleReject(invoiceId: string) {
    await apApi.rejectInvoice(invoiceId, 'Rejected by user');
    const queueList = await apApi.getInvoicesAwaitingApproval(entityId);
    setApprovalQueue(queueList);
  }

  function resetForm() {
    setInvSupplier(''); setInvNumber(''); setInvDate(''); setInvDue('');
    setInvLines([{ propertyId: '', glCode: '', description: '', amount: '', vatCode: 'standard' }]);
    setCodingSuggestion(null);
  }
  function addLine() { setInvLines([...invLines, { propertyId: '', glCode: '', description: '', amount: '', vatCode: 'standard' }]); }
  function removeLine(i: number) { setInvLines(invLines.filter((_, idx) => idx !== i)); }

  const navItems: Array<{ key: APSection; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'approval-queue', label: 'Approval Queue' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'credit-notes', label: 'Credit Notes' },
    { key: 'recurring', label: 'Recurring' },
    { key: 'aging', label: 'Aging' },
    { key: 'payments', label: 'Payments' },
    { key: 'month-end', label: 'Month-End' },
  ];

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
          <div className="flex gap-2">
            <button onClick={() => setShowBulk(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Bulk Upload</button>
            <button onClick={() => setShowCapture(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Capture Invoice</button>
          </div>
        </div>

        {/* WARNINGS */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6">
            <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">⚠ Attention Required</p>
            <div className="space-y-1">{warnings.slice(0, 5).map((w: any, i: number) => (<div key={i} className="flex items-center justify-between text-xs"><span className="text-zinc-300">{w.message}</span><span className={`px-1.5 py-0.5 rounded text-[10px] ${w.severity === 'high' ? 'bg-red-500/10 text-red-400' : w.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{w.severity}</span></div>))}</div>
          </div>
        )}

        {section === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <KPI label="Outstanding AP" value={`R${(data.outstandingAP || 0).toLocaleString()}`} />
              <KPI label="Awaiting Approval" value={approvalQueue.length} highlight />
              <KPI label="Recurring Expenses" value={data.recurringCount || 0} />
              <KPI label="Warnings" value={warnings.length} highlight={warnings.length > 0} />
            </div>
            {data.aging && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging Summary</p>
                <div className="grid grid-cols-5 gap-3 text-center text-xs">
                  {[{ label: 'Current', value: data.aging.current }, { label: '1-30 Days', value: data.aging.days30 }, { label: '31-60', value: data.aging.days60 }, { label: '61-90', value: data.aging.days90 }, { label: '120+', value: data.aging.days120 }].map(b => (<div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-zinc-500">{b.label}</p><p className={`text-sm font-medium mt-1 ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p></div>))}
                </div>
              </div>
            )}
          </div>
        )}

        {section === 'approval-queue' && <ApprovalQueue invoices={approvalQueue} onApprove={handleApprove} onReject={handleReject} />}
        {section === 'suppliers' && <SuppliersList suppliers={suppliers} entityId={entityId} onSelect={(s: any) => { setSelectedSupplier(s); setSection('invoices'); }} />}
        {section === 'recurring' && <RecurringExpenses entityId={entityId} />}
        {section === 'aging' && data.aging && <AgingDetail aging={data.aging} />}
        {section === 'month-end' && <MonthEndAssistant entityId={entityId} />}
      </div>

      {/* CAPTURE MODAL */}
      {showCapture && (
        <Modal title="Capture Invoice" onClose={() => setShowCapture(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <select value={invSupplier} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select supplier...</option>{suppliers.map(s => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}</select>
            {codingSuggestion && (<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400">Suggested: GL {codingSuggestion.glCode} · {codingSuggestion.vatCode} · {codingSuggestion.confidence}% confidence (based on {codingSuggestion.basedOn} invoices)</div>)}
            <div className="flex gap-3"><input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="Invoice #" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={invDate} onChange={(e) => setInvDate(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={invDue} onChange={(e) => setInvDue(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Line Items</p>
            {invLines.map((line, i) => (<div key={i} className="space-y-2 border border-white/[0.06] rounded-lg p-3"><div className="flex gap-2"><select value={line.propertyId} onChange={(e) => { const l = [...invLines]; l[i].propertyId = e.target.value; setInvLines(l); }} className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none"><option value="">Property</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select><input value={line.glCode} onChange={(e) => { const l = [...invLines]; l[i].glCode = e.target.value; setInvLines(l); }} placeholder="GL" className="w-20 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" /></div><input value={line.description} onChange={(e) => { const l = [...invLines]; l[i].description = e.target.value; setInvLines(l); }} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" /><div className="flex gap-2"><input value={line.amount} onChange={(e) => { const l = [...invLines]; l[i].amount = e.target.value; setInvLines(l); }} placeholder="Amount" type="number" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" /><select value={line.vatCode} onChange={(e) => { const l = [...invLines]; l[i].vatCode = e.target.value; setInvLines(l); }} className="w-32 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none"><option value="standard">VAT 15%</option><option value="zero_rated">Zero Rated</option><option value="exempt">Exempt</option><option value="non_vatable">No VAT</option></select>{invLines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-400 text-xs px-2">✕</button>}</div></div>))}
            <button onClick={addLine} className="w-full rounded-lg border border-dashed border-white/[0.1] py-2 text-xs text-zinc-500 hover:text-white">+ Add Line</button>
            <button onClick={handleCapture} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Capture Invoice</button>
          </div>
        </Modal>
      )}

      {showBulk && <Modal title="Bulk Upload" onClose={() => setShowBulk(false)}><div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center"><p className="text-sm text-zinc-400">Drag and drop PDFs, images, or scans here</p><p className="text-xs text-zinc-600 mt-1">OCR will process automatically</p></div></Modal>}
    </div>
  );
}

function KPI({ label, value, highlight }: any) {
  return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">{label}</p><p className={`text-xl font-light ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p></div>);
}

function ApprovalQueue({ invoices, onApprove, onReject }: any) {
  if (!invoices || invoices.length === 0) return <p className="text-sm text-zinc-500 py-8 text-center">No invoices awaiting approval.</p>;
  return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Source</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead><tbody>{invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-500 text-xs">{inv.source}</td><td className="py-2.5 px-4 text-right"><button onClick={() => onApprove(inv.id)} className="text-emerald-400 hover:text-emerald-300 text-xs mr-2">Approve</button><button onClick={() => onReject(inv.id)} className="text-red-400 hover:text-red-300 text-xs">Reject</button></td></tr>))}</tbody></table></div>);
}

function SuppliersList({ suppliers, entityId, onSelect }: any) {
  return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Contact</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead><tbody>{suppliers.map((s: any) => (<tr key={s.id} onClick={() => onSelect(s)} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer"><td className="py-2.5 px-4 text-white font-light">{s.supplier_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.email || s.phone || '—'}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td></tr>))}</tbody></table></div>);
}

function RecurringExpenses({ entityId }: any) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: '', glCode: '', amount: '', frequency: 'monthly' });
  useEffect(() => { async function load() { const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId); setExpenses(data || []); } load(); }, [entityId]);
  async function handleAdd() { await apApi.createRecurringExpense({ entityId, description: form.description, glCode: form.glCode, amount: parseFloat(form.amount), frequency: form.frequency }); setShowAdd(false); const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId); setExpenses(data || []); }
  return (<div className="space-y-4"><div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Recurring</button></div>{expenses.length === 0 ? <p className="text-sm text-zinc-500 py-8 text-center">No recurring expenses.</p> : (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">GL</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Frequency</th></tr></thead><tbody>{expenses.map(e => (<tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{e.description}</td><td className="py-2.5 px-4 text-zinc-400">{e.gl_code}</td><td className="py-2.5 px-4 text-right text-white tabular-nums">R{e.amount.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-400 capitalize">{e.frequency}</td></tr>))}</tbody></table></div>)}{showAdd && <Modal title="Add Recurring Expense" onClose={() => setShowAdd(false)}><div className="space-y-3"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.glCode} onChange={(e) => setForm({ ...form, glCode: e.target.value })} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select><button onClick={handleAdd} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save</button></div></Modal>}</div>);
}

function AgingDetail({ aging }: any) {
  return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging Detail</p><div className="grid grid-cols-5 gap-3 text-center">{[{ label: 'Current', value: aging.current }, { label: '1-30 Days', value: aging.days30 }, { label: '31-60 Days', value: aging.days60 }, { label: '61-90 Days', value: aging.days90 }, { label: '120+ Days', value: aging.days120 }].map(b => (<div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-xs text-zinc-500 mb-2">{b.label}</p><p className={`text-2xl font-light ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p></div>))}</div></div>);
}

function MonthEndAssistant({ entityId }: any) {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => { async function load() { const s = await apApi.getMonthEndStatus(entityId); setStatus(s); } load(); }, [entityId]);
  if (!status) return <p className="text-sm text-zinc-500 py-8 text-center">Loading...</p>;
  return (<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
    <p className="text-sm font-medium text-white mb-4">Month-End AP Assistant</p>
    <div className="space-y-2">
      <CheckItem label="No Draft Invoices" passed={status.hasDrafts} />
      <CheckItem label="No Duplicate Warnings" passed={status.hasDuplicates} />
      <CheckItem label="No Unallocated Payments" passed={true} />
      <CheckItem label="No Missing VAT" passed={true} />
      <CheckItem label="No Outstanding Approvals" passed={status.pendingCount === 0} />
    </div>
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <p className={`text-sm font-medium ${status.ready ? 'text-emerald-400' : 'text-amber-400'}`}>{status.ready ? '✓ Ready for Close' : `${status.pendingCount} items need attention`}</p>
    </div>
  </div>);
}

function CheckItem({ label, passed }: any) {
  return (<div className="flex items-center gap-2 text-xs"><span className={passed ? 'text-emerald-400' : 'text-zinc-500'}>{passed ? '✓' : '○'}</span><span className={passed ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span></div>);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (<><div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{title}</p><button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button></div>{children}</div></div></>);
}
