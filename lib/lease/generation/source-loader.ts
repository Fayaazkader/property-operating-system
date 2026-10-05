import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { LeaseTemplate } from '../templates/types';

export type LeaseTemplateSourceFormat = 'docx' | 'pdf';

export interface VerifiedLeaseTemplateSource {
  documentId: string;
  fileName: string;
  mimeType: string;
  format: LeaseTemplateSourceFormat;
  storageBucket: string;
  storageKey: string;
  checksum: string;
  bytes: Uint8Array;
}

export class LeaseTemplateSourceError extends Error {
  constructor(
    public readonly code:
      | 'source_missing'
      | 'document_not_found'
      | 'document_mismatch'
      | 'unsupported_source_format'
      | 'storage_download_failed'
      | 'checksum_mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'LeaseTemplateSourceError';
  }
}

interface DocumentSourceRow {
  id: string;
  entity_id: string;
  file_name: string;
  mime_type: string;
  storage_bucket: string;
  storage_key: string;
  checksum: string;
  document_type: string;
}

const PDF_MIME = 'application/pdf';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function resolveFormat(mimeType: string): LeaseTemplateSourceFormat {
  if (mimeType === PDF_MIME) {
    return 'pdf';
  }

  if (mimeType === DOCX_MIME) {
    return 'docx';
  }

  throw new LeaseTemplateSourceError(
    'unsupported_source_format',
    `Unsupported lease-template source MIME type: ${mimeType}`,
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function loadVerifiedLeaseTemplateSource(
  entityId: string,
  template: LeaseTemplate,
  client: SupabaseClient,
): Promise<VerifiedLeaseTemplateSource> {
  if (
    !template.source_document_id ||
    !template.source_document_checksum ||
    !template.source_mime_type
  ) {
    throw new LeaseTemplateSourceError(
      'source_missing',
      'Lease template does not have complete source-document provenance.',
    );
  }

  const { data: document, error: documentError } = await client
    .from('documents')
    .select(
      'id, entity_id, file_name, mime_type, storage_bucket, storage_key, checksum, document_type',
    )
    .eq('id', template.source_document_id)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (documentError) {
    throw documentError;
  }

  if (!document) {
    throw new LeaseTemplateSourceError(
      'document_not_found',
      'Canonical lease-template source document could not be resolved.',
    );
  }

  const source = document as DocumentSourceRow;

  if (
    source.document_type !== 'lease_template_source' ||
    source.checksum !== template.source_document_checksum ||
    source.mime_type !== template.source_mime_type
  ) {
    throw new LeaseTemplateSourceError(
      'document_mismatch',
      'Canonical source document does not match approved template provenance.',
    );
  }

  if (!source.storage_bucket || !source.storage_key) {
    throw new LeaseTemplateSourceError(
      'source_missing',
      'Canonical lease-template source has no storage identity.',
    );
  }

  const format = resolveFormat(source.mime_type);

  const {
    data: storedFile,
    error: downloadError,
  } = await client.storage
    .from(source.storage_bucket)
    .download(source.storage_key);

  if (downloadError || !storedFile) {
    throw new LeaseTemplateSourceError(
      'storage_download_failed',
      downloadError?.message ||
        'Unable to download canonical lease-template source.',
    );
  }

  const bytes = new Uint8Array(await storedFile.arrayBuffer());
  const actualChecksum = sha256(bytes);

  if (
    actualChecksum !== source.checksum ||
    actualChecksum !== template.source_document_checksum
  ) {
    throw new LeaseTemplateSourceError(
      'checksum_mismatch',
      'Stored lease-template bytes do not match approved template provenance.',
    );
  }

  return {
    documentId: source.id,
    fileName: source.file_name,
    mimeType: source.mime_type,
    format,
    storageBucket: source.storage_bucket,
    storageKey: source.storage_key,
    checksum: actualChecksum,
    bytes,
  };
}
