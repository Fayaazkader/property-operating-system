// lib/intelligence/recommendation-engine.ts
// Recommendation Engine — Groups by operational context, evidence-based confidence

import { getAllSignals } from './signal-registry';
import type { IntelligenceSignal, Recommendation } from './types';

export class RecommendationEngine {

  async generate(): Promise<Recommendation[]> {
    const signals = await getAllSignals();
    const recommendations: Recommendation[] = [];

    // Group by affected_entity_id for operational context
    const groups = new Map<string, IntelligenceSignal[]>();
    for (const signal of signals) {
      const key = signal.affected_entity_id || `${signal.domain}:general`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(signal);
    }

    for (const [, groupSignals] of groups) {
      // Confidence from evidence: number of signals, freshness, severity spread
      const evidenceCount = groupSignals.length;
      const freshCount = groupSignals.filter(s => 
        new Date(s.created_at).getTime() > Date.now() - 86400000
      ).length;
      const severityScore = groupSignals.reduce((s, sig) => 
        s + (sig.severity === 'critical' ? 4 : sig.severity === 'high' ? 3 : sig.severity === 'medium' ? 2 : 1), 0
      );
      
      const confidence = Math.min(98, 
        50 + (evidenceCount * 8) + (freshCount * 5) + (severityScore * 3)
      );

      const highestSeverity = groupSignals.reduce((max, s) => 
        s.severity === 'critical' ? 'critical' : 
        s.severity === 'high' && max !== 'critical' ? 'high' : 
        s.severity === 'medium' && max !== 'critical' && max !== 'high' ? 'medium' : max, 'low' as string);
      const priority = highestSeverity === 'critical' ? 1 : highestSeverity === 'high' ? 2 : highestSeverity === 'medium' ? 3 : 4;

      const primarySignal = groupSignals.sort((a, b) => b.score - a.score)[0];

      recommendations.push({
        id: crypto.randomUUID(),
        priority,
        title: primarySignal.recommendation || primarySignal.title,
        reasoning: groupSignals.map(s => s.explanation),
        confidence,
        action: primarySignal.action || 'Review',
        domain: primarySignal.domain,
        signals: groupSignals.map(s => s.id),
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  async getTopRecommendation(): Promise<Recommendation | null> {
    const all = await this.generate();
    return all[0] || null;
  }
}

export const recommendationEngine = new RecommendationEngine();
