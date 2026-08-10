// lib/intelligence/operational-context.ts
// Operational Context — One call gives every workspace AI, signals, timeline, actions

import { getDomainSignals } from './signal-registry';
import { recommendationEngine } from './recommendation-engine';
import { supabase } from '@/lib/supabase';
import type { IntelligenceSignal, Recommendation } from './types';

export interface SuggestedAction {
  label: string;
  action: string;
  priority: number;
}

export interface OperationalContext {
  entityId: string;
  domain: string;
  health: 'green' | 'amber' | 'red';
  signals: IntelligenceSignal[];
  recommendation: Recommendation | null;
  actions: SuggestedAction[];
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
  relatedObjects: {
    maintenance?: any[];
    inspections?: any[];
    leases?: any[];
    suppliers?: any[];
    invoices?: any[];
  };
}

export async function getOperationalContext(
  domain: string,
  entityId: string,
  entityType?: string
): Promise<OperationalContext> {

  // 1. Get signals for this entity
  const domainSignals = await getDomainSignals(domain as any);
  const relevantSignals = domainSignals.filter(s => 
    s.affected_entity_id === entityId || s.affected_entity_type === entityType
  );

  // 2. Get recommendation
  const recs = await recommendationEngine.generate();
  const recommendation = recs.find(r => 
    r.signals.some(sid => relevantSignals.some(ds => ds.id === sid))
  ) || null;

  // 3. Determine health
  const activeCount = relevantSignals.filter(s => s.status === 'active').length;
  const criticalCount = relevantSignals.filter(s => s.severity === 'critical' || s.severity === 'high').length;
  const health = criticalCount > 0 ? 'red' : activeCount > 0 ? 'amber' : 'green';

  // 4. Build actions from recommendation
  const actions: SuggestedAction[] = recommendation ? [{
    label: recommendation.title,
    action: recommendation.action,
    priority: recommendation.priority,
  }] : [];

  // 5. Build timeline from signals
  const timeline = relevantSignals
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(s => ({
      timestamp: s.created_at,
      event: s.source_event?.replace(/_/g, ' ') || 'Signal',
      detail: s.title,
    }));

  // 6. Get related objects
  const relatedObjects: any = {};
  
  try {
    const { data: maint } = await supabase.from('maintenance_issues').select('id, title').eq('property_id', entityId).limit(3);
    if (maint?.length) relatedObjects.maintenance = maint;
  } catch {}

  try {
    const { data: insp } = await supabase.from('inspections').select('id, title').eq('property_id', entityId).limit(3);
    if (insp?.length) relatedObjects.inspections = insp;
  } catch {}

  return {
    entityId,
    domain,
    health,
    signals: relevantSignals,
    recommendation,
    actions,
    timeline,
    relatedObjects,
  };
}
