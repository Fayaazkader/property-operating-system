// lib/workflow/services/operational-journal.ts
// Records every governed workflow action for audit trail

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export interface JournalEntry {
  entity_id: string;
  reference_type: string;
  reference_id: string;
  event_type: string;
  description: string;
  actor_id?: string;
  metadata?: Record<string, any>;
}

export class OperationalJournal {
  async log(entry: JournalEntry): Promise<void> {
    await supabase.from('financial_timeline').insert({
      id: crypto.randomUUID(),
      entity_id: entry.entity_id,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      event_type: entry.event_type,
      description: entry.description,
      actor_id: entry.actor_id,
      source_engine: 'operational-journal',
      metadata: entry.metadata || {},
      created_at: new Date().toISOString(),
    });

    await publish('workflow.journal.entry', {
      correlationId: crypto.randomUUID(),
      source: 'operational-journal',
      version: '1.0',
      payload: entry,
    });
  }
}

export const operationalJournal = new OperationalJournal();
