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
  const [showBulk, setShowBulk] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<any[]>([]);
  const [codingSuggestion, setCodingSuggestion] = useState<any>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState('');
  const [supplierForm, setSupplierForm] = useState({
    supplier_name: '', trading_name: '', registered_name: '', registration_number: '',
    tax_number: '', vat_number: '', contact_person: '', email: '', phone: '',
    accounts_contact: '', bank_name: '', bank_account: '', bank_branch: '',
    payment_method: 'eft', default_payment_terms: '30', category: '',
    is_active: true,
  });
  const [supplierAccounts, setSupplierAccounts] = useState<any[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ property_id: '', account_number: '', account_name: '', meter_number: '' });

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconSupplier, setReconSupplier] = useState('');
  const [reconLines, setReconLines] = useState('');
  const [reconResult, setReconResult] = useState<any>(null);

  // Capture form — redesigned
  const [captureType, setCaptureType] = useState<'invoice' | 'credit_note'>('invoice');
  const [invSupplier, setInvSupplier] = useState('');
  const [invAccountId, setInvAccountId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invDue, setInvDue] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invLines, setInvLines] = useState<Array<{ propertyId: string; glCode: string; description: string; amountExcl: string; vatRate: string; amountIncl: string; editField: 'excl' | 'vat' | 'incl' }>>([
    { propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }
  ]);
  const [accountSearch, setAccountSearch] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState<any[]>([]);

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
    setInvAccountId('');
    const { data: accounts } = await supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', supplierId);
    setSupplierAccounts(accounts || []);
    const suggestion = await apIntelligence.getCodingSuggestions(supplierId);
    setCodingSuggestion(suggestion);
    if (suggestion) setInvLines([{ propertyId: suggestion.propertyId || '', glCode: suggestion.glCode, description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]);
  }

  function handleAccountSearch(q: string) {
    setAccountSearch(q);
    if (!q) { setFilteredAccounts([]); return; }
    setFilteredAccounts(supplierAccounts.filter(a => a.account_number?.toLowerCase().includes(q.toLowerCase()) || a.property?.property_name?.toLowerCase().includes(q.toLowerCase())));
  }

  function recalcLine(i: number, field: 'excl' | 'vat' | 'incl', value: string) {
    const lines = [...invLines];
    lines[i].editField = field;
    const num = parseFloat(value) || 0;
    const vatRate = parseFloat(lines[i].vatRate) || 15;
    
    if (field === 'excl') {
      lines[i].amountExcl = value;
      lines[i].amountIncl = (num * (1 + vatRate / 100)).toFixed(2);
    } else if (field === 'incl') {
      lines[i].amountIncl = value;
      lines[i].amountExcl = (num / (1 + vatRate / 100)).toFixed(2);
    } else if (field === 'vat') {
      lines[i].amountExcl = (num / (vatRate / 100)).toFixed(2);
      lines[i].amountIncl = (parseFloat(lines[i].amountExcl) + num).toFixed(2);
    }
    setInvLines(lines);
  }

  async function handleCapture() {
    const lines = invLines.map(l => ({
      propertyId: l.propertyId || undefined,
      glCode: l.glCode,
      description: l.description,
      amount: parseFloat(l.amountExcl) || 0,
      vatCode: parseFloat(l.vatRate) === 0 ? 'non_vatable' : 'standard',
      vatRate: parseFloat(l.vatRate) || 15,
    }));
    await apApi.captureInvoice({ entityId, supplierId: invSupplier, invoiceNumber: invNumber, invoiceDate: invDate, dueDate: invDue, description: invDescription, lines, source: 'manual', createdBy: 'user' });
    setShowCapture(false); resetForm();
    await refreshData();
  }

  async function handleApprove(invoiceId: string) { await apApi.approveInvoice(invoiceId, 'user'); await refreshData(); }
  async function handleReject(invoiceId: string) { await apApi.rejectInvoice(invoiceId, 'Rejected'); await refreshData(); }

  async function handleSaveSupplier() {
    const payload = { ...supplierForm };
    if (editSupplierId) {
      await supabase.from('suppliers').update(payload).eq('id', editSupplierId);
    } else {
      await supabase.from('suppliers').insert({ ...payload, entity_id: entityId });
    }
    setShowSupplierForm(false); setEditSupplierId('');
    const { data } = await supabase.from('suppliers').select('*').eq('entity_id', entityId).order('supplier_name');
    setSuppliers(data || []);
  }

  function editSupplier(s: any) {
    setEditSupplierId(s.id);
    setSupplierForm({
      supplier_name: s.supplier_name || '', trading_name: s.trading_name || '', registered_name: s.registered_name || '',
      registration_number: s.registration_number || '', tax_number: s.tax_number || '', vat_number: s.vat_number || '',
      contact_person: s.contact_person || '', email: s.email || '', phone: s.phone || '',
      accounts_contact: s.accounts_contact || '', bank_name: s.bank_name || '', bank_account: s.bank_account || '',
      bank_branch: s.bank_branch || '', payment_method: s.payment_method || 'eft',
      default_payment_terms: s.default_payment_terms || '30', category: s.category || '',
      is_active: s.is_active !== false,
    });
    setShowSupplierForm(true);
  }

  async function handleSaveAccount() {
    if (!invSupplier || !accountForm.property_id || !accountForm.account_number) return;
    await supabase.from('supplier_accounts').insert({
      entity_id: entityId, supplier_id: invSupplier,
      property_id: accountForm.property_id, account_number: accountForm.account_number,
      account_name: accountForm.account_name, meter_number: accountForm.meter_number,
    });
    setShowAccountForm(false);
    const { data: accounts } = await supabase.from('supplier_accounts').select('*, property:property_id(property_name)').eq('supplier_id', invSupplier);
    setSupplierAccounts(accounts || []);
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

  function resetForm() { setInvSupplier(''); setInvAccountId(''); setInvNumber(''); setInvDate(new Date().toISOString().split('T')[0]); setInvDue(''); setInvDescription(''); setInvLines([{ propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]); setCodingSuggestion(null); }
  function addLine() { setInvLines([...invLines, { propertyId: '', glCode: '', description: '', amountExcl: '', vatRate: '15', amountIncl: '', editField: 'excl' }]); }
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
          <div className="flex gap-2">
            <button onClick={() => setShowBulk(true)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white hover:border-white/20">Bulk Upload</button>
            <button onClick={() => setShowCapture(true)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Capture</button>
          </div>
        </div>

        {warnings.length > 0 && (<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6"><p className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">⚠ Attention</p>{warnings.slice(0, 5).map((w: any, i: number) => (<div key={i} className="flex justify-between text-xs"><span className="text-zinc-300">{w.message}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${w.severity === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{w.severity}</span></div>))}</div>)}

        {section === 'dashboard' && <DashboardPanel data={data} approvalCount={approvalQueue.length} warningCount={warnings.length} />}
        {section === 'approval-queue' && <ApprovalQueue invoices={approvalQueue} onApprove={handleApprove} onReject={handleReject} />}
        {section === 'invoices' && <InvoicesList invoices={filteredInvoices} search={invoiceSearch} setSearch={setInvoiceSearch} />}
        {section === 'suppliers' && <SuppliersList suppliers={suppliers} onEdit={editSupplier} onAdd={() => { setEditSupplierId(''); setSupplierForm({ supplier_name: '', trading_name: '', registered_name: '', registration_number: '', tax_number: '', vat_number: '', contact_person: '', email: '', phone: '', accounts_contact: '', bank_name: '', bank_account: '', bank_branch: '', payment_method: 'eft', default_payment_terms: '30', category: '', is_active: true }); setShowSupplierForm(true); }} />}
        {section === 'credit-notes' && <CreditNotesList creditNotes={creditNotes} />}
        {section === 'recurring' && <RecurringExpenses entityId={entityId} />}
        {section === 'aging' && data.aging && <AgingDetail aging={data.aging} />}
        {section === 'payments' && <PaymentHistoryList payments={paymentHistory} />}
        {section === 'month-end' && <MonthEndAssistant status={data.monthEnd} />}
        {section === 'reconciliation' && <ReconciliationPanel suppliers={suppliers} reconSupplier={reconSupplier} setReconSupplier={setReconSupplier} reconLines={reconLines} setReconLines={setReconLines} reconResult={reconResult} onReconcile={handleReconcile} />}
      </div>

      {/* CAPTURE MODAL */}
      {showCapture && (
        <Modal title={captureType === 'invoice' ? 'Capture Invoice' : 'Capture Credit Note'} onClose={() => setShowCapture(false)}>
          <div className="space-y-3 max-h-[75vh] overflow-y-auto">
            <div className="flex gap-2">
              <button onClick={() => setCaptureType('invoice')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'invoice' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Invoice</button>
              <button onClick={() => setCaptureType('credit_note')} className={`flex-1 rounded-lg py-2 text-xs font-medium ${captureType === 'credit_note' ? 'bg-white text-black' : 'border border-white/[0.08] text-white'}`}>Credit Note</button>
            </div>

            <select value={invSupplier} onChange={(e) => handleSupplierSelect(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
              <option value="">Select supplier...</option>
              {suppliers.map(s => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}
            </select>

            {supplierAccounts.length > 0 && (
              <div className="relative">
                <input value={accountSearch} onChange={(e) => handleAccountSearch(e.target.value)} placeholder="Search account number or property..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                {filteredAccounts.length > 0 && accountSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-30 max-h-32 overflow-y-auto">
                    {filteredAccounts.map(a => (
                      <button key={a.id} onClick={() => { setInvAccountId(a.id); setAccountSearch(`${a.account_number} — ${a.property?.property_name || ''}`); setFilteredAccounts([]); }} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">
                        {a.account_number} — {a.property?.property_name || 'No property'}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowAccountForm(true)} className="mt-1 text-[10px] text-zinc-500 hover:text-white">+ Add account number</button>
              </div>
            )}

            {codingSuggestion && (<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400">Suggested: GL {codingSuggestion.glCode} · {codingSuggestion.vatCode} · {codingSuggestion.confidence}% confidence</div>)}

            <div className="grid grid-cols-3 gap-2">
              <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="Invoice #" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={invDate} onChange={(e) => setInvDate(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={invDue} onChange={(e) => setInvDue(e.target.value)} type="date" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>

            <input value={invDescription} onChange={(e) => setInvDescription(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />

            <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Line Items</p>
            {invLines.map((line, i) => (
              <div key={i} className="space-y-2 border border-white/[0.06] rounded-lg p-3">
                <div className="flex gap-2">
                  <select value={line.propertyId} onChange={(e) => { const l = [...invLines]; l[i].propertyId = e.target.value; setInvLines(l); }} className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none"><option value="">Property</option>{properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}</select>
                  <input value={line.glCode} onChange={(e) => { const l = [...invLines]; l[i].glCode = e.target.value; setInvLines(l); }} placeholder="GL Code" className="w-20 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" />
                </div>
                <input value={line.description} onChange={(e) => { const l = [...invLines]; l[i].description = e.target.value; setInvLines(l); }} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-xs text-white outline-none" />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-zinc-600 block mb-0.5">Ex VAT</label>
                    <input value={line.amountExcl} onChange={(e) => recalcLine(i, 'excl', e.target.value)} placeholder="0.00" className={`w-full rounded-lg border bg-zinc-900 px-2 py-2 text-white outline-none ${line.editField === 'excl' ? 'border-white/30' : 'border-white/[0.08]'}`} />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-600 block mb-0.5">VAT %</label>
                    <input value={line.vatRate} onChange={(e) => { const l = [...invLines]; l[i].vatRate = e.target.value; recalcLine(i, 'excl', l[i].amountExcl); }} placeholder="15" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-2 text-white outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-600 block mb-0.5">Incl VAT</label>
                    <input value={line.amountIncl} onChange={(e) => recalcLine(i, 'incl', e.target.value)} placeholder="0.00" className={`w-full rounded-lg border bg-zinc-900 px-2 py-2 text-white outline-none ${line.editField === 'incl' ? 'border-white/30' : 'border-white/[0.08]'}`} />
                  </div>
                </div>
                {invLines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-400 text-[10px]">Remove line</button>}
              </div>
            ))}
            <button onClick={addLine} className="w-full rounded-lg border border-dashed border-white/[0.1] py-2 text-xs text-zinc-500 hover:text-white">+ Add Line</button>
            <button onClick={handleCapture} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Capture {captureType === 'invoice' ? 'Invoice' : 'Credit Note'}</button>
          </div>
        </Modal>
      )}

      {/* BULK UPLOAD MODAL */}
      {showBulk && (<Modal title="Bulk Upload" onClose={() => setShowBulk(false)}><div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center space-y-3"><p className="text-sm text-zinc-400">Drag and drop PDFs, images, or scans here</p><p className="text-xs text-zinc-600">OCR will process automatically · Drafts created for review</p><input type="file" multiple accept=".pdf,.jpg,.png,.jpeg" className="text-xs text-zinc-500" /></div></Modal>)}

      {/* SUPPLIER FORM MODAL */}
      {showSupplierForm && (
        <Modal title={editSupplierId ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setShowSupplierForm(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">General</p>
            <input value={supplierForm.supplier_name} onChange={(e) => setSupplierForm({ ...supplierForm, supplier_name: e.target.value })} placeholder="Supplier Name *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={supplierForm.trading_name} onChange={(e) => setSupplierForm({ ...supplierForm, trading_name: e.target.value })} placeholder="Trading Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={supplierForm.registered_name} onChange={(e) => setSupplierForm({ ...supplierForm, registered_name: e.target.value })} placeholder="Registered Name" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={supplierForm.registration_number} onChange={(e) => setSupplierForm({ ...supplierForm, registration_number: e.target.value })} placeholder="Registration Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={supplierForm.tax_number} onChange={(e) => setSupplierForm({ ...supplierForm, tax_number: e.target.value })} placeholder="Tax Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <input value={supplierForm.vat_number} onChange={(e) => setSupplierForm({ ...supplierForm, vat_number: e.target.value })} placeholder="VAT Number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Category</p>
            <select value={supplierForm.category} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
              <option value="">Select category...</option>
              <option value="municipality">Municipality</option>
              <option value="utility">Utility</option>
              <option value="contractor">Contractor</option>
              <option value="security">Security</option>
              <option value="cleaning">Cleaning</option>
              <option value="insurance">Insurance</option>
              <option value="legal">Legal</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Other</option>
            </select>

            <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Contact</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={supplierForm.contact_person} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} placeholder="Contact Person" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={supplierForm.accounts_contact} onChange={(e) => setSupplierForm({ ...supplierForm, accounts_contact: e.target.value })} placeholder="Accounts Contact" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="Email" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="Phone" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>

            <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Banking</p>
            <div className="grid grid-cols-3 gap-2">
              <input value={supplierForm.bank_name} onChange={(e) => setSupplierForm({ ...supplierForm, bank_name: e.target.value })} placeholder="Bank" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={supplierForm.bank_account} onChange={(e) => setSupplierForm({ ...supplierForm, bank_account: e.target.value })} placeholder="Account Number" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
              <input value={supplierForm.bank_branch} onChange={(e) => setSupplierForm({ ...supplierForm, bank_branch: e.target.value })} placeholder="Branch" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>

            <p className="text-[10px] uppercase tracking-wider text-zinc-500 pt-2">Defaults</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={supplierForm.payment_method} onChange={(e) => setSupplierForm({ ...supplierForm, payment_method: e.target.value })} className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
                <option value="eft">EFT</option><option value="debit_order">Debit Order</option><option value="cash">Cash</option><option value="cheque">Cheque</option>
              </select>
              <input value={supplierForm.default_payment_terms} onChange={(e) => setSupplierForm({ ...supplierForm, default_payment_terms: e.target.value })} placeholder="Payment Terms (days)" className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={supplierForm.is_active} onChange={(e) => setSupplierForm({ ...supplierForm, is_active: e.target.checked })} />
              Active
            </label>

            <button onClick={handleSaveSupplier} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">{editSupplierId ? 'Update Supplier' : 'Add Supplier'}</button>
          </div>
        </Modal>
      )}

      {/* ACCOUNT FORM MODAL */}
      {showAccountForm && (
        <Modal title="Add Account Number" onClose={() => setShowAccountForm(false)}>
          <div className="space-y-3">
            <select value={accountForm.property_id} onChange={(e) => setAccountForm({ ...accountForm, property_id: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none">
              <option value="">Select property...</option>
              {properties.map(p => (<option key={p.id} value={p.id}>{p.property_name}</option>))}
            </select>
            <input value={accountForm.account_number} onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })} placeholder="Account Number *" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <input value={accountForm.account_name} onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })} placeholder="Account Name (optional)" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <input value={accountForm.meter_number} onChange={(e) => setAccountForm({ ...accountForm, meter_number: e.target.value })} placeholder="Meter Number (if applicable)" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            <button onClick={handleSaveAccount} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save Account</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// All the sub-components (DashboardPanel, KPI, ApprovalQueue, InvoicesList, SuppliersList, CreditNotesList, RecurringExpenses, AgingDetail, PaymentHistoryList, MonthEndAssistant, CheckItem, ReconciliationPanel, Modal) remain the same as previous version
function DashboardPanel({ data, approvalCount, warningCount }: any) {
  return (<div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><KPI label="Outstanding AP" value={`R${(data.outstandingAP || 0).toLocaleString()}`} /><KPI label="Awaiting Approval" value={approvalCount} highlight /><KPI label="Warnings" value={warningCount} highlight={warningCount > 0} /><KPI label="Month-End" value={data.monthEnd?.ready ? 'Ready' : 'Pending'} /></div>{data.aging && <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging</p><div className="grid grid-cols-5 gap-3 text-center text-xs">{[{ label: 'Current', value: data.aging.current }, { label: '1-30', value: data.aging.days30 }, { label: '31-60', value: data.aging.days60 }, { label: '61-90', value: data.aging.days90 }, { label: '120+', value: data.aging.days120 }].map(b => (<div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3"><p className="text-zinc-500">{b.label}</p><p className={`text-sm font-medium mt-1 ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p></div>))}</div></div>}</div>);
}
function KPI({ label, value, highlight }: any) { return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">{label}</p><p className={`text-xl font-light ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p></div>); }
function ApprovalQueue({ invoices, onApprove, onReject }: any) { if (!invoices?.length) return <p className="text-sm text-zinc-500 py-8 text-center">No invoices awaiting approval.</p>; return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead><tbody>{invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-right"><button onClick={() => onApprove(inv.id)} className="text-emerald-400 hover:text-emerald-300 text-xs mr-2">Approve</button><button onClick={() => onReject(inv.id)} className="text-red-400 hover:text-red-300 text-xs">Reject</button></td></tr>))}</tbody></table></div>); }
function InvoicesList({ invoices, search, setSearch }: any) { return (<div className="space-y-4"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice number or supplier..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />{!invoices?.length ? <p className="text-sm text-zinc-500 py-8 text-center">No invoices found.</p> : (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice #</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead><tbody>{invoices.map((inv: any) => (<tr key={inv.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td><td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{inv.lifecycle_status}</span></td></tr>))}</tbody></table></div>)}</div>); }
function SuppliersList({ suppliers, onEdit, onAdd }: any) { return (<div className="space-y-4"><div className="flex justify-end"><button onClick={onAdd} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add Supplier</button></div><div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Contact</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th></tr></thead><tbody>{suppliers.map((s: any) => (<tr key={s.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{s.supplier_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.email || s.phone || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{s.vat_number || '—'}</td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td><td className="py-2.5 px-4 text-right"><button onClick={() => onEdit(s)} className="text-xs text-zinc-400 hover:text-white">Edit</button></td></tr>))}</tbody></table></div></div>); }
function CreditNotesList({ creditNotes }: any) { if (!creditNotes?.length) return <p className="text-sm text-zinc-500 py-8 text-center">No credit notes.</p>; return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">CN #</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Reason</th></tr></thead><tbody>{creditNotes.map((cn: any) => (<tr key={cn.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{cn.supplier?.supplier_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{cn.credit_note_number}</td><td className="py-2.5 px-4 text-right text-emerald-400 tabular-nums text-xs">R{cn.amount?.toLocaleString()}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{cn.reason || '—'}</td></tr>))}</tbody></table></div>); }
function RecurringExpenses({ entityId }: any) { const [expenses, setExpenses] = useState<any[]>([]); const [showAdd, setShowAdd] = useState(false); const [form, setForm] = useState({ description: '', glCode: '', amount: '', frequency: 'monthly' }); useEffect(() => { async function load() { const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId); setExpenses(data || []); } load(); }, [entityId]); async function handleAdd() { await apApi.createRecurringExpense({ entityId, description: form.description, glCode: form.glCode, amount: parseFloat(form.amount), frequency: form.frequency }); setShowAdd(false); const { data } = await supabase.from('recurring_expenses').select('*').eq('entity_id', entityId); setExpenses(data || []); } return (<div className="space-y-4"><div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">+ Add</button></div>{!expenses.length ? <p className="text-sm text-zinc-500 py-8 text-center">No recurring expenses.</p> : (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">GL</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th><th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Frequency</th></tr></thead><tbody>{expenses.map(e => (<tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{e.description}</td><td className="py-2.5 px-4 text-zinc-400">{e.gl_code}</td><td className="py-2.5 px-4 text-right text-white tabular-nums">R{e.amount.toLocaleString()}</td><td className="py-2.5 px-4 text-center text-zinc-400 capitalize">{e.frequency}</td></tr>))}</tbody></table></div>)}{showAdd && <Modal title="Add Recurring Expense" onClose={() => setShowAdd(false)}><div className="space-y-3"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.glCode} onChange={(e) => setForm({ ...form, glCode: e.target.value })} placeholder="GL Code" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select><button onClick={handleAdd} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Save</button></div></Modal>}</div>); }
function AgingDetail({ aging }: any) { return (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Aging Detail</p><div className="grid grid-cols-5 gap-3 text-center">{[{ label: 'Current', value: aging.current }, { label: '1-30 Days', value: aging.days30 }, { label: '31-60', value: aging.days60 }, { label: '61-90', value: aging.days90 }, { label: '120+', value: aging.days120 }].map(b => (<div key={b.label} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4"><p className="text-xs text-zinc-500 mb-2">{b.label}</p><p className={`text-2xl font-light ${b.value > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>R{(b.value || 0).toLocaleString()}</p></div>))}</div></div>); }
function PaymentHistoryList({ payments }: any) { if (!payments?.length) return <p className="text-sm text-zinc-500 py-8 text-center">No payment history. Payments are managed in Cash Book.</p>; return (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Description</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Debit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Credit</th><th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Balance</th></tr></thead><tbody>{payments.map((p: any, i: number) => (<tr key={i} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-zinc-400 text-xs">{p.posted_at?.split('T')[0]}</td><td className="py-2.5 px-4 text-white font-light text-xs">{p.description}</td><td className="py-2.5 px-4 text-right text-zinc-300 text-xs tabular-nums">R{(p.debit_amount || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-zinc-300 text-xs tabular-nums">R{(p.credit_amount || 0).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-white text-xs tabular-nums">R{(p.running_balance || 0).toLocaleString()}</td></tr>))}</tbody></table></div>); }
function MonthEndAssistant({ status }: any) { if (!status) return <p className="text-sm text-zinc-500 py-8 text-center">Loading...</p>; return (<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6"><p className="text-sm font-medium text-white mb-4">Month-End AP Assistant</p><div className="space-y-2"><CheckItem label="No Draft Invoices" passed={status.hasDrafts} /><CheckItem label="Ready for Close" passed={status.ready} /></div><div className="mt-4 pt-4 border-t border-white/[0.06]"><p className={`text-sm font-medium ${status.ready ? 'text-emerald-400' : 'text-amber-400'}`}>{status.ready ? '✓ Ready for Close' : `${status.pendingCount} items need attention`}</p></div></div>); }
function CheckItem({ label, passed }: any) { return (<div className="flex items-center gap-2 text-xs"><span className={passed ? 'text-emerald-400' : 'text-zinc-500'}>{passed ? '✓' : '○'}</span><span className={passed ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span></div>); }
function ReconciliationPanel({ suppliers, reconSupplier, setReconSupplier, reconLines, setReconLines, reconResult, onReconcile }: any) { return (<div className="space-y-6"><div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Supplier Statement Query</p><select value={reconSupplier} onChange={(e) => setReconSupplier(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none"><option value="">Select supplier...</option>{suppliers.map((s: any) => (<option key={s.id} value={s.id}>{s.supplier_name}</option>))}</select><textarea value={reconLines} onChange={(e) => setReconLines(e.target.value)} placeholder="Paste statement lines: date, description, debit, credit (one per line)" rows={6} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /><button onClick={onReconcile} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Compare</button></div>{reconResult && (<div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-xs text-zinc-400 mb-3">Ledger has {reconResult.ledger?.invoices?.length || 0} invoices · Statement has {reconResult.statementLines?.length || 0} lines</p></div>)}</div>); }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return (<><div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">{title}</p><button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button></div>{children}</div></div></>); }
