// lib/financial/expectations-engine.ts
// Financial Expectations Engine v1 — Learns patterns with seasonal awareness

import { supabase } from '@/lib/supabase';
import { publish } from '../platform/events/event-bus';
import type { FinancialExpectation } from './types';

export class ExpectationsEngine {
  async learnPatterns(entityId: string, periodId: string): Promise<void> {
    const { data: prevPeriods } = await supabase.from('financial_periods').select('id, start_date').eq('entity_id', entityId).eq('period_type', 'financial').eq('status', 'closed').order('start_date', { ascending: false }).limit(12);

    if (!prevPeriods || prevPeriods.length < 3) return;

    const prevIds = prevPeriods.map(p => p.id);
    const { data: prevExpectations } = await supabase.from('financial_expectations').select('expectation_type, reference_type, reference_id, expected_amount, seasonality_month').eq('entity_id', entityId).in('period_id', prevIds);

    const currentMonth = new Date().getMonth() + 1;

    // Group by type + reference + seasonality month
    const patterns = new Map<string, number[]>();
    for (const e of (prevExpectations || [])) {
      const key = `${e.expectation_type}:${e.reference_type || 'none'}:${e.reference_id || 'none'}:${e.seasonality_month || currentMonth}`;
      if (!patterns.has(key)) patterns.set(key, []);
      patterns.get(key)!.push(e.expected_amount || 0);
    }

    for (const [key, amounts] of patterns) {
      if (amounts.length < 2) continue;
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length);
      const confidence = Math.max(0.3, Math.min(0.95, 1 - (stdDev / (avg || 1))));

      const [type, refType, refId, seasonMonth] = key.split(':');

      await supabase.from('financial_expectations').insert({
        id: crypto.randomUUID(), entity_id: entityId, period_id: periodId,
        expectation_type: type,
        reference_type: refType !== 'none' ? refType : null,
        reference_id: refId !== 'none' ? refId : null,
        expected_amount: Math.round(avg * 100) / 100,
        seasonality_month: parseInt(seasonMonth),
        confidence_score: Math.round(confidence * 100) / 100,
        status: 'pending',
      });
    }
  }

  async checkExpectations(entityId: string, periodId: string): Promise<FinancialExpectation[]> {
    const { data: expectations } = await supabase.from('financial_expectations').select('*').eq('entity_id', entityId).eq('period_id', periodId).eq('status', 'pending');

    const anomalies: FinancialExpectation[] = [];

    for (const exp of (expectations || [])) {
      if (!exp.expected_amount || exp.expected_amount === 0) continue;

      const variance = exp.actual_amount ? Math.abs((exp.actual_amount || 0) - exp.expected_amount) / exp.expected_amount * 100 : 100;
      const isAnomaly = variance > 20 && (exp.confidence_score || 0.5) > 0.4;

      const newStatus = isAnomaly ? 'anomaly' : 'matched';
      await supabase.from('financial_expectations').update({
        variance_pct: Math.round(variance), status: newStatus, updated_at: new Date().toISOString(),
      }).eq('id', exp.id);

      if (isAnomaly) {
        anomalies.push({ ...exp, variance_pct: Math.round(variance), status: 'anomaly' } as FinancialExpectation);
      }
    }

    if (anomalies.length > 0) {
      await publish('financial.anomalies.detected', {
        correlationId: crypto.randomUUID(), source: 'expectations-engine', version: '1.0',
        payload: { entityId, periodId, anomalies },
      });
    }

    return anomalies;
  }

  async getAnomalies(entityId: string, periodId: string): Promise<FinancialExpectation[]> {
    const { data } = await supabase.from('financial_expectations').select('*').eq('entity_id', entityId).eq('period_id', periodId).eq('status', 'anomaly');
    return (data || []) as FinancialExpectation[];
  }
}

export const expectationsEngine = new ExpectationsEngine();
