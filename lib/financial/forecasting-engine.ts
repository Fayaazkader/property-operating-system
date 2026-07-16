// lib/financial/forecasting-engine.ts
// Forecasting Engine — Actual to date + Expected remaining = Forecast

import { supabase } from '@/lib/supabase';
import { financialStatementsEngine } from './statements-engine';
import type { Forecast } from './types';

export class ForecastingEngine {
  async generateForecast(entityId: string, periodId: string): Promise<Forecast[]> {
    const tb = await financialStatementsEngine.generateTrialBalance(entityId, periodId);

    const { data: expectations } = await supabase.from('financial_expectations').select('*').eq('entity_id', entityId).eq('period_id', periodId);
    const expectedMap = new Map<string, number>();
    for (const e of (expectations || [])) {
      if (e.expected_amount) expectedMap.set(e.expectation_type, e.expected_amount);
    }

    const forecasts: Forecast[] = [];

    for (const line of tb) {
      if (line.account_type !== 'income' && line.account_type !== 'expense') continue;

      const actualToDate = Math.abs(line.net_balance);
      const expectedRemaining = expectedMap.get(line.account_name.toLowerCase().replace(/\s/g, '_')) || 0;
      const forecastTotal = actualToDate + expectedRemaining;

      const { data, error } = await supabase.from('forecasts').upsert({
        entity_id: entityId, period_id: periodId, account_id: line.account_id,
        actual_to_date: actualToDate, expected_remaining: expectedRemaining,
        forecast_total: forecastTotal, forecast_type: 'rolling',
      }, { onConflict: 'entity_id,period_id,account_id,COALESCE(property_id, \'00000000-0000-0000-0000-000000000000\')' }).select('*').single();

      if (!error && data) forecasts.push(data as Forecast);
    }

    return forecasts;
  }

  async getForecast(entityId: string, periodId: string): Promise<Forecast[]> {
    const { data } = await supabase.from('forecasts').select('*').eq('entity_id', entityId).eq('period_id', periodId);
    return (data || []) as Forecast[];
  }
}

export const forecastingEngine = new ForecastingEngine();
