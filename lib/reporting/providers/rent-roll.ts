// lib/reporting/providers/rent-roll.ts
import { supabase } from '@/lib/supabase';

export async function getRentRollData(entityId: string): Promise<{ headers: string[]; rows: string[][]; totals: string[] }> {
  const { data: leases } = await supabase
    .from('leases')
    .select('tenant_name, property_name, monthly_rental, lease_start_date, lease_end_date, parking_bays, parking_rate')
    .eq('lease_status', 'Active')
    .eq('owner_entity_id', entityId)
    .order('property_name');

  const rows: string[][] = [];
  let totalRent = 0;

  for (const l of (leases || [])) {
    const parking = (l.parking_bays || 0) * (l.parking_rate || 0);
    const total = (l.monthly_rental || 0) + parking;
    totalRent += total;
    rows.push([l.property_name || '', l.tenant_name || '', (l.monthly_rental || 0).toLocaleString(), parking.toLocaleString(), total.toLocaleString(), l.lease_end_date || '']);
  }

  return {
    headers: ['Property', 'Tenant', 'Base Rent', 'Parking', 'Total', 'Lease End'],
    rows,
    totals: ['', '', '', 'TOTAL', totalRent.toLocaleString(), ''],
  };
}
