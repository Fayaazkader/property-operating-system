'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  useEffect(() => { async function load() { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data: entities } = await supabase.rpc('auth_entities'); if (!entities?.length) return; const { data: props } = await supabase.from('properties').select('*, entities:entity_id(entity_name)').in('entity_id', entities).order('property_name'); setProperties(props || []); } load(); }, []);
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Properties</h1><p className="text-sm text-zinc-500 mt-1">Properties across your entities.</p></div><button className="rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-gray-100">+ Add Property</button></div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Entity</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">City</th></tr></thead>
          <tbody>{properties.slice(0, 20).map(p => (<tr key={p.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{p.property_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{p.entities?.entity_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{p.property_type || '—'}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{p.city || '—'}</td></tr>))}</tbody></table>
      </div>
    </div>
  );
}
