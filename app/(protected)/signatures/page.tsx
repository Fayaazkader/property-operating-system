'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminEngine } from '@/lib/platform/admin/engine';
import { signingEngine } from '@/lib/signing/engine';
import DocumentViewer from '@/app/components/signing/DocumentViewer';
import SignaturePad from '@/app/components/signing/SignaturePad';
import type { SigningField } from '@/lib/signing/types';
import { Lock, Upload, PenLine, Type, Calendar, CheckSquare, Users, X, Copy, ArrowLeft, Trash2, Layers } from 'lucide-react';
import Link from 'next/link';

type ToolType = 'signature' | 'initial' | 'date' | 'text' | 'checkbox' | 'witness' | null;
type SignerRole = 'landlord' | 'tenant' | 'witness';
type ViewMode = 'select' | 'place';

const TOOLS: Array<{ type: ToolType; label: string; icon: any }> = [
  { type: 'signature', label: 'Signature', icon: PenLine },
  { type: 'initial', label: 'Initials', icon: Type },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'witness', label: 'Witness', icon: Users },
];

export default function LeaseExecutionPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [selectedField, setSelectedField] = useState<SigningField | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showReplicatePrompt, setShowReplicatePrompt] = useState(false);
  const [pendingReplicateField, setPendingReplicateField] = useState<SigningField | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [hasProAccess, setHasProAccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pendingSignature, setPendingSignature] = useState<string>('');

  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [signerRole, setSignerRole] = useState<SignerRole>('tenant');
  const [viewMode, setViewMode] = useState<ViewMode>('select');

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!activeRequest) return;
      if (e.key === 'Escape') { setActiveTool(null); setDuplicateMode(false); setViewMode('select'); }
      if (e.key === 'Delete' && selectedField) { handleDeleteField(selectedField.id); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedField) { e.preventDefault(); duplicateField(selectedField); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRequest, selectedField]);

  useEffect(() => { loadRequests(); checkAccess(); }, []);

  async function checkAccess() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase.from('profiles').select('platform_role').eq('id', session.user.id).single();
    if (profile?.platform_role === 'platform_admin') { setHasProAccess(true); return; }
    const { data: entities } = await supabase.rpc('auth_entities');
    if (entities?.length) { setHasProAccess(await adminEngine.isFeatureEnabled(entities[0], 'document_signing_pro', session.user.id)); }
  }

  async function loadRequests() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('signature_requests').select('*').eq('created_by', session.user.id).order('created_at', { ascending: false });
    setRequests(data || []);
  }

  function openRequest(request: any) {
    setActiveRequest(request);
    setActiveTool(null); setDuplicateMode(false); setViewMode('select'); setSelectedField(null);
    if (request.fields?.length > 0) setTotalPages(Math.max(...request.fields.map((f: SigningField) => f.page)));
  }

  function selectTool(tool: ToolType) {
    if (activeTool === tool) { setActiveTool(null); setViewMode('select'); return; }
    setActiveTool(tool); setViewMode('place'); setDuplicateMode(false); setSelectedField(null);
  }

  async function handleFieldAdd(field: SigningField) {
    if (!activeRequest || !activeTool) return;
    const newField: SigningField = { ...field, type: activeTool, signerRole: activeTool === 'witness' ? 'witness' : signerRole };
    const updatedFields = [...(activeRequest.fields || []), newField];
    setActiveRequest({ ...activeRequest, fields: updatedFields });
    await supabase.from('signature_requests').update({ fields: updatedFields }).eq('id', activeRequest.id);
    setSelectedField(newField);
    if (!duplicateMode) { setActiveTool(null); setViewMode('select'); }
  }

  async function handleFieldMove(fieldId: string, x: number, y: number) {
    if (!activeRequest) return;
    const updatedFields = (activeRequest.fields || []).map(f => f.id === fieldId ? { ...f, x, y } : f);
    setActiveRequest({ ...activeRequest, fields: updatedFields });
    await signingEngine.moveField(activeRequest.id, fieldId, x, y, false);
  }

  function handleFieldClick(field: SigningField) {
    if (viewMode === 'place' && activeTool) return; // Don't select while placing
    setSelectedField(field.id === selectedField?.id ? null : field);
  }

  function handleFieldDoubleClick(field: SigningField) {
    setSelectedField(field);
    if (!field.value) { setShowSignaturePad(true); }
  }

  async function handleDeleteField(fieldId: string) {
    if (!activeRequest) return;
    const updatedFields = (activeRequest.fields || []).filter(f => f.id !== fieldId);
    setActiveRequest({ ...activeRequest, fields: updatedFields });
    setSelectedField(null);
    await supabase.from('signature_requests').update({ fields: updatedFields }).eq('id', activeRequest.id);
  }

  function duplicateField(field: SigningField) {
    if (!activeRequest) return;
    const newField: SigningField = { ...field, id: crypto.randomUUID(), x: field.x + 30, y: field.y + 30 };
    const updatedFields = [...(activeRequest.fields || []), newField];
    setActiveRequest({ ...activeRequest, fields: updatedFields });
    setSelectedField(newField);
    supabase.from('signature_requests').update({ fields: updatedFields }).eq('id', activeRequest.id);
  }

  async function handleSignatureSave(data: string) {
    if (!selectedField || !activeRequest) return;
    await signingEngine.updateField(activeRequest.id, selectedField.id, data);
    if (selectedField.type === 'initial' && !selectedField.isReplica) { setPendingReplicateField(selectedField); setShowReplicatePrompt(true); }
    setShowSignaturePad(false); setPendingSignature('');
    await refreshRequest();
  }

  async function handleReplicate(action: string) {
    if (!pendingReplicateField || !activeRequest) return;
    const { replicateInitials } = await import('@/lib/signing/initial-replicator');
    let pages: number[] = [pendingReplicateField.page];
    if (action === 'all') pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    else if (action === 'odd') pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 1);
    else if (action === 'even') pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p % 2 === 0);
    const replicas = replicateInitials(pendingReplicateField, totalPages, pages);
    const updatedFields = [...(activeRequest.fields || []), ...replicas].map(f => f.id === pendingReplicateField!.id ? { ...f, replicatePages: pages } : f);
    await supabase.from('signature_requests').update({ fields: updatedFields }).eq('id', activeRequest.id);
    setShowReplicatePrompt(false); setPendingReplicateField(null);
    await refreshRequest();
  }

  async function handleComplete() {
    if (!activeRequest) return;
    const { data: { session } } = await supabase.auth.getSession();
    await signingEngine.completeSigning(activeRequest.id, session?.user?.email || 'Unknown', session?.user?.email || '');
    setActiveRequest(null); await loadRequests();
  }

  async function handleUploadDocument() {
    if (!uploadFile || !uploadName) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const filePath = `signatures/${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadFile);
    if (uploadError) { alert('Upload failed: ' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
    const { data: entities } = await supabase.rpc('auth_entities');
    await supabase.from('signature_requests').insert({ entity_id: entities?.[0] || '', request_type: 'document', document_name: uploadName, document_url: urlData?.publicUrl || '', fields: [], status: 'draft', created_by: session.user.id });
    setShowUpload(false); setUploadName(''); setUploadFile(null);
    await loadRequests();
  }

  async function refreshRequest() {
    if (!activeRequest) return;
    const updated = await signingEngine.getRequest(activeRequest.id);
    setActiveRequest(updated);
  }

  // Field counts by type
  const fieldCounts = TOOLS.map(t => ({ ...t, count: (activeRequest?.fields || []).filter((f: SigningField) => f.type === t.type).length }));

  const allFieldsSigned = activeRequest?.fields?.every((f: SigningField) => f.value);

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-4">
          {activeRequest ? (
            <button onClick={() => { setActiveRequest(null); setActiveTool(null); setSelectedField(null); }} className="text-sm text-zinc-500 hover:text-white flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back</button>
          ) : (
            <div><p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Lease Execution</p><h1 className="text-lg font-light tracking-[-0.02em] text-white">Signatures</h1></div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasProAccess && !activeRequest && (<button onClick={() => setShowUpload(true)} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200"><Upload className="w-3 h-3" /> New Document</button>)}
          {!hasProAccess && !activeRequest && (<Link href="/signatures/pro" className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500/30"><Lock className="w-3 h-3" /> Document Signing Pro</Link>)}
          {activeRequest && (
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeRequest.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{activeRequest.status}</span>
              <span className="text-xs text-zinc-500">{activeRequest.document_name}</span>
              {allFieldsSigned && activeRequest.status !== 'completed' && (<button onClick={handleComplete} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200">Complete Execution</button>)}
            </div>
          )}
        </div>
      </div>

      {activeRequest ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Toolbox */}
          <div className="w-56 border-r border-white/[0.06] flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3">Fields</p>
              {fieldCounts.map(tool => (
                <button key={tool.type} onClick={() => selectTool(tool.type)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${activeTool === tool.type ? 'bg-white text-black font-medium' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'}`}>
                  <span className="flex items-center gap-2"><tool.icon className="w-3.5 h-3.5" /> {tool.label}</span>
                  {tool.count > 0 && <span className="text-[10px] text-zinc-600">{tool.count}</span>}
                </button>
              ))}
            </div>

            {activeTool && (
              <div className="border-t border-white/[0.06] p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Active Tool</p>
                <p className="text-xs text-white capitalize">{activeTool}</p>
                {(activeTool === 'signature' || activeTool === 'initial') && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500">Signer</p>
                    {(['landlord', 'tenant', 'witness'] as SignerRole[]).map(role => (
                      <button key={role} onClick={() => setSignerRole(role)} className={`w-full text-left px-2 py-1 rounded text-xs capitalize ${signerRole === role ? 'text-white bg-white/[0.06]' : 'text-zinc-500 hover:text-white'}`}>{role}</button>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={duplicateMode} onChange={(e) => setDuplicateMode(e.target.checked)} className="rounded" /> Duplicate mode
                </label>
                <button onClick={() => { setActiveTool(null); setViewMode('select'); }} className="w-full rounded-lg border border-white/[0.08] py-1.5 text-xs text-white hover:border-white/20">Done</button>
              </div>
            )}

            {/* Layers Panel */}
            {activeRequest?.fields?.length > 0 && (
              <div className="border-t border-white/[0.06] p-4 flex-1 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3 flex items-center gap-1"><Layers className="w-3 h-3" /> Layers</p>
                <div className="space-y-0.5">
                  {(activeRequest.fields || []).map((f: SigningField) => (
                    <button key={f.id} onClick={() => { setSelectedField(f); setViewMode('select'); }}
                      className={`w-full text-left px-2 py-1 rounded text-[10px] truncate flex items-center gap-2 ${selectedField?.id === f.id ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.value ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                      {f.type} {f.signerRole ? `(${f.signerRole})` : ''} — p.{f.page}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center: PDF Viewer */}
          <div className="flex-1 overflow-auto p-4">
            <DocumentViewer
              fileUrl={activeRequest.document_url}
              fields={activeRequest.fields || []}
              selectedFieldId={selectedField?.id}
              onFieldAdd={handleFieldAdd}
              onFieldMove={handleFieldMove}
              onFieldClick={handleFieldClick}
              onFieldDoubleClick={handleFieldDoubleClick}
              readOnly={activeRequest.status === 'completed'}
              placingMode={viewMode === 'place' && !!activeTool}
            />
          </div>

          {/* Right Inspector */}
          {selectedField && (
            <div className="w-56 border-l border-white/[0.06] p-4 flex-shrink-0 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Selected Field</p>
                <button onClick={() => setSelectedField(null)} className="text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
              </div>
              <p className="text-xs text-white capitalize">{selectedField.type}</p>
              
              {(selectedField.type === 'signature' || selectedField.type === 'initial' || selectedField.type === 'witness') && (
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500">Signer</p>
                  {(['landlord', 'tenant', 'witness'] as SignerRole[]).map(role => (
                    <button key={role} onClick={async () => {
                      const updatedFields = (activeRequest.fields || []).map(f => f.id === selectedField.id ? { ...f, signerRole: role } : f);
                      setActiveRequest({ ...activeRequest, fields: updatedFields });
                      setSelectedField({ ...selectedField, signerRole: role });
                      await supabase.from('signature_requests').update({ fields: updatedFields }).eq('id', activeRequest.id);
                    }} className={`w-full text-left px-2 py-1 rounded text-xs capitalize ${selectedField.signerRole === role ? 'text-white bg-white/[0.06]' : 'text-zinc-500 hover:text-white'}`}>{role}</button>
                  ))}
                </div>
              )}

              {!selectedField.value && (
                <button onClick={() => setShowSignaturePad(true)} className="w-full rounded-lg bg-white py-2 text-xs font-medium text-black hover:bg-zinc-200">Sign</button>
              )}

              <button onClick={() => duplicateField(selectedField)} className="w-full rounded-lg border border-white/[0.08] py-2 text-xs text-white hover:border-white/20 flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> Duplicate</button>
              <button onClick={() => handleDeleteField(selectedField.id)} className="w-full rounded-lg border border-red-500/20 py-2 text-xs text-red-400 hover:border-red-500/40 flex items-center justify-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Document</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th></tr></thead>
                <tbody>{requests.length === 0 ? (<tr><td colSpan={4} className="py-12 text-center text-sm text-zinc-500">No signature requests yet.</td></tr>) : requests.map(r => (<tr key={r.id} onClick={() => openRequest(r)} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer"><td className="py-2.5 px-4 text-white font-light text-xs">{r.document_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{r.request_type === 'lease' ? 'Lease' : 'Document'}</td><td className="py-2.5 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'sent' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{r.status}</span></td><td className="py-2.5 px-4 text-zinc-500 text-xs">{r.created_at?.split('T')[0]}</td></tr>))}</tbody></table>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignaturePad(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-medium text-white mb-4">{selectedField?.type === 'signature' ? 'Signature' : selectedField?.type === 'initial' ? 'Initials' : 'Sign'}</p>
              <SignaturePad value={selectedField?.value || pendingSignature} onChange={(data) => setPendingSignature(data)} onClear={() => setPendingSignature('')} />
              <button onClick={() => { if (pendingSignature) handleSignatureSave(pendingSignature); }} className="w-full mt-2 rounded-lg bg-white py-2 text-sm font-medium text-black hover:bg-gray-100">Done</button>
              <button onClick={() => setShowSignaturePad(false)} className="w-full mt-2 rounded-lg border border-white/[0.08] py-2 text-sm text-white hover:border-white/20">Cancel</button>
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
              <p className="text-xs text-zinc-400 mb-6">Replicate to other pages?</p>
              <div className="space-y-2">
                <button onClick={() => handleReplicate('all')} className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200">All {totalPages} Pages</button>
                <button onClick={() => handleReplicate('odd')} className="w-full rounded-lg border border-white/[0.08] py-2.5 text-sm text-white hover:border-white/20">Odd Pages Only</button>
                <button onClick={() => handleReplicate('even')} className="w-full rounded-lg border border-white/[0.08] py-2.5 text-sm text-white hover:border-white/20">Even Pages Only</button>
                <button onClick={() => handleReplicate('this_page')} className="w-full rounded-lg border border-white/[0.08] py-2.5 text-sm text-white hover:border-white/20">This Page Only</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowUpload(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-medium text-white mb-4">Upload Document for Signing</p>
              <input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Document name" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none mb-3" />
              <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-6 text-center cursor-pointer hover:border-white/20 transition-all mb-4" onClick={() => (document.querySelector('.file-input-hidden') as HTMLInputElement)?.click()}>
                {uploadFile ? (<p className="text-sm text-emerald-400">{uploadFile.name}</p>) : (<><p className="text-sm text-zinc-400">Click to select PDF</p><p className="text-xs text-zinc-600 mt-1">or drag and drop</p></>)}
                <input type="file" accept=".pdf" className="file-input-hidden hidden" onChange={(e) => { setUploadFile(e.target.files?.[0] || null); }} />
              </div>
              <div className="flex gap-3"><button onClick={handleUploadDocument} className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200">Upload and Create</button><button onClick={() => setShowUpload(false)} className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-white hover:border-white/20">Cancel</button></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
