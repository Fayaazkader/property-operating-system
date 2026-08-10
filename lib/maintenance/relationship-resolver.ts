import { supabase } from '@/lib/supabase';
import { registerManifest } from '@/lib/intelligence/module-manifest';

registerManifest({
  metadata: { domain: 'maintenance', label: 'Maintenance' },
  services: {
    relationships: {
      resolvers: {
        maintenance: async (entityId: string) => {
          const { data } = await supabase.from('maintenance_issues').select('id, title, status').eq('property_id', entityId).limit(5);
          return (data || []).map((i: any) => ({ source: entityId, target: i.id, type: 'HAS_ISSUE' as const, id: i.id, entityType: 'maintenance_issue', title: i.title, href: `/maintenance/${i.id}`, status: i.status }));
        },
      },
      needs: [
        { domain: 'inspections', priority: 1 },
        { domain: 'leases', priority: 2 },
      ],
    },
  },
});
