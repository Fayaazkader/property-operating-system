// lib/brokerage/commissions/commission-calculator.ts
// Commission Calculator — Pure Business Logic (No Persistence)

import { CreateCommissionParams } from './commission.types';

export interface CommissionCalculationResult {
  total_commission: number;
  snapshot: {
    annual_rent: number;
    lease_term_months: number;
    base_amount: number;
    rate_applied: number;
    split_percentage?: number;
    rule_version: string;
    calculation_date: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    reason?: string;
  };
}

export class CommissionCalculator {
  private ruleVersion = '1.0';

  calculate(params: CreateCommissionParams): CommissionCalculationResult {
    let total = 0;
    let reason = '';

    if (params.commission_type === 'percentage') {
      const annualRent = params.annual_rent;
      const rate = params.commission_rate / 100;
      total = annualRent * rate;
      reason = `${params.commission_rate}% of annual rent (R${annualRent.toLocaleString()})`;
    } else if (params.commission_type === 'fixed') {
      total = params.commission_rate;
      reason = `Fixed amount of R${params.commission_rate.toLocaleString()}`;
    } else if (params.commission_type === 'tiered') {
      const annualRent = params.annual_rent;
      const threshold = 1000000;
      const firstTierRate = 0.05;
      const secondTierRate = 0.03;

      if (annualRent <= threshold) {
        total = annualRent * firstTierRate;
        reason = `5% of annual rent up to R1,000,000`;
      } else {
        total = (threshold * firstTierRate) + ((annualRent - threshold) * secondTierRate);
        reason = `5% on first R1,000,000, 3% on remainder`;
      }
    }

    // Apply split if multiple brokers
    if (params.split_percentage && params.split_percentage < 100) {
      const originalTotal = total;
      total = total * (params.split_percentage / 100);
      reason += ` (${params.split_percentage}% split)`;
    }

    total = Math.round(total * 100) / 100;

    return {
      total_commission: total,
      snapshot: {
        annual_rent: params.annual_rent,
        lease_term_months: params.lease_term_months,
        base_amount: params.annual_rent,
        rate_applied: params.commission_rate,
        split_percentage: params.split_percentage || 100,
        rule_version: this.ruleVersion,
        calculation_date: new Date().toISOString(),
        inputs: {
          commission_type: params.commission_type,
          commission_rate: params.commission_rate,
          annual_rent: params.annual_rent,
          lease_term_months: params.lease_term_months,
          split_percentage: params.split_percentage || 100,
        },
        outputs: {
          total_commission: total,
          reason: reason,
        },
        reason: reason,
      },
    };
  }
}

export const commissionCalculator = new CommissionCalculator();
