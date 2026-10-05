import type { SupabaseClient } from '@supabase/supabase-js';

import { PERMISSIONS } from '@/lib/rbac/permissions';
import { leaseTemplateService } from '../templates/service';
import { buildLeaseGenerationManifest } from './manifest';

import type {
  ApprovedCommercialSnapshot,
  LeaseGenerationEntity,
  LeaseGenerationManifest,
  LeaseGenerationProperty,
  LeaseGenerationUnit,
} from './types';

export class LeaseGenerationAuthorityError extends Error {
  constructor(
    public readonly code:
      | 'permission_denied'
      | 'opportunity_not_found'
      | 'commercial_terms_not_approved'
      | 'approved_version_not_found'
      | 'authority_mismatch'
      | 'property_not_found'
      | 'unit_not_found'
      | 'template_not_found'
      | 'template_not_applicable'
      | 'template_source_missing'
      | 'generation_invalid',
    message: string,
  ) {
    super(message);
    this.name = 'LeaseGenerationAuthorityError';
  }
}

interface PrepareLeaseGenerationInput {
  entityId: string;
  opportunityId: string;
  templateId: string;
  actorId: string;
}

interface OpportunityAuthorityRow {
  id: string;
  entity_id: string;
  unit_id: string | null;
  approved_terms_version_id: string | null;
}

interface CommercialVersionRow {
  id: string;
  entity_id: string;
  opportunity_id: string;
  version_number: number;
  snapshot: ApprovedCommercialSnapshot;
}

function requireSnapshotString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LeaseGenerationAuthorityError(
      'authority_mismatch',
      `Approved commercial snapshot is missing "${fieldName}".`,
    );
  }

  return value;
}

