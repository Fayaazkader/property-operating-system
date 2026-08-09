'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Wrench, Clock, AlertTriangle, Zap, Search, Plus, FileText, Calendar, Shield } from 'lucide-react';
import Link from 'next/link';

export default function MaintenanceCommand() {
  const [issues, setIssues] = useState<any[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, slaBreach: 0, emergency: 0, committed: 0 });
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
      setStats({ active, slaBreach: 0, emergency, committed: 0 });

      // Build attention feed
      const feed: any[] = [];
      const emergencies = all.filter(i => i.priority === 'emergency' && i.status === 'reported');
      emergencies.forEach(i => feed.push({ type: 'emergency', issue: i, action: 'Assign Supplier', urgency: 'now' }));
      
      const pending = all.filter(i => i.status === 'classified' && i.priority === 'urgent');
      pending.forEach(i => feed.push({ type: 'urgent', issue: i, action: 'Create Work Order', urgency: 'today' }));
      
      setAttention(feed.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  const stages = [
    { key: 'reported', label: 'Reported', color: 'bg-amber-400' },
    { key: 'classified', label: 'Classified', color: 'bg-blue-400' },
    { key: 'in_progress', label: 'In Progress', color: 'bg-orange-400' },
    { key: 'resolved', label: 'Resolved', color: 'bg-emerald-400' },
    { key: 'closed', label: 'Closed', color: 'bg-zinc-600' },
  ];

  return (
    <div className="flex h-full">
      {/* Left: Command Centre */}
      <div className="flex-1 p-8 overflow-y-auto space-y-8">
        
        {/* HEADER */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Maintenance Command</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">
            {stats.active} active issue{stats.active !== 1 ? 's' : ''}
            {stats.emergency > 0 && <span className="text-red-400"> · {stats.emergency} emergenc{stats.emergency === 1 ? 'y' : 'ies'}</span>}
          </h1>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues, suppliers, assets, work orders..."
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.01] pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-white/10 transition-all font-light"
          />
        </div>

        {/* QUICK ACTIONS */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'New Issue', icon: Plus, href: '/maintenance/new' },
            { label: 'Request Quotes', icon: FileText, href: '/maintenance/quotes' },
            { label: 'Schedule Service', icon: Calendar, href: '/maintenance/schedule' },
            { label: 'Preventative Plan', icon: Shield, href: '/maintenance/preventative' },
          ].map(action => (
            <Link key={action.label} href={action.href}
              className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all">
              <action.icon className="w-3.5 h-3.5" /> {action.label}
            </Link>
          ))}
        </div>

        {/* ATTENTION FEED */}
        {attention.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Needs Attention</p>
            <div className="space-y-2">
              {attention.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${item.type === 'emergency' ? 'bg-red-400 animate-pulse' : 'bg-amber-400'}`} />
                    <div>
                      <p className="text-sm text-white font-light">{item.issue.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.issue.priority} · reported {item.issue.created_at?.split('T')[0]}</p>
                    </div>
                  </div>
                  <button className="rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-gray-100">
                    {item.action}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KANBAN */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Pipeline</p>
          <div className="grid grid-cols-5 gap-3">
            {stages.map(stage => {
              const count = issues.filter(i => i.status === stage.key).length;
              return (
                <div key={stage.key} className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{stage.label}</p>
                  </div>
                  <p className="text-2xl font-light text-white">{count}</p>
                  {count > 0 && (
                    <div className="mt-3 space-y-1">
                      {issues.filter(i => i.status === stage.key).slice(0, 3).map(i => (
                        <p key={i.id} className="text-[11px] text-zinc-400 font-light truncate">{i.title}</p>
                      ))}
                      {count > 3 && <p className="text-[10px] text-zinc-600">+{count - 3} more</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Timeline */}
      <div className="w-72 border-l border-white/[0.06] p-6 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Live Activity</p>
        <div className="space-y-4">
          {issues.slice(0, 10).map((issue, i) => (
            <div key={i} className="border-l border-white/[0.06] pl-4">
              <p className="text-[11px] text-zinc-500">{issue.created_at ? new Date(issue.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              <p className="text-xs text-white font-light mt-0.5">{issue.title}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">{issue.status.replace('_', ' ')} · {issue.priority}</p>
            </div>
          ))}
          {issues.length === 0 && <p className="text-xs text-zinc-600">No activity yet.</p>}
        </div>
      </div>
    </div>
  );
}
