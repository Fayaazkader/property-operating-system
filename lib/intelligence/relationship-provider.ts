// lib/intelligence/relationship-provider.ts
// Thin wrapper — delegates to module manifests

import { resolveRelationships } from './module-manifest';
import type { RelationshipEdge } from './relationship-types';

export async function getRelatedObjects(entityId: string, workspace?: string): Promise<Record<string, RelationshipEdge[]>> {
  if (!workspace) return {};
  
  const promises = resolveRelationships(entityId, workspace);
  const result: Record<string, RelationshipEdge[]> = {};
  
  for (const [domain, promise] of Object.entries(promises)) {
    result[domain] = await promise;
  }
  
  return result;
}
