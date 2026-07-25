'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { lodEligibility } from '@/lib/revenue/lod-eligibility';
import { lodRenderer } from '@/lib/revenue/lod-renderer';
import type { LODEligibility } from '@/lib/revenue/lod-eligibility';

export default function LetterOfDemandPage() {
  const [entityId, setEntityId] = useState('');
  const [eligible, setEligible] = useState<LODEligibility[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      setEntityId(entities[0]);

      const { data: tpl } = await supabase.from('lod_templates').select('*').eq('entity_id', entities[0]).eq('is_active', true);
      setTemplates(tpl || []);

      const results = await lodEligibility.findEligible(entities[0]);
      setEligible(results);
    }
    init();
  }, []);

  async function handlePreview(tenantId: string, templateId: string) {
    setLoading(true);
    const result = await lodRenderer.render(tenantId, templateId, entityId);
    setPreview({ ...result, tenantId, templateId });
    setLoading(false);
  }

  async function handleSend() {
    if (!preview) return;
    await supabase.from('lod_queue').insert({
      entity_id: entityId, tenant_id: preview.tenantId,
      template_id: preview.templateId, subject: preview.subject,
      body: preview.body, status: 'queued',
    });
    setPreview(null);
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
          <p className="text-xs text-zinc-600 mt-1">Tenants become eligible when overdue beyond the threshold set in your LOD templates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.tenantId} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-light">{e.tenantName}</p>
                <p className="text-xs text-zinc-500">R{e.overdueAmount.toLocaleString()} · {e.daysOverdue} days overdue · {e.propertyName}</p>
              </div>
              <div className="flex gap-2">
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => handlePreview(e.tenantId, tpl.id)} className="text-xs text-zinc-400 hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5">
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
              <div className="text-sm leading-relaxed whitespace-pre-line border-t border-zinc-200 pt-4">{preview.body}</div>
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
