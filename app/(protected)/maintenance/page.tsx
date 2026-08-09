'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Wrench, Clock, CheckCircle, AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';

export default function MaintenanceWorkspace() {
  const [issues, setIssues] = useState<any[]>([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: entities } = await supabase.rpc('auth_entities');
      if (!entities?.length) { setLoading(false); return; }
      const entityId = entities[0];

      const { data } = await supabase
        .from('maintenance_issues')
        .select('*, work_orders(*)')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);

      setIssues(data || []);

      const open = (data || []).filter(i => i.status === 'reported' || i.status === 'classified').length;
      const inProgress = (data || []).filter(i => i.status === 'in_progress').length;
      const completed = (data || []).filter(i => i.status === 'resolved' || i.status === 'closed').length;
      setStats({ open, inProgress, completed, overdue: 0 });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-20 text-zinc-500 text-center">Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Maintenance</p>
          <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Workspace</h1>
        </div>
        <Link href="/maintenance/new" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-gray-100">
          <Plus className="w-3.5 h-3.5" /> New Issue
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Open', value: stats.open, icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Overdue', value: stats.overdue, icon: Wrench, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{s.label}</p>
            </div>
            <p className={`text-2xl font-light ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.05] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Issue</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Property</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Priority</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Status</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Reported</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-zinc-500">No maintenance issues yet.</td></tr>
            ) : (
              issues.map(issue => (
                <tr key={issue.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] cursor-pointer">
                  <td className="py-2.5 px-4 text-white font-light text-xs">{issue.title}</td>
                  <td className="py-2.5 px-4 text-zinc-400 text-xs">{issue.property_id ? 'Property' : '-'}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      issue.priority === 'emergency' ? 'bg-red-500/10 text-red-400' :
                      issue.priority === 'urgent' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>{issue.priority}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      issue.status === 'reported' ? 'bg-amber-500/10 text-amber-400' :
                      issue.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                      issue.status === 'resolved' || issue.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>{issue.status.replace('_', ' ')}</span>
                  </td>
                  <td className="py-2.5 px-4 text-zinc-500 text-xs">{issue.created_at?.split('T')[0]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
