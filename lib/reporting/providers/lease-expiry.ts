// lib/reporting/providers/lease-expiry.ts
import { supabase } from '@/lib/supabase';

export async function getLeaseExpiryData(entityId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data: leases } = await supabase
    .from('leases')
    .select('tenant_name, property_name, lease_id, monthly_rental, lease_end_date, lease_status')
    .eq('owner_entity_id', entityId)
    .eq('lease_status', 'Active')
    .order('lease_end_date', { ascending: true });

  const rows = (leases || []).map(l => {
    const daysRemaining = l.lease_end_date ? Math.ceil((new Date(l.lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    return [l.property_name || '', l.tenant_name || '', l.lease_id || '', (l.monthly_rental || 0).toLocaleString(), l.lease_end_date || '', daysRemaining.toString(), daysRemaining <= 90 ? '⚠ Expiring' : 'Active'];
  });

  return { headers: ['Property', 'Tenant', 'Lease', 'Monthly Rent', 'End Date', 'Days Left', 'Status'], rows, totals: [] };
}
