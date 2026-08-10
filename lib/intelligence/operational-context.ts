// lib/intelligence/operational-context.ts
// Operational Context — Orchestrates domain providers

import { getDomainSignals } from './signal-registry';
import { recommendationEngine } from './recommendation-engine';
import { getRelatedObjects } from './relationship-provider';
import { getTimeline } from './timeline-provider';

export interface SuggestedAction {
  label: string; action: string; priority: number;
}

export interface OperationalContext {
  entityId: string; domain: string;
  health: 'green' | 'amber' | 'red';
  signals: any[];
  recommendation: any | null;
  actions: SuggestedAction[];
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
  relationships: Record<string, Array<{ id: string; type: string; title: string; href: string; status?: string }>>;
}

export async function getOperationalContext(domain: string, entityId: string): Promise<OperationalContext> {
  const domainSignals = await getDomainSignals(domain as any);
  const relevantSignals = domainSignals.filter(s => s.affected_entity_id === entityId);

  const recs = await recommendationEngine.generate();
  const recommendation = recs.find(r => r.signals.some((sid: string) => relevantSignals.some(ds => ds.id === sid))) || null;

  const criticalCount = relevantSignals.filter(s => s.severity === 'critical' || s.severity === 'high').length;
  const health = criticalCount > 0 ? 'red' : relevantSignals.length > 0 ? 'amber' : 'green';

  const actions: SuggestedAction[] = recommendation ? [{ label: recommendation.title, action: recommendation.action, priority: recommendation.priority }] : [];

  // Timeline from activity_feed, not signals
  const timeline = await getTimeline(entityId);

  // Relationships — only resolve what this domain needs
  const relationships = await getRelatedObjects(entityId, domain);

  return { entityId, domain, health, signals: relevantSignals, recommendation, actions, timeline, relationships };
}
