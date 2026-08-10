// lib/procurement/manifest.ts
import { supabase } from '@/lib/supabase';
import { registerManifest } from '@/lib/intelligence/module-manifest';

registerManifest({
  metadata: { domain: 'procurement', label: 'Procurement' },
  services: {
    relationships: {
      resolvers: {
        procurement: async (entityId: string) => {
          const { data } = await supabase.from('procurement_spend_requests').select('id, title, status').eq('property_id', entityId).limit(5);
          return (data || []).map((sr: any) => ({ source: entityId, target: sr.id, type: 'GENERATED_BY' as const, id: sr.id, entityType: 'spend_request', title: sr.title, href: `/procurement/${sr.id}`, status: sr.status }));
        },
      },
      needs: [
        { domain: 'maintenance', priority: 1 },
        { domain: 'leases', priority: 2 },
        { domain: 'recoveries', priority: 3 },
      ],
    },
  },
});
