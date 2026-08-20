'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';
import { Plus, X } from 'lucide-react';
import CaptureInvoiceModal from '@/app/components/suppliers/CaptureInvoiceModal';

export default function InvoicesPage() {
  const [entityId, setEntityId] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCapture, setShowCapture] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [postingInvoice, setPostingInvoice] = useState(false);

  async function init() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: accessRows } = await supabase
      .from('user_entity_access')
      .select('entity_id')
      .eq('user_id', session.user.id);

    const entityIdList = accessRows?.map((r: any) => r.entity_id) || [];
    if (!entityIdList.length) { setLoading(false); return; }

    setEntityId(entityIdList[0]);
    const { data, error } = await supabase
      .from('supplier_invoices_new')
      .select('*, supplier:supplier_id(supplier_name)')
      .in('entity_id', entityIdList)
      .order('created_at', { ascending: false })
      .limit(50);
    setInvoices(data || []);
    setLoading(false);
  }

  useEffect(() => {
    init();
  }, []);

    const filtered = invoices.filter(i => {
    if (filter === 'credit_note' && i.status !== 'credit_note') return false;
    if (filter !== 'all' && filter !== 'credit_note' && i.lifecycle_status !== filter) return false;
    if (search && !i.invoice_number?.toLowerCase().includes(search.toLowerCase()) && !i.supplier?.supplier_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openInvoice = async (inv: any) => {
    const { data: lines } = await supabase
      .from('supplier_invoice_lines')
      .select('*')
      .eq('invoice_id', inv.id);
    setSelectedInvoice({ ...inv, line_items: lines || [] });
  };

  const handlePost = async () => {
    if (!selectedInvoice) return;
    setPostingInvoice(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/suppliers/invoices/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ invoiceId: selectedInvoice.id }),
    });
    if (response.ok) {
      setSelectedInvoice(null);
      init();
    } else {
      alert('Failed to post invoice');
    }
    setPostingInvoice(false);
  };

  const handleCreditNote = async () => {
    if (!selectedInvoice) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/suppliers/invoices/credit-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ invoiceId: selectedInvoice.id }),
    });
    if (response.ok) {
      setSelectedInvoice(null);
      init();
      } else {
    const errData = await response.json().catch(() => ({}));
    console.error("CREDIT NOTE ERROR:", errData);
    alert(`Failed: ${errData.error || errData.message || 'Unknown error'}`);
  }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Invoices</h1>
        <button
          onClick={() => setShowCapture(true)}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Capture Invoice
        </button>
      </div>

      <div className="flex gap-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'posted', label: 'Posted' },
          { key: 'credit_note', label: 'Credit Notes' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs transition-all ${filter === tab.key ? 'bg-white text-black font-medium' : 'text-zinc-500 hover:text-white border border-white/[0.08]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0 focus:outline-none" />

      {!filtered.length ? (
        <p className="text-sm text-zinc-500 py-8 text-center">No invoices found.</p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Supplier</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Invoice #</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Amount</th>
                <th className="text-center py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv: any) => (
                <tr key={inv.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                  <td className="py-2.5 px-4 text-white font-light text-xs">{inv.supplier?.supplier_name || '—'}</td>
                  <td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_number}</td>
                  <td className="py-2.5 px-4 text-zinc-400 text-xs">{inv.invoice_date}</td>
                  <td className="py-2.5 px-4 text-right text-white tabular-nums text-xs">R{inv.total_amount?.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : inv.lifecycle_status === 'pending' ? 'bg-amber-500/10 text-amber-400' : inv.lifecycle_status === 'credit_note' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
  {inv.status === 'credit_note' ? 'credit_note' : inv.lifecycle_status}
</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button onClick={() => openInvoice(inv)} className="text-xs text-zinc-400 hover:text-white transition-colors">
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCapture && (
        <CaptureInvoiceModal
          entityId={entityId}
          onClose={() => setShowCapture(false)}
          onCaptured={() => {
            setShowCapture(false);
            init();
          }}
        />
      )}

      {/* INVOICE DETAIL DRAWER */}
      {selectedInvoice && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />
          <div className="fixed right-0 top-0 h-full w-[480px] z-50 bg-zinc-950 border-l border-white/[0.08] shadow-2xl overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-white">{selectedInvoice.invoice_number}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{selectedInvoice.supplier?.supplier_name}</p>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-zinc-600">Invoice Date</p>
                  <p className="text-sm text-white">{selectedInvoice.invoice_date || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600">Due Date</p>
                  <p className="text-sm text-white">{selectedInvoice.due_date || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600">Subtotal</p>
                  <p className="text-sm text-white">R{selectedInvoice.subtotal?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600">VAT</p>
                  <p className="text-sm text-white">R{selectedInvoice.vat_amount?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600">Total</p>
                  <p className="text-sm font-medium text-white">R{selectedInvoice.total_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600">Status</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedInvoice.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {selectedInvoice.lifecycle_status}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedInvoice.description && (
                <div>
                  <p className="text-[10px] text-zinc-600">Description</p>
                  <p className="text-sm text-zinc-300">{selectedInvoice.description}</p>
                </div>
              )}

              {/* Line Items */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Line Items</p>
                {selectedInvoice.line_items?.length === 0 ? (
                  <p className="text-xs text-zinc-500">No line items recorded</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInvoice.line_items?.map((item: any, i: number) => (
                      <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
                        <p className="text-xs text-white">{item.description || 'No description'}</p>
                        <div className="flex justify-between mt-1.5 text-xs">
                          <span className="text-zinc-500">GL: {item.gl_code || '—'}</span>
                          <span className="text-zinc-500">Ex VAT: R{item.amount?.toLocaleString() || '0'}</span>
                          <span className="text-white font-medium">R{item.total?.toLocaleString() || '0'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-white/[0.06] space-y-2">
                {selectedInvoice.lifecycle_status === 'pending' && (
                  <button
                    onClick={handlePost}
                    disabled={postingInvoice}
                    className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 transition-all"
                  >
                    {postingInvoice ? 'Posting...' : 'Post to AP'}
                  </button>
                )}
                {selectedInvoice.lifecycle_status === 'posted' && (
                  <button
                    onClick={handleCreditNote}
                    className="w-full rounded-full border border-blue-500/20 py-2.5 text-sm text-blue-400 hover:border-blue-500/40 transition-all"
                  >
                    Create Credit Note
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="w-full rounded-full border border-white/[0.08] py-2.5 text-sm text-white hover:border-white/20 transition-all"
                >
                  Print / PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}