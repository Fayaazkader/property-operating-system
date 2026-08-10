import { supabase } from '@/lib/supabase';
import { registerManifest } from '@/lib/intelligence/module-manifest';

registerManifest({
  metadata: { domain: 'inspections', label: 'Inspections' },
  services: {
    relationships: {
      resolvers: {
        inspections: async (entityId: string) => {
          const { data } = await supabase.from('inspections').select('id, title, status').eq('property_id', entityId).limit(5);
          return (data || []).map((i: any) => ({ source: entityId, target: i.id, type: 'HAS_INSPECTION' as const, id: i.id, entityType: 'inspection', title: i.title, href: `/inspections`, status: i.status }));
        },
      },
      needs: [
        { domain: 'maintenance', priority: 1 },
        { domain: 'leases', priority: 2 },
      ],
    },
  },
});
