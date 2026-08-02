'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import SignaturePad from '@/app/components/signing/SignaturePad';
import { CheckCircle } from 'lucide-react';

export default function SignaturesPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ documentName: '', subject: '', recipients: [{ name: '', email: '' }], selfSign: false });
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('signature_requests').select('*').eq('created_by', session.user.id).order('created_at', { ascending: false });
      setRequests(data || []);
    }
    load();
  }, []);

  function addRecipient() { setForm({ ...form, recipients: [...form.recipients, { name: '', email: '' }] }); }
  function removeRecipient(i: number) { setForm({ ...form, recipients: form.recipients.filter((_, idx) => idx !== i) }); }
  function updateRecipient(i: number, field: string, value: string) {
    const updated = [...form.recipients];
    (updated[i] as any)[field] = value;
    setForm({ ...form, recipients: updated });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">AssetFlow Signature</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Document Signing</h1>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-zinc-200 transition-all">
          {showNew ? 'Cancel' : '+ New Request'}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
          <input value={form.documentName} onChange={(e) => setForm({ ...form, documentName: e.target.value })} placeholder="Document name" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Recipients</p>
              <button onClick={addRecipient} className="text-xs text-white hover:text-zinc-300">+ Add</button>
            </div>
            {form.recipients.map((r, i) => (
              <div key={i} className="flex gap-3">
                <input value={r.name} onChange={(e) => updateRecipient(i, 'name', e.target.value)} placeholder="Full name" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                <input value={r.email} onChange={(e) => updateRecipient(i, 'email', e.target.value)} placeholder="Email" className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                {form.recipients.length > 1 && <button onClick={() => removeRecipient(i)} className="text-zinc-500 hover:text-white text-sm">✕</button>}
              </div>
            ))}
          </div>

          <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center">
            <p className="text-sm text-zinc-500">Drop PDF here or click to upload</p>
          </div>

          <label className="flex items-center gap-3 text-sm text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={form.selfSign} onChange={(e) => { setForm({ ...form, selfSign: e.target.checked }); if (e.target.checked) setShowSignaturePad(true); }} className="rounded" />
            Sign this document yourself
          </label>

          {showSignaturePad && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <p className="text-xs text-zinc-500 mb-3">Your Signature</p>
              <SignaturePad onSave={(data) => { setSignatureData(data); setShowSignaturePad(false); }} onClear={() => setSignatureData(null)} />
              {signatureData && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> Signature captured
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200">
              {form.selfSign ? (signatureData ? 'Sign & Send' : 'Sign & Send') : 'Send for Signing'}
            </button>
            {form.selfSign && signatureData && (
              <button className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-white hover:border-white/20">
                Sign & Download
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Document</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Recipients</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th></tr></thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-zinc-500">No signature requests yet.</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer">
                <td className="py-2.5 px-4 text-white font-light text-xs">{r.document_name}</td>
                <td className="py-2.5 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'sent' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>{r.status}</span></td>
                <td className="py-2.5 px-4 text-zinc-400 text-xs">{r.recipient_count || 0}</td>
                <td className="py-2.5 px-4 text-zinc-500 text-xs">{r.created_at?.split('T')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
