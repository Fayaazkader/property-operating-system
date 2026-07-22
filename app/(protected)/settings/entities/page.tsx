'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
export default function EntitiesPage() {
  const [entities, setEntities] = useState<any[]>([]);
  useEffect(() => { async function load() { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data: e } = await supabase.rpc('auth_entities'); if (!e?.length) return; const { data: orgs } = await supabase.from('organisations').select('*').in('entity_id', e); const orgMap = new Map((orgs || []).map(o => [o.entity_id, o])); const { data: entData } = await supabase.from('entities').select('*').in('id', e); setEntities((entData || []).map(e => ({ ...e, org: orgMap.get(e.id) }))); } load(); }, []);
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Entities</h1><p className="text-sm text-zinc-500 mt-1">Legal entities within your portfolio.</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Add Entity</button></div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Reg Number</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">VAT</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th></tr></thead>
          <tbody>{entities.map(e => (<tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{e.entity_name || e.org?.company_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{e.org?.registration_number || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{e.org?.vat_number || '—'}</td><td className="py-2.5 px-4"><span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Active</span></td></tr>))}</tbody></table>
      </div>
    </div>
  );
}
