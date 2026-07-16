// lib/financial/reversal-engine.ts
// Reversal Engine — Never delete, only reverse with full audit

import { supabase } from '@/lib/supabase';
import { postingEngine } from './posting-engine';
import { financialTimelineEngine } from './timeline-engine';
import type { FinancialEvent, ReversalResult } from './types';

export class ReversalEngine {
  async reverseJournal(originalJournalId: string, reason: string, requestedBy: string): Promise<ReversalResult> {
    const { data: original } = await supabase.from('journals').select('*').eq('id', originalJournalId).single();
    if (!original) throw new Error('Original journal not found');
    if (!original.is_posted) throw new Error('Cannot reverse an unposted journal');

    const correlationId = crypto.randomUUID();

    const reversalEvent: FinancialEvent = {
      source_engine: 'financial',
      business_event: 'journal_reversal',
      entity_id: original.entity_id,
      amount: 0,
      description: `Reversal of ${original.journal_number}: ${reason}`,
      period_id: original.period_id,
      occurred_at: new Date().toISOString(),
      effective_date: new Date().toISOString().split('T')[0],
      correlation_id: correlationId,
      dimensions: {},
      metadata: {
        original_journal_id: originalJournalId,
        reversal_reason: reason,
        created_by: requestedBy,
        source_id: `REV-${originalJournalId}`,
      },
    };

    const result = await postingEngine.post(reversalEvent);

    await financialTimelineEngine.addEntry({
      entity_id: original.entity_id,
      reference_type: 'journal', reference_id: originalJournalId,
      event_type: 'reversed', actor_id: requestedBy,
      correlation_id: correlationId, source_engine: 'reversal-engine',
      description: `Reversed: ${reason}`,
      metadata: { reversal_journal_id: result.journal.id },
    });

    return {
      original_journal_id: originalJournalId,
      reversal_journal: result.journal,
      explanation: result.explanation,
    };
  }
}

export const reversalEngine = new ReversalEngine();
