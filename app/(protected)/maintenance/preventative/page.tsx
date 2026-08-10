'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Shield, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';

export default function PreventativePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }

      const { data } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('entity_id', entities[0])
        .order('next_due', { ascending: true });

      setSchedules(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  const overdue = schedules.filter(s => s.next_due && new Date(s.next_due) < new Date());
  const upcoming = schedules.filter(s => s.next_due && new Date(s.next_due) >= new Date());

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/maintenance" className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Maintenance</p>
            <h1 className="text-xl font-light tracking-[-0.02em] text-white">Preventative Plans</h1>
          </div>
        </div>
        <Link href="/maintenance/preventative/new"
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
          <Plus className="w-3.5 h-3.5" /> Add Plan
        </Link>
      </div>

      {overdue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-red-400">Overdue</p>
          </div>
          <div className="space-y-2">
            {overdue.map(s => (
              <div key={s.id} className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-light">{s.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Due: {s.next_due} · Every {s.frequency_months} months</p>
                </div>
                <button className="rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-gray-100">
                  Service Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Upcoming</p>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-8 text-center">
            <Shield className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-light">No upcoming preventative plans.</p>
            <p className="text-xs text-zinc-600 mt-1">Create a plan to schedule regular maintenance.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => (
              <div key={s.id} className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <div>
                    <p className="text-sm text-white font-light">{s.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Due: {s.next_due} · Every {s.frequency_months} months</p>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500">{s.next_due ? Math.ceil((new Date(s.next_due).getTime() - Date.now()) / 86400000) : '?'} days</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
