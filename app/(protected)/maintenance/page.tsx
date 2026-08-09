'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, ArrowRight, Zap, Clock, Shield, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function MaintenanceCommand() {
  const [issues, setIssues] = useState<any[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, emergency: 0, approvals: 0, slaHealthy: 97 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const entityId = entities[0];

      const { data } = await supabase
        .from('maintenance_issues')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(100);

      const all = data || [];
      setIssues(all);

      const active = all.filter(i => !['resolved', 'closed'].includes(i.status)).length;
      const emergency = all.filter(i => i.priority === 'emergency' && !['resolved', 'closed'].includes(i.status)).length;
      const approvals = all.filter(i => i.status === 'classified').length;
      setStats({ active, emergency, approvals, slaHealthy: 97 });

      // Build attention feed with context
      const feed: any[] = [];
      
      const emergencies = all.filter(i => i.priority === 'emergency' && i.status === 'reported');
      emergencies.forEach(i => feed.push({ 
        type: 'emergency', issue: i, 
        context: `No supplier assigned · ${minutesAgo(i.created_at)}min ago`,
        action: 'Assign Now'
      }));
      
      const pending = all.filter(i => i.status === 'classified' && i.priority === 'urgent');
      pending.forEach(i => feed.push({ 
        type: 'urgent', issue: i, 
        context: `Awaiting work order`,
        action: 'Create WO'
      }));

      const quotes = all.filter(i => i.status === 'classified');
      if (quotes.length > 0 && feed.length < 5) {
        feed.push({ type: 'approval', issue: quotes[0], context: `${quotes.length} quote${quotes.length > 1 ? 's' : ''} awaiting approval`, action: 'Review' });
      }
      
      setAttention(feed.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  function minutesAgo(date: string): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  }

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  const stages = [
    { key: 'reported', label: 'Reported', color: 'bg-amber-400' },
    { key: 'classified', label: 'Awaiting Action', color: 'bg-blue-400' },
    { key: 'in_progress', label: 'In Progress', color: 'bg-orange-400' },
    { key: 'resolved', label: 'Resolved', color: 'bg-emerald-400' },
    { key: 'closed', label: 'Closed', color: 'bg-zinc-600' },
  ];

  const contextualActions = attention.length > 0 && attention[0].type === 'emergency' 
    ? [{ label: 'Assign Emergency', icon: Zap, href: '/maintenance/assign' }]
    : [{ label: 'Schedule Service', icon: Clock, href: '/maintenance/schedule' }];

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8 lg:p-10 overflow-y-auto space-y-10">
        
        {/* OPERATIONS PULSE */}
        <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-r from-white/[0.01] via-transparent to-white/[0.01] px-6 py-4">
          <div className="flex items-center gap-6 text-xs font-light">
            <span className="text-zinc-400">Maintenance is</span>
            <span className="text-emerald-400">{stats.slaHealthy}% within SLA</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-400">Today:</span>
            {stats.emergency > 0 && <span className="text-red-400">{stats.emergency} emergenc{stats.emergency === 1 ? 'y' : 'ies'}</span>}
            {stats.approvals > 0 && <span className="text-amber-400">{stats.approvals} approval{stats.approvals > 1 ? 's' : ''}</span>}
            <span className="text-zinc-400">{stats.active} active</span>
          </div>
        </div>

        {/* HEADER — Decisions first */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Maintenance Command</p>
          <h1 className="text-3xl font-light tracking-[-0.02em] text-white leading-tight">
            {attention.length > 0 
              ? `${attention.length} operational decision${attention.length > 1 ? 's' : ''} require${attention.length === 1 ? 's' : ''} attention`
              : 'All operations running smoothly'}
          </h1>
          {attention.length === 0 && (
            <p className="text-zinc-500 text-sm mt-2 font-light">{stats.active} active work orders · No urgent actions required</p>
          )}
        </div>

        {/* SEARCH — Universal */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-600" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues, suppliers, assets, properties, invoices..."
            className="w-full rounded-xl border border-white/[0.05] bg-white/[0.01] pl-10 pr-4 py-3.5 text-sm text-white outline-none focus:border-white/[0.08] transition-all font-light"
          />
        </div>

        {/* CONTEXTUAL ACTIONS */}
        <div className="flex gap-2 flex-wrap">
          {contextualActions.map(action => (
            <Link key={action.label} href={action.href}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100 transition-all">
              <action.icon className="w-3.5 h-3.5" /> {action.label}
            </Link>
          ))}
          <Link href="/maintenance/new"
            className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all">
            <Plus className="w-3.5 h-3.5" /> New Issue
          </Link>
          <Link href="/maintenance/preventative"
            className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all">
            <Shield className="w-3.5 h-3.5" /> Preventative Plan
          </Link>
        </div>

        {/* ATTENTION FEED — The Hero */}
        {attention.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Needs Attention</p>
            <div className="space-y-2">
              {attention.map((item, i) => (
                <div key={i} className="group flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 hover:bg-white/[0.02] hover:border-white/[0.06] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      item.type === 'emergency' ? 'bg-red-400 animate-pulse' : 
                      item.type === 'urgent' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <div>
                      <p className="text-sm text-white font-light">{item.issue.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-1 font-light">{item.context}</p>
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-medium text-black hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100">
                    {item.action} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PIPELINE — Alive, not cards */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Pipeline</p>
          <div className="grid grid-cols-5 gap-2">
            {stages.map((stage, idx) => {
              const stageIssues = issues.filter(i => i.status === stage.key);
              const count = stageIssues.length;
              return (
                <div key={stage.key} className="group rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 hover:bg-white/[0.02] transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${stage.color}`} />
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{stage.label}</p>
                  </div>
                  <p className="text-3xl font-light text-white tracking-[-0.02em]">{count}</p>
                  {idx < stages.length - 1 && (
                    <div className="flex justify-end mt-1">
                      <ArrowRight className="w-3 h-3 text-zinc-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Activity + Upcoming */}
      <div className="w-72 border-l border-white/[0.04] p-6 flex-shrink-0 overflow-y-auto space-y-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Today's Activity</p>
          <div className="space-y-3">
            {issues.filter(i => i.created_at && new Date(i.created_at).toDateString() === new Date().toDateString()).slice(0, 8).map((issue, i) => (
              <div key={i} className="border-l border-white/[0.04] pl-4">
                <p className="text-[10px] text-zinc-600">{issue.created_at ? new Date(issue.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-white font-light mt-0.5">{issue.title}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">{issue.status.replace('_', ' ')}</p>
              </div>
            ))}
            {issues.filter(i => i.created_at && new Date(i.created_at).toDateString() === new Date().toDateString()).length === 0 && (
              <p className="text-xs text-zinc-600 font-light">No activity today</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Upcoming</p>
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 font-light">Generator Service</div>
            <p className="text-[10px] text-zinc-600">Tomorrow</p>
            <div className="text-xs text-zinc-500 font-light mt-3">Lift Inspection</div>
            <p className="text-[10px] text-zinc-600">Friday</p>
            <div className="text-xs text-zinc-500 font-light mt-3">Fire Audit</div>
            <p className="text-[10px] text-zinc-600">Next Week</p>
          </div>
        </div>
      </div>
    </div>
  );
}
