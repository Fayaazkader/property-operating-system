// lib/revenue-command/assurance-engine.ts
// Revenue Assurance — Scores leases, identifies risk, recommends actions

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { revenueSignalsEngine } from './signals-engine';
import type { RevenueAssuranceScore, RevenueDigitalTwin } from './types';

export class RevenueAssuranceEngine {

  async scoreLease(leaseId: string, entityId: string): Promise<RevenueAssuranceScore> {
    const { data: lease } = await supabase.from('leases').select('*, tenant:tenant_id(*)').eq('id', leaseId).single();
    if (!lease) throw new Error('Lease not found');

    const tenantId = lease.tenant_id;
    const dna = await revenueSignalsEngine.getDNA(tenantId);
    const anomalies = await revenueSignalsEngine.detectBehaviorAnomalies(tenantId);

    // Component scores
    const paymentReliability = dna ? (dna.collection_confidence || 0.5) * 100 : 50;
    const behaviourStability = dna ? this.calculateBehaviourStability(dna, anomalies) : 50;
    const communicationScore = dna ? (dna.contact_reliability || 0.5) * 100 : 50;
    const financialHealth = dna ? this.calculateFinancialHealth(dna) : 50;
    const complianceScore = 80; // Placeholder

    // Weighted composite
    const recoverability = dna ? Math.round(((dna.promise_keeping_rate || 0.5) * 40 + (dna.deposit_usage_count ? 60 - dna.deposit_usage_count * 20 : 50)) * 10) / 10 : 50;

    const overallScore = Math.round(
      (paymentReliability * 0.35) +
      (behaviourStability * 0.20) +
      (communicationScore * 0.15) +
      (financialHealth * 0.20) +
      (complianceScore * 0.10)
    );

    // Build explanation
    const explanation: Record<string, any> = {
      payment_reliability: {
        score: paymentReliability,
        factors: dna ? [`Average payment day: ${dna.avg_payment_day || 'N/A'}`, `Collection confidence: ${Math.round((dna.collection_confidence || 0) * 100)}%`] : [],
      },
      behaviour_stability: {
        score: behaviourStability,
        factors: anomalies.length > 0 ? anomalies : ['Behaviour normal'],
      },
      communication: {
        score: communicationScore,
        factors: dna ? [`Preferred channel: ${dna.preferred_channel}`, `Reminder effectiveness: ${Math.round((dna.reminder_effectiveness || 0) * 100)}%`] : [],
      },
      financial_health: {
        score: financialHealth,
        factors: dna ? [`Disputes raised: ${dna.disputes_raised || 0}`, `Promise keeping: ${Math.round((dna.promise_keeping_rate || 0) * 100)}%`] : [],
      },
    };

    // Determine action
    let recommendedAction = 'None';
    let actionUrgency = 'none';
    if (overallScore < 30) { recommendedAction = 'Call tenant immediately'; actionUrgency = 'critical'; }
    else if (overallScore < 50) { recommendedAction = 'Send WhatsApp reminder and follow up'; actionUrgency = 'high'; }
    else if (overallScore < 70) { recommendedAction = 'Monitor closely'; actionUrgency = 'medium'; }
    else if (overallScore < 90) { recommendedAction = 'Standard billing'; actionUrgency = 'low'; }

    const score: RevenueAssuranceScore = {
      lease_id: leaseId,
      overall_score: overallScore,
      payment_reliability: paymentReliability,
      behaviour_stability: behaviourStability,
      communication_score: communicationScore,
      financial_health: financialHealth,
      compliance_score: complianceScore,
      confidence_level: dna ? dna.collection_confidence || 0.8 : 0.5,
      trend: dna?.payment_trend || 'stable',
      explanation,
      recommended_action: recommendedAction,
      action_urgency: actionUrgency,
    };

    // Persist
    await supabase.from('revenue_assurance_scores').insert({
      entity_id: entityId,
      ...score,
      explanation: JSON.stringify(explanation),
    });

    await publish('revenue.assurance.scored', {
      correlationId: crypto.randomUUID(),
      source: 'revenue-assurance',
      version: '1.0',
      payload: { leaseId, entityId, score },
    });

    return score;
  }

