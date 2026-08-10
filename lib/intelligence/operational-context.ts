// lib/intelligence/operational-context.ts
// Operational Context — Discovers modules via manifests

import { getDomainSignals } from './signal-registry';
import { recommendationEngine } from './recommendation-engine';
import { getTimeline } from './timeline-provider';
import { resolveRelationships } from './module-manifest';

export interface SuggestedAction { label: string; action: string; priority: number; }

export interface OperationalContext {
  entityId: string; domain: string; health: 'green' | 'amber' | 'red';
  signals: any[]; recommendation: any | null; actions: SuggestedAction[];
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
  relationships: Record<string, any[]>;
}

export async function getOperationalContext(domain: string, entityId: string): Promise<OperationalContext> {
  const signals = await getDomainSignals(domain as any);
  const relevant = signals.filter(s => s.affected_entity_id === entityId);
  
  const recs = await recommendationEngine.generate();
  const recommendation = recs.find(r => r.signals.some((sid: string) => relevant.some(ds => ds.id === sid))) || null;
  
  const critical = relevant.filter(s => s.severity === 'critical' || s.severity === 'high').length;
  const health = critical > 0 ? 'red' : relevant.length > 0 ? 'amber' : 'green';
  
  const actions: SuggestedAction[] = recommendation ? [{ label: recommendation.title, action: recommendation.action, priority: recommendation.priority }] : [];
  const timeline = await getTimeline(entityId);
  
  // Resolve relationships via manifest — Operational Context doesn't know about resolvers
  const relPromises = resolveRelationships(entityId, domain);
  const relationships: Record<string, any[]> = {};
  for (const [key, promise] of Object.entries(relPromises)) {
    relationships[key] = await promise;
  }

  return { entityId, domain, health, signals: relevant, recommendation, actions, timeline, relationships };
}
