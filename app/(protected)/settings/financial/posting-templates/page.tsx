'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PostingTemplatesPage() {
  const [entityId, setEntityId] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) return;
      const eid = entities[0]; setEntityId(eid);
      const { data: tmpl } = await supabase.from('posting_templates').select('*').eq('entity_id', eid).order('business_event');
      setTemplates(tmpl || []);
      const { data: accts } = await supabase.from('chart_of_accounts').select('gl_code, account_name').eq('entity_id', eid);
      const map: Record<string, string> = {};
      (accts || []).forEach(a => { map[a.gl_code] = `${a.gl_code} — ${a.account_name}`; });
      setAccounts(map);
    }
    load();
  }, []);

  async function loadLines(templateId: string) {
    if (expanded === templateId) { setExpanded(null); return; }
    const { data } = await supabase.from('posting_template_lines').select('*').eq('template_id', templateId).order('sequence');
    setLines(data || []);
    setExpanded(templateId);
  }

  function resolveAccount(resolver: string): string {
    return accounts[resolver] || resolver;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Posting Templates</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure double-entry posting rules for each business event.</p>
      </div>
      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id}>
            <div onClick={() => loadLines(t.id)} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:bg-white/[0.02] cursor-pointer transition-all">
              <div>
                <p className="text-sm text-white font-light capitalize">{t.business_event?.replace(/_/g, ' ')}</p>
                <p className="text-xs text-zinc-500">{t.description || 'No description'} · v{t.version || 1}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            {expanded === t.id && (
              <div className="ml-4 mt-1 rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/[0.04]"><th className="text-left py-2 px-3 text-[10px] text-zinc-500">#</th><th className="text-left py-2 px-3 text-[10px] text-zinc-500">Direction</th><th className="text-left py-2 px-3 text-[10px] text-zinc-500">Account</th><th className="text-left py-2 px-3 text-[10px] text-zinc-500">Formula</th><th className="text-left py-2 px-3 text-[10px] text-zinc-500">VAT</th></tr></thead>
                  <tbody>{lines.map(l => (<tr key={l.id} className="border-b border-white/[0.02]"><td className="py-1.5 px-3 text-zinc-500">{l.sequence}</td><td className="py-1.5 px-3"><span className={l.direction === 'debit' ? 'text-blue-400' : 'text-amber-400'}>{l.direction}</span></td><td className="py-1.5 px-3 text-zinc-300 text-[11px]">{resolveAccount(l.account_resolver)}</td><td className="py-1.5 px-3 text-zinc-400 font-mono">{l.amount_formula}</td><td className="py-1.5 px-3 text-zinc-500">{l.vat_treatment}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
