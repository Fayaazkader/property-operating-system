// lib/signing/initial-replicator.ts
// Handles smart initial replication across pages

import type { SigningField } from './types';

export function replicateInitials(
  templateField: SigningField,
  totalPages: number,
  selectedPages: number[]
): SigningField[] {
  const replicas: SigningField[] = [];
  
  for (const page of selectedPages) {
    if (page === templateField.page) continue; // Skip the template page itself
    
    replicas.push({
      ...templateField,
      id: crypto.randomUUID(),
      page,
      isReplica: true,
      templateId: templateField.id,
      value: templateField.value, // Share the same signature image
    });
  }
  
  return replicas;
}

export function moveReplicatedInitials(
  fields: SigningField[],
  templateId: string,
  deltaX: number,
  deltaY: number,
  applyToAll: boolean
): SigningField[] {
  return fields.map(f => {
    if (f.id === templateId) {
      return { ...f, x: f.x + deltaX, y: f.y + deltaY };
    }
    if (applyToAll && f.templateId === templateId) {
      return { ...f, x: f.x + deltaX, y: f.y + deltaY };
    }
    return f;
  });
}

export function getInitialTemplate(fields: SigningField[], templateId: string): SigningField | undefined {
  return fields.find(f => f.id === templateId && !f.isReplica);
}

export function getReplicaCount(fields: SigningField[], templateId: string): number {
  return fields.filter(f => f.templateId === templateId && f.isReplica).length;
}
