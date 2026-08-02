// lib/signing/lease-template.ts
// Hierarchical signing templates — Platform → Entity → Property → Lease

import { supabase } from '@/lib/supabase';
import type { SigningField, LeaseSigningTemplate } from './types';
import type { NormalisedRect } from './coordinates';

export async function getLeaseTemplate(
  entityId: string,
  propertyId?: string,
  leaseId?: string
): Promise<{ template: LeaseSigningTemplate; version: number; templateId: string; expiryDays: number }> {
  // Try property-level first, then entity, then platform default
  let query = supabase.from('signing_templates').select('*').eq('is_active', true).order('version', { ascending: false });
  
  if (propertyId) {
    const { data } = await query.eq('property_id', propertyId).limit(1).single();
    if (data) return { template: mapToTemplate(data), version: data.version, templateId: data.id, expiryDays: data.expiry_days || 14 };
  }
  
  const { data: entityTemplate } = await supabase.from('signing_templates').select('*').eq('entity_id', entityId).is('property_id', null).eq('is_active', true).order('version', { ascending: false }).limit(1).single();
  if (entityTemplate) return { template: mapToTemplate(entityTemplate), version: entityTemplate.version, templateId: entityTemplate.id, expiryDays: entityTemplate.expiry_days || 14 };

  // Fallback
  return { template: getDefaultTemplate(), version: 1, templateId: 'default', expiryDays: 14 };
}

function mapToTemplate(data: any): LeaseSigningTemplate {
  return {
    landlord_signature: data.landlord_signature,
    tenant_signature: data.tenant_signature,
    witness_signature: data.witness_signature,
    landlord_initials: data.landlord_initials,
    tenant_initials: data.tenant_initials,
    date_fields: data.date_fields || [],
    witnesses_count: data.witnesses_count || 1,
  };
}

function getDefaultTemplate(): LeaseSigningTemplate {
  return {
    landlord_signature: { page: -1, x: 0.15, y: 0.78, width: 0.25, height: 0.07 },
    tenant_signature: { page: -1, x: 0.50, y: 0.78, width: 0.25, height: 0.07 },
    witness_signature: { page: -1, x: 0.15, y: 0.90, width: 0.25, height: 0.07 },
    landlord_initials: { x: 0.70, y: 0.95, width: 0.07, height: 0.04, pages: [] },
    tenant_initials: { x: 0.70, y: 0.91, width: 0.07, height: 0.04, pages: [] },
    date_fields: [{ page: -1, x: 0.15, y: 0.87 }, { page: -1, x: 0.50, y: 0.87 }],
    witnesses_count: 1,
  };
}

export function generateLeaseSigningFields(
  totalPages: number,
  template: LeaseSigningTemplate
): SigningField[] {
  const lastPage = totalPages;
  const fields: SigningField[] = [];

  const addField = (config: any, type: SigningField['type'], role?: string) => {
    const page = config.page === -1 ? lastPage : config.page;
    fields.push({
      id: crypto.randomUUID(), type, page,
      x: config.x, y: config.y, width: config.width || config.w, height: config.height || config.h,
      signerRole: role as any, isTemplate: true,
    });
  };

  addField(template.landlord_signature, 'signature', 'landlord');
  addField(template.tenant_signature, 'signature', 'tenant');

  const witnessCount = template.witnesses_count || 1;
  for (let i = 0; i < witnessCount; i++) {
    const wx = (template.witness_signature?.x || 0.15) + (i * 0.20);
    addField({ ...template.witness_signature, x: wx }, 'witness', `witness_${i + 1}`);
  }

  fields.push({
    id: crypto.randomUUID(), type: 'initial', page: 1,
    x: template.landlord_initials.x, y: template.landlord_initials.y,
    width: template.landlord_initials.width, height: template.landlord_initials.height,
    signerRole: 'landlord', isTemplate: true, replicatePages: [],
  });

  fields.push({
    id: crypto.randomUUID(), type: 'initial', page: 1,
    x: template.tenant_initials.x, y: template.tenant_initials.y,
    width: template.tenant_initials.width, height: template.tenant_initials.height,
    signerRole: 'tenant', isTemplate: true, replicatePages: [],
  });

  for (const df of template.date_fields) {
    addField({ ...df, width: df.width || 0.15, height: df.height || 0.04 }, 'date');
  }

  return fields;
}
