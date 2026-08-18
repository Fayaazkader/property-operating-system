'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Loader2, X, FileText, Plus, AlertTriangle, CheckCircle, Link as LinkIcon } from 'lucide-react';
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
  const [properties, setProperties] = useState<any[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [documentId, setDocumentId] = useState('');
  const [error, setError] = useState('');
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierMatch, setSupplierMatch] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [activeWarning, setActiveWarning] = useState<'duplicate' | 'calculation' | null>(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [overrideCalculation, setOverrideCalculation] = useState(false);
  
  // Account state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountPropertyId, setNewAccountPropertyId] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountMatch, setAccountMatch] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('suppliers').select('id, supplier_name').eq('entity_id', entityId).then(({ data }) => {
      setSuppliers(data || []);
    });
    supabase.from('properties').select('id, property_name').eq('entity_id', entityId).then(({ data }) => {
      setProperties(data || []);
    });
  }, [entityId]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setState('uploading');
    setError('');
    setActiveWarning(null);
    setOverrideDuplicate(false);
    setOverrideCalculation(false);
    setSelectedAccountId('');
    setAccountMatch(null);
    setShowCreateAccount(false);

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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Processing failed');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'OCR failed');

      setResult(data.result);
      setDocumentId(data.documentId);

      const fields = data.result.extractedFields || {};

      // Duplicate pre-check
      if (fields.invoice_number) {
        const { data: existing } = await supabase
          .from('supplier_invoices_new')
          .select('id, invoice_number, total_amount')
          .eq('entity_id', entityId)
          .eq('invoice_number', fields.invoice_number)
          .maybeSingle();
        if (existing) {
          setActiveWarning('duplicate');
          setWarningMessage(`Invoice ${fields.invoice_number} already exists for R${existing.total_amount?.toLocaleString()}`);
        }
      }

      // Calculation check
      if (fields.subtotal && fields.vat_amount && fields.invoice_amount) {
        const subtotal = parseFloat(fields.subtotal);
        const vat = parseFloat(fields.vat_amount);
        const total = parseFloat(fields.invoice_amount);
        if (Math.abs((subtotal + vat) - total) > 1) {
          setActiveWarning('calculation');
          setWarningMessage(`Subtotal R${subtotal.toLocaleString()} + VAT R${vat.toLocaleString()} = R${(subtotal + vat).toLocaleString()}, but total is R${total.toLocaleString()}`);
        }
      }

      // Supplier matching
      const ocrSupplierName = fields.supplier_name;
      if (ocrSupplierName) {
        const match = await findSupplierMatch(entityId, ocrSupplierName, supabase);
        if (match) {
          setSelectedSupplierId(match.supplier_id);
          setSupplierMatch(match);

          // Load supplier accounts
          const { data: accounts } = await supabase
            .from('supplier_accounts')
            .select('id, account_number, property_id')
            .eq('supplier_id', match.supplier_id)
            .eq('is_active', true);
          setSupplierAccounts(accounts || []);

          // Check account number match
          const ocrAccountNumber = fields.account_number;
          if (ocrAccountNumber && accounts?.length) {
            const matchedAccount = accounts.find(a => a.account_number === ocrAccountNumber);
            if (matchedAccount) {
              setSelectedAccountId(matchedAccount.id);
              setAccountMatch(matchedAccount);
            } else {
              // Account number found but no match — prompt to create
              setNewAccountNumber(ocrAccountNumber);
              setShowCreateAccount(true);
            }
          } else if (ocrAccountNumber) {
            // Supplier matched but no accounts exist
            setNewAccountNumber(ocrAccountNumber);
            setShowCreateAccount(true);
          }
        } else {
          setNewSupplierName(ocrSupplierName);
          setShowCreateSupplier(true);
        }
      }

      setState('review');
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
        body: JSON.stringify({ name: newSupplierName }),
      });

      if (!response.ok) throw new Error('Failed to create supplier');

      const data = await response.json();
      if (data.data) {
        setSuppliers(prev => [...prev, data.data]);
        setSelectedSupplierId(data.data.id);
        setSupplierMatch({ supplier_id: data.data.id, supplier_name: data.data.name, confidence: 100 });
        setShowCreateSupplier(false);

        // Check if account number needs creating too
        const ocrAccountNumber = result?.extractedFields?.account_number;
        if (ocrAccountNumber) {
          setNewAccountNumber(ocrAccountNumber);
          setShowCreateAccount(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
    setCreatingSupplier(false);
  };

  const handleCreateAccount = async () => {
    setCreatingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const { data } = await supabase
        .from('supplier_accounts')
        .insert({
          supplier_id: selectedSupplierId,
          entity_id: entityId,
          property_id: newAccountPropertyId || null,
          account_number: newAccountNumber,
          account_type: 'general',
        })
        .select('*')
        .single();

      if (data) {
        setSupplierAccounts(prev => [...prev, data]);
        setSelectedAccountId(data.id);
        setAccountMatch(data);
        setShowCreateAccount(false);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setCreatingAccount(false);
  };

  const handleSave = async () => {
    setState('saving');
    setError('');

    const fields = { ...(result?.extractedFields || {}), ...editedFields };

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
          invoiceNumber: fields.invoice_number,
          invoiceDate: fields.invoice_date || null,
          dueDate: fields.due_date || null,
          totalAmount: parseFloat(fields.invoice_amount) || 0,
          vatAmount: parseFloat(fields.vat_amount) || 0,
          subtotal: parseFloat(fields.subtotal) || 0,
          documentId,
          extractedFields: fields,
          overrideDuplicate,
          overrideCalculation,
        }),
      });

      if (response.status === 409) {
        const errData = await response.json();
        setActiveWarning('duplicate');
        setWarningMessage(errData.message || 'Duplicate invoice detected');
        setState('review');
        return;
      }

      if (response.status === 422) {
        const errData = await response.json();
        setActiveWarning('calculation');
        setWarningMessage(errData.message || 'Calculation mismatch');
        setState('review');
        return;
      }

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
  const canSave = selectedSupplierId && displayFields?.invoice_number && displayFields?.invoice_amount;

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
              {selectedFile && <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><FileText className="w-3 h-3" /> {selectedFile.name}</p>}
            </div>
          </div>
        )}

        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mt-3"><p className="text-sm text-red-400">{error}</p></div>}

        {activeWarning === 'duplicate' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-medium text-amber-400">Duplicate Invoice Detected</p>
            </div>
            <p className="text-sm text-amber-300">{warningMessage}</p>
            <div className="mt-3 space-y-2">
              <button onClick={() => { setOverrideDuplicate(true); setActiveWarning(null); }}
                className="w-full rounded-lg bg-amber-500/20 border border-amber-500/30 py-2 text-xs text-amber-400 hover:bg-amber-500/30">
                Continue Anyway — This is a different invoice
              </button>
              <button onClick={onClose} className="w-full rounded-lg border border-white/[0.08] py-2 text-xs text-white hover:border-white/20">Cancel</button>
            </div>
          </div>
        )}

        {activeWarning === 'calculation' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-sm font-medium text-red-400">Calculation Mismatch</p>
            </div>
            <p className="text-sm text-red-300">{warningMessage}</p>
            <div className="mt-3">
              <button onClick={() => { setOverrideCalculation(true); setActiveWarning(null); }}
                className="w-full rounded-lg bg-red-500/20 border border-red-500/30 py-2 text-xs text-red-400 hover:bg-red-500/30">
                I&apos;ve Verified — Continue Anyway
              </button>
            </div>
          </div>
        )}

        {state === 'review' && displayFields && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-3">
                {result.documentType.replace(/_/g, ' ')} · Confidence {displayFields.confidence || 0}%
              </p>

              {/* Supplier */}
              <div className="mb-3">
                <p className="text-[10px] text-zinc-600 mb-1">Supplier</p>
                {supplierMatch ? (
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                    <p className="text-sm text-white">{supplierMatch.supplier_name}</p>
                    <p className="text-[10px] text-emerald-400">{supplierMatch.confidence}% match</p>
                  </div>
                ) : showCreateSupplier ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-400 mb-2">Supplier not found — create new supplier</p>
                    <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none mb-2" placeholder="Supplier name" />
                    <button onClick={handleCreateSupplier} disabled={creatingSupplier || !newSupplierName}
                      className="w-full rounded-lg bg-amber-500/20 border border-amber-500/20 py-2 text-xs text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> {creatingSupplier ? 'Creating...' : 'Create Supplier'}
                    </button>
                  </div>
                ) : (
                  <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
                    <option value="">Select supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                  </select>
                )}
              </div>

              {/* Account */}
              {supplierMatch && (displayFields.account_number || supplierAccounts.length > 0) && (
                <div className="mb-3">
                  <p className="text-[10px] text-zinc-600 mb-1">Account</p>
                  {accountMatch ? (
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                      <p className="text-sm text-white">{accountMatch.account_number}</p>
                      <p className="text-[10px] text-emerald-400">Account matched</p>
                    </div>
                  ) : showCreateAccount ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs text-amber-400 mb-2">Account not found — link to property</p>
                      <input type="text" value={newAccountNumber} onChange={(e) => setNewAccountNumber(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none mb-2" placeholder="Account number" />
                      <select value={newAccountPropertyId} onChange={(e) => setNewAccountPropertyId(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none mb-2">
                        <option value="">Link to property (optional)</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                      </select>
                      <button onClick={handleCreateAccount} disabled={creatingAccount || !newAccountNumber}
                        className="w-full rounded-lg bg-amber-500/20 border border-amber-500/20 py-2 text-xs text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 flex items-center justify-center gap-1">
                        <LinkIcon className="w-3 h-3" /> {creatingAccount ? 'Linking...' : 'Link Account'}
                      </button>
                    </div>
                  ) : (
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none">
                      <option value="">Select account</option>
                      {supplierAccounts.map(a => <option key={a.id} value={a.id}>{a.account_number}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Editable fields */}
              {Object.entries(displayFields)
                .filter(([key]) => !['confidence', 'requiresHumanReview', 'missingFields', 'supplier_name', 'account_number'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="mb-2">
                    <p className="text-[10px] text-zinc-600 mb-1">{key.replace(/_/g, ' ')}</p>
                    <input type="text" value={String(value || '')}
                      onChange={(e) => setEditedFields(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                  </div>
                ))}
            </div>

            <button onClick={handleSave} disabled={!canSave || (activeWarning !== null && !overrideDuplicate && !overrideCalculation)}
              className="w-full rounded-full bg-white py-3 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Save Invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
