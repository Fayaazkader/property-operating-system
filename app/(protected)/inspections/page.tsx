'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { inspectionsEngine } from '@/lib/inspections/engine';
import { Search, Plus, Calendar, CheckCircle, AlertTriangle, ClipboardCheck, ArrowRight, Shield, Clock, FileText } from 'lucide-react';
import Link from 'next/link';

export default function InspectionsCommand() {
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [complianceRate, setComplianceRate] = useState(100);
  const [stats, setStats] = useState({ total: 0, overdueCount: 0, upcomingCount: 0, highRiskFindings: 0, completedThisMonth: 0 });

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

      const total = up.length + ov.length + hist.length;
      const compliant = hist.filter(i => i.severity !== 'critical' && i.severity !== 'high').length;
      setComplianceRate(total > 0 ? Math.round((compliant / Math.max(hist.length, 1)) * 100) : 100);
      setStats({
        total, overdueCount: ov.length, upcomingCount: up.length,
        highRiskFindings: hist.filter(i => i.severity === 'critical' || i.severity === 'high').length,
        completedThisMonth: hist.filter(i => i.completed_date && new Date(i.completed_date).getMonth() === new Date().getMonth()).length,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="p-8 lg:p-10 max-w-6xl mx-auto space-y-10">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Inspection Command</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            {stats.total} inspection{stats.total !== 1 ? 's' : ''}
            {stats.overdueCount > 0 && <span className="text-red-400"> · {stats.overdueCount} overdue</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/inspections/new" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
            <Plus className="w-3.5 h-3.5" /> Schedule
          </Link>
        </div>
      </div>

      {/* COMPLIANCE PULSE */}
      <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-r from-white/[0.01] via-transparent to-white/[0.01] px-6 py-4">
        <div className="flex items-center gap-6 text-xs font-light flex-wrap">
          <span className="text-zinc-400">Compliance</span>
          <span className={`${complianceRate >= 95 ? 'text-emerald-400' : complianceRate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>{complianceRate}%</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-400">{stats.upcomingCount} upcoming</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-400">{stats.completedThisMonth} completed this month</span>
          {stats.highRiskFindings > 0 && <span className="text-red-400">· {stats.highRiskFindings} high-risk findings</span>}
        </div>
      </div>

      {/* OVERDUE — Hero section if any exist */}
      {overdue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-red-400">Overdue ({overdue.length})</p>
          </div>
          <div className="space-y-2">
            {overdue.map(insp => (
              <div key={insp.id} className="group flex items-center justify-between rounded-xl border border-red-500/10 bg-red-500/[0.02] p-4 hover:bg-red-500/[0.04] transition-all">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white font-light">{insp.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Scheduled: {insp.scheduled_date} · {insp.type} · {insp.property_id ? 'Property assigned' : 'No property'}</p>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all">
                  Complete <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Upcoming', value: stats.upcomingCount, icon: Calendar, color: 'text-blue-400' },
          { label: 'Completed This Month', value: stats.completedThisMonth, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'High-Risk Findings', value: stats.highRiskFindings, icon: AlertTriangle, color: stats.highRiskFindings > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Compliance Rate', value: `${complianceRate}%`, icon: Shield, color: complianceRate >= 95 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{s.label}</p>
            </div>
            <p className={`text-2xl font-light ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* UPCOMING */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Upcoming ({upcoming.length})</p>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-8 text-center">
            <Calendar className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-light">No upcoming inspections.</p>
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
                </tr>
              </thead>
              <tbody>
                {upcoming.map(insp => (
                  <tr key={insp.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer">
                    <td className="py-2.5 px-4 text-white font-light text-xs">{insp.title}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs capitalize">{insp.type}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">{insp.scheduled_date}</td>
                    <td className="py-2.5 px-4 text-zinc-400 text-xs">{insp.inspector || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HISTORY */}
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
