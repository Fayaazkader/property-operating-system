'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { inspectionsEngine } from '@/lib/inspections/engine';
import { Search, Plus, Calendar, CheckCircle, AlertTriangle, ClipboardCheck, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function InspectionsWorkspace() {
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const entityId = entities[0];

      const [up, ov, hist] = await Promise.all([
        inspectionsEngine.getUpcoming(entityId),
        inspectionsEngine.getOverdue(entityId),
        inspectionsEngine.getHistory(entityId),
      ]);
      setUpcoming(up);
      setOverdue(ov);
      setHistory(hist);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Inspections</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            {overdue.length > 0 ? `${overdue.length} overdue` : `${upcoming.length} upcoming`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/inspections/new" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
            <Plus className="w-3.5 h-3.5" /> Schedule Inspection
          </Link>
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-red-400">Overdue ({overdue.length})</p>
          </div>
          <div className="space-y-2">
            {overdue.map(insp => (
              <div key={insp.id} className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-sm text-white font-light">{insp.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Scheduled: {insp.scheduled_date} · {insp.type}</p>
                  </div>
                </div>
                <button className="rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-gray-100">Complete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Upcoming ({upcoming.length})</p>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-12 text-center">
            <ClipboardCheck className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-sm text-zinc-500 font-light">No upcoming inspections.</p>
            <p className="text-xs text-zinc-600 mt-1">Schedule routine, compliance, or handover inspections.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.05] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Inspection</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Inspector</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(insp => (
                  <tr key={insp.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer">
                    <td className="py-2.5 px-4 text-white font-light text-xs">{insp.title}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs capitalize">{insp.type}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">{insp.scheduled_date}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">{insp.inspector || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{insp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Recent History ({history.length})</p>
          <div className="rounded-xl border border-white/[0.05] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Inspection</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Completed</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Severity</th>
                  <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Findings</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map(insp => (
                  <tr key={insp.id} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                    <td className="py-2.5 px-4 text-white font-light text-xs">{insp.title}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">{insp.completed_date || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        insp.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                        insp.severity === 'high' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>{insp.severity || 'none'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs truncate max-w-xs">{insp.findings || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
