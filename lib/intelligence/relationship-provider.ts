// lib/intelligence/relationship-provider.ts
// Relationship Provider — Modules register resolvers + declare what they need

export interface RelatedObject {
  source: string;
  target: string;
  relationship: string;
  id: string;
  type: string;
  title: string;
  href: string;
  status?: string;
}

type RelationshipResolver = (entityId: string) => Promise<RelatedObject[]>;

const resolvers: Map<string, RelationshipResolver> = new Map();

// Each domain declares what relationships it needs
const domainRelationships: Map<string, string[]> = new Map();

export function registerRelationshipResolver(domain: string, resolver: RelationshipResolver): void {
  resolvers.set(domain, resolver);
}

export function declareDomainRelationships(domain: string, needs: string[]): void {
  domainRelationships.set(domain, needs);
}

export async function getRelatedObjects(entityId: string, domain?: string): Promise<Record<string, RelatedObject[]>> {
  const result: Record<string, RelatedObject[]> = {};
  
  // If a specific domain is asking, only resolve what it needs
  const targetDomains = domain && domainRelationships.has(domain) 
    ? domainRelationships.get(domain)!
    : Array.from(resolvers.keys());

  for (const d of targetDomains) {
    const resolver = resolvers.get(d);
    if (resolver) {
      try { result[d] = await resolver(entityId); } catch { result[d] = []; }
    }
  }

  return result;
}

// Declare what each workspace needs
declareDomainRelationships('utilities', ['maintenance', 'inspections', 'leases', 'recoveries']);
declareDomainRelationships('maintenance', ['inspections', 'leases', 'recoveries']);
declareDomainRelationships('inspections', ['maintenance', 'leases']);
