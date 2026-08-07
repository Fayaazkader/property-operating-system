// lib/revenue-command/explainability-engine.ts
// Explainability Engine — Generic score explanation, not just revenue

export class ExplainabilityEngine {
  explain(score: any): string[] {
    const reasons: string[] = [];
    if (score.overall_score >= 90) reasons.push('Excellent standing');
    else if (score.overall_score >= 70) reasons.push('Good standing');
    else if (score.overall_score < 50) reasons.push('Requires attention');
    if (score.trend === 'declining') reasons.push('Trend is declining');
    if (score.trend === 'improving') reasons.push('Trend is improving');
    return reasons;
  }
}

export const explainabilityEngine = new ExplainabilityEngine();