export async function prepareLeaseGeneration(
  input: PrepareLeaseGenerationInput,
  client: SupabaseClient,
): Promise<LeaseGenerationManifest> {
  const {
    entityId,
    opportunityId,
    templateId,
    actorId,
  } = input;

  /*
   * Permission authority.
   *
   * Do not infer generation authority from role names or membership.
   * AssetFlow's canonical permission resolver owns that decision.
   */
  const {
    data: canGenerate,
    error: permissionError,
  } = await client.rpc('has_entity_permission', {
    p_user_id: actorId,
    p_entity_id: entityId,
    p_permission_key: PERMISSIONS.LEASING.DOCUMENT_GENERATE,
  });

  if (permissionError) {
    throw permissionError;
  }

  if (canGenerate !== true) {
    throw new LeaseGenerationAuthorityError(
      'permission_denied',
      'Lease-document generation permission required.',
    );
  }

  /*
   * Opportunity authority.
   *
   * The mutable opportunity does not itself constitute approved commercial
   * terms. Its approved_terms_version_id is the pointer to the immutable
   * approved authority.
   */
  const {
    data: opportunity,
    error: opportunityError,
  } = await client
    .from('leasing_opportunities')
    .select(
      'id, entity_id, unit_id, approved_terms_version_id',
    )
    .eq('id', opportunityId)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (opportunityError) {
    throw opportunityError;
  }

  if (!opportunity) {
    throw new LeaseGenerationAuthorityError(
      'opportunity_not_found',
      'Leasing opportunity not found within the authorised entity.',
    );
  }

  const authorityOpportunity =
    opportunity as OpportunityAuthorityRow;

  if (!authorityOpportunity.approved_terms_version_id) {
    throw new LeaseGenerationAuthorityError(
      'commercial_terms_not_approved',
      'Commercial terms must be approved before lease generation.',
    );
  }

  /*
   * Load the exact immutable approved commercial version.
   * Repeat entity/opportunity checks here even though database lineage
   * constraints also protect this relationship. Generation fails closed.
   */
  const {
    data: commercialVersion,
    error: versionError,
  } = await client
    .from('leasing_opportunity_versions')
    .select(
      'id, entity_id, opportunity_id, version_number, snapshot',
    )
    .eq('id', authorityOpportunity.approved_terms_version_id)
    .eq('entity_id', entityId)
    .eq('opportunity_id', opportunityId)
    .maybeSingle();

  if (versionError) {
    throw versionError;
  }

  if (!commercialVersion) {
    throw new LeaseGenerationAuthorityError(
      'approved_version_not_found',
      'Approved commercial terms version could not be resolved.',
    );
  }

  const authorityVersion =
    commercialVersion as CommercialVersionRow;

  if (
    authorityVersion.id !==
      authorityOpportunity.approved_terms_version_id ||
    authorityVersion.entity_id !== entityId ||
    authorityVersion.opportunity_id !== opportunityId
  ) {
    throw new LeaseGenerationAuthorityError(
      'authority_mismatch',
      'Approved commercial version authority does not match the opportunity.',
    );
  }

  const snapshot = authorityVersion.snapshot;

  /*
   * Property and unit identity come from the immutable approved snapshot.
   *
   * We do not silently substitute a different current operational property
   * or unit when the approved commercial terms identify the contractual
   * premises.
   */
  const snapshotPropertyId = requireSnapshotString(
    snapshot.propertyId,
    'propertyId',
  );

  const snapshotUnitId = requireSnapshotString(
    snapshot.unitId,
    'unitId',
  );

  if (
    authorityOpportunity.unit_id &&
    authorityOpportunity.unit_id !== snapshotUnitId
  ) {
    throw new LeaseGenerationAuthorityError(
      'authority_mismatch',
      'Approved commercial unit does not match the opportunity unit.',
    );
  }

  const {
    data: property,
    error: propertyError,
  } = await client
    .from('properties')
    .select(
      'id, property_name, property_type, entity_id, owner_entity_id, managing_entity_id',
    )
    .eq('id', snapshotPropertyId)
    .maybeSingle();

  if (propertyError) {
    throw propertyError;
  }

  if (!property) {
    throw new LeaseGenerationAuthorityError(
      'property_not_found',
      'Approved commercial property could not be resolved.',
    );
  }

  const authorityProperty =
    property as LeaseGenerationProperty;

  /*
   * At least one canonical ownership relationship must tie the property
   * to the generation entity. This prevents a caller from pairing approved
   * commercial data with an unrelated property master record.
   */
  const propertyBelongsToEntity =
    authorityProperty.entity_id === entityId ||
    authorityProperty.owner_entity_id === entityId ||
    authorityProperty.managing_entity_id === entityId;

  if (!propertyBelongsToEntity) {
    throw new LeaseGenerationAuthorityError(
      'authority_mismatch',
      'Approved commercial property does not belong to the generation entity.',
    );
  }

  const {
    data: unit,
    error: unitError,
  } = await client
    .from('units')
    .select('id, property_id, unit_number')
    .eq('id', snapshotUnitId)
    .eq('property_id', snapshotPropertyId)
    .maybeSingle();

  if (unitError) {
    throw unitError;
  }

  if (!unit) {
    throw new LeaseGenerationAuthorityError(
      'unit_not_found',
      'Approved commercial unit could not be resolved for the property.',
    );
  }

  const authorityUnit = unit as LeaseGenerationUnit;

  /*
   * Landlord authority.
   */
  const {
    data: entity,
    error: entityError,
  } = await client
    .from('entities')
    .select(
      'id, name, entity_name, registration_number, vat_number, telephone, email',
    )
    .eq('id', entityId)
    .maybeSingle();

  if (entityError) {
    throw entityError;
  }

  if (!entity) {
    throw new LeaseGenerationAuthorityError(
      'authority_mismatch',
      'Generation entity could not be resolved.',
    );
  }

  const authorityEntity =
    entity as LeaseGenerationEntity;

  /*
   * Template authority.
   *
   * Reuse the canonical operational template-selection rules rather than
   * independently recreating property/type applicability.
   */
  const applicableTemplates =
    await leaseTemplateService.getForProperty(
      entityId,
      snapshotPropertyId,
      authorityProperty.property_type ?? '',
      client,
    );

  const template = applicableTemplates.find(
    candidate => candidate.id === templateId,
  );

  if (!template) {
    throw new LeaseGenerationAuthorityError(
      'template_not_applicable',
      'Selected lease template is not active, approved, or applicable to this property.',
    );
  }

  /*
   * Rendering must eventually verify the source bytes against this
   * provenance. At this stage we refuse templates that have no canonical
   * source identity/checksum.
   */
  if (
    !template.source_document_id ||
    !template.source_document_checksum ||
    !template.source_mime_type
  ) {
    throw new LeaseGenerationAuthorityError(
      'template_source_missing',
      'Approved lease template does not have complete source-document provenance.',
    );
  }

  const manifest = buildLeaseGenerationManifest({
    entityId,
    opportunityId,
    commercialVersionId: authorityVersion.id,
    commercialVersionNumber: authorityVersion.version_number,
    snapshot,
    entity: authorityEntity,
    property: authorityProperty,
    unit: authorityUnit,
    template,
  });

  if (!manifest.validation.valid) {
    throw new LeaseGenerationAuthorityError(
      'generation_invalid',
      manifest.validation.errors
        .map(issue => issue.message)
        .join(' '),
    );
  }

  return manifest;
}
