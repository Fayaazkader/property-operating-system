// lib/procurement/signal-publisher.ts
import { publishSignal } from '@/lib/intelligence/signal-registry';
import { supabase } from '@/lib/supabase';

export async function publishProcurementSignals(entityId: string): Promise<void> {
  const { data: pending } = await supabase.from('procurement_spend_requests').select('id, title, estimated_amount').eq('entity_id', entityId).eq('status', 'submitted');
  for (const sr of (pending || [])) {
    publishSignal({
      id: crypto.randomUUID(), domain: 'procurement', category: 'status',
      severity: 'medium', score: 10, title: `Spend request awaiting approval: ${sr.title}`,
      explanation: `Spend request for R${(sr.estimated_amount || 0).toLocaleString()} requires approval.`,
      recommendation: 'Review and approve spend request',
      action: 'Approve', affected_entity_id: sr.id, affected_entity_type: 'spend_request',
      source_event: 'procurement.spend_request.pending', created_at: new Date().toISOString(),
    });
  }
}
