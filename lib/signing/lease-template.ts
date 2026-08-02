// lib/signing/lease-template.ts
// Reads signing template from database — configurable per entity

import { supabase } from '@/lib/supabase';
import type { SigningField, LeaseSigningTemplate } from './types';

export async function getLeaseTemplate(entityId: string): Promise<LeaseSigningTemplate> {
  const { data } = await supabase
    .from('signing_templates')
    .select('*')
    .eq('entity_id', entityId)
    .eq('is_default', true)
    .single();

  if (data) {
    return {
      landlord_signature: data.landlord_signature,
      tenant_signature: data.tenant_signature,
      witness_signature: data.witness_signature,
      landlord_initials: data.landlord_initials,
      tenant_initials: data.tenant_initials,
      date_fields: data.date_fields || [],
    };
  }

  // Fallback default
  return {
    landlord_signature: { page: -1, x: 120, y: 620, width: 200, height: 60 },
    tenant_signature: { page: -1, x: 380, y: 620, width: 200, height: 60 },
    witness_signature: { page: -1, x: 120, y: 720, width: 200, height: 60 },
    landlord_initials: { x: 520, y: 780, width: 60, height: 30, pages: [] },
    tenant_initials: { x: 520, y: 750, width: 60, height: 30, pages: [] },
    date_fields: [{ page: -1, x: 120, y: 690 }, { page: -1, x: 380, y: 690 }],
  };
}

export function generateLeaseSigningFields(
  totalPages: number,
  template: LeaseSigningTemplate
): SigningField[] {
  const lastPage = totalPages;
  const fields: SigningField[] = [];

  const addField = (config: { page: number; x: number; y: number; width: number; height: number }, type: SigningField['type'], role?: string) => {
    const page = config.page === -1 ? lastPage : config.page;
    fields.push({
      id: crypto.randomUUID(),
      type,
      page,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      signerRole: role as any,
      isTemplate: true,
    });
  };

  addField(template.landlord_signature, 'signature', 'landlord');
  addField(template.tenant_signature, 'signature', 'tenant');
  if (template.witness_signature) addField(template.witness_signature, 'witness', 'witness');

  // Initials — template only, replicas on user choice
  fields.push({
    id: crypto.randomUUID(),
    type: 'initial',
    page: 1,
    x: template.landlord_initials.x,
    y: template.landlord_initials.y,
    width: template.landlord_initials.width,
    height: template.landlord_initials.height,
    signerRole: 'landlord',
    isTemplate: true,
    replicatePages: [],
  });

  fields.push({
    id: crypto.randomUUID(),
    type: 'initial',
    page: 1,
    x: template.tenant_initials.x,
    y: template.tenant_initials.y,
    width: template.tenant_initials.width,
    height: template.tenant_initials.height,
    signerRole: 'tenant',
    isTemplate: true,
    replicatePages: [],
  });

  // Dates
  for (const df of template.date_fields) {
    addField({ ...df, width: 120, height: 30 }, 'date');
  }

  return fields;
}
