// lib/reporting/providers/tenancy-schedule.ts
import { supabase } from '@/lib/supabase';

export async function getTenancyScheduleData(entityId: string) {
  const { data: leases } = await supabase
    .from('leases')
    .select('tenant_name, property_name, lease_id, unit_number, monthly_rental, lease_start_date, lease_end_date, parking_bays, parking_rate, escalation_percent, deposit_amount, lease_status, gla_sqm, lease_type, notice_period_days')
    .eq('owner_entity_id', entityId)
    .order('property_name')
    .order('tenant_name');

  const rows = (leases || []).map(l => [
    l.property_name || '', l.tenant_name || '', l.lease_id || '', l.unit_number || '',
    (l.monthly_rental || 0).toLocaleString(), l.lease_start_date || '', l.lease_end_date || '',
    (l.parking_bays || 0).toString(), (l.parking_rate || 0).toLocaleString(),
    `${l.escalation_percent || 0}%`, (l.deposit_amount || 0).toLocaleString(),
    (l.gla_sqm || 0).toString(), l.lease_type || '', l.notice_period_days?.toString() || '', l.lease_status || '',
  ]);

  return {
    headers: ['Property', 'Tenant', 'Lease', 'Unit', 'Rent', 'Start', 'End', 'Parking', 'Park Rate', 'Escalation', 'Deposit', 'GLA', 'Type', 'Notice', 'Status'],
    rows,
    totals: [],
  };
}
