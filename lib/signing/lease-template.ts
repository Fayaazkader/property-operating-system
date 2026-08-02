// lib/signing/lease-template.ts
// Pre-defined signing field positions for lease documents

import type { SigningField, LeaseSigningTemplate } from './types';

// Standard commercial lease signing positions
// These are calibrated for the AssetFlow lease template
// In production, these would be configurable per entity

const STANDARD_COMMERCIAL_LEASE: LeaseSigningTemplate = {
  landlord_signature: { page: -1, x: 120, y: 620, width: 200, height: 60 },    // -1 = last page
  tenant_signature: { page: -1, x: 380, y: 620, width: 200, height: 60 },
  witness_signature: { page: -1, x: 120, y: 720, width: 200, height: 60 },
  landlord_initials: { x: 520, y: 780, width: 60, height: 30, pages: [] },      // pages[] = all pages
  tenant_initials: { x: 520, y: 750, width: 60, height: 30, pages: [] },
  date_fields: [
    { page: -1, x: 120, y: 690 },
    { page: -1, x: 380, y: 690 },
  ],
};

export function generateLeaseSigningFields(
  totalPages: number,
  template?: LeaseSigningTemplate
): SigningField[] {
  const t = template || STANDARD_COMMERCIAL_LEASE;
  const lastPage = totalPages;
  const fields: SigningField[] = [];

  // Landlord signature — last page
  const lp = t.landlord_signature.page === -1 ? lastPage : t.landlord_signature.page;
  fields.push({
    id: crypto.randomUUID(),
    type: 'signature',
    page: lp,
    x: t.landlord_signature.x,
    y: t.landlord_signature.y,
    width: t.landlord_signature.width,
    height: t.landlord_signature.height,
    signerRole: 'landlord',
    isTemplate: true,
  });

  // Tenant signature — last page
  const tp = t.tenant_signature.page === -1 ? lastPage : t.tenant_signature.page;
  fields.push({
    id: crypto.randomUUID(),
    type: 'signature',
    page: tp,
    x: t.tenant_signature.x,
    y: t.tenant_signature.y,
    width: t.tenant_signature.width,
    height: t.tenant_signature.height,
    signerRole: 'tenant',
    isTemplate: true,
  });

  // Witness
  if (t.witness_signature) {
    const wp = t.witness_signature.page === -1 ? lastPage : t.witness_signature.page;
    fields.push({
      id: crypto.randomUUID(),
      type: 'witness',
      page: wp,
      x: t.witness_signature.x,
      y: t.witness_signature.y,
      width: t.witness_signature.width,
      height: t.witness_signature.height,
      signerRole: 'witness',
      isTemplate: true,
    });
  }

  // Landlord initials — all pages
  const landlordInitialTemplate: SigningField = {
    id: crypto.randomUUID(),
    type: 'initial',
    page: 1,
    x: t.landlord_initials.x,
    y: t.landlord_initials.y,
    width: t.landlord_initials.width,
    height: t.landlord_initials.height,
    signerRole: 'landlord',
    isTemplate: true,
    replicatePages: Array.from({ length: totalPages }, (_, i) => i + 1),
  };
  fields.push(landlordInitialTemplate);

  // Create replicas for all pages
  for (let p = 2; p <= totalPages; p++) {
    fields.push({
      ...landlordInitialTemplate,
      id: crypto.randomUUID(),
      page: p,
      isReplica: true,
      templateId: landlordInitialTemplate.id,
    });
  }

  // Tenant initials — all pages
  const tenantInitialTemplate: SigningField = {
    id: crypto.randomUUID(),
    type: 'initial',
    page: 1,
    x: t.tenant_initials.x,
    y: t.tenant_initials.y,
    width: t.tenant_initials.width,
    height: t.tenant_initials.height,
    signerRole: 'tenant',
    isTemplate: true,
    replicatePages: Array.from({ length: totalPages }, (_, i) => i + 1),
  };
  fields.push(tenantInitialTemplate);

  for (let p = 2; p <= totalPages; p++) {
    fields.push({
      ...tenantInitialTemplate,
      id: crypto.randomUUID(),
      page: p,
      isReplica: true,
      templateId: tenantInitialTemplate.id,
    });
  }

  // Date fields
  for (const df of t.date_fields) {
    const dp = df.page === -1 ? lastPage : df.page;
    fields.push({
      id: crypto.randomUUID(),
      type: 'date',
      page: dp,
      x: df.x,
      y: df.y,
      width: 120,
      height: 30,
      isTemplate: true,
    });
  }

  return fields;
}
