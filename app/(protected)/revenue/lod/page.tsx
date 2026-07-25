'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { lodEligibility } from '@/lib/revenue/lod-eligibility';
import { lodRenderer } from '@/lib/revenue/lod-renderer';
import { lodQueue } from '@/lib/revenue/lod-queue';
import type { LODEligibility } from '@/lib/revenue/lod-eligibility';

export default function LetterOfDemandPage() {
  const [entityId, setEntityId] = useState('');
  const [eligible, setEligible] = useState<LODEligibility[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);

      const { data: tpl } = await supabase.from('lod_templates').select('*').eq('entity_id', entities[0]).eq('is_active', true);
      setTemplates(tpl || []);

      const [results, hist] = await Promise.all([
        lodEligibility.findEligible(entities[0]),
        lodQueue.getHistory(entities[0]),
      ]);
      setEligible(results);
      setHistory(hist || []);
    }
    init();
  }, []);

  async function handlePreview(tenantId: string, templateId?: string) {
    setLoading(true);
    const tplId = templateId || templates[0]?.id;
    if (!tplId) return;
    const result = await lodRenderer.render(tenantId, tplId, entityId);
    setPreview({ ...result, tenantId, templateId: tplId });
    setLoading(false);
  }

  async function handleSend() {
    if (!preview) return;
    await lodQueue.queue({
      entityId, tenantId: preview.tenantId,
      templateId: preview.templateId,
      subject: preview.subject, body: preview.body,
    });
    setPreview(null);
    const hist = await lodQueue.getHistory(entityId);
    setHistory(hist || []);
  }

  const filtered = search ? eligible.filter(e => e.tenantName.toLowerCase().includes(search.toLowerCase())) : eligible;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Revenue Operations</p>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Letters of Demand</h1>
      </div>

      <div className="flex gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenant..." className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center">
          <p className="text-sm text-zinc-500">No tenants currently eligible for Letters of Demand.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.tenantId} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-light">{e.tenantName}</p>
                <p className="text-xs text-zinc-500">R{e.overdueAmount.toLocaleString()} · {e.daysOverdue} days · {e.propertyName}</p>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => handlePreview(e.tenantId, e.matchedTemplateId)} className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-1.5">
                  Preview {e.matchedTemplateName || 'LOD'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[11px] font-medium text-zinc-500 uppercase">History</p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 px-4 text-[10px] text-zinc-500">Tenant</th><th className="text-left py-2 px-4 text-[10px] text-zinc-500">Template</th><th className="text-left py-2 px-4 text-[10px] text-zinc-500">Status</th><th className="text-left py-2 px-4 text-[10px] text-zinc-500">Date</th></tr></thead>
            <tbody>{history.map(h => (<tr key={h.id} className="border-b border-white/[0.03]"><td className="py-2 px-4 text-white text-xs font-light">{h.subject?.replace('Letter of Demand — ', '')}</td><td className="py-2 px-4 text-zinc-400 text-xs">{h.templates?.name || '—'}</td><td className="py-2 px-4"><span className={`text-[10px] px-2 py-0.5 rounded-full ${h.status === 'queued' ? 'bg-amber-500/10 text-amber-400' : h.status === 'emailed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{h.status}</span></td><td className="py-2 px-4 text-zinc-500 text-xs">{h.created_at?.split('T')[0]}</td></tr>))}</tbody></table>
        </div>
      )}

      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="fixed inset-4 z-50 overflow-y-auto flex items-start justify-center p-4">
            <div className="bg-white text-black rounded-2xl p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-medium">{preview.subject}</p>
                <button onClick={() => setPreview(null)} className="text-zinc-500 hover:text-black">✕</button>
              </div>
              <div className="text-sm leading-relaxed border-t border-zinc-200 pt-4" dangerouslySetInnerHTML={{ __html: preview.html }} />
              <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-200">
                <button onClick={handleSend} className="rounded-lg bg-black text-white px-4 py-2 text-xs font-medium hover:bg-zinc-800">Queue for Sending</button>
                <button onClick={() => window.print()} className="rounded-lg border border-zinc-300 px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100">Print</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
