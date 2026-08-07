// lib/revenue-command/timeline-engine.ts
// Revenue Timeline — Event projection, no direct queries

import { supabase } from '@/lib/supabase';

export interface TimelineEvent {
  timestamp: string;
  event: string;
  detail: string;
  status: 'completed' | 'pending' | 'warning' | 'missed';
}

export class RevenueTimelineEngine {
  async getLeaseTimeline(leaseId: string, periodStart: string, periodEnd: string): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    const { data: ledgerEntries } = await supabase
      .from('sub_ledger_entries')
      .select('*')
      .eq('tenant_id', leaseId)
      .gte('posted_at', periodStart)
      .lte('posted_at', periodEnd)
      .order('posted_at', { ascending: true });

    for (const entry of (ledgerEntries || [])) {
      if (entry.debit_amount > 0) {
        events.push({ timestamp: entry.posted_at, event: 'Invoice Generated', detail: `R${entry.debit_amount.toLocaleString()}`, status: 'completed' });
      }
      if (entry.credit_amount > 0) {
        events.push({ timestamp: entry.posted_at, event: 'Payment Received', detail: `R${entry.credit_amount.toLocaleString()}`, status: 'completed' });
      }
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}

export const revenueTimelineEngine = new RevenueTimelineEngine();
