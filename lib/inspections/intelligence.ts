// lib/inspections/intelligence.ts
// Inspections domain intelligence

import { supabase } from '@/lib/supabase';
import { publishSignal } from '@/lib/intelligence/signal-registry';

export class InspectionsIntelligence {
  
  async analyze(entityId: string): Promise<void> {
    // Critical findings
    const { data: critical } = await supabase
      .from('inspections')
      .select('id, title')
      .eq('entity_id', entityId)
      .in('severity', ['critical', 'high'])
      .gte('completed_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);

    for (const c of (critical || [])) {
      publishSignal({
        id: crypto.randomUUID(),
        domain: 'inspections',
        category: 'risk',
        severity: 'high',
        score: 25,
        title: `Critical finding: ${c.title}`,
        explanation: 'High-severity inspection finding requires follow-up action.',
        recommendation: 'Create maintenance issue from finding',
        action: 'Create Work Order',
        affected_entity_id: c.id,
        affected_entity_type: 'inspection',
        source_event: 'inspection.critical.finding',
        created_at: new Date().toISOString(),
      });
    }

    // Overdue inspections
    const { data: overdue } = await supabase
      .from('inspections')
      .select('id, title')
      .eq('entity_id', entityId)
      .eq('status', 'scheduled')
      .lt('scheduled_date', new Date().toISOString().split('T')[0]);

    for (const o of (overdue || [])) {
      publishSignal({
        id: crypto.randomUUID(),
        domain: 'inspections',
        category: 'risk',
        severity: 'medium',
        score: 20,
        title: `Overdue: ${o.title}`,
        explanation: 'Scheduled inspection has not been completed.',
        recommendation: 'Complete or reschedule inspection',
        affected_entity_id: o.id,
        affected_entity_type: 'inspection',
        source_event: 'inspection.overdue',
        created_at: new Date().toISOString(),
      });
    }
  }
}

export const inspectionsIntelligence = new InspectionsIntelligence();
