import { supabase } from '@/lib/supabase';
import { registerManifest } from '@/lib/intelligence/module-manifest';
import type { RelationshipEdge } from '@/lib/intelligence/relationship-types';

registerManifest({
  domain: 'utilities',
  label: 'Utilities & Recoveries',
  relationships: {
    resolvers: {
      recoveries: async (entityId: string): Promise<RelationshipEdge[]> => {
        const { data } = await supabase.from('recoveries').select('id, recovery_category, status').eq('property_id', entityId).limit(5);
        return (data || []).map((r: any) => ({
          source: entityId, target: r.id, type: 'HAS_RECOVERY',
          id: r.id, entityType: 'recovery', title: r.recovery_category?.replace(/_/g, ' ') || 'Recovery', href: `/utilities/${r.id}`, status: r.status,
        }));
      },
      leases: async (entityId: string): Promise<RelationshipEdge[]> => {
        const { data } = await supabase.from('leases').select('id, lease_ref, lease_status').eq('property_id', entityId).limit(5);
        return (data || []).map((l: any) => ({
          source: entityId, target: l.id, type: 'HAS_LEASE',
          id: l.id, entityType: 'lease', title: l.lease_ref || 'Lease', href: `/leases`, status: l.lease_status,
        }));
      },
    },
    needs: [
      { domain: 'maintenance', priority: 1 },
      { domain: 'inspections', priority: 2 },
      { domain: 'leases', priority: 3 },
      { domain: 'recoveries', priority: 4 },
    ],
  },
});
