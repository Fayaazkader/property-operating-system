'use client';
import { useState } from 'react';
import { revenueApi } from '@/lib/revenue/api';

interface InvoiceLine { id?: string; description: string; amount: number; }
interface Props { entityId: string; tenantId: string; tenantName: string; invoiceId?: string; invoiceNumber?: string; invoiceLines?: InvoiceLine[]; onClose: () => void; onIssued: () => void; }

export default function CreditNoteModal({ entityId, tenantId, tenantName, invoiceId, invoiceNumber, invoiceLines, onClose, onIssued }: Props) {
  const [mode, setMode] = useState<'invoice' | 'manual' | 'ocr'>('invoice');
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const totalSelected = mode === 'manual' ? parseFloat(manualAmount) || 0 : invoiceLines?.filter((_, i) => selectedLines.has(i)).reduce((s, l) => s + l.amount, 0) || 0;

  async function handleIssue() {
    if (totalSelected <= 0) return;
    setLoading(true);
    try {
      const lineItems = mode === 'invoice'
        ? invoiceLines?.filter((_, i) => selectedLines.has(i)).map(l => ({ invoice_line_id: l.id, description: l.description, credited_amount: l.amount, reason })) || []
        : [{ description: manualDesc, credited_amount: parseFloat(manualAmount), reason }];
      await revenueApi.issueCreditNote({ entityId, tenantId, invoiceId, invoiceNumber, lineItems, totalAmount: totalSelected, reason });
      onIssued();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function toggleLine(index: number) { const next = new Set(selectedLines); next.has(index) ? next.delete(index) : next.add(index); setSelectedLines(next); }

  return (<>
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="fixed inset-4 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div><p className="text-sm font-medium text-white">Issue Credit Note</p><p className="text-xs text-zinc-500">{tenantName}{invoiceNumber ? ` · ${invoiceNumber}` : ''}</p></div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <div className="flex gap-2 mb-4">
          {(['invoice', 'manual', 'ocr'] as const).map(m => (<button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg text-xs capitalize ${mode === m ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{m === 'ocr' ? 'OCR / Scan' : m}</button>))}
        </div>
        {mode === 'invoice' && invoiceLines && (<div className="space-y-2 mb-4">
          <p className="text-xs text-zinc-500">Select line items to credit from this invoice</p>
          {invoiceLines.map((line, i) => (<label key={i} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${selectedLines.has(i) ? 'border-red-500/30 bg-red-500/5' : 'border-white/[0.06] bg-white/[0.01]'}`}>
            <div className="flex items-center gap-3"><input type="checkbox" checked={selectedLines.has(i)} onChange={() => toggleLine(i)} className="rounded" /><span className="text-sm text-zinc-300">{line.description}</span></div>
            <span className="text-sm text-white tabular-nums">R{line.amount.toLocaleString()}</span>
          </label>))}
        </div>)}
        {mode === 'manual' && (<div className="space-y-3 mb-4">
          <input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
          <input value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="Amount" type="number" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
        </div>)}
        {mode === 'ocr' && (<div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center mb-4"><p className="text-sm text-zinc-500">Upload credit note document</p><p className="text-xs text-zinc-600 mt-1">OCR will extract details automatically (coming soon)</p></div>)}
        <div className="mb-4"><label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Overcharged, Lease adjustment" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" /></div>
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div><span className="text-xs text-zinc-500">Total Credit: </span><span className="text-sm text-red-400 font-medium tabular-nums">R{totalSelected.toLocaleString()}</span></div>
          <button onClick={handleIssue} disabled={totalSelected <= 0 || loading} className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-40">{loading ? 'Issuing...' : 'Issue Credit Note'}</button>
        </div>
      </div>
    </div>
  </>);
}
