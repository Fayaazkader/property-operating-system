// lib/platform/policies/sla.engine.ts
// SLA Engine — Policy-driven SLA management

export interface SLAPolicy {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  response_hours: number;
  completion_hours: number;
  escalation_hours?: number;
  escalation_contact?: string;
}

export interface EntityPolicy {
  entity_id: string;
  policies: SLAPolicy[];
}

export class SLAEngine {
  private defaultPolicies: SLAPolicy[] = [
    { id: 'sla.emergency', name: 'Emergency', priority: 'emergency', response_hours: 0.25, completion_hours: 4 },
    { id: 'sla.high', name: 'High Priority', priority: 'high', response_hours: 2, completion_hours: 24 },
    { id: 'sla.medium', name: 'Medium Priority', priority: 'medium', response_hours: 8, completion_hours: 72 },
    { id: 'sla.low', name: 'Low Priority', priority: 'low', response_hours: 48, completion_hours: 168 },
  ];

  private entityPolicies: Map<string, EntityPolicy> = new Map();

  getPolicy(priority: 'low' | 'medium' | 'high' | 'emergency', entityId?: string): SLAPolicy {
    if (entityId && this.entityPolicies.has(entityId)) {
      const entityPolicy = this.entityPolicies.get(entityId)!;
      const custom = entityPolicy.policies.find(p => p.priority === priority);
      if (custom) return custom;
    }
    return this.defaultPolicies.find(p => p.priority === priority)!;
  }

  setEntityPolicy(entityId: string, policies: SLAPolicy[]): void {
    this.entityPolicies.set(entityId, { entity_id: entityId, policies });
  }

  calculateResponseDeadline(priority: 'low' | 'medium' | 'high' | 'emergency', entityId?: string): Date {
    const policy = this.getPolicy(priority, entityId);
    const now = new Date();
    now.setHours(now.getHours() + policy.response_hours);
    return now;
  }

  calculateCompletionDeadline(priority: 'low' | 'medium' | 'high' | 'emergency', entityId?: string): Date {
    const policy = this.getPolicy(priority, entityId);
    const now = new Date();
    now.setHours(now.getHours() + policy.completion_hours);
    return now;
  }

  isSLAViolated(createdAt: string, priority: 'low' | 'medium' | 'high' | 'emergency', entityId?: string): boolean {
    const deadline = this.calculateResponseDeadline(priority, entityId);
    const now = new Date();
    const created = new Date(createdAt);
    const deadlineTime = new Date(created.getTime() + (deadline.getTime() - new Date().getTime()));
    return now > deadlineTime;
  }

  getSLAStatus(createdAt: string, priority: 'low' | 'medium' | 'high' | 'emergency', entityId?: string): {
    status: 'within_sla' | 'approaching' | 'breached';
    remaining_hours: number;
  } {
    const policy = this.getPolicy(priority, entityId);
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + (policy.response_hours * 60 * 60 * 1000));
    const now = new Date();
    const remaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (remaining < 0) {
      return { status: 'breached', remaining_hours: 0 };
    } else if (remaining < 2) {
      return { status: 'approaching', remaining_hours: remaining };
    } else {
      return { status: 'within_sla', remaining_hours: remaining };
    }
  }
}

export const slaEngine = new SLAEngine();
