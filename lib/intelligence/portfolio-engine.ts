// lib/intelligence/portfolio-engine.ts
// Portfolio Intelligence — Aggregates domain risk scores. Never calculates them.

import { getDomainIntelligence, getAllSignals } from './signal-registry';
import { recommendationEngine } from './recommendation-engine';
import type { DomainIntelligence, SignalDomain } from './types';

export interface PortfolioRisk {
  overall: 'low' | 'medium' | 'high';
  score: number;
  domains: DomainIntelligence[];
  summary: string;
}

export interface OvernightBrief {
  greeting: string;
  riskSummary: string;
  topRecommendation: { title: string; reasoning: string[]; confidence: number; action: string } | null;
  signals: string[];
  priorities: string[];
  timestamp: string;
}

export class PortfolioIntelligenceEngine {

  async getPortfolioRisk(): Promise<PortfolioRisk> {
    const domains: SignalDomain[] = ['maintenance', 'inspections', 'revenue', 'supplier', 'compliance', 'tenant'];
    const domainIntel = await Promise.all(domains.map(d => getDomainIntelligence(d)));
    
    // Aggregate — each domain reports its own risk contribution
    // Portfolio only sums, never calculates
    const totalRiskContribution = domainIntel.reduce((s, d) => {
      const domainRisk = d.signals.reduce((rs, sig) => rs + sig.score, 0);
      return s + domainRisk;
    }, 0);
    
    const avgScore = Math.max(0, 100 - Math.min(totalRiskContribution, 100));
    const overall = avgScore >= 85 ? 'low' as const : avgScore >= 60 ? 'medium' as const : 'high' as const;

    const allSignals = await getAllSignals();
    const summary = allSignals.length > 0
      ? `Risk ${overall.toUpperCase()} — ${allSignals.slice(0, 3).map(s => s.title).join(' · ')}`
      : 'All domains operational';

    return { overall, score: avgScore, domains: domainIntel, summary };
  }

  async getOvernightBrief(): Promise<OvernightBrief> {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const risk = await this.getPortfolioRisk();
    const recommendation = await recommendationEngine.getTopRecommendation();
    const allSignals = await getAllSignals();

    return {
      greeting,
      riskSummary: risk.summary,
      topRecommendation: recommendation ? {
        title: recommendation.title,
        reasoning: recommendation.reasoning,
        confidence: recommendation.confidence,
        action: recommendation.action,
      } : null,
      signals: allSignals.slice(0, 5).map(s => s.title),
      priorities: allSignals.filter(s => s.severity === 'high' || s.severity === 'critical').map(s => s.title),
      timestamp: new Date().toISOString(),
    };
  }
}

export const portfolioIntelligenceEngine = new PortfolioIntelligenceEngine();
