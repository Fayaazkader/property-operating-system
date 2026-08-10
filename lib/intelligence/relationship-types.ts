// lib/intelligence/relationship-types.ts
// Platform-standard relationship types — every module uses these

export type RelationshipType = 
  | 'BELONGS_TO'
  | 'AFFECTS'
  | 'GENERATED_BY'
  | 'ALLOCATED_TO'
  | 'RECOVERS'
  | 'SUPPLIED_BY'
  | 'INSPECTED_BY'
  | 'CREATED_FROM'
  | 'HAS_ISSUE'
  | 'HAS_INSPECTION'
  | 'HAS_RECOVERY'
  | 'HAS_LEASE'
  | 'BILLED_TO';

export interface RelationshipEdge {
  source: string;
  target: string;
  type: RelationshipType;
  id: string;
  entityType: string;
  title: string;
  href: string;
  status?: string;
}

export interface WorkspaceRegistration {
  workspace: string;
  relationships: Array<{
    domain: string;
    priority: number;
    required?: boolean;
  }>;
}
