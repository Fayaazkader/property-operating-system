// lib/intelligence/relationship-provider.ts
// Relationship Provider — Every module registers its relationships.
// Operational Context asks: "Give me related objects for entity X"

import { supabase } from '@/lib/supabase';

export interface RelatedObject {
  id: string;
  type: string;
  title: string;
  href: string;
  status?: string;
}

type RelationshipResolver = (entityId: string, entityType: string) => Promise<RelatedObject[]>;

const resolvers: Map<string, RelationshipResolver> = new Map();

export function registerRelationshipResolver(domain: string, resolver: RelationshipResolver): void {
  resolvers.set(domain, resolver);
}

export async function getRelatedObjects(entityId: string, domains?: string[]): Promise<Record<string, RelatedObject[]>> {
  const result: Record<string, RelatedObject[]> = {};
  const targetDomains = domains || Array.from(resolvers.keys());

  for (const domain of targetDomains) {
    const resolver = resolvers.get(domain);
    if (resolver) {
      try {
        result[domain] = await resolver(entityId, domain);
      } catch { result[domain] = []; }
    }
  }

  return result;
}

// Register built-in resolvers
registerRelationshipResolver('maintenance', async (entityId: string) => {
  const { data } = await supabase.from('maintenance_issues').select('id, title, status').eq('property_id', entityId).limit(5);
  return (data || []).map((i: any) => ({ id: i.id, type: 'maintenance', title: i.title, href: `/maintenance/${i.id}`, status: i.status }));
});

registerRelationshipResolver('inspections', async (entityId: string) => {
  const { data } = await supabase.from('inspections').select('id, title, status').eq('property_id', entityId).limit(5);
  return (data || []).map((i: any) => ({ id: i.id, type: 'inspection', title: i.title, href: `/inspections`, status: i.status }));
});

registerRelationshipResolver('recoveries', async (entityId: string) => {
  const { data } = await supabase.from('recoveries').select('id, recovery_category, status').eq('property_id', entityId).limit(5);
  return (data || []).map((r: any) => ({ id: r.id, type: 'recovery', title: r.recovery_category?.replace(/_/g, ' ') || 'Recovery', href: `/utilities/${r.id}`, status: r.status }));
});

registerRelationshipResolver('leases', async (entityId: string) => {
  const { data } = await supabase.from('leases').select('id, lease_ref, lease_status').eq('property_id', entityId).limit(5);
  return (data || []).map((l: any) => ({ id: l.id, type: 'lease', title: l.lease_ref || 'Lease', href: `/leases`, status: l.lease_status }));
});
