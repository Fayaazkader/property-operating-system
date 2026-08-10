// lib/intelligence/operational-context.ts
// Operational Context — Orchestrates domain providers. Never queries tables directly.

import { getDomainSignals } from './signal-registry';
import { recommendationEngine } from './recommendation-engine';
import { getRelatedObjects } from './relationship-provider';
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
  relationships: Record<string, Array<{ id: string; type: string; title: string; href: string; status?: string }>>;
}

export async function getOperationalContext(
  domain: string,
  entityId: string
): Promise<OperationalContext> {

  // 1. Get signals from signal registry
  const domainSignals = await getDomainSignals(domain as any);
  const relevantSignals = domainSignals.filter(s => s.affected_entity_id === entityId);

  // 2. Get recommendation from recommendation engine
  const recs = await recommendationEngine.generate();
  const recommendation = recs.find(r => 
    r.signals.some(sid => relevantSignals.some(ds => ds.id === sid))
  ) || null;

  // 3. Determine health from signals
  const criticalCount = relevantSignals.filter(s => s.severity === 'critical' || s.severity === 'high').length;
  const health = criticalCount > 0 ? 'red' : relevantSignals.length > 0 ? 'amber' : 'green';

  // 4. Build actions from recommendation
  const actions: SuggestedAction[] = recommendation ? [{
    label: recommendation.title,
    action: recommendation.action,
    priority: recommendation.priority,
  }] : [];

  // 5. Timeline from signals only — timeline is separate from activity feed
  const timeline = relevantSignals
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map(s => ({
      timestamp: s.created_at,
      event: s.source_event?.replace(/_/g, ' ') || 'Signal',
      detail: s.title,
    }));

  // 6. Get related objects from relationship provider
  const relationships = await getRelatedObjects(entityId);

  return {
    entityId,
    domain,
    health,
    signals: relevantSignals,
    recommendation,
    actions,
    timeline,
    relationships,
  };
}
