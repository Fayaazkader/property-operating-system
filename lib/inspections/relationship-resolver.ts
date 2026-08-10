import { supabase } from '@/lib/supabase';
import { registerManifest } from '@/lib/intelligence/module-manifest';
import type { RelationshipEdge } from '@/lib/intelligence/relationship-types';

registerManifest({
  domain: 'inspections',
  label: 'Inspections',
  relationships: {
    resolvers: {
      inspections: async (entityId: string): Promise<RelationshipEdge[]> => {
        const { data } = await supabase.from('inspections').select('id, title, status').eq('property_id', entityId).limit(5);
        return (data || []).map((i: any) => ({
          source: entityId, target: i.id, type: 'HAS_INSPECTION',
          id: i.id, entityType: 'inspection', title: i.title, href: `/inspections`, status: i.status,
        }));
      },
    },
    needs: [
      { domain: 'maintenance', priority: 1 },
      { domain: 'leases', priority: 2 },
    ],
  },
});
