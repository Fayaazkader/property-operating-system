import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export class SLAEngine {
  async getSLA(entityId: string, priority: string) {
    const { data } = await supabase
      .from('maintenance_slas')
      .select('*')
      .eq('entity_id', entityId)
      .eq('priority', priority)
      .single();
    return data;
  }

  async checkSLA(issueId: string, entityId: string, priority: string, reportedAt: string): Promise<void> {
    const sla = await this.getSLA(entityId, priority);
    if (!sla) return;
    const reported = new Date(reportedAt);
    const responseDeadline = new Date(reported.getTime() + sla.response_hours * 3600000);
    const now = new Date();
    if (now > responseDeadline) {
      await publish('maintenance.sla.breached', {
        correlationId: crypto.randomUUID(), source: 'sla-engine', version: '1.0',
        payload: { issueId, sla_type: 'response', deadline: responseDeadline.toISOString(), priority },
      });
    }
  }
}

export const slaEngine = new SLAEngine();
