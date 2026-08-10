// lib/intelligence/module-manifest.ts
// Module Manifest — Metadata separate from services

import type { RelationshipEdge } from './relationship-types';

export interface ModuleMetadata {
  domain: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ModuleServices {
  relationships?: {
    resolvers: Record<string, (entityId: string) => Promise<RelationshipEdge[]>>;
    needs: Array<{ domain: string; priority: number }>;
  };
  intelligence?: {
    analyze: (entityId: string) => Promise<void>;
  };
}

export interface ModuleManifest {
  metadata: ModuleMetadata;
  services: ModuleServices;
}

const manifests: Map<string, ModuleManifest> = new Map();

export function registerManifest(manifest: ModuleManifest): void {
  manifests.set(manifest.metadata.domain, manifest);
}

export function getManifest(domain: string): ModuleManifest | undefined {
  return manifests.get(domain);
}

export function getRelationshipsForWorkspace(workspace: string): Array<{ domain: string; priority: number }> {
  const manifest = manifests.get(workspace);
  return manifest?.services?.relationships?.needs || [];
}

export function resolveRelationships(entityId: string, workspace: string): Record<string, Promise<RelationshipEdge[]>> {
  const manifest = manifests.get(workspace);
  if (!manifest?.services?.relationships) return {};

  const result: Record<string, Promise<RelationshipEdge[]>> = {};
  for (const need of manifest.services.relationships.needs) {
    const resolver = manifest.services.relationships.resolvers[need.domain];
    if (resolver) {
      result[need.domain] = resolver(entityId).catch(() => []);
    }
  }
  return result;
}
