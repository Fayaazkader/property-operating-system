'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Loader2, X } from 'lucide-react';
import { findSupplierMatch } from '@/lib/suppliers/matching';

interface Props {
  entityId: string;
  onClose: () => void;
  onCaptured: () => void;
}

type ProcessingState = 'idle' | 'uploading' | 'ocr' | 'review' | 'saving';

export default function CaptureInvoiceModal({ entityId, onClose, onCaptured }: Props) {
  const [state, setState] = useState<ProcessingState>('idle');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [supplierMatch, setSupplierMatch] = useState<any>(null);

  useEffect(() => {
    supabase.from('suppliers').select('id, supplier_name').eq('entity_id', entityId).then(({ data }) => {
      setSuppliers(data || []);
    });
  }, [entityId]);

  const handleFile = async (file: File) => {
    setState('uploading');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);
      formData.append('entityId', entityId);

      setState('ocr');

      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Processing failed');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'OCR failed');

      setResult(data.result);
            // Try supplier matching
      const ocrSupplierName = data.result.extractedFields.supplier_name;
      if (ocrSupplierName) {
        const match = await findSupplierMatch(entityId, ocrSupplierName, supabase);
        if (match) {
          setSelectedSupplierId(match.supplier_id);
          setSupplierMatch(match);
        }
      }
      setDocumentId(data.documentId);
      setState('review');
    } catch (err: any) {
      setError(err.message);
      setState('idle');
    }
  };
  

  const handleSave = async () => {
    setState('saving');
    setError('');

    const fields = { ...result.extractedFields, ...editedFields };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const response = await fetch('/api/suppliers/invoices/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          entityId,
          supplierId: selectedSupplierId,
          invoiceNumber: fields.invoice_number,
          invoiceDate: fields.invoice_date || null,
          dueDate: fields.due_date || null,
          totalAmount: parseFloat(fields.invoice_amount) || 0,
          vatAmount: parseFloat(fields.vat_amount) || 0,
          subtotal: parseFloat(fields.subtotal) || 0,
          documentId,
          extractedFields: fields,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Save failed');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Save failed');

      onCaptured();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setState('review');
    }
  };

  const displayFields = result ? { ...result.extractedFields, ...editedFields } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm font-medium text-white">Capture Invoice</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {state === 'idle' && 'Upload invoice — OCR extracts fields'}
              {state === 'uploading' && 'Uploading document...'}
              {state === 'ocr' && 'Reading document...'}
              {state === 'review' && 'Review extracted fields'}
              {state === 'saving' && 'Saving invoice...'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

                {state === 'idle' && (
          <div 
            className="rounded-xl border-2 border-dashed border-white/[0.08] p-10 text-center cursor-pointer"
            onClick={() => document.getElementById('invoice-upload')?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-6 h-6 text-zinc-600 mx-auto mb-2 pointer-events-none" />
            <p className="text-xs text-zinc-500 pointer-events-none">Drop invoice PDF or image here</p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              id="invoice-upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <span className="inline-block mt-3 rounded-full bg-white px-5 py-2 text-xs font-medium text-black hover:bg-gray-100 cursor-pointer pointer-events-none">
              Browse
            </span>
          </div>
        )}

        {(state === 'uploading' || state === 'ocr') && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <p className="text-sm text-zinc-300">{state === 'uploading' ? 'Uploading...' : 'Running OCR & extracting...'}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mt-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {state === 'review' && displayFields && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-3">
                {result.documentType.replace(/_/g, ' ')} · Confidence {result.extractedFields.confidence}%
              </p>

                            <div className="mb-3">
                <p className="text-[10px] text-zinc-600 mb-1">Supplier</p>
                {supplierMatch ? (
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                    <p className="text-sm text-white">{supplierMatch.supplier_name}</p>
                    <p className="text-[10px] text-emerald-400">{supplierMatch.confidence}% match</p>
                  </div>
                ) : (
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplier_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {Object.entries(displayFields)
                .filter(([key]) => !['confidence', 'requiresHumanReview', 'missingFields'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="mb-2">
                    <p className="text-[10px] text-zinc-600 mb-1">{key.replace(/_/g, ' ')}</p>
                    <input
                      type="text"
                      value={String(value || '')}
                      onChange={(e) => setEditedFields(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                    />
                  </div>
                ))}
            </div>

            <button
              onClick={handleSave}
              disabled={!selectedSupplierId || !displayFields.invoice_number || !displayFields.invoice_amount}
              className="w-full rounded-full bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Save Invoice
            </button>
          </div>
        )}

        {state === 'saving' && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <p className="text-sm text-zinc-300">Saving supplier invoice...</p>
          </div>
        )}
      </div>
    </div>
  );
}
