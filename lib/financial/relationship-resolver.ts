import { supabase } from '@/lib/supabase';
import { registerRelationshipResolver } from '@/lib/intelligence/relationship-provider';
import type { RelationshipEdge } from '@/lib/intelligence/relationship-types';

registerRelationshipResolver('recoveries', async (entityId: string): Promise<RelationshipEdge[]> => {
  const { data } = await supabase.from('recoveries').select('id, recovery_category, status').eq('property_id', entityId).limit(5);
  return (data || []).map((r: any) => ({
    source: entityId, target: r.id, type: 'HAS_RECOVERY',
    id: r.id, entityType: 'recovery', title: r.recovery_category?.replace(/_/g, ' ') || 'Recovery', href: `/utilities/${r.id}`, status: r.status,
  }));
});

registerRelationshipResolver('leases', async (entityId: string): Promise<RelationshipEdge[]> => {
  const { data } = await supabase.from('leases').select('id, lease_ref, lease_status').eq('property_id', entityId).limit(5);
  return (data || []).map((l: any) => ({
    source: entityId, target: l.id, type: 'HAS_LEASE',
    id: l.id, entityType: 'lease', title: l.lease_ref || 'Lease', href: `/leases`, status: l.lease_status,
  }));
});
