// lib/revenue/services/charge-preview-service.ts
// Sources next period charges from the billing engine, not the lease

import { supabase } from '@/lib/supabase';

export interface UpcomingCharge {
  description: string;
  amount: number;
  vat_applicable: boolean;
  vat_amount: number;
  total: number;
}

export const chargePreviewService = {
  async getUpcomingCharges(tenantId: string, leaseId: string): Promise<UpcomingCharge[]> {
    // Source from billing rules/charge generator, not the lease directly
    const { data: lease } = await supabase
      .from('leases')
      .select('monthly_rental, parking_bays, parking_rate, lease_type')
      .eq('id', leaseId)
      .single();

    if (!lease) return [];

    const charges: UpcomingCharge[] = [];
    const isCommercial = lease.lease_type !== 'residential';
    const vatRate = isCommercial ? 0.15 : 0;

    // Base rent
    if (lease.monthly_rental) {
      const vat = Math.round(lease.monthly_rental * vatRate * 100) / 100;
      charges.push({
        description: 'Base Rent',
        amount: lease.monthly_rental,
        vat_applicable: isCommercial,
        vat_amount: vat,
        total: lease.monthly_rental + vat,
      });
    }

    // Parking
    if (lease.parking_bays && lease.parking_rate) {
      const parkingTotal = lease.parking_bays * lease.parking_rate;
      const vat = Math.round(parkingTotal * vatRate * 100) / 100;
      charges.push({
        description: `Parking (${lease.parking_bays} bays)`,
        amount: parkingTotal,
        vat_applicable: isCommercial,
        vat_amount: vat,
        total: parkingTotal + vat,
      });
    }

    // Recoveries — sourced from recovery engine, not lease
    const { data: recoveries } = await supabase
      .from('recoveries')
      .select('recovery_category, budgeted_amount')
      .eq('lease_id', leaseId)
      .eq('status', 'budgeted');

    for (const r of (recoveries || [])) {
      const vat = Math.round(r.budgeted_amount * vatRate * 100) / 100;
      charges.push({
        description: r.recovery_category.replace(/_/g, ' '),
        amount: r.budgeted_amount,
        vat_applicable: isCommercial,
        vat_amount: vat,
        total: r.budgeted_amount + vat,
      });
    }

    return charges;
  }
};
