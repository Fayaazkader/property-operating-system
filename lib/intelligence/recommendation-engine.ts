// lib/intelligence/recommendation-engine.ts
// Recommendation Engine — Ranks actions from signals

import { getAllSignals } from './signal-registry';
import type { IntelligenceSignal, Recommendation } from './types';

export class RecommendationEngine {

  generate(): Recommendation[] {
    const signals = getAllSignals();
    const recommendations: Recommendation[] = [];

    // Group signals by domain and severity
    const actionable = signals.filter(s => s.action && s.severity !== 'low');
    
    for (const signal of actionable) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: signal.severity === 'critical' ? 1 : signal.severity === 'high' ? 2 : 3,
        title: signal.recommendation || signal.title,
        reasoning: [signal.explanation],
        confidence: signal.severity === 'critical' ? 98 : signal.severity === 'high' ? 90 : 75,
        action: signal.action || 'Review',
        domain: signal.domain,
        signals: [signal.id],
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  getTopRecommendation(): Recommendation | null {
    const all = this.generate();
    return all[0] || null;
  }
}

export const recommendationEngine = new RecommendationEngine();
