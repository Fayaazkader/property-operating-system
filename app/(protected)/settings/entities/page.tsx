'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
export default function EntitiesPage() {
  const [entities, setEntities] = useState<any[]>([]);
  useEffect(() => { async function load() { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data: e } = await supabase.rpc('auth_entities'); if (!e?.length) return; const { data } = await supabase.from('entities').select('*').in('id', e); setEntities(data || []); } load(); }, []);
  return (<div className="space-y-6 max-w-3xl"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Entities</h1><div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">ID</th></tr></thead><tbody>{entities.map(e => (<tr key={e.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{e.entity_name}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{e.id}</td></tr>))}</tbody></table></div></div>); }
