// lib/financial/relationship-resolver.ts
import { supabase } from '@/lib/supabase';
import { registerRelationshipResolver } from '@/lib/intelligence/relationship-provider';

registerRelationshipResolver('recoveries', async (entityId: string) => {
  const { data } = await supabase.from('recoveries').select('id, recovery_category, status').eq('property_id', entityId).limit(5);
  return (data || []).map((r: any) => ({
    source: entityId, target: r.id,
    relationship: 'has_recovery',
    id: r.id, type: 'recovery', title: r.recovery_category?.replace(/_/g, ' ') || 'Recovery', href: `/utilities/${r.id}`, status: r.status,
  }));
});

registerRelationshipResolver('leases', async (entityId: string) => {
  const { data } = await supabase.from('leases').select('id, lease_ref, lease_status').eq('property_id', entityId).limit(5);
  return (data || []).map((l: any) => ({
    source: entityId, target: l.id,
    relationship: 'has_lease',
    id: l.id, type: 'lease', title: l.lease_ref || 'Lease', href: `/leases`, status: l.lease_status,
  }));
});
