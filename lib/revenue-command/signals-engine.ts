// lib/revenue-command/intelligence-engine.ts
// Revenue Signals — Learns tenant behavior, builds DNA, detects anomalies

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import type { CommercialBehaviourProfile } from './types';

export class RevenueIntelligenceEngine {
  
  async buildProfile(tenantId: string, entityId: string): Promise<CommercialBehaviourProfile> {
    // Gather all behavioral data
    const [payments, communications, disputes, maintenance, leaseData] = await Promise.all([
      this.getPaymentHistory(tenantId),
      this.getCommunicationHistory(tenantId),
      this.getDisputeHistory(tenantId),
      this.getMaintenanceHistory(tenantId),
      this.getLeaseInfo(tenantId),
    ]);

    const dna: CommercialBehaviourProfile = {
      tenant_id: tenantId,
      entity_id: entityId,
      
      // Payment DNA
      avg_payment_day: this.calculateAvgPaymentDay(payments),
      avg_delay_days: this.calculateAvgDelay(payments),
      collection_confidence: this.calculateCollectionConfidence(payments),
      seasonal_pattern: this.detectSeasonality(payments),
      payment_trend: this.detectPaymentTrend(payments),
      promise_keeping_rate: await this.calculatePromiseKeepingRate(payments),
      
      // Communication DNA
      preferred_channel: this.detectPreferredChannel(communications),
      avg_response_time_minutes: this.calculateAvgResponseTime(communications),
      reminder_effectiveness: this.calculateReminderEffectiveness(communications, payments),
      contact_reliability: this.calculateContactReliability(communications),
      
      // Financial DNA
      disputes_raised: disputes.length,
      deposit_usage_count: this.countDepositUsage(payments),
      
      // Operational DNA
      maintenance_trend: this.detectMaintenanceTrend(maintenance),
      utility_trend: this.detectUtilityTrend(payments),
      
      // Classification
      assigned_playbook: this.assignPlaybook(payments),
    };

    // Persist
    await supabase.from('commercial_behaviour_profile').upsert({
      ...dna,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    await publish('revenue.dna.updated', {
      correlationId: crypto.randomUUID(),
      source: 'revenue-signals',
      version: '1.0',
      payload: { tenantId, entityId, dna },
    });

    return dna;
  }

  async detectBehaviorAnomalies(tenantId: string): Promise<string[]> {
    const dna = await this.getDNA(tenantId);
    if (!dna) return [];

    const anomalies: string[] = [];

    // Check payment delay vs historical average
    const recentPayments = await this.getRecentPayments(tenantId, 3);
    const recentAvg = this.calculateAvgDelay(recentPayments);
    if (dna.avg_delay_days && recentAvg > dna.avg_delay_days * 2) {
      anomalies.push(`Payment delay increased from ${dna.avg_delay_days} to ${recentAvg} days`);
    }

    // Check communication responsiveness
    const recentComms = await this.getRecentCommunications(tenantId, 5);
    const recentResponseTime = this.calculateAvgResponseTime(recentComms);
    if (dna.avg_response_time_minutes && recentResponseTime > dna.avg_response_time_minutes * 3) {
      anomalies.push(`Response time degraded from ${dna.avg_response_time_minutes} to ${recentResponseTime} minutes`);
    }

    // Check utility consumption drop (possible vacancy or financial stress)
    if (dna.utility_trend === 'declining') {
      anomalies.push('Utility consumption trending downward — possible financial stress');
    }

    // Check maintenance request increase (possible property issues or move-out preparation)
    if (dna.maintenance_trend === 'increasing') {
      anomalies.push('Maintenance requests increasing — possible operational issues');
    }

    return anomalies;
  }

  // --- Private helpers ---

  private async getPaymentHistory(tenantId: string) {
    const { data } = await supabase
      .from('sub_ledger_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ledger_type', 'tenant')
      .order('posted_at', { ascending: false })
      .limit(24);
    return data || [];
  }

  private async getCommunicationHistory(tenantId: string) {
    const { data } = await supabase
      .from('communications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }

  private async getDisputeHistory(tenantId: string) {
    const { data } = await supabase
      .from('communications')
      .select('*')
      .eq('tenant_id', tenantId)
      .or('event_type.eq.dispute_raised,event_type.eq.payment_disputed')
      .order('created_at', { ascending: false });
    return data || [];
  }

  private async getMaintenanceHistory(tenantId: string) {
    const { data } = await supabase
      .from('work_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(24);
    return data || [];
  }

  private async getLeaseInfo(tenantId: string) {
    const { data } = await supabase
      .from('leases')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('lease_status', 'Active')
      .single();
    return data;
  }

  private async getRecentPayments(tenantId: string, count: number) {
    const { data } = await supabase
      .from('sub_ledger_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ledger_type', 'tenant')
      .order('posted_at', { ascending: false })
      .limit(count);
    return data || [];
  }

  private async getRecentCommunications(tenantId: string, count: number) {
    const { data } = await supabase
      .from('communications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(count);
    return data || [];
  }

  async getDNA(tenantId: string): Promise<CommercialBehaviourProfile | null> {
    const { data } = await supabase
      .from('commercial_behaviour_profile')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
    return data as CommercialBehaviourProfile | null;
  }

  // --- Calculation helpers ---

  private calculateAvgPaymentDay(payments: any[]): number {
    if (!payments.length) return 0;
    const days = payments
      .filter((p: any) => p.debit_amount > 0)
      .map((p: any) => new Date(p.posted_at).getDate());
    return days.length ? Math.round(days.reduce((a: number, b: number) => a + b, 0) / days.length) : 0;
  }

  private calculateAvgDelay(payments: any[]): number {
    // Compare invoice dates to payment dates
    const delays: number[] = [];
    for (const p of payments) {
      if (p.debit_amount > 0 && p.reference_id) {
        // Simplified: use posting date as proxy
        const date = new Date(p.posted_at);
        const expectedDay = 1; // Most leases due on 1st
        const delay = date.getDate() - expectedDay;
        if (delay > 0) delays.push(delay);
      }
    }
    return delays.length ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10 : 0;
  }

  private calculateCollectionConfidence(payments: any[]): number {
    if (!payments.length) return 0.5;
    const onTime = payments.filter((p: any) => {
      const date = new Date(p.posted_at);
      return date.getDate() <= 5; // Paid within first 5 days
    }).length;
    return Math.round((onTime / payments.length) * 100) / 100;
  }

  private detectSeasonality(payments: any[]): Record<string, number> {
    const monthly: Record<string, number> = {};
    for (const p of payments) {
      const month = new Date(p.posted_at).getMonth();
      const key = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month];
      monthly[key] = (monthly[key] || 0) + 1;
    }
    return monthly;
  }

  private detectPaymentTrend(payments: any[]): string {
    if (payments.length < 3) return 'stable';
    const recent = payments.slice(0, 3);
    const older = payments.slice(3, 6);
    const recentAvg = this.calculateAvgDelay(recent);
    const olderAvg = this.calculateAvgDelay(older);
    if (recentAvg > olderAvg * 1.5) return 'declining';
    if (recentAvg < olderAvg * 0.5) return 'improving';
    return 'stable';
  }

  private async calculatePromiseKeepingRate(payments: any[]): Promise<number> {
    const { data } = await supabase
      .from('payment_commitments')
      .select('*')
      .eq('tenant_id', payments[0]?.tenant_id);
    // Will be implemented when commitments exist
    return 1.0;
  }

  private detectPreferredChannel(communications: any[]): string {
    const channels: Record<string, number> = {};
    for (const c of communications) {
      channels[c.channel] = (channels[c.channel] || 0) + 1;
    }
    let max = 0, preferred = 'email';
    for (const [ch, count] of Object.entries(channels)) {
      if (count > max) { max = count; preferred = ch; }
    }
    return preferred;
  }

  private calculateAvgResponseTime(communications: any[]): number {
    // Simplified — will be enhanced with actual response tracking
    return 0;
  }

  private calculateReminderEffectiveness(communications: any[], payments: any[]): number {
    if (!communications.length || !payments.length) return 0.5;
    const reminded = communications.filter((c: any) => c.event_type?.includes('reminder')).length;
    const paidAfterReminder = payments.filter((p: any) => {
      const payDate = new Date(p.posted_at);
      return payDate.getDate() > 1; // Paid after the 1st
    }).length;
    return reminded > 0 ? Math.round((paidAfterReminder / reminded) * 100) / 100 : 1.0;
  }

  private calculateContactReliability(communications: any[]): number {
    if (!communications.length) return 0.5;
    const delivered = communications.filter((c: any) => c.status === 'delivered' || c.status === 'read').length;
    return Math.round((delivered / communications.length) * 100) / 100;
  }

  private countDepositUsage(payments: any[]): number {
    return payments.filter((p: any) => p.description?.includes('deposit')).length;
  }

  private detectMaintenanceTrend(maintenance: any[]): string {
    if (maintenance.length < 3) return 'stable';
    const recent = maintenance.slice(0, 3).length;
    const older = maintenance.slice(3, 6).length;
    if (recent > older) return 'increasing';
    if (recent < older) return 'decreasing';
    return 'stable';
  }

  private detectUtilityTrend(payments: any[]): string {
    const recent = payments.slice(0, 3);
    const older = payments.slice(3, 6);
    const recentSum = recent.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const olderSum = older.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    if (recentSum < olderSum * 0.7) return 'declining';
    if (recentSum > olderSum * 1.3) return 'increasing';
    return 'stable';
  }

  private assignPlaybook(payments: any[]): string {
    const confidence = this.calculateCollectionConfidence(payments);
    if (confidence >= 0.95) return 'reliable';
    if (confidence >= 0.75) return 'standard';
    if (confidence >= 0.50) return 'watch_list';
    return 'high_risk';
  }
}

export const revenueSignalsEngine = new RevenueIntelligenceEngine();
