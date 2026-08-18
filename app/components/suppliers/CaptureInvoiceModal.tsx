'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Loader2, X, FileText, Plus, AlertTriangle, Link as LinkIcon, Trash2 } from 'lucide-react';
import CreateSupplierForm from './CreateSupplierForm';
import { findSupplierMatch } from '@/lib/suppliers/matching';

interface Props {
  entityId: string;
  onClose: () => void;
  onCaptured: () => void;
}

type ProcessingState = 'idle' | 'uploading' | 'ocr' | 'create_supplier' | 'capture_invoice' | 'saving';
type LineItem = {
  id: string;
  property_id: string;
  gl_code: string;
  description: string;
  amount_excl: number;
  vat_rate: number;
  vat_amount: number;
  amount_incl: number;
  cost_centre: string;
};

export default function CaptureInvoiceModal({ entityId, onClose, onCaptured }: Props) {
  const [state, setState] = useState<ProcessingState>('idle');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierMatch, setSupplierMatch] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Supplier creation
  const [newSupplier, setNewSupplier] = useState({
    name: '', vat_number: '', registration_number: '', email: '', phone: '',
  });
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  
  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [invoiceSubtotal, setInvoiceSubtotal] = useState(0);
  const [invoiceVat, setInvoiceVat] = useState(0);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  
  // Account
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountPropertyId, setAccountPropertyId] = useState('');
  const [showAccountLink, setShowAccountLink] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('suppliers').select('id, supplier_name').eq('entity_id', entityId).then(({ data }) => setSuppliers(data || []));
    supabase.from('properties').select('id, property_name').eq('entity_id', entityId).then(({ data }) => setProperties(data || []));
    supabase.from('chart_of_accounts').select('id, gl_code, account_name').eq('entity_id', entityId).eq('account_type', 'expense').eq('is_active', true).then(({ data }) => setGlAccounts(data || []));
  }, [entityId]);

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: crypto.randomUUID(),
      property_id: '',
      gl_code: '',
      description: '',
      amount_excl: 0,
      vat_rate: 15,
      vat_amount: 0,
      amount_incl: 0,
      cost_centre: '',
    }]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Recalculate VAT and total
      if (field === 'amount_excl' || field === 'vat_rate') {
        updated.vat_amount = Math.round((updated.amount_excl * updated.vat_rate / 100) * 100) / 100;
        updated.amount_incl = Math.round((updated.amount_excl + updated.vat_amount) * 100) / 100;
      }
      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const recalculateTotals = () => {
  if (lineItems.length === 0) {
    // Keep OCR totals if no line items
    return;
  }
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount_excl, 0);
  const vat = lineItems.reduce((sum, item) => sum + item.vat_amount, 0);
  setInvoiceSubtotal(subtotal);
  setInvoiceVat(vat);
  setInvoiceTotal(subtotal + vat);
};

  useEffect(() => {
    recalculateTotals();
  }, [lineItems]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setState('uploading');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type || 'application/pdf');
      formData.append('entityId', entityId);

      setState('ocr');

      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('OCR failed');

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'OCR failed');

      setResult(data.result);
      setDocumentId(data.documentId);

      // Pre-fill invoice fields from OCR
      const fields = data.result.extractedFields || {};
      setInvoiceNumber(fields.invoice_number || '');
      setInvoiceDate(fields.invoice_date || '');
      setDueDate(fields.due_date || '');
      setInvoiceDescription(fields.description || '');
            setInvoiceSubtotal(parseFloat(fields.subtotal) || 0);
      setInvoiceVat(parseFloat(fields.vat_amount) || 0);
      setInvoiceTotal(parseFloat(fields.invoice_amount) || 0);
            // Auto-create one line item from OCR totals
      setLineItems([{
        id: crypto.randomUUID(),
        property_id: '',
        gl_code: '',
        description: fields.description || 'Invoice total',
        amount_excl: parseFloat(fields.subtotal) || 0,
        vat_rate: 15,
        vat_amount: parseFloat(fields.vat_amount) || 0,
        amount_incl: parseFloat(fields.invoice_amount) || 0,
        cost_centre: '',
      }]);

      // Check supplier
      const ocrSupplierName = fields.supplier_name;
      if (ocrSupplierName) {
        const match = await findSupplierMatch(entityId, ocrSupplierName, supabase);
        if (match) {
          setSelectedSupplierId(match.supplier_id);
          setSupplierMatch(match);
          setState('capture_invoice');
        } else {
         setNewSupplier(prev => ({ ...prev, name: ocrSupplierName.replace(/BILL\s+(FROM|TO)\s+/gi, '').trim(), vat_number: fields.supplier_vat || '', registration_number: fields.registration_number || '' }));
          setState('create_supplier');
        }
      } else {
        setState('capture_invoice');
      }
    } catch (err: any) {
      setError(err.message);
      setState('idle');
    }
  };

  const handleCreateSupplier = async () => {
    setCreatingSupplier(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const response = await fetch('/api/property/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(newSupplier),
      });

      if (!response.ok) throw new Error('Failed to create supplier');

      const data = await response.json();
      if (data.data) {
        setSuppliers(prev => [...prev, data.data]);
        setSelectedSupplierId(data.data.id);
        setSupplierMatch({ supplier_id: data.data.id, supplier_name: data.data.name, confidence: 100 });
        setState('capture_invoice');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setCreatingSupplier(false);
  };

  const handleSave = async () => {
    setState('saving');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const response = await fetch('/api/suppliers/invoices/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          entityId,
          supplierId: selectedSupplierId,
          supplierAccountId: selectedAccountId || null,
          invoiceNumber,
          invoiceDate: invoiceDate || null,
          dueDate: dueDate || null,
          description: invoiceDescription,
          totalAmount: invoiceTotal,
          vatAmount: invoiceVat,
          subtotal: invoiceSubtotal,
          documentId,
          lineItems,
          extractedFields: result?.extractedFields || {},
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
      setState('capture_invoice');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm font-medium text-white">Capture Invoice</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {state === 'idle' && 'Upload invoice — OCR extracts fields'}
              {state === 'uploading' && 'Uploading document...'}
              {state === 'ocr' && 'Reading document...'}
              {state === 'create_supplier' && 'Create supplier'}
              {state === 'capture_invoice' && 'Capture invoice details'}
              {state === 'saving' && 'Saving...'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {state === 'idle' && (
          <div>
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-white/[0.1] p-10 text-center hover:border-white/20 transition-all cursor-pointer">
              <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-300">Click to select invoice PDF or image</p>
              <p className="text-xs text-zinc-600 mt-1">PDF, PNG, JPG — max 10MB</p>
            </button>
          </div>
        )}

        {(state === 'uploading' || state === 'ocr') && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <div>
              <p className="text-sm text-zinc-300">{state === 'uploading' ? 'Uploading...' : 'Running OCR...'}</p>
              {selectedFile && <p className="text-xs text-zinc-500 mt-0.5">{selectedFile.name}</p>}
            </div>
          </div>
        )}

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mt-3"><p className="text-sm text-red-400">{error}</p></div>}

                {/* CREATE SUPPLIER */}
        {state === 'create_supplier' && (
          <CreateSupplierForm
            entityId={entityId}
            initialData={{
              name: newSupplier.name,
              vat_number: newSupplier.vat_number,
              registration_number: newSupplier.registration_number,
            }}
            onCreated={(supplier) => {
              setSuppliers(prev => [...prev, supplier]);
              setSelectedSupplierId(supplier.id);
              setSupplierMatch({ supplier_id: supplier.id, supplier_name: supplier.name, confidence: 100 });
              setState('capture_invoice');
            }}
            onCancel={() => setState('idle')}
          />
        )}

        {/* CAPTURE INVOICE */}
        {state === 'capture_invoice' && (
          <div className="space-y-6">
            {/* Supplier */}
            <div>
              <p className="text-[10px] text-zinc-600 mb-1">Supplier</p>
              {supplierMatch ? (
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                  <p className="text-sm text-white">{supplierMatch.supplier_name}</p>
                </div>
              ) : (
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                </select>
              )}
            </div>

            {/* Account link */}
            <div className="flex items-center gap-3">
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Account number (optional)" />
              <select value={accountPropertyId} onChange={(e) => setAccountPropertyId(e.target.value)}
                className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
                <option value="">Link to property</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.property_name}</option>)}
              </select>
            </div>

            {/* Invoice fields */}
            <div className="grid grid-cols-3 gap-3">
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Invoice number *" />
              <input type="text" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Invoice date" />
              <input type="text" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Due date" />
            </div>
            <input type="text" value={invoiceDescription} onChange={(e) => setInvoiceDescription(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" placeholder="Description" />

            {/* Line items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Line Items</p>
                <button onClick={addLineItem} className="flex items-center gap-1 text-xs text-white hover:text-zinc-300">
                  <Plus className="w-3 h-3" /> Add Line
                </button>
              </div>
              
              {lineItems.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No line items — add line items or save with total only</p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map(item => (
                    <div key={item.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <select value={item.gl_code} onChange={(e) => updateLineItem(item.id, 'gl_code', e.target.value)}
                          className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none">
                          <option value="">GL Code</option>
                          {glAccounts.map(acc => <option key={acc.id} value={acc.gl_code}>{acc.gl_code} — {acc.account_name}</option>)}
                        </select>
                        <select value={item.property_id} onChange={(e) => updateLineItem(item.id, 'property_id', e.target.value)}
                          className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none">
                          <option value="">Property</option>
                          {properties.map(p => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                        </select>
                        <input type="number" value={item.amount_excl || ''} onChange={(e) => updateLineItem(item.id, 'amount_excl', parseFloat(e.target.value) || 0)}
                          className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" placeholder="Ex VAT" />
                        <input type="number" value={item.vat_rate || 15} onChange={(e) => updateLineItem(item.id, 'vat_rate', parseFloat(e.target.value) || 0)}
                          className="rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" placeholder="VAT %" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          className="col-span-2 rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" placeholder="Description" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Incl: R{item.amount_incl.toFixed(2)}</span>
                          <button onClick={() => removeLineItem(item.id)} className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Subtotal</span>
                <span className="text-white">R{invoiceSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">VAT</span>
                <span className="text-white">R{invoiceVat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t border-white/[0.06] pt-2">
                <span className="text-white">Total</span>
                <span className="text-white">R{invoiceTotal.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleSave} disabled={!selectedSupplierId || !invoiceNumber || invoiceTotal <= 0}
              className="w-full rounded-full bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Save Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
