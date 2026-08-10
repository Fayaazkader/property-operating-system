'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Filter, AlertTriangle, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function MaintenanceInbox() {
  const [issues, setIssues] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }

      const { data } = await supabase
        .from('maintenance_issues')
        .select('*')
        .eq('entity_id', entities[0])
        .order('created_at', { ascending: false })
        .limit(200);

      setIssues(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = issues.filter(i => {
    if (filter === 'attention') return !['resolved', 'closed'].includes(i.status);
    if (filter === 'emergency') return i.priority === 'emergency';
    if (filter === 'today') return i.created_at && new Date(i.created_at).toDateString() === new Date().toDateString();
    if (search) return i.title?.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const counts = {
    all: issues.length,
    attention: issues.filter(i => !['resolved', 'closed'].includes(i.status)).length,
    emergency: issues.filter(i => i.priority === 'emergency' && !['resolved', 'closed'].includes(i.status)).length,
    today: issues.filter(i => i.created_at && new Date(i.created_at).toDateString() === new Date().toDateString()).length,
  };

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="flex h-full">
      {/* Left: Filter Bar */}
      <div className="w-48 border-r border-white/[0.04] p-4 flex-shrink-0 space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-3 px-2">Views</p>
        {[
          { key: 'all', label: 'All Issues' },
          { key: 'attention', label: 'Needs Attention' },
          { key: 'emergency', label: 'Emergency' },
          { key: 'today', label: 'Today' },
        ].map(item => (
          <button key={item.key} onClick={() => setFilter(item.key)}
            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
              filter === item.key ? 'bg-white/[0.06] text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}>
            {item.label}
            <span className="text-[10px] text-zinc-600">{(counts as any)[item.key]}</span>
          </button>
        ))}
      </div>

      {/* Center: Inbox List */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 bg-black z-10 px-6 py-3 border-b border-white/[0.04]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-600" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter issues..."
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.01] pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-white/10 font-light" />
          </div>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No issues found.</div>
          ) : (
            filtered.map(issue => (
              <Link key={issue.id} href={`/maintenance/${issue.id}`}
                className="flex items-center gap-4 px-6 py-3 hover:bg-white/[0.01] transition-all cursor-pointer group">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  issue.priority === 'emergency' ? 'bg-red-400' : issue.priority === 'urgent' ? 'bg-amber-400' : 'bg-zinc-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-light truncate">{issue.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {issue.category?.replace('_', ' ')} · {issue.priority} · {issue.created_at?.split('T')[0]}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                  issue.status === 'reported' ? 'bg-amber-500/10 text-amber-400' :
                  issue.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                  issue.status === 'resolved' || issue.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                }`}>{issue.status.replace('_', ' ')}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-all" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
