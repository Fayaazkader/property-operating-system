'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Loader2, X, FileText, Plus, CheckCircle, AlertTriangle, Trash2, ChevronDown } from 'lucide-react';
import { findSupplierMatch } from '@/lib/suppliers/matching';
import CreateSupplierForm from './CreateSupplierForm';

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
  tax_code: string;
};

const TAX_CODES = ['VAT 15%', 'VAT Exempt', 'Zero Rated', 'No VAT'];

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
  const [newSupplier, setNewSupplier] = useState({ name: '', vat_number: '', registration_number: '' });
  
  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [poReference, setPoReference] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [supplierAccountId, setSupplierAccountId] = useState('');
const [accountNumber, setAccountNumber] = useState('');
const [accountPropertyId, setAccountPropertyId] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  
  // Validation
  const [validationChecks, setValidationChecks] = useState<{ label: string; passed: boolean }[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('suppliers').select('id, supplier_name').eq('entity_id', entityId).then(({ data }) => setSuppliers(data || []));
    supabase.from('properties').select('id, property_name').eq('entity_id', entityId).then(({ data }) => setProperties(data || []));
    supabase.from('chart_of_accounts').select('id, gl_code, account_name').eq('entity_id', entityId).eq('account_type', 'expense').eq('is_active', true).then(({ data }) => setGlAccounts(data || []));
  }, [entityId]);

  // Auto-validate on line item change
  useEffect(() => {
    const checks = [];
    checks.push({ label: 'Supplier verified', passed: !!selectedSupplierId });
    checks.push({ label: 'Invoice number present', passed: !!invoiceNumber });
    checks.push({ label: 'At least one line item', passed: lineItems.length > 0 });
    
    if (lineItems.length > 0) {
      const allAllocated = lineItems.every(item => item.property_id && item.gl_code);
      checks.push({ label: 'All lines allocated', passed: allAllocated });
      
      const vatValid = lineItems.every(item => {
  const expectedVat = Math.round((item.amount_excl * item.vat_rate / 100) * 100) / 100;
  return Math.abs(expectedVat - item.vat_amount) <= 0.01;
});
checks.push({ label: 'VAT calculation verified', passed: vatValid });
    }
    if (lineItems.length > 0 && result?.extractedFields?.invoice_amount) {
  const ocrTotal = parseFloat(result.extractedFields.invoice_amount);
  const diff = Math.abs(totalIncl - ocrTotal);
  checks.push({ label: 'Invoice total reconciles', passed: diff <= 1 });
}
    
    setValidationChecks(checks);
  }, [supplierMatch, invoiceNumber, lineItems]);

  const addLineItem = (initial?: Partial<LineItem>) => {
    setLineItems(prev => [...prev, {
      id: crypto.randomUUID(),
      property_id: '',
      gl_code: '',
      description: initial?.description || '',
      amount_excl: initial?.amount_excl || 0,
      vat_rate: initial?.vat_rate || 15,
      vat_amount: initial?.vat_amount || 0,
      amount_incl: initial?.amount_incl || 0,
      cost_centre: '',
      tax_code: initial?.tax_code || 'VAT 15%',
      ...initial,
    }]);
  };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      
      if (field === 'amount_excl') {
        // Recalc VAT from ex VAT
        updated.vat_amount = Math.round((updated.amount_excl * updated.vat_rate / 100) * 100) / 100;
        updated.amount_incl = Math.round((updated.amount_excl + updated.vat_amount) * 100) / 100;
      } else if (field === 'vat_amount') {
        // Recalc inc VAT from ex + vat
        updated.amount_incl = Math.round((updated.amount_excl + updated.vat_amount) * 100) / 100;
      } else if (field === 'amount_incl') {
        // Recalc ex and vat from inc
        updated.amount_excl = Math.round((updated.amount_incl / (1 + updated.vat_rate / 100)) * 100) / 100;
        updated.vat_amount = Math.round((updated.amount_incl - updated.amount_excl) * 100) / 100;
      }
      
      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const totalExcl = lineItems.reduce((sum, item) => sum + item.amount_excl, 0);
  const totalVat = lineItems.reduce((sum, item) => sum + item.vat_amount, 0);
  const totalIncl = totalExcl + totalVat;

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

      const fields = data.result.extractedFields || {};
      setInvoiceNumber(fields.invoice_number || '');
      setInvoiceDate(fields.invoice_date || '');
      setDueDate(fields.due_date || '');
      setInvoiceDescription(fields.description || '');

      // Check supplier
      const ocrSupplierName = fields.supplier_name?.replace(/BILL\s+(FROM|TO)\s+/gi, '').trim();
      if (ocrSupplierName) {
        const match = await findSupplierMatch(entityId, ocrSupplierName, supabase);
        if (match) {
          setSelectedSupplierId(match.supplier_id);
          setSupplierMatch(match);
          setState('capture_invoice');
                    const ocrLineItems = (fields.line_items?.value as Array<any>) || [];
          if (ocrLineItems.length > 0) {
            setLineItems(ocrLineItems.map((li: any) => ({
              id: crypto.randomUUID(),
              property_id: '',
              gl_code: '',
              description: li.description || '',
              amount_excl: li.amount || 0,
              vat_rate: 15,
              vat_amount: Math.round((li.amount * 15 / 100) * 100) / 100 || 0,
              amount_incl: (li.amount || 0) + Math.round((li.amount * 15 / 100) * 100) / 100,
              cost_centre: '',
              tax_code: 'VAT 15%',
            })));
          } else {
            setLineItems([{
              id: crypto.randomUUID(),
              property_id: '',
              gl_code: '',
              description: '',
              amount_excl: parseFloat(fields.subtotal) || 0,
              vat_rate: 15,
              vat_amount: parseFloat(fields.vat_amount) || 0,
              amount_incl: parseFloat(fields.invoice_amount) || 0,
              cost_centre: '',
              tax_code: 'VAT 15%',
            }]);
          }
        } else {
          setNewSupplier({ name: ocrSupplierName, vat_number: fields.supplier_vat || '', registration_number: fields.registration_number || '' });
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
          invoiceNumber,
          invoiceDate: invoiceDate || null,
          dueDate: dueDate || null,
          description: invoiceDescription,
          poReference,
          paymentTerms,
          totalAmount: totalIncl,
          vatAmount: totalVat,
          subtotal: totalExcl,
          documentId,
          lineItems,
          extractedFields: result?.extractedFields || {},
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = typeof errData.error === 'string' ? errData.error : errData.message || 'Save failed';
        throw new Error(errMsg);
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

  const allChecksPassed = validationChecks.every(c => c.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="sticky top-0 bg-zinc-950 border-b border-white/[0.06] px-6 py-4 flex justify-between items-center z-10">
          <div>
            <p className="text-sm font-medium text-white">Capture Invoice</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {state === 'capture_invoice' && result ? 'OCR captured · Review accounting allocation' : 'Upload invoice'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* IDLE */}
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

          {/* LOADING */}
          {(state === 'uploading' || state === 'ocr') && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <p className="text-sm text-zinc-300">{state === 'uploading' ? 'Uploading...' : 'Running OCR...'}</p>
            </div>
          )}

          {/* CREATE SUPPLIER */}
          {state === 'create_supplier' && (
            <CreateSupplierForm
              entityId={entityId}
              initialData={newSupplier}
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
            <div className="space-y-8">
              {/* SECTION 01: INVOICE DETAILS */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-3">01 · Invoice Details</p>
                
                {/* Supplier */}
                <div className="mb-4">
                  <p className="text-[11px] text-zinc-500 mb-1">Supplier</p>
                  {supplierMatch ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
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

                {/* Invoice fields grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Invoice Number *</p>
                    <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">PO / Reference</p>
                    <input type="text" value={poReference} onChange={(e) => setPoReference(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Invoice Date</p>
                    <input type="text" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Due Date</p>
                    <input type="text" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                </div>

                {/* Description */}
                <div className="mt-3">
                  <p className="text-[11px] text-zinc-500 mb-1">Description</p>
                  <input type="text" value={invoiceDescription} onChange={(e) => setInvoiceDescription(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>

              {/* SECTION 02: ACCOUNTING ALLOCATION */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium">02 · Accounting Allocation</p>
                  <button onClick={() => addLineItem()} className="flex items-center gap-1 text-xs text-white hover:text-zinc-300">
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>

                {lineItems.length === 0 ? (
                  <button onClick={() => addLineItem({
                    description: invoiceDescription,
                    amount_excl: parseFloat(result?.extractedFields?.subtotal) || 0,
                    vat_amount: parseFloat(result?.extractedFields?.vat_amount) || 0,
                    amount_incl: parseFloat(result?.extractedFields?.invoice_amount) || 0,
                  })}
                  className="w-full rounded-lg border border-dashed border-white/[0.1] py-6 text-center text-sm text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition-all">
                    Add first line item — pre-filled from OCR
                  </button>
                ) : (
                  <div className="space-y-3">
                    {lineItems.map(item => (
                      <div key={item.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div>
                            <p className="text-[10px] text-zinc-600 mb-1">Property</p>
                            <select value={item.property_id} onChange={(e) => updateLineItem(item.id, 'property_id', e.target.value)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none">
                              <option value="">Select</option>
                              {properties.map(p => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 mb-1">GL Account</p>
                            <select value={item.gl_code} onChange={(e) => updateLineItem(item.id, 'gl_code', e.target.value)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none">
                              <option value="">Select</option>
                              {glAccounts.map(acc => <option key={acc.id} value={acc.gl_code}>{acc.gl_code} — {acc.account_name}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 mb-1">Tax Code</p>
                            <select value={item.tax_code} onChange={(e) => updateLineItem(item.id, 'tax_code', e.target.value)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none">
                              {TAX_CODES.map(tc => <option key={tc} value={tc}>{tc}</option>)}
                            </select>
                          </div>
                        </div>
                                                <div className="mb-2">
                          <p className="text-[10px] text-zinc-600 mb-1">Description / Remarks</p>
                          <input type="text" value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" placeholder="What is this expense for?" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div>
                            <p className="text-[10px] text-zinc-600 mb-1">Ex VAT</p>
                            <input type="number" value={item.amount_excl || ''} onChange={(e) => updateLineItem(item.id, 'amount_excl', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" />
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 mb-1">VAT</p>
                            <input type="number" value={item.vat_amount || ''} onChange={(e) => updateLineItem(item.id, 'vat_amount', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" />
                          </div>
                                                    <div>
                            <p className="text-[10px] text-zinc-600 mb-1">Inc VAT</p>
                            <input type="number" value={item.amount_incl || ''} 
                              onChange={(e) => updateLineItem(item.id, 'amount_incl', parseFloat(e.target.value) || 0)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none" />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => removeLineItem(item.id)} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.01] p-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Subtotal</span>
                    <span className="text-white">R{totalExcl.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">VAT</span>
                    <span className="text-white">R{totalVat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium border-t border-white/[0.06] pt-2">
                    <span className="text-white">Total</span>
                    <span className="text-white">R{totalIncl.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 03: VALIDATION */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-medium mb-3">03 · Validation</p>
                <div className="space-y-1">
                  {validationChecks.map(check => (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                      {check.passed ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className={check.passed ? 'text-zinc-400' : 'text-amber-400'}>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTIONS */}
                            <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
                <button onClick={() => { /* Save draft logic */ }} disabled={!selectedSupplierId || !invoiceNumber}
                  className="rounded-full border border-white/[0.08] px-5 py-3 text-sm text-white hover:border-white/20 disabled:opacity-40">
                  Save Draft
                </button>
                <button onClick={handleSave} disabled={!allChecksPassed || !selectedSupplierId}
                  className="flex-1 rounded-full bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  Submit Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
