'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
      setLogs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-8 max-w-4xl">
      <div><h1 className="text-2xl font-light tracking-[-0.02em] text-white">Audit Log</h1><p className="text-sm text-zinc-500 mt-1">Complete record of all platform activity.</p></div>
      {loading ? <p className="text-sm text-zinc-500">Loading...</p> : logs.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center"><p className="text-sm text-zinc-500">No audit entries yet.</p></div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06] bg-white/[0.02]"><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Action</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Resource</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">User</th><th className="text-left py-3 px-4 text-[11px] font-medium text-zinc-500 uppercase">Date</th></tr></thead>
            <tbody>{logs.map(l => (<tr key={l.id} className="border-b border-white/[0.03]"><td className="py-2.5 px-4 text-white font-light text-xs">{l.action}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{l.resource_type}</td><td className="py-2.5 px-4 text-zinc-400 text-xs">{l.actor_email || 'System'}</td><td className="py-2.5 px-4 text-zinc-500 text-xs">{l.created_at?.split('T')[0]}</td></tr>))}</tbody></table>
        </div>
      )}
    </div>
  );
}
