// lib/revenue/services/charge-preview-service.ts
// Sources upcoming charges from billing engine. Returns posted vs projected.

import { supabase } from '@/lib/supabase';

export interface ProjectedCharge {
  description: string;
  amount: number;
  source: string;
  category: string;
  status: 'projected_fixed' | 'projected_variable' | 'pending';
  confidence: string;
  billing_period: string;
}

export const chargePreviewService = {
  async getUpcomingCharges(tenantId: string, leaseId: string): Promise<ProjectedCharge[]> {
    const { data: lease } = await supabase
      .from('leases')
      .select('monthly_rental, parking_bays, parking_rate, lease_type')
      .eq('id', leaseId)
      .single();

    if (!lease) return [];

    const charges: ProjectedCharge[] = [];
    const period = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    // Fixed charges from lease rules
    if (lease.monthly_rental) {
      charges.push({
        description: 'Base Rent',
        amount: lease.monthly_rental,
        source: 'Lease Rule',
        category: 'rent',
        status: 'projected_fixed',
        confidence: 'Confirmed',
        billing_period: period,
      });
    }

    if (lease.parking_bays && lease.parking_rate) {
      charges.push({
        description: `Parking (${lease.parking_bays} bays)`,
        amount: lease.parking_bays * lease.parking_rate,
        source: 'Lease Rule',
        category: 'parking',
        status: 'projected_fixed',
        confidence: 'Confirmed',
        billing_period: period,
      });
    }

    // Variable charges — pending billing run
    const { data: recoveries } = await supabase
      .from('recoveries')
      .select('recovery_category, budgeted_amount')
      .eq('lease_id', leaseId)
      .eq('status', 'budgeted');

    for (const r of (recoveries || [])) {
      charges.push({
        description: r.recovery_category.replace(/_/g, ' '),
        amount: r.budgeted_amount,
        source: 'Recovery Engine',
        category: 'recovery',
        status: 'projected_variable',
        confidence: 'Estimate',
        billing_period: period,
      });
    }

    // Add utility placeholder if no recoveries exist yet
    if (!recoveries?.length) {
      charges.push({
        description: 'Utilities',
        amount: 0,
        source: 'Utility Billing',
        category: 'utilities',
        status: 'pending',
        confidence: 'Awaiting meter reading',
        billing_period: period,
      });
    }

    return charges;
  }
};
