import { resolveLeaseCanonicalValues } from './commercial-field-resolver';
import { validateLeaseGeneration } from './generation-validator';

import type {
  BuildLeaseGenerationManifestInput,
  LeaseGenerationManifest,
} from './types';

export function buildLeaseGenerationManifest(
  input: BuildLeaseGenerationManifestInput,
): LeaseGenerationManifest {
  const {
    entityId,
    opportunityId,
    commercialVersionId,
    commercialVersionNumber,
    snapshot,
    entity,
    property,
    unit,
    template,
  } = input;

  const values = resolveLeaseCanonicalValues({
    snapshot,
    entity,
    property,
    unit,
  });

  const validation = validateLeaseGeneration({
    values,
    template,
  });

  return {
    values,
    mappings: template.field_mapping ?? [],
    provenance: {
      entityId,
      opportunityId,
      commercialVersionId,
      commercialVersionNumber,
      templateId: template.id,
      templateVersion: template.version,
      sourceTemplateDocumentId:
        template.source_document_id,
      sourceTemplateChecksum:
        template.source_document_checksum,
    },
    validation,
  };
}
