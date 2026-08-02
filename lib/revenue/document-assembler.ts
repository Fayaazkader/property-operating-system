// lib/revenue/document-assembler.ts

import type { BillingDocument } from './types';

export function assembleDocuments(
  tenantDocs: any[],
  propertyDocs: any[],
  tenantId: string,
  propertyId: string
): BillingDocument[] {
  const docs: BillingDocument[] = [];
  
  for (const d of tenantDocs.filter((d: any) => d.tenant_id === tenantId).slice(0, 3)) {
    docs.push({ name: d.file_name, level: 'tenant', url: d.file_url, type: 'tenant_document' });
  }
  for (const d of propertyDocs.filter((d: any) => d.related_entity_id === propertyId).slice(0, 3)) {
    docs.push({ name: d.file_name, level: 'property', url: d.file_url, type: 'property_document' });
  }
  
  return docs;
}
