'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { inspectionsEngine } from '@/lib/inspections/engine';
import { getPropertyHealth, getOvernightChanges } from '@/lib/inspections/property-health';
import { Calendar, CheckCircle, AlertTriangle, Shield, Clock, ArrowRight, ArrowUp, ArrowDown, Plus, Search } from 'lucide-react';
import Link from 'next/link';

export default function InspectionsCommand() {
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyHealth, setPropertyHealth] = useState<any>({ green: 0, amber: 0, red: 0 });
  const [overnightChanges, setOvernightChanges] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, overdueCount: 0, upcomingCount: 0, highRiskFindings: 0, completedThisMonth: 0, prevHighRisk: 0, prevCompliance: 0, prevOverdue: 0 });

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

      const lastMonth = hist.filter(i => i.completed_date && new Date(i.completed_date).getMonth() === new Date().getMonth() - 1);
      const health = await getPropertyHealth(entityId);
      setPropertyHealth(health);
      const changes = await getOvernightChanges(entityId);
      setOvernightChanges(changes);
      setStats({
        total: up.length + ov.length + hist.length,
        overdueCount: ov.length, upcomingCount: up.length,
        highRiskFindings: hist.filter(i => i.severity === 'critical' || i.severity === 'high').length,
        completedThisMonth: hist.filter(i => i.completed_date && new Date(i.completed_date).getMonth() === new Date().getMonth()).length,
        prevHighRisk: lastMonth.filter(i => i.severity === 'critical' || i.severity === 'high').length,
        prevCompliance: lastMonth.length,
        prevOverdue: ov.length,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  const complianceRate = history.length > 0 ? Math.round((history.filter(i => i.severity !== 'critical' && i.severity !== 'high').length / history.length) * 100) : 100;
  const highRiskTrend = stats.prevHighRisk > 0 ? Math.round(((stats.highRiskFindings - stats.prevHighRisk) / stats.prevHighRisk) * 100) : 0;

  // Group upcoming by date
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const todayInspections = upcoming.filter(i => i.scheduled_date === today);
  const tomorrowInspections = upcoming.filter(i => i.scheduled_date === tomorrow);
  const laterInspections = upcoming.filter(i => i.scheduled_date !== today && i.scheduled_date !== tomorrow);

  // Compliance by category
  const categories = [...new Set(history.map(i => i.type))];

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

      {/* OVERDUE HERO */}
      {overdue.length > 0 && (
        <div className="space-y-2">
          {overdue.map(insp => (
            <div key={insp.id} className="group flex items-center justify-between rounded-xl border border-red-500/10 bg-red-500/[0.02] p-4 hover:bg-red-500/[0.04] transition-all">
              <div className="flex items-center gap-4">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-light">{insp.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Scheduled: {insp.scheduled_date} · {insp.type}</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all">
                Complete <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TREND CARDS */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Compliance', value: `${complianceRate}%`, trend: complianceRate >= 95 ? 'up' : 'down', icon: Shield },
          { label: 'High Risk Findings', value: stats.highRiskFindings, trend: highRiskTrend <= 0 ? 'down' : 'up', icon: AlertTriangle },
          { label: 'Completed This Month', value: stats.completedThisMonth, trend: 'up', icon: CheckCircle },
          { label: 'Overdue', value: stats.overdueCount, trend: stats.overdueCount === 0 ? 'down' : 'up', icon: Clock },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.trend === 'down' ? 'text-emerald-400' : s.label === 'Overdue' ? 'text-red-400' : 'text-zinc-400'}`} />
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{s.label}</p>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-light text-white">{s.value}</p>
              {s.trend === 'down' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-400 mb-1" /> : s.label !== 'Overdue' ? <ArrowUp className="w-3.5 h-3.5 text-zinc-500 mb-1" /> : null}
            </div>
          </div>
        ))}
      </div>

      {/* PROPERTY HEALTH */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Property Health</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="text-sm text-white font-light">{propertyHealth.green}</span>
            <span className="text-[11px] text-zinc-500">Green</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-sm text-white font-light">{propertyHealth.amber}</span>
            <span className="text-[11px] text-zinc-500">Amber</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm text-white font-light">{propertyHealth.red}</span>
            <span className="text-[11px] text-zinc-500">Red</span>
          </div>
        </div>
      </div>

      {/* OVERNIGHT CHANGES */}
      {overnightChanges.length > 0 && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Overnight Changes</p>
          <div className="space-y-1.5">
            {overnightChanges.map((change, i) => (
              <p key={i} className="text-xs text-zinc-400 font-light">· {change}</p>
            ))}
          </div>
        </div>
      )}

      {/* COMPLIANCE MAP */}
      {categories.length > 0 && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-4">Portfolio Compliance</p>
          <div className="grid grid-cols-3 gap-3">
            {categories.map(cat => {
              const catHist = history.filter(i => i.type === cat);
              const catOk = catHist.filter(i => i.severity !== 'critical' && i.severity !== 'high').length;
              const catRate = catHist.length > 0 ? Math.round((catOk / catHist.length) * 100) : 100;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${catRate >= 90 ? 'bg-emerald-400' : catRate >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <span className="text-xs text-zinc-400 capitalize flex-1">{cat}</span>
                  <span className={`text-xs ${catRate >= 90 ? 'text-emerald-400' : catRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{catRate}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UPCOMING — Calendar-style feed */}
      <div className="space-y-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Upcoming</p>
        
        {todayInspections.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 font-medium">Today</p>
            {todayInspections.map(insp => (
              <div key={insp.id} className="flex items-center gap-4 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white font-light">{insp.title}</p>
                  <p className="text-[11px] text-zinc-500">{insp.type} · {insp.inspector || 'Unassigned'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tomorrowInspections.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 font-medium">Tomorrow</p>
            {tomorrowInspections.map(insp => (
              <div key={insp.id} className="flex items-center gap-4 rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                <Calendar className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white font-light">{insp.title}</p>
                  <p className="text-[11px] text-zinc-500">{insp.type} · {insp.inspector || 'Unassigned'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {laterInspections.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 font-medium">Later</p>
            <div className="rounded-xl border border-white/[0.05] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Inspection</th>
                    <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Date</th>
                    <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {laterInspections.map(insp => (
                    <tr key={insp.id} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                      <td className="py-2 px-4 text-white font-light text-xs">{insp.title}</td>
                      <td className="py-2 px-4 text-zinc-400 text-xs">{insp.scheduled_date}</td>
                      <td className="py-2 px-4 text-zinc-400 text-xs capitalize">{insp.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {upcoming.length === 0 && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-8 text-center">
            <Calendar className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-light">No upcoming inspections.</p>
          </div>
        )}
      </div>

      {/* HISTORY */}
      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Recent History</p>
          <div className="rounded-xl border border-white/[0.05] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Inspection</th>
                  <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Completed</th>
                  <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Severity</th>
                  <th className="text-left py-2.5 px-4 text-[10px] font-medium text-zinc-500 uppercase">Findings</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map(insp => (
                  <tr key={insp.id} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                    <td className="py-2 px-4 text-white font-light text-xs">{insp.title}</td>
                    <td className="py-2 px-4 text-zinc-400 text-xs">{insp.completed_date || '—'}</td>
                    <td className="py-2 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        insp.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                        insp.severity === 'high' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>{insp.severity || 'none'}</span>
                    </td>
                    <td className="py-2 px-4 text-zinc-400 text-xs truncate max-w-xs">{insp.findings || '—'}</td>
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
