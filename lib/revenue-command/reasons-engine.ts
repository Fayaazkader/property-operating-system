// lib/revenue-command/reasons-engine.ts
// Revenue Reasons — Explains every score with plain-language factors

import type { RevenueAssuranceScore } from './types';

export class RevenueReasonsEngine {

  explain(score: RevenueAssuranceScore): string[] {
    const reasons: string[] = [];

    // Payment reliability
    if (score.payment_reliability >= 90) {
      reasons.push('✓ Payment history is excellent');
    } else if (score.payment_reliability >= 70) {
      reasons.push('○ Payment history is acceptable');
    } else if (score.payment_reliability < 50) {
      reasons.push('✗ Payment history is poor');
    }

    // Behaviour signals
    if (score.behaviour_stability >= 80) {
      reasons.push('✓ Tenant behaviour is consistent');
    } else if (score.behaviour_stability < 50) {
      reasons.push('⚠ Tenant behaviour is changing');
    }

    // Communication
    if (score.communication_score >= 80) {
      reasons.push('✓ Tenant responds to communications');
    } else if (score.communication_score < 40) {
      reasons.push('✗ Tenant rarely responds');
    }

    // Financial health
    if (score.financial_health >= 80) {
      reasons.push('✓ No financial stress indicators');
    } else if (score.financial_health < 50) {
      reasons.push('⚠ Financial stress detected');
    }

    // Trend
    if (score.trend === 'declining') {
      reasons.push('⚠ Revenue trend is declining');
    } else if (score.trend === 'improving') {
      reasons.push('✓ Revenue trend is improving');
    }

    // Specific signals from explanation
    if (score.explanation?.behaviour_stability?.factors) {
      for (const factor of score.explanation.behaviour_stability.factors) {
        if (typeof factor === 'string' && !factor.includes('normal')) {
          reasons.push(`⚠ ${factor}`);
        }
      }
    }

    return reasons;
  }

  generateConfidenceExplanation(score: RevenueAssuranceScore): string {
    const reasons = this.explain(score);
    if (reasons.length === 0) return 'No concerns detected';
    return reasons.slice(0, 5).join(' · ');
  }
}

export const revenueReasonsEngine = new RevenueReasonsEngine();
