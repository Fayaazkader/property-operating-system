// lib/revenue-command/decisions-engine.ts
// Revenue Decisions — The orchestration brain that chooses the next best action

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { RevenueAssuranceScore, RevenueDecision, SignalCategory } from './types';

export class RevenueDecisionsEngine {

  async decide(
    leaseId: string, 
    entityId: string, 
    tenantId: string,
    score: RevenueAssuranceScore,
    signals: Array<{ category: SignalCategory; event: string }>
  ): Promise<RevenueDecision> {
    
    const alternatives = this.generateAlternatives(score);
    const chosen = this.selectBestAction(alternatives, score, signals);
    
    const decision: RevenueDecision = {
      id: crypto.randomUUID(),
      entity_id: entityId,
      lease_id: leaseId,
      tenant_id: tenantId,
      decision_type: chosen.type,
      confidence: chosen.confidence,
      signals_considered: signals.map(s => `${s.category}:${s.event}`),
      chosen_action: chosen.action,
      alternative_actions: alternatives.filter(a => a.type !== chosen.type).map(a => a.action),
      executed: false,
    };

    await supabase.from('revenue_decisions').insert(decision);
    await this.recordActivity(entityId, leaseId, 'decision', 'revenue_decision_made', 
      `${chosen.action} (confidence: ${Math.round(chosen.confidence * 100)}%)`,
      { decision_id: decision.id }
    );

    await publish('revenue.decision.made', {
      correlationId: crypto.randomUUID(),
      source: 'revenue-decisions',
      version: '1.0',
      payload: decision,
    });

    return decision;
  }

  private generateAlternatives(score: RevenueAssuranceScore): Array<{
    type: string; action: string; confidence: number;
  }> {
    const alternatives: Array<{ type: string; action: string; confidence: number }> = [];

    if (score.overall_score >= 90) {
      alternatives.push({ type: 'monitor', action: 'Monitor — no action required', confidence: 0.98 });
    }

    if (score.overall_score >= 60 && score.overall_score < 90) {
      alternatives.push({ type: 'whatsapp_reminder', action: 'Send WhatsApp reminder', confidence: 0.85 });
      alternatives.push({ type: 'email_reminder', action: 'Send email reminder', confidence: 0.70 });
    }

    if (score.overall_score >= 30 && score.overall_score < 60) {
      alternatives.push({ type: 'phone_call', action: 'Call tenant directly', confidence: 0.75 });
      alternatives.push({ type: 'payment_plan', action: 'Offer payment plan', confidence: 0.65 });
    }

    if (score.overall_score < 30) {
      alternatives.push({ type: 'deposit_application', action: 'Apply deposit to arrears', confidence: 0.90 });
      alternatives.push({ type: 'legal_notice', action: 'Issue letter of demand', confidence: 0.80 });
      alternatives.push({ type: 'legal_proceedings', action: 'Initiate legal proceedings', confidence: 0.60 });
    }

    if (score.recoverability > 80) {
      alternatives.push({ type: 'negotiate', action: 'Negotiate payment terms', confidence: 0.85 });
    }

    return alternatives;
  }

  private selectBestAction(
    alternatives: Array<{ type: string; action: string; confidence: number }>,
    score: RevenueAssuranceScore,
    signals: Array<{ category: SignalCategory; event: string }>
  ): { type: string; action: string; confidence: number } {
    
    // Sort by confidence
    alternatives.sort((a, b) => b.confidence - a.confidence);
    
    // If tenant is unresponsive, prefer direct contact
    const hasCommunication = signals.some(s => s.category === 'communication');
    if (!hasCommunication && score.overall_score < 70) {
      const callAction = alternatives.find(a => a.type === 'phone_call');
      if (callAction) return callAction;
    }

    // Default: highest confidence action
    return alternatives[0] || { type: 'monitor', action: 'Monitor', confidence: 0.95 };
  }

  async executeDecision(decisionId: string): Promise<void> {
    await supabase.from('revenue_decisions').update({
      executed: true,
      executed_at: new Date().toISOString(),
    }).eq('id', decisionId);
  }

  async recordOutcome(decisionId: string, outcome: string): Promise<void> {
    await supabase.from('revenue_decisions').update({
      outcome,
      updated_at: new Date().toISOString(),
    } as any).eq('id', decisionId);
  }

  private async recordActivity(
    entityId: string, referenceId: string, 
    referenceType: string, eventType: string,
    description: string, metadata?: Record<string, any>
  ): Promise<void> {
    await supabase.from('revenue_activity_feed').insert({
      entity_id: entityId,
      reference_type: referenceType,
      reference_id: referenceId,
      signal_category: 'behaviour',
      event_type: eventType,
      description,
      metadata: metadata || {},
    });
  }
}

export const revenueDecisionsEngine = new RevenueDecisionsEngine();
