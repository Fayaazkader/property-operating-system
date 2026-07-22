'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cashbookService } from '@/lib/cashbook/cashbook-service';

type Destination = 'tenant' | 'supplier' | 'property' | 'entity' | null;

interface InvoiceRow {
  id: string; invoice_number: string; date: string; outstanding: number;
  due: string; status: string; property_name?: string; po_reference?: string;
}

export default function ManualAllocationWorkspace() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.accountId as string;
  const transactionId = params.transactionId as string;

  const [transaction, setTransaction] = useState<any>(null);
  const [destination, setDestination] = useState<Destination>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isReceipt, setIsReceipt] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [entityId, setEntityId] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceSort, setInvoiceSort] = useState<'date' | 'outstanding' | 'age'>('date');
  const [invoiceSortDir, setInvoiceSortDir] = useState<'asc' | 'desc'>('asc');

  const [glSearch, setGlSearch] = useState('');
  const [glResults, setGlResults] = useState<any[]>([]);
  const [selectedGl, setSelectedGl] = useState<any>(null);
  const [allocatedAmount, setAllocatedAmount] = useState(0);

  const [isReallocation, setIsReallocation] = useState(false);
  const [reallocationReason, setReallocationReason] = useState('');

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase.from('bank_transactions').select('*').eq('id', transactionId).single();
      if (tx) {
        setTransaction(tx);
        setTotalAmount(Math.abs(tx.transaction_amount || 0));
        setIsReceipt((tx.transaction_amount || 0) >= 0);
        setIsReallocation(tx.allocation_status === 'posted');
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: entityIds } = await supabase.rpc('auth_entities');
        setEntityId(entityIds?.[0] || '');
      }
      setLoading(false);
    }
    load();
  }, [transactionId]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q || q.length < 2 || !destination) { setSearchResults([]); return; }
    const lower = q.toLowerCase();
    let results: any[] = [];
    if (destination === 'tenant') {
      const { data } = await supabase.from('tenants').select('id, tenant_name').in('entity_id', [entityId]).ilike('tenant_name', `%${lower}%`).limit(10);
      results = data || [];
    } else if (destination === 'supplier') {
      const { data } = await supabase.from('suppliers').select('id, supplier_name').eq('entity_id', entityId).ilike('supplier_name', `%${lower}%`).limit(10);
      results = data || [];
    } else if (destination === 'property') {
      const { data } = await supabase.from('properties').select('id, property_name').eq('entity_id', entityId).ilike('property_name', `%${lower}%`).limit(10);
      results = data || [];
    } else if (destination === 'entity') {
      const { data } = await supabase.from('entities').select('id, entity_name').in('id', [entityId]).ilike('entity_name', `%${lower}%`).limit(5);
      results = data || [];
    }
    setSearchResults(results);
  }

  async function handleSelect(item: any) {
    setSelectedItem(item);
    setSearchQuery(destination === 'tenant' ? item.tenant_name : destination === 'supplier' ? item.supplier_name : destination === 'property' ? item.property_name : item.entity_name);
    setSearchResults([]);
    if (destination === 'tenant') {
      const { data } = await supabase.from('invoices').select('id, invoice_number, total_amount, payment_status, created_at').eq('tenant_id', item.id).neq('payment_status', 'paid').order('created_at', { ascending: false });
      setInvoices((data || []).map(inv => ({ id: inv.id, invoice_number: inv.invoice_number, date: inv.created_at?.split('T')[0] || '', outstanding: inv.total_amount, due: inv.created_at?.split('T')[0] || '', status: inv.payment_status })));
    } else if (destination === 'supplier') {
      const { data } = await supabase.from('supplier_invoices_new').select('id, invoice_number, total_amount, invoice_date').eq('supplier_id', item.id).eq('lifecycle_status', 'posted').order('invoice_date', { ascending: false });
      setInvoices((data || []).map(inv => ({ id: inv.id, invoice_number: inv.invoice_number, date: inv.invoice_date || '', outstanding: inv.total_amount, due: inv.invoice_date || '', status: 'posted' })));
    }
  }

  async function handleGlSearch(q: string) {
    setGlSearch(q);
    if (!q || q.length < 2) { setGlResults([]); return; }
    const { data } = await supabase.from('chart_of_accounts').select('id, gl_code, account_name').eq('entity_id', entityId).or(`gl_code.ilike.%${q}%,account_name.ilike.%${q}%`).limit(15);
    setGlResults(data || []);
  }

  function toggleInvoice(invId: string) { setSelectedInvoices(prev => prev.includes(invId) ? prev.filter(id => id !== invId) : [...prev, invId]); }
  function getSelectedInvoiceTotal(): number { return invoices.filter(inv => selectedInvoices.includes(inv.id)).reduce((s, inv) => s + inv.outstanding, 0); }

  function handleSortInvoices(field: 'date' | 'outstanding' | 'age') {
    if (invoiceSort === field) setInvoiceSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setInvoiceSort(field); setInvoiceSortDir('asc'); }
  }

  const sortedInvoices = [...invoices].sort((a, b) => {
    let cmp = 0;
    if (invoiceSort === 'date') cmp = a.date.localeCompare(b.date);
    else if (invoiceSort === 'outstanding') cmp = a.outstanding - b.outstanding;
    if (invoiceSortDir === 'desc') cmp = -cmp;
    return cmp;
  });

  const filteredInvoices = sortedInvoices.filter(inv => !invoiceSearch || inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) || inv.po_reference?.toLowerCase().includes(invoiceSearch.toLowerCase()));
  const currentAllocated = destination === 'tenant' || destination === 'supplier' ? getSelectedInvoiceTotal() : allocatedAmount;
  const remaining = totalAmount - currentAllocated;
  const isOverpayment = remaining < 0;
  const isPartial = currentAllocated > 0 && currentAllocated < totalAmount;

  async function handleSave() {
    setSaving(true);
    const tenantId = destination === 'tenant' ? selectedItem?.id : undefined;
    const supplierId = destination === 'supplier' ? selectedItem?.id : undefined;
    const invoiceId = selectedInvoices.length === 1 ? selectedInvoices[0] : undefined;
    if (destination === 'tenant' || destination === 'supplier') {
      await cashbookService.confirmAllocation(transactionId, invoiceId || 'manual', tenantId, supplierId);
    } else {
      await supabase.from('bank_transactions').update({ allocation_status: 'ready_to_post', queue: 'ready' }).eq('id', transactionId);
    }
    router.push(`/financials/cash-book/${accountId}`);
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-zinc-500">Loading...</div>;
  const destLabel = destination === 'tenant' ? 'Tenant' : destination === 'supplier' ? 'Supplier' : destination === 'property' ? 'Property' : destination === 'entity' ? 'Entity' : '';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 pt-8 pb-12">
      <button onClick={() => router.back()} className="text-xs text-zinc-500 hover:text-white">← Back</button>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Manual Allocation</p><p className="text-xs text-zinc-500">{isReallocation ? 'Reallocation — previous allocation will be reversed.' : 'No match found. Choose where this transaction belongs.'}</p></div>
          <div className="text-right"><p className="text-[10px] text-zinc-600">{transaction?.transaction_date}</p><p className="text-sm text-white mt-0.5">{transaction?.transaction_description}</p><p className={`text-xl font-light mt-1 ${isReceipt ? 'text-emerald-400' : 'text-red-400'} tabular-nums`}>{isReceipt ? '+' : '−'}R{totalAmount.toLocaleString()}</p></div>
        </div>
      </div>

      {!destination && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">Allocate {isReceipt ? 'Receipt' : 'Payment'} to</p>
          <div className="grid grid-cols-2 gap-3">
            {(isReceipt ? ['tenant', 'supplier', 'property', 'entity'] : ['supplier', 'tenant', 'property', 'entity']).map(d => (
              <button key={d} onClick={() => setDestination(d as Destination)} className="rounded-xl border border-white/[0.06] p-4 text-left hover:border-white/20 transition-all">
                <p className="text-sm font-medium text-white capitalize">{d}</p>
                <p className="text-xs text-zinc-500 mt-1">{d === 'tenant' ? 'Tenant receipt, deposit, or refund' : d === 'supplier' ? 'Supplier invoice or payment' : d === 'property' ? 'Property income or expense' : 'Entity-level transaction'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {destination && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
          <div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Allocate to {destLabel}</p><button onClick={() => { setDestination(null); setSelectedItem(null); setInvoices([]); setSelectedInvoices([]); }} className="text-xs text-zinc-500 hover:text-white">Change</button></div>

          <div className="relative">
            <input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} onFocus={() => { if (selectedItem) { setSearchQuery(''); setSelectedItem(null); setInvoices([]); setSelectedInvoices([]); } }} placeholder={`Search ${destLabel.toLowerCase()}...`} className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
            {searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-30 max-h-48 overflow-y-auto">
                {searchResults.map(r => (<button key={r.id} onClick={() => handleSelect(r)} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{destination === 'tenant' ? r.tenant_name : destination === 'supplier' ? r.supplier_name : destination === 'property' ? r.property_name : r.entity_name}</button>))}
              </div>
            )}
          </div>

          {selectedItem && (destination === 'tenant' || destination === 'supplier') && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 grid grid-cols-3 gap-4 text-xs">
              <div><p className="text-zinc-500">{destLabel}</p><p className="text-white font-medium">{destination === 'tenant' ? selectedItem.tenant_name : selectedItem.supplier_name}</p></div>
              <div><p className="text-zinc-500">Outstanding</p><p className="text-white">R{invoices.reduce((s, i) => s + i.outstanding, 0).toLocaleString()}</p></div>
              <div><p className="text-zinc-500">Invoices</p><p className="text-white">{invoices.length} open</p></div>
            </div>
          )}

          {selectedItem && (destination === 'tenant' || destination === 'supplier') && invoices.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2"><input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} placeholder="Search invoices..." className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" /></div>
              <div className="rounded-lg border border-white/[0.06] overflow-hidden"><table className="w-full text-xs"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase">Invoice</th><th onClick={() => handleSortInvoices('date')} className="text-left py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Date {invoiceSort === 'date' ? (invoiceSortDir === 'asc' ? '↑' : '↓') : ''}</th><th onClick={() => handleSortInvoices('outstanding')} className="text-right py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase cursor-pointer hover:text-white">Outstanding {invoiceSort === 'outstanding' ? (invoiceSortDir === 'asc' ? '↑' : '↓') : ''}</th><th className="text-center py-2 px-3 text-[10px] font-medium text-zinc-500 uppercase w-16">Select</th></tr></thead><tbody>{filteredInvoices.map(inv => (<tr key={inv.id} className={`border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer ${selectedInvoices.includes(inv.id) ? 'bg-white/[0.03]' : ''}`} onClick={() => toggleInvoice(inv.id)}><td className="py-2 px-3 text-white">{inv.invoice_number}</td><td className="py-2 px-3 text-zinc-400">{inv.date}</td><td className="py-2 px-3 text-right text-white tabular-nums">R{inv.outstanding.toLocaleString()}</td><td className="py-2 px-3 text-center"><span className={selectedInvoices.includes(inv.id) ? 'text-emerald-400' : 'text-zinc-600'}>{selectedInvoices.includes(inv.id) ? '✓' : '○'}</span></td></tr>))}</tbody></table></div>
            </div>
          )}

          {selectedItem && (destination === 'property' || destination === 'entity') && (
            <div className="space-y-3">
              <div className="relative">
                <input value={glSearch} onChange={(e) => handleGlSearch(e.target.value)} onFocus={() => { if (selectedGl) { setGlSearch(''); setSelectedGl(null); } }} placeholder="Search GL account by code or name..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
                {glSearch && <button onClick={() => { setGlSearch(''); setGlResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>}
                {glResults.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-30 max-h-48 overflow-y-auto">{glResults.map(g => (<button key={g.id} onClick={() => { setSelectedGl(g); setGlSearch(`${g.gl_code} — ${g.account_name}`); setGlResults([]); }} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white">{g.gl_code} — {g.account_name}</button>))}</div>)}
              </div>
              {selectedGl && (<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs"><span className="text-emerald-400">{selectedGl.gl_code} — {selectedGl.account_name}</span></div>)}
              <div><label className="text-[9px] text-zinc-600 block mb-0.5">Amount</label><input value={allocatedAmount || totalAmount} onChange={(e) => setAllocatedAmount(parseFloat(e.target.value) || 0)} type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
            </div>
          )}
        </div>
      )}

      {destination && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5">
          <div className="flex justify-between text-sm"><span className="text-zinc-500">Transaction</span><span className="text-white tabular-nums">R{totalAmount.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-zinc-500">Allocated</span><span className={`tabular-nums ${remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>R{currentAllocated.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm mt-1 font-medium"><span className="text-zinc-500">Remaining</span><span className={`tabular-nums ${remaining === 0 ? 'text-emerald-400' : 'text-red-400'}`}>R{Math.abs(remaining).toLocaleString()}</span></div>
          {isOverpayment && (<div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">Overpayment of R{Math.abs(remaining).toLocaleString()} — this will create a {destination === 'tenant' ? 'tenant' : 'supplier'} credit.</div>)}
          {isPartial && !isOverpayment && (<p className="text-xs text-zinc-500 mt-2">Partial payment — R{remaining.toLocaleString()} will remain outstanding.</p>)}
          {isReallocation && (<div className="mt-3"><input value={reallocationReason} onChange={(e) => setReallocationReason(e.target.value)} placeholder="Reason for reallocation..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>)}
          <button onClick={handleSave} disabled={saving || !selectedItem || (destination === 'tenant' || destination === 'supplier' ? selectedInvoices.length === 0 : !selectedGl)} className="mt-4 w-full rounded-lg bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40">{saving ? 'Saving...' : isReallocation ? 'Confirm Reallocation' : 'Confirm Allocation'}</button>
        </div>
      )}
    </div>
  );
}
