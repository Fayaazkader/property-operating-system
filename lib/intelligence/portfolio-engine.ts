// lib/intelligence/portfolio-engine.ts
// Portfolio Intelligence — Aggregates domain signals. Never queries operational tables.

import { getDomainIntelligence, getAllSignals } from './signal-registry';
import { maintenanceIntelligence } from '@/lib/maintenance/intelligence';
import { inspectionsIntelligence } from '@/lib/inspections/intelligence';
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
  topRecommendation: string | null;
  signals: string[];
  priorities: string[];
  timestamp: string;
}

export class PortfolioIntelligenceEngine {

  async refreshAll(entityId: string): Promise<void> {
    await Promise.all([
      maintenanceIntelligence.analyze(entityId),
      inspectionsIntelligence.analyze(entityId),
    ]);
  }

  async getPortfolioRisk(): Promise<PortfolioRisk> {
    const domains: SignalDomain[] = ['maintenance', 'inspections', 'revenue', 'supplier', 'compliance', 'tenant'];
    const domainIntel = domains.map(d => getDomainIntelligence(d));
    
    const totalScore = domainIntel.reduce((s, d) => s + d.riskScore, 0);
    const avgScore = Math.round(totalScore / domains.length);
    const overall = avgScore >= 85 ? 'low' as const : avgScore >= 60 ? 'medium' as const : 'high' as const;

    const allSignals = getAllSignals();
    const summary = allSignals.length > 0
      ? `Risk ${overall.toUpperCase()} — ${allSignals.slice(0, 3).map(s => s.title).join(' · ')}`
      : 'All domains operational';

    return { overall, score: avgScore, domains: domainIntel, summary };
  }

  async getOvernightBrief(entityId: string): Promise<OvernightBrief> {
    await this.refreshAll(entityId);
    
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const risk = await this.getPortfolioRisk();
    const recommendation = recommendationEngine.getTopRecommendation();
    const allSignals = getAllSignals();

    return {
      greeting,
      riskSummary: risk.summary,
      topRecommendation: recommendation?.title || null,
      signals: allSignals.slice(0, 5).map(s => s.title),
      priorities: allSignals.filter(s => s.severity === 'high' || s.severity === 'critical').map(s => s.title),
      timestamp: new Date().toISOString(),
    };
  }
}

export const portfolioIntelligenceEngine = new PortfolioIntelligenceEngine();
