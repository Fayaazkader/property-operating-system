'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apApi } from '@/lib/accounts-payable/api';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCN, setShowCN] = useState(false);
  const [cnAmount, setCnAmount] = useState('');
  const [cnReason, setCnReason] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('supplier_invoices_new').select('*, lines:supplier_invoice_lines(*), supplier:supplier_id(supplier_name)').eq('id', id).single();
      setInvoice(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handlePost() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id || !invoice?.entity_id) {
    alert('Unable to verify your access.');
    return;
  }

  try {
    await apApi.postInvoice(
      id as string,
      session.user.id,
      invoice.entity_id
    );

    const { data } = await supabase
      .from('supplier_invoices_new')
      .select('*, lines:supplier_invoice_lines(*), supplier:supplier_id(supplier_name)')
      .eq('id', id)
      .single();

    setInvoice(data);
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Unable to post invoice.');
  }
}
  async function handleCreditNote() { await apApi.captureInvoice({ entityId: invoice.entity_id, supplierId: invoice.supplier_id, invoiceNumber: `CN-${invoice.invoice_number}`, invoiceDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], description: cnReason, lines: [{ glCode: invoice.lines?.[0]?.gl_code || '', description: cnReason, amount: parseFloat(cnAmount) || 0, vatCode: 'standard' }], source: 'manual', createdBy: 'user' }); setShowCN(false); }

  if (loading) return <div className="text-zinc-500 p-8">Loading...</div>;
  if (!invoice) return <div className="text-zinc-500 p-8">Invoice not found.</div>;

  return (
    <div className="space-y-6">
      <a href="/suppliers/invoices" className="text-xs text-zinc-500 hover:text-white">← Invoices</a>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">{invoice.invoice_number}</h1><span className={`text-[10px] px-2 py-0.5 rounded-full ${invoice.lifecycle_status === 'posted' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{invoice.lifecycle_status || invoice.status}</span></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Details</p><div className="space-y-1 text-xs"><p className="text-zinc-400">Supplier: {invoice.supplier?.supplier_name || '—'}</p><p className="text-zinc-400">Date: {invoice.invoice_date} · Due: {invoice.due_date}</p>{invoice.description && <p className="text-zinc-400">{invoice.description}</p>}</div></div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5"><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Actions</p><div className="space-y-2">{invoice.lifecycle_status !== 'posted' && <button onClick={handlePost} className="w-full rounded-lg bg-white py-2 text-xs font-medium text-black hover:bg-gray-100">Post Invoice</button>}<button onClick={() => setShowCN(true)} className="w-full rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-white hover:border-white/20">Issue Credit Note</button></div></div>
      </div>
      {invoice.lines?.length > 0 && (<div className="rounded-xl border border-white/[0.06] overflow-hidden"><div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"><p className="text-[11px] font-medium text-zinc-500 uppercase">Line Items</p></div><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 px-4 text-[10px] text-zinc-500 uppercase">GL</th><th className="text-left py-2 px-4 text-[10px] text-zinc-500 uppercase">Description</th><th className="text-right py-2 px-4 text-[10px] text-zinc-500 uppercase">Amount</th><th className="text-right py-2 px-4 text-[10px] text-zinc-500 uppercase">VAT</th><th className="text-right py-2 px-4 text-[10px] text-zinc-500 uppercase">Total</th></tr></thead><tbody>{invoice.lines.map((line: any, i: number) => (<tr key={i} className="border-b border-white/[0.03]"><td className="py-2 px-4 text-zinc-400 text-xs">{line.gl_code}</td><td className="py-2 px-4 text-white text-xs">{line.description}</td><td className="py-2 px-4 text-right text-white text-xs">R{line.amount?.toLocaleString()}</td><td className="py-2 px-4 text-right text-zinc-400 text-xs">R{line.vat_amount?.toLocaleString()}</td><td className="py-2 px-4 text-right text-white text-xs">R{line.total?.toLocaleString()}</td></tr>))}</tbody></table></div>)}

      {showCN && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCN(false)} />
          <div className="fixed inset-4 z-50 flex items-center justify-center p-4"><div className="bg-[var(--bg-primary)] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md"><div className="flex justify-between items-center mb-4"><p className="text-sm font-medium text-white">Issue Credit Note</p><button onClick={() => setShowCN(false)} className="text-zinc-500 hover:text-white">✕</button></div><div className="space-y-3"><input value={cnAmount} onChange={(e) => setCnAmount(e.target.value)} placeholder="Amount" type="number" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><input value={cnReason} onChange={(e) => setCnReason(e.target.value)} placeholder="Reason" className="w-full rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-white outline-none" /><button onClick={handleCreditNote} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-gray-100">Issue</button></div></div></div>
        </>
      )}
    </div>
  );
}
