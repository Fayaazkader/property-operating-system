'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Zap, Clock, Shield, MapPin, Wrench, X, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function MaintenanceCommand() {
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<any[]>([]);
  const [selectedVisits, setSelectedVisits] = useState<any[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, emergency: 0, slaHealthy: 97, predictedSpend: 184000, waitingAssignment: 0, slaBreaches: 0, scheduledVisits: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('attention');

  const loadData = useCallback(async () => {
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
      .limit(200);

    const all = data || [];
    setIssues(all);

    const active = all.filter(i => !['resolved', 'closed'].includes(i.status)).length;
    const emergency = all.filter(i => i.priority === 'emergency' && !['resolved', 'closed'].includes(i.status)).length;
    const waitingAssignment = all.filter(i => i.status === 'reported').length;
    setStats({ active, emergency, slaHealthy: 97, predictedSpend: 184000, waitingAssignment, slaBreaches: 2, scheduledVisits: 14 });

    const feed: any[] = [];
    all.filter(i => i.priority === 'emergency' && i.status === 'reported').forEach(i => feed.push({ type: 'emergency', issue: i, context: `No supplier · ${minutesAgo(i.created_at)}min`, action: 'Assign' }));
    all.filter(i => i.status === 'classified').slice(0, 3).forEach(i => feed.push({ type: 'urgent', issue: i, context: 'Awaiting work order', action: 'Create WO' }));
    setAttention(feed.slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function selectIssue(issue: any) {
    setSelectedIssue(issue);
    const { data: wo } = await supabase.from('work_orders').select('*').eq('issue_id', issue.id);
    setSelectedWorkOrders(wo || []);
    if (wo?.length) {
      const woIds = wo.map((w: any) => w.id);
      const { data: visits } = await supabase.from('supplier_visits').select('*').in('work_order_id', woIds);
      setSelectedVisits(visits || []);
    } else {
      setSelectedVisits([]);
    }
  }

  function minutesAgo(date: string): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); (document.querySelector('[data-search]') as HTMLInputElement)?.focus(); }
      if (e.key === 'Escape') setSelectedIssue(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  const filteredIssues = issues.filter(i => {
    if (filter === 'attention') return !['resolved', 'closed'].includes(i.status);
    if (filter === 'emergency') return i.priority === 'emergency' && !['resolved', 'closed'].includes(i.status);
    if (filter === 'today') return i.created_at && new Date(i.created_at).toDateString() === new Date().toDateString();
    if (search) return i.title?.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const counts = {
    attention: issues.filter(i => !['resolved', 'closed'].includes(i.status)).length,
    emergency: issues.filter(i => i.priority === 'emergency' && !['resolved', 'closed'].includes(i.status)).length,
    today: issues.filter(i => i.created_at && new Date(i.created_at).toDateString() === new Date().toDateString()).length,
    all: issues.length,
  };

  return (
    <div className="flex h-full bg-black" style={{ height: 'calc(100vh - 4rem)' }}>
      
      {/* COLUMN 1: Inbox */}
      <div className="w-80 border-r border-white/[0.04] flex flex-col flex-shrink-0 h-full">
        <div className="px-4 py-4 border-b border-white/[0.04] space-y-3 flex-shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Maintenance</p>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-light tracking-[-0.02em] text-white">
                {stats.emergency > 0 ? `${stats.emergency} emergenc${stats.emergency === 1 ? 'y' : 'ies'}` : `${stats.active} active`}
              </h1>
              <Link href="/maintenance/new" className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-black hover:bg-gray-100">
                <Plus className="w-3 h-3" /> New
              </Link>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-600" />
            <input data-search type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anything... (⌘K)"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.01] pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-white/10 font-light" />
          </div>
          <div className="flex gap-1">
            {[
              { key: 'attention', label: 'Attention' }, { key: 'emergency', label: 'Emergency' },
              { key: 'today', label: 'Today' }, { key: 'all', label: 'All' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all ${filter === tab.key ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {tab.label} <span className="text-zinc-600 ml-0.5">{(counts as any)[tab.key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-600">No issues</div>
          ) : (
            filteredIssues.map(issue => (
              <button key={issue.id} onClick={() => selectIssue(issue)}
                className={`w-full text-left px-4 py-3 border-b border-white/[0.02] hover:bg-white/[0.01] transition-all ${
                  selectedIssue?.id === issue.id ? 'bg-white/[0.03] border-l-2 border-l-white' : ''
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${issue.priority === 'emergency' ? 'bg-red-400' : issue.priority === 'urgent' ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                  <span className="text-xs text-white font-light truncate">{issue.title}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 ml-3.5">{issue.category?.replace('_', ' ')} · {issue.created_at?.split('T')[0]}</p>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.04] px-4 py-2 flex gap-1 flex-shrink-0">
          <Link href="/maintenance/inbox" className="flex-1 text-center text-[10px] py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">Inbox</Link>
          <Link href="/maintenance/assets" className="flex-1 text-center text-[10px] py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">Assets</Link>
          <Link href="/maintenance/preventative" className="flex-1 text-center text-[10px] py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all">Plans</Link>
        </div>
      </div>

      {/* COLUMN 2: Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedIssue ? (
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedIssue.priority === 'emergency' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{selectedIssue.priority}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{selectedIssue.status.replace('_', ' ')}</span>
                </div>
                <h2 className="text-xl font-light tracking-[-0.02em] text-white">{selectedIssue.title}</h2>
                <p className="text-sm text-zinc-500 mt-1 font-light">{selectedIssue.description || 'No description'}</p>
              </div>
              <button onClick={() => setSelectedIssue(null)} className="text-zinc-600 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Operational Context */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">SLA</p>
                <p className="text-sm font-light text-emerald-400">38 min remaining</p>
              </div>
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">Supplier</p>
                <p className={`text-sm font-light ${selectedWorkOrders[0]?.supplier_id ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedWorkOrders[0]?.supplier_id ? 'Assigned' : 'Not assigned'}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">Property</p>
                <p className="text-sm font-light text-white">Block C</p>
              </div>
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">Responsibility</p>
                <p className="text-sm font-light text-white">{selectedIssue.landlord_responsibility ? 'Landlord' : 'Tenant'}</p>
              </div>
            </div>

            {/* Work Orders */}
            {selectedWorkOrders.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Work Orders</p>
                {selectedWorkOrders.map(wo => (
                  <div key={wo.id} className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 flex items-center justify-between">
                    <div><p className="text-sm text-white font-light">{wo.title}</p><p className="text-[11px] text-zinc-500 mt-0.5">Cost: R{wo.supplier_cost?.toLocaleString() || '0'}</p></div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${wo.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{wo.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              {!selectedWorkOrders.length && <button className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">Create Work Order</button>}
              <button className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">Request Quotes</button>
              <button className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white hover:border-white/20">Assign Supplier</button>
            </div>

            {/* AI Recommendations */}
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Recommendations</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-light">ABC Plumbing</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">97% match · ETA 34 min · SLA compliant</p>
                </div>
                <button className="rounded-full bg-white px-4 py-2 text-[11px] font-medium text-black hover:bg-gray-100">Assign</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8">
            {/* Operational Dashboard when nothing selected */}
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">Today's Operations</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02] p-4">
                    <p className="text-2xl font-light text-red-400">{stats.emergency}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-1">Emergencies</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4">
                    <p className="text-2xl font-light text-amber-400">{stats.waitingAssignment}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-1">Waiting Assignment</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                    <p className="text-2xl font-light text-white">{stats.scheduledVisits}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mt-1">Scheduled Visits</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Recommended Next Action</p>
                <p className="text-sm text-white font-light">Assign supplier to Water Leak at Building A</p>
                <button className="mt-3 rounded-full bg-white px-4 py-2 text-[11px] font-medium text-black hover:bg-gray-100">Take Action</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Predicted Spend</p>
                  <p className="text-xl font-light text-white">R{stats.predictedSpend.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">SLA Health</p>
                  <p className="text-xl font-light text-emerald-400">{stats.slaHealthy}%</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COLUMN 3: Timeline + AI */}
      {selectedIssue && (
        <div className="w-64 border-l border-white/[0.04] p-4 flex-shrink-0 overflow-y-auto h-full">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">Timeline</p>
          <div className="relative">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.04]" />
            <div className="space-y-4">
              <div className="relative pl-5">
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-amber-400" />
                <p className="text-[10px] text-zinc-600">{selectedIssue.created_at ? new Date(selectedIssue.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-white font-light mt-0.5">Reported</p>
                <p className="text-[10px] text-zinc-600">Via {selectedIssue.reported_via}</p>
              </div>
              <div className="relative pl-5">
                <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-blue-400" />
                <p className="text-[10px] text-zinc-600">{selectedIssue.updated_at ? new Date(selectedIssue.updated_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                <p className="text-xs text-white font-light mt-0.5">AI Classified</p>
                <p className="text-[10px] text-zinc-600">{selectedIssue.category?.replace('_', ' ')} · 96%</p>
              </div>
              {selectedVisits.map((v: any, i: number) => (
                <div key={i} className="relative pl-5">
                  <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-black bg-emerald-400" />
                  <p className="text-[10px] text-zinc-600">{v.scheduled_at ? new Date(v.scheduled_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  <p className="text-xs text-white font-light mt-0.5">{v.status.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Assistant Panel */}
          <div className="mt-8 pt-6 border-t border-white/[0.04] space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Assistant</p>
            <div className="space-y-2 text-[11px] font-light">
              <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" /><span className="text-zinc-400">Diagnosis: <span className="text-white">Burst isolation valve</span></span></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" /><span className="text-zinc-400">Confidence: <span className="text-white">96%</span></span></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" /><span className="text-zinc-400">Est. cost: <span className="text-white">R2,400</span></span></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" /><span className="text-zinc-400">Approval: <span className="text-white">Not required</span></span></div>
              <div className="flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" /><span className="text-zinc-400">Risk: <span className="text-white">Low</span></span></div>
            </div>
            <button className="w-full rounded-full bg-white py-2 text-[11px] font-medium text-black hover:bg-gray-100 mt-2">Assign Supplier</button>
          </div>
        </div>
      )}
    </div>
  );
}
