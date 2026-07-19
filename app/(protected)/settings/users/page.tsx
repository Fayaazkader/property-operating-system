'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { async function load() { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data: entities } = await supabase.rpc('auth_entities'); if (!entities?.length) return; const { data } = await supabase.from('user_entities').select('*, profiles:user_id(email, full_name)').eq('entity_id', entities[0]); setUsers(data || []); } load(); }, []);
  return (<div className="space-y-6"><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Users & Roles</h1><div className="rounded-xl border border-white/[0.06] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Name</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Email</th></tr></thead><tbody>{users.map(u => (<tr key={u.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light">{u.profiles?.full_name || '—'}</td><td className="py-2.5 px-4 text-zinc-400">{u.profiles?.email || '—'}</td></tr>))}</tbody></table></div></div>); }