  async buildDigitalTwin(leaseId: string, entityId: string): Promise<RevenueDigitalTwin> {
    const score = await this.scoreLease(leaseId, entityId);
    const { data: lease } = await supabase.from('leases').select('*').eq('id', leaseId).single();

    const twin: RevenueDigitalTwin = {
      lease_id: leaseId,
      expected_collection: lease?.monthly_rental,
      collection_confidence: score.confidence_level,
      revenue_risk: score.overall_score < 40 ? 'high' : score.overall_score < 70 ? 'medium' : 'low',
      behaviour_trend: score.trend,
      recommended_action: score.recommended_action,
      next_expected_event: this.predictNextEvent(score),
      next_expected_date: this.predictNextPaymentDate(lease),
      legal_monthly_rent: lease?.monthly_rental,
    };

    await supabase.from('revenue_digital_twins').upsert({
      entity_id: entityId,
      ...twin,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lease_id' });

    return twin;
  }

  async generateRevenueOutlook(entityId: string): Promise<void> {
    const { data: leases } = await supabase
      .from('leases')
      .select('id, monthly_rental')
      .eq('owner_entity_id', entityId)
      .eq('lease_status', 'Active');

    if (!leases?.length) return;

    let expectedToday = 0, collectedToday = 0, atRisk = 0;
    const priorities: any[] = [];

    for (const lease of leases) {
      const score = await this.scoreLease(lease.id, entityId);
      expectedToday += lease.monthly_rental || 0;
      
      if (score.overall_score < 50) {
        atRisk += lease.monthly_rental || 0;
        priorities.push({
          lease_id: lease.id,
          amount: lease.monthly_rental,
          risk: score.overall_score < 30 ? 'high' : 'medium',
          action: score.recommended_action,
        });
      }
    }

    const stillExpected = expectedToday - collectedToday;
    const collectionConfidence = expectedToday > 0 
      ? Math.round(((expectedToday - atRisk) / expectedToday) * 100) / 100 
      : 1;

    await supabase.from('revenue_outlooks').upsert({
      entity_id: entityId,
      snapshot_date: new Date().toISOString().split('T')[0],
      expected_today: expectedToday,
      collected_today: collectedToday,
      still_expected: stillExpected,
      at_risk: atRisk,
      collection_confidence: collectionConfidence,
      top_priorities: priorities.slice(0, 5),
    }, { onConflict: 'entity_id,snapshot_date' });

    await publish('revenue.outlook.generated', {
      correlationId: crypto.randomUUID(),
      source: 'revenue-assurance',
      version: '1.0',
      payload: { entityId, expectedToday, atRisk, collectionConfidence },
    });
  }

  // --- Private helpers ---

  private calculateBehaviourStability(dna: any, anomalies: string[]): number {
    let score = 80;
    if (anomalies.length > 0) score -= anomalies.length * 10;
    if (dna?.payment_trend === 'declining') score -= 20;
    if (dna?.payment_trend === 'improving') score += 10;
    return Math.max(0, Math.min(100, score));
  }

  private calculateFinancialHealth(dna: any): number {
    let score = 70;
    if (dna?.disputes_raised > 2) score -= 15;
    if (dna?.deposit_usage_count > 1) score -= 10;
    if (dna?.promise_keeping_rate < 0.7) score -= 20;
    return Math.max(0, Math.min(100, score));
  }

  private predictNextEvent(score: RevenueAssuranceScore): string {
    if (score.overall_score >= 90) return 'Payment expected';
    if (score.overall_score >= 70) return 'Monitor for payment';
    if (score.overall_score >= 50) return 'Follow-up reminder due';
    return 'Escalation needed';
  }

  private predictNextPaymentDate(lease: any): string | undefined {
    if (!lease) return undefined;
    const today = new Date();
    const billingDay = lease.billing_day || 1;
    const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
    return nextDate.toISOString().split('T')[0];
  }
}


  async calculateRevenueProtected(entityId: string, startDate: string, endDate: string): Promise<{
    total_due: number;
    collected: number;
    protected_amount: number;
    lost: number;
    actions_taken: number;
  }> {
    const { data: leases } = await supabase
      .from("leases")
      .select("id, monthly_rental")
      .eq("owner_entity_id", entityId)
      .eq("lease_status", "Active");
    let totalDue = 0, collected = 0, protectedAmount = 0, actionsTaken = 0;
    for (const lease of (leases || [])) {
      totalDue += lease.monthly_rental || 0;
      const { count } = await supabase
        .from("communications")
        .select("*", { count: "exact", head: true })
        .eq("entity_id", entityId)
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      actionsTaken += count || 0;
      const score = await this.scoreLease(lease.id, entityId);
      if (score.overall_score >= 50) protectedAmount += lease.monthly_rental || 0;
    }
    return { total_due: totalDue, collected, protected_amount: protectedAmount, lost: Math.max(0, totalDue - protectedAmount), actions_taken: actionsTaken };
  }

  async calculateRevenueProtected(entityId: string, startDate: string, endDate: string): Promise<{
    total_due: number;
    collected: number;
    protected_amount: number;
    lost: number;
    actions_taken: number;
  }> {
    const { data: leases } = await supabase
      .from("leases")
      .select("id, monthly_rental")
      .eq("owner_entity_id", entityId)
      .eq("lease_status", "Active");

    let totalDue = 0, collected = 0, protectedAmount = 0, actionsTaken = 0;

    for (const lease of (leases || [])) {
      totalDue += lease.monthly_rental || 0;
      const { count } = await supabase
        .from("communications")
        .select("*", { count: "exact", head: true })
        .eq("entity_id", entityId)
        .gte("created_at", startDate)
        .lte("created_at", endDate);
      actionsTaken += count || 0;
      const score = await this.scoreLease(lease.id, entityId);
      if (score.overall_score >= 50) protectedAmount += lease.monthly_rental || 0;
    }

    return { total_due: totalDue, collected, protected_amount: protectedAmount, lost: Math.max(0, totalDue - protectedAmount), actions_taken: actionsTaken };
  }
export const revenueAssuranceEngine = new RevenueAssuranceEngine();
