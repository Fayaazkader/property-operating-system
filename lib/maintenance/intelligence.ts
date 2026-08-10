// lib/maintenance/intelligence.ts
// Maintenance domain intelligence — publishes signals for Portfolio Intelligence

import { supabase } from '@/lib/supabase';
import { publishSignal } from '@/lib/intelligence/signal-registry';
import type { IntelligenceSignal } from '@/lib/intelligence/types';

export class MaintenanceIntelligence {
  
  async analyze(entityId: string): Promise<void> {
    // Emergency issues
    const { data: emergencies } = await supabase
      .from('maintenance_issues')
      .select('id, title, status')
      .eq('entity_id', entityId)
      .eq('priority', 'emergency')
      .in('status', ['reported', 'classified']);

    for (const e of (emergencies || [])) {
      publishSignal({
        id: crypto.randomUUID(),
        domain: 'maintenance',
        category: 'risk',
        severity: 'high',
        score: 30,
        title: `Emergency: ${e.title}`,
        explanation: `Emergency maintenance issue requires immediate attention. Currently ${e.status}.`,
        recommendation: 'Assign supplier immediately',
        action: 'Assign Supplier',
        affected_entity_id: e.id,
        affected_entity_type: 'maintenance_issue',
        source_event: 'maintenance.emergency.detected',
        created_at: new Date().toISOString(),
      });
    }

    // Overdue work orders
    const { data: overdue } = await supabase
      .from('work_orders')
      .select('id, title, status')
      .eq('entity_id', entityId)
      .in('status', ['pending', 'assigned'])
      .lt('scheduled_date', new Date().toISOString().split('T')[0]);

    for (const wo of (overdue || [])) {
      publishSignal({
        id: crypto.randomUUID(),
        domain: 'maintenance',
        category: 'risk',
        severity: 'medium',
        score: 15,
        title: `Overdue: ${wo.title}`,
        explanation: 'Work order has exceeded its scheduled date without completion.',
        recommendation: 'Follow up with assigned supplier',
        affected_entity_id: wo.id,
        affected_entity_type: 'work_order',
        source_event: 'maintenance.work_order.overdue',
        created_at: new Date().toISOString(),
      });
    }

    // Quotes awaiting approval
    const { data: quotes } = await supabase
      .from('maintenance_quotes')
      .select('id')
      .eq('entity_id', entityId)
      .eq('status', 'pending');

    if (quotes && quotes.length > 0) {
      publishSignal({
        id: crypto.randomUUID(),
        domain: 'maintenance',
        category: 'status',
        severity: 'low',
        score: 5,
        title: `${quotes.length} quote${quotes.length > 1 ? 's' : ''} awaiting approval`,
        explanation: 'Maintenance quotes require review and approval before work orders can be created.',
        recommendation: 'Review and approve pending quotes',
        affected_entity_type: 'maintenance_quote',
        source_event: 'maintenance.quotes.pending',
        created_at: new Date().toISOString(),
      });
    }
  }
}

export const maintenanceIntelligence = new MaintenanceIntelligence();
