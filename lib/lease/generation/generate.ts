import { randomUUID } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { renderLeaseDocx } from './docx-renderer';
import { buildLeaseRenderPlan } from './renderer';
import {
  prepareLeaseGenerationAuthority,
  type PrepareLeaseGenerationInput,
} from './service';
import { loadVerifiedLeaseTemplateSource } from './source-loader';

const DOCUMENTS_BUCKET = 'documents';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type LeaseGenerationFailureCode =
  | 'unsupported_format'
  | 'storage_upload_failed'
  | 'registration_failed'
  | 'registration_invalid';

export class LeaseGenerationError extends Error {
  constructor(
    public readonly code: LeaseGenerationFailureCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LeaseGenerationError';
  }
}

export interface GenerateLeaseDocumentInput
  extends PrepareLeaseGenerationInput {}

export interface GeneratedLeaseDocument {
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksum: string;
  storageBucket: string;
  storageKey: string;
  commercialVersionId: string;
  commercialVersionNumber: number;
  templateId: string;
  templateVersion: number;
  templateSourceDocumentId: string;
  templateSourceChecksum: string;
}

export interface LeaseGenerationDependencies {
  prepareAuthority: typeof prepareLeaseGenerationAuthority;
  loadSource: typeof loadVerifiedLeaseTemplateSource;
  buildRenderPlan: typeof buildLeaseRenderPlan;
  renderDocx: typeof renderLeaseDocx;
  createAttemptId: () => string;
}

const DEFAULT_DEPENDENCIES: LeaseGenerationDependencies = {
  prepareAuthority: prepareLeaseGenerationAuthority,
  loadSource: loadVerifiedLeaseTemplateSource,
  buildRenderPlan: buildLeaseRenderPlan,
  renderDocx: renderLeaseDocx,
  createAttemptId: randomUUID,
};

function sanitiseFileNamePart(value: string): string {
  const sanitised = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  return sanitised || 'lease';
}

function buildGeneratedFileName(
  opportunityId: string,
  templateVersion: number,
): string {
  return `lease-${sanitiseFileNamePart(opportunityId)}-v${templateVersion}.docx`;
}

export function buildStorageKey(params: {
  entityId: string;
  opportunityId: string;
  commercialVersionId: string;
  templateId: string;
  templateVersion: number;
  checksum: string;
  attemptId: string;
}): string {
  return [
    'generated-leases',
    params.entityId,
    params.opportunityId,
    params.commercialVersionId,
    params.templateId,
    `v${params.templateVersion}`,
    `${params.checksum}-${params.attemptId}.docx`,
  ].join('/');
}

async function removeOwnUpload(
  client: SupabaseClient,
  storageKey: string,
): Promise<void> {
  try {
    await client.storage
      .from(DOCUMENTS_BUCKET)
      .remove([storageKey]);
  } catch {
    /*
     * Best-effort compensation only.
     *
     * Registration failure remains the authoritative error. A failed
     * cleanup must never obscure the contractual registration failure.
     * Orphan-storage reconciliation can remove an unregistered attempt.
     */
  }
}

function requireUuidResult(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new LeaseGenerationError(
    'registration_invalid',
    'Generated lease registration returned no canonical document identity.',
  );
}

