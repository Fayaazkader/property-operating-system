'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, X } from 'lucide-react';

export default function DocumentIntelligencePage() {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError('');
    setResult(null);
    setReviewStatus(null);
    setEditedFields({});

    try {
      // Upload to Supabase Storage
      const filePath = `documents/intake/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      // Get session for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      // Call server API
      setProcessing(true);
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fileUrl: urlData.publicUrl,
          fileName: file.name,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Processing failed');

            setResult({
        ...data.result,
        documentId: data.documentId,
      });
      setProcessing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to process document');
      setProcessing(false);
    }
    setUploading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

    const handleApprove = async () => {
    const missing = result?.extractedFields?.missingFields || [];
        const unfilled = missing.filter((field: string) => {
      const value = editedFields[field];
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (unfilled.length > 0) {
      setError(`Please fill missing fields: ${unfilled.join(', ').replace(/_/g, ' ')}`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const response = await fetch('/api/documents/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentId: result.documentId,
          status: 'approved',
          extractedFields: displayFields,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Review failed');
      }

      setReviewStatus('approved');
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const response = await fetch('/api/documents/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentId: result.documentId,
          status: 'rejected',
          reason: 'Rejected by user',
          extractedFields: displayFields,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Review failed');
      }

      setReviewStatus('rejected');
    } catch (err: any) {
      setError(err.message || 'Failed to reject');
    }
  };

  const handleFieldEdit = (key: string, value: any) => {
    setEditedFields(prev => ({ ...prev, [key]: value }));
  };

  const displayFields = result
    ? { ...result.extractedFields, ...editedFields }
    : null;

  return (
    <div className="mx-auto max-w-4xl px-8 pt-12 pb-24">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Document Intelligence</p>
        <h1 className="text-3xl font-light tracking-[-0.02em] text-white mt-1">Upload & Extract</h1>
        <p className="text-sm text-zinc-500 mt-2">OCR automatically extracts invoice, lease, and document fields.</p>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.01] p-12 text-center"
      >
        <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-400">Drag & drop a document here</p>
        <p className="text-xs text-zinc-600 mt-1">PDF, PNG, JPG — invoices, leases, statements</p>
        
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          id="doc-upload"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <label
          htmlFor="doc-upload"
          className="inline-block mt-4 rounded-full bg-white px-6 py-2.5 text-xs font-medium text-black hover:bg-gray-100 transition-all cursor-pointer"
        >
          Browse Files
        </label>
      </div>

      {/* Processing */}
      {(uploading || processing) && (
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          <p className="text-sm text-zinc-300">
            {uploading ? 'Uploading...' : 'Running OCR & extracting fields...'}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-center gap-3">
          <X className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !processing && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-white capitalize">
                  {result.documentType.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-zinc-500">{result.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.extractedFields.requiresHumanReview ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] text-amber-400">
                  <AlertTriangle className="w-3 h-3" /> Review Required
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> Auto-Processed
                </span>
              )}
            </div>
          </div>

          {/* Extracted Fields — editable */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Extracted Fields</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(displayFields || {})
                .filter(([key]) => !['confidence', 'requiresHumanReview', 'missingFields'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600">{key.replace(/_/g, ' ')}</p>
                    {result.extractedFields.requiresHumanReview ? (
                      <input
                        type="text"
                        value={String(value || '')}
                        onChange={(e) => handleFieldEdit(key, e.target.value)}
                        className="w-full bg-transparent text-sm text-white mt-1 outline-none border-b border-white/[0.06] focus:border-white/20"
                      />
                    ) : (
                      <p className="text-sm text-white mt-1">{String(value || '—')}</p>
                    )}
                  </div>
                ))}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mb-1">Confidence</p>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${result.extractedFields.confidence >= 80 ? 'bg-emerald-400' : result.extractedFields.confidence >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${result.extractedFields.confidence}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-white font-medium">{result.extractedFields.confidence}%</span>
            </div>

            {result.extractedFields.missingFields?.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-500/5 border border-amber-500/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-amber-400 mb-2">Missing Fields</p>
                <div className="flex gap-2 flex-wrap">
                  {result.extractedFields.missingFields.map((field: string) => (
                    <span key={field} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                      {field.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Approve / Reject */}
                        {result.extractedFields.requiresHumanReview && reviewStatus === null && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleApprove}
                  className={`flex-1 rounded-full px-4 py-2.5 text-xs font-medium transition-all ${
                    result.extractedFields.missingFields?.some((f: string) => !editedFields[f])
                      ? 'bg-white/10 text-zinc-500 cursor-not-allowed'
                      : 'bg-emerald-500 text-black hover:bg-emerald-400'
                  }`}
                >
                  Approve{result.extractedFields.missingFields?.some((f: string) => !editedFields[f]) ? ' (Fill Missing Fields)' : ''}
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 rounded-full border border-red-500/30 px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all"
                >
                  Reject
                </button>
              </div>
            )}

            {reviewStatus === 'approved' && (
              <div className="mt-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center">
                <p className="text-sm text-emerald-400">Document approved and recorded.</p>
              </div>
            )}

            {reviewStatus === 'rejected' && (
              <div className="mt-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-center">
                <p className="text-sm text-red-400">Document rejected.</p>
              </div>
            )}

            {reviewStatus === 'approved' && (
              <div className="mt-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center">
                <p className="text-sm text-emerald-400">Document approved. Workflow will continue.</p>
              </div>
            )}

            {reviewStatus === 'rejected' && (
              <div className="mt-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-center">
                <p className="text-sm text-red-400">Document rejected.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
