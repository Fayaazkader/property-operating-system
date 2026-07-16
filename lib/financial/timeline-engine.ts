// lib/financial/timeline-engine.ts
// Financial Timeline Engine — Every financial object has a timeline

import { supabase } from '@/lib/supabase';
import type { FinancialTimelineEntry } from './types';

export class FinancialTimelineEngine {
  async addEntry(params: {
    entity_id: string; reference_type: string; reference_id: string;
    event_type: string; description?: string; actor_id?: string;
    correlation_id?: string; event_id?: string; source_engine?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await supabase.from('financial_timeline').insert({
      id: crypto.randomUUID(), entity_id: params.entity_id,
      reference_type: params.reference_type, reference_id: params.reference_id,
      event_type: params.event_type, description: params.description,
      actor_id: params.actor_id, correlation_id: params.correlation_id,
      event_id: params.event_id, source_engine: params.source_engine || 'financial',
      metadata: params.metadata || {}, created_at: new Date().toISOString(),
    });
  }

  async getTimeline(entityId: string, referenceType: string, referenceId: string): Promise<FinancialTimelineEntry[]> {
    const { data } = await supabase.from('financial_timeline').select('*').eq('entity_id', entityId).eq('reference_type', referenceType).eq('reference_id', referenceId).order('created_at', { ascending: false }).limit(50);
    return (data || []) as FinancialTimelineEntry[];
  }

  async recordJournalLifecycle(journalId: string, entityId: string, event: string, actorId?: string, correlationId?: string): Promise<void> {
    await this.addEntry({
      entity_id: entityId, reference_type: 'journal', reference_id: journalId,
      event_type: event, actor_id: actorId, correlation_id: correlationId,
      source_engine: 'posting-engine',
      description: `Journal ${event.replace(/_/g, ' ')}`,
    });
  }
}

export const financialTimelineEngine = new FinancialTimelineEngine();