export async function generateLeaseDocument(
  input: GenerateLeaseDocumentInput,
  client: SupabaseClient,
  dependencies: LeaseGenerationDependencies = DEFAULT_DEPENDENCIES,
): Promise<GeneratedLeaseDocument> {
  /*
   * 1. Resolve the governed commercial and template authorities.
   *
   * This must happen before rendering. The renderer never decides which
   * commercial version or template is authoritative.
   */
  const prepared = await dependencies.prepareAuthority(input, client);

  const {
    manifest,
    template,
  } = prepared;

  /*
   * 2. Resolve and cryptographically verify the exact approved source bytes.
   */
  const source = await dependencies.loadSource(
    input.entityId,
    template,
    client,
  );

  /*
   * Phase 1 rendering is deliberately fail-closed to DOCX.
   * PDF generation is not implemented merely because the template target
   * contract contains PDF target types.
   */
  if (source.format !== 'docx') {
    throw new LeaseGenerationError(
      'unsupported_format',
      `Lease generation does not yet support ${source.format.toUpperCase()} source templates.`,
    );
  }

  /*
   * 3. Convert the approved mappings + canonical values into a render plan,
   * then render exact contractual bytes.
   */
  const plan = dependencies.buildRenderPlan(manifest, source);
  const rendered = dependencies.renderDocx(source, plan);

  if (
    rendered.mimeType !== DOCX_MIME ||
    rendered.bytes.length <= 0 ||
    !rendered.checksum
  ) {
    throw new LeaseGenerationError(
      'registration_invalid',
      'Lease renderer did not return a valid DOCX contractual artifact.',
    );
  }

  /*
   * 4. Every upload attempt gets a unique physical object.
   *
   * The contractual generation identity is enforced by PostgreSQL using
   * entity + commercial version + template + template version.
   *
   * Keeping physical attempts unique means a losing concurrent request may
   * safely compensate by deleting only the object it uploaded.
   */
  const attemptId = dependencies.createAttemptId();

  const storageKey = buildStorageKey({
    entityId: manifest.provenance.entityId,
    opportunityId: manifest.provenance.opportunityId,
    commercialVersionId: manifest.provenance.commercialVersionId,
    templateId: manifest.provenance.templateId,
    templateVersion: manifest.provenance.templateVersion,
    checksum: rendered.checksum,
    attemptId,
  });

  const fileName = buildGeneratedFileName(
    manifest.provenance.opportunityId,
    manifest.provenance.templateVersion,
  );

  /*
   * 5. Upload exact rendered bytes.
   *
   * upsert=false is intentional. A generation attempt must never overwrite
   * an existing contractual object.
   */
  const {
    error: uploadError,
  } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .upload(
      storageKey,
      rendered.bytes,
      {
        contentType: rendered.mimeType,
        upsert: false,
      },
    );

  if (uploadError) {
    throw new LeaseGenerationError(
      'storage_upload_failed',
      `Unable to store generated lease document: ${uploadError.message}`,
      uploadError,
    );
  }

  /*
   * 6. Commit canonical document identity + immutable generation provenance
   * in one database transaction.
   *
   * If this fails, only this attempt's unique object is compensated.
   */
  const {
    data: registeredDocumentId,
    error: registrationError,
  } = await client.rpc(
    'register_generated_lease_document',
    {
      p_actor_id: input.actorId,
      p_entity_id: manifest.provenance.entityId,
      p_opportunity_id: manifest.provenance.opportunityId,
      p_commercial_version_id:
        manifest.provenance.commercialVersionId,
      p_template_id: manifest.provenance.templateId,
      p_template_version: manifest.provenance.templateVersion,
      p_template_source_document_id:
        manifest.provenance.sourceTemplateDocumentId,
      p_template_source_checksum:
        manifest.provenance.sourceTemplateChecksum,
      p_generated_checksum: rendered.checksum,
      p_file_name: fileName,
      p_mime_type: rendered.mimeType,
      p_file_size_bytes: rendered.bytes.length,
      p_storage_bucket: DOCUMENTS_BUCKET,
      p_storage_key: storageKey,
    },
  );

  if (registrationError) {
    await removeOwnUpload(client, storageKey);

    throw new LeaseGenerationError(
      'registration_failed',
      `Unable to register generated lease document: ${registrationError.message}`,
      registrationError,
    );
  }

  let documentId: string;

  try {
    documentId = requireUuidResult(registeredDocumentId);
  } catch (error) {
    await removeOwnUpload(client, storageKey);
    throw error;
  }

  /*
   * IMPORTANT:
   *
   * The registration RPC may return an already-registered canonical
   * document for an idempotent retry.
   *
   * In that case its canonical storage identity may differ from this
   * attempt's unique storage key. We therefore resolve the registered
   * document before deciding whether this upload belongs to the winner.
   */
  const {
    data: canonicalDocument,
    error: canonicalDocumentError,
  } = await client
    .from('documents')
    .select(
      'id, file_name, mime_type, file_size_bytes, checksum, storage_bucket, storage_key',
    )
    .eq('id', documentId)
    .eq('entity_id', manifest.provenance.entityId)
    .maybeSingle();

  if (canonicalDocumentError || !canonicalDocument) {
    /*
     * We cannot safely remove our upload here because registration may have
     * committed this exact object. Losing visibility of the canonical row is
     * a reconciliation condition, not proof that this object is orphaned.
     */
    throw new LeaseGenerationError(
      'registration_invalid',
      canonicalDocumentError?.message ||
        'Registered lease document could not be resolved after commit.',
      canonicalDocumentError,
    );
  }

  const canonical = canonicalDocument as {
    id: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number | null;
    checksum: string | null;
    storage_bucket: string | null;
    storage_key: string;
  };

  /*
   * If PostgreSQL returned an existing canonical generation, this attempt
   * lost the race. Delete only our unique object.
   */
  if (
    canonical.storage_bucket !== DOCUMENTS_BUCKET ||
    canonical.storage_key !== storageKey
  ) {
    await removeOwnUpload(client, storageKey);
  }

  /*
   * 7. Final trust check.
   *
   * Regardless of whether this request created the artifact or resolved an
   * idempotent winner, the canonical registered bytes must represent the
   * same deterministic render result.
   */
  if (
    canonical.checksum !== rendered.checksum ||
    canonical.mime_type !== rendered.mimeType
  ) {
    throw new LeaseGenerationError(
      'registration_invalid',
      'Canonical generated lease does not match the deterministic render result.',
    );
  }

  return {
    documentId: canonical.id,
    fileName: canonical.file_name,
    mimeType: canonical.mime_type,
    fileSizeBytes:
      canonical.file_size_bytes ?? rendered.bytes.length,
    checksum: rendered.checksum,
    storageBucket:
      canonical.storage_bucket ?? DOCUMENTS_BUCKET,
    storageKey: canonical.storage_key,
    commercialVersionId:
      manifest.provenance.commercialVersionId,
    commercialVersionNumber:
      manifest.provenance.commercialVersionNumber,
    templateId: manifest.provenance.templateId,
    templateVersion: manifest.provenance.templateVersion,
    templateSourceDocumentId: source.documentId,
    templateSourceChecksum: source.checksum,
  };
}
