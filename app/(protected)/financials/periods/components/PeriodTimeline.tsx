'use client';

import { useState, useEffect } from 'react';
import { financialTimelineEngine } from '@/lib/financial/timeline-engine';
import type { FinancialTimelineEntry } from '@/lib/financial/types';

interface Props { periodName: string; entityId: string; }

export function PeriodTimeline({ periodName, entityId }: Props) {
  const [events, setEvents] = useState<FinancialTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!periodName || !entityId) { setLoading(false); return; }
      const data = await financialTimelineEngine.getTimeline(entityId, 'statement_period', periodName);
      setEvents(data || []);
      setLoading(false);
    }
    load();
  }, [periodName, entityId]);

  if (loading) return <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6"><div className="animate-pulse h-20 bg-zinc-800 rounded" /></div>;
  if (!events.length) return <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6"><p className="text-sm text-[var(--text-muted)]">No events recorded for this period.</p></div>;

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] mb-4">Period Timeline</p>
      <div className="space-y-3">
        {events.map(e => (
          <div key={e.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">{e.description}</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(e.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
