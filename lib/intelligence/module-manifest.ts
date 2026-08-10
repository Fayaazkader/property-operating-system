// lib/intelligence/module-manifest.ts
// Module Manifest — Every module declares what it provides. Bootstrap discovers them.

import type { RelationshipEdge } from './relationship-types';

export interface ModuleManifest {
  domain: string;
  label: string;
  relationships: {
    resolvers: Record<string, (entityId: string) => Promise<RelationshipEdge[]>>;
    needs: Array<{ domain: string; priority: number }>;
  };
  intelligence?: {
    analyze: (entityId: string) => Promise<void>;
  };
}

const manifests: Map<string, ModuleManifest> = new Map();

export function registerManifest(manifest: ModuleManifest): void {
  manifests.set(manifest.domain, manifest);
}

export function getManifest(domain: string): ModuleManifest | undefined {
  return manifests.get(domain);
}

export function getAllManifests(): ModuleManifest[] {
  return Array.from(manifests.values());
}

export function getRelationshipsForWorkspace(workspace: string): Array<{ domain: string; priority: number }> {
  const manifest = manifests.get(workspace);
  return manifest?.relationships?.needs || [];
}

export function resolveRelationships(entityId: string, workspace: string): Record<string, Promise<RelationshipEdge[]>> {
  const manifest = manifests.get(workspace);
  if (!manifest) return {};

  const result: Record<string, Promise<RelationshipEdge[]>> = {};
  for (const need of (manifest.relationships?.needs || [])) {
    const resolver = manifest.relationships?.resolvers[need.domain];
    if (resolver) {
      result[need.domain] = resolver(entityId).catch(() => []);
    }
  }
  return result;
}
