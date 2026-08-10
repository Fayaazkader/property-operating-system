// lib/intelligence/relationship-provider.ts
// Relationship Provider — Modules register resolvers + workspace needs

import type { RelationshipEdge, WorkspaceRegistration } from './relationship-types';

type RelationshipResolver = (entityId: string) => Promise<RelationshipEdge[]>;

const resolvers: Map<string, RelationshipResolver> = new Map();
const workspaceRegistrations: Map<string, WorkspaceRegistration> = new Map();

export function registerRelationshipResolver(domain: string, resolver: RelationshipResolver): void {
  resolvers.set(domain, resolver);
}

export function registerWorkspace(registration: WorkspaceRegistration): void {
  workspaceRegistrations.set(registration.workspace, registration);
}

export async function getRelatedObjects(entityId: string, workspace?: string): Promise<Record<string, RelationshipEdge[]>> {
  const result: Record<string, RelationshipEdge[]> = {};

  // If workspace is registered, only resolve what it needs (in priority order)
  const targetDomains = workspace && workspaceRegistrations.has(workspace)
    ? workspaceRegistrations.get(workspace)!.relationships
        .sort((a, b) => a.priority - b.priority)
        .map(r => r.domain)
    : Array.from(resolvers.keys());

  for (const domain of targetDomains) {
    const resolver = resolvers.get(domain);
    if (resolver) {
      try { result[domain] = await resolver(entityId); } catch { result[domain] = []; }
    }
  }

  return result;
}

// Register workspaces
registerWorkspace({
  workspace: 'utilities',
  relationships: [
    { domain: 'maintenance', priority: 1 },
    { domain: 'inspections', priority: 2 },
    { domain: 'leases', priority: 3 },
    { domain: 'recoveries', priority: 4 },
  ],
});

registerWorkspace({
  workspace: 'maintenance',
  relationships: [
    { domain: 'inspections', priority: 1 },
    { domain: 'leases', priority: 2 },
    { domain: 'recoveries', priority: 3 },
  ],
});

registerWorkspace({
  workspace: 'inspections',
  relationships: [
    { domain: 'maintenance', priority: 1 },
    { domain: 'leases', priority: 2 },
  ],
});
