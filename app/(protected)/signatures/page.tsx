'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { signingEngine } from '@/lib/signing/engine';
import DocumentViewer from '@/app/components/signing/DocumentViewer';
import SignaturePad from '@/app/components/signing/SignaturePad';
import { getInitialTemplate, getReplicaCount } from '@/lib/signing/initial-replicator';
import type { SigningField } from '@/lib/signing/types';
import { FileText, CheckCircle, Clock, Send, Lock } from 'lucide-react';
import Link from 'next/link';

export default function LeaseExecutionPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [activeField, setActiveField] = useState<SigningField | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showReplicatePrompt, setShowReplicatePrompt] = useState(false);
  const [pendingReplicateField, setPendingReplicateField] = useState<SigningField | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('signature_requests').select('*').eq('created_by', session.user.id).order('created_at', { ascending: false });
    setRequests(data || []);
  }

  function openRequest(request: any) {
    setActiveRequest(request);
    if (request.fields?.length > 0) {
      const maxPage = Math.max(...request.fields.map((f: SigningField) => f.page));
      setTotalPages(maxPage);
    }
  }

  async function handleFieldClick(field: SigningField) {
    if (field.type === 'initial' && !field.isReplica && !field.value) {
      // First time placing an initial — show replicate prompt after signing
      setPendingReplicateField(field);
      setActiveField(field);
      setShowSignaturePad(true);
      return;
    }
    setActiveField(field);
    setShowSignaturePad(true);
  }

  async function handleSignatureSave(data: string) {
    if (!activeField || !activeRequest) return;
    
    await signingEngine.updateField(activeRequest.id, activeField.id, data);
    
    // If this was a pending initial, show replicate prompt
    if (pendingReplicateField?.id === activeField.id) {
      setShowReplicatePrompt(true);
    }
    
    setShowSignaturePad(false);
    setActiveField(null);
    await refreshRequest();
  }

  async function handleReplicate(action: 'all' | 'selected' | 'none') {
    if (!pendingReplicateField || !activeRequest) return;
    
    if (action === 'all') {
      const { replicateInitials } = await import('@/lib/signing/initial-replicator');
      const replicas = replicateInitials(pendingReplicateField, totalPages, Array.from({ length: totalPages }, (_, i) => i + 1));
      const updatedFields = [...(activeRequest.fields || []), ...replicas].map(f => {
        if (f.id === pendingReplicateField!.id) {
          return { ...f, replicatePages: Array.from({ length: totalPages }, (_, i) => i + 1) };
        }
        return f;
      });
      await supabase.from('signature_requests').update({ fields: updatedFields }).eq('id', activeRequest.id);
    } else {
    if (!pendingReplicateField || !activeRequest) return;
    
    const pages = action === 'all' 
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : action === 'selected' 
        ? [pendingReplicateField.page]
        : [];
    
    // Update the template field with replicate pages
    const { data: request } = await supabase.from('signature_requests').select('fields').eq('id', activeRequest.id).single();
    const fields = (request.fields as SigningField[]).map(f => {
      if (f.id === pendingReplicateField.id) {
        return { ...f, replicatePages: action === 'none' ? [] : pages };
      }
      return f;
    });

    await supabase.from('signature_requests').update({ fields }).eq('id', activeRequest.id);
    
    }
    
    setShowReplicatePrompt(false);
    setPendingReplicateField(null);
    await refreshRequest();
  }

  async function handleFieldMove(fieldId: string, x: number, y: number) {
    if (!activeRequest) return;
    
    const field = (activeRequest.fields as SigningField[]).find((f: SigningField) => f.id === fieldId);
    const isTemplate = field?.isTemplate && !field?.isReplica;
    const hasReplicas = field?.templateId || getReplicaCount(activeRequest.fields, fieldId) > 0;
    
    if (isTemplate || hasReplicas) {
      // For now, move just this one. Linked editing prompt can be added.
    }
    
    await signingEngine.moveField(activeRequest.id, fieldId, x, y, false);
    await refreshRequest();
  }

  async function handleComplete() {
    if (!activeRequest) return;
    const { data: { session } } = await supabase.auth.getSession();
    await signingEngine.completeSigning(
      activeRequest.id,
      session?.user?.email || 'Unknown',
      session?.user?.email || ''
    );
    setActiveRequest(null);
    await loadRequests();
  }

  async function refreshRequest() {
    if (!activeRequest) return;
    const updated = await signingEngine.getRequest(activeRequest.id);
    setActiveRequest(updated);
  }

  const allFieldsSigned = activeRequest?.fields?.every((f: SigningField) => f.value);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Lease Execution</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Signatures</h1>
        </div>
        <Link href="/signatures/pro" className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-4 py-2 text-xs text-amber-400 hover:border-amber-500/30 transition-all">
          <Lock className="w-3 h-3" /> Document Signing Pro
        </Link>
      </div>

      {activeRequest ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveRequest(null)} className="text-sm text-zinc-500 hover:text-white">← Back</button>
              <div>
                <p className="text-sm font-medium text-white">{activeRequest.document_name}</p>
                <p className="text-xs text-zinc-500">{activeRequest.request_type === 'lease' ? 'Lease Execution' : 'Document'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeRequest.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {activeRequest.status}
              </span>
              {allFieldsSigned && activeRequest.status !== 'completed' && (
                <button onClick={handleComplete} className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200">
                  Complete Execution
                </button>
              )}
            </div>
          </div>

          <DocumentViewer
            fileUrl={activeRequest.document_url}
            fields={activeRequest.fields || []}
            onFieldAdd={() => {}}
            onFieldMove={handleFieldMove}
            onFieldClick={handleFieldClick}
            readOnly={activeRequest.status === 'completed'}
          />

          {/* Signature Pad Modal */}
          {showSignaturePad && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignaturePad(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <p className="text-sm font-medium text-white mb-4">
                    {activeField?.signerRole ? `${activeField.signerRole} — ` : ''}
                    {activeField?.type === 'signature' ? 'Signature' : activeField?.type === 'initial' ? 'Initials' : activeField?.type === 'witness' ? 'Witness' : 'Sign'}
                  </p>
                  <SignaturePad value={activeField?.value || ''} onChange={handleSignatureSave} onClear={() => {}} />
                  <button onClick={() => setShowSignaturePad(false)} className="w-full mt-4 rounded-lg border border-white/[0.08] py-2 text-sm text-white hover:border-white/20">Cancel</button>
                </div>
              </div>
            </>
          )}

          {/* Replicate Prompt */}
          {showReplicatePrompt && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowReplicatePrompt(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
                  <p className="text-sm font-medium text-white mb-2">Initial Placed</p>
                  <p className="text-xs text-zinc-400 mb-6">Would you like to replicate this initial to other pages?</p>
                  <div className="space-y-2">
                    <button onClick={() => handleReplicate('all')} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200">
                      Replicate to All {totalPages} Pages
                    </button>
                    <button onClick={() => handleReplicate('selected')} className="w-full rounded-lg border border-white/[0.08] py-2.5 text-sm text-white hover:border-white/20">
                      This Page Only
                    </button>
                    <button onClick={() => setShowReplicatePrompt(false)} className="w-full text-sm text-zinc-500 hover:text-zinc-300 py-2">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Document</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th></tr></thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-zinc-500">No signature requests yet.<br /><span className="text-xs text-zinc-600 mt-1">Lease execution requests will appear here when a lease is sent for signing.</span></td></tr>
              ) : requests.map(r => (
                <tr key={r.id} onClick={() => openRequest(r)} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer">
                  <td className="py-2.5 px-4 text-white font-light text-xs">{r.document_name}</td>
                  <td className="py-2.5 px-4 text-zinc-400 text-xs">{r.request_type === 'lease' ? 'Lease' : 'Document'}</td>
                  <td className="py-2.5 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'sent' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{r.status}</span></td>
                  <td className="py-2.5 px-4 text-zinc-500 text-xs">{r.created_at?.split('T')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
