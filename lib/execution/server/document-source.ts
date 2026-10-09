import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ExecutionSourceFormat } from './document-conversion';

export interface VerifiedExecutionSource {
  documentId: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  format: ExecutionSourceFormat;
  storageBucket: string;
  storageKey: string;
  checksum: string;
  bytes: Uint8Array;
}

interface ExecutionDocumentRow {
  id: string;
  entity_id: string;
  file_name: string;
  mime_type: string;
  storage_bucket: string;
  storage_key: string;
  checksum: string;
  document_type: string;
}

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const PDF_MIME = 'application/pdf';

function resolveFormat(mimeType: string): ExecutionSourceFormat {
  if (mimeType === PDF_MIME) return 'pdf';
  if (mimeType === DOCX_MIME) return 'docx';

  throw new Error('Unsupported execution source format');
}

export async function loadVerifiedExecutionSource(
  client: SupabaseClient,
  input: {
    entityId: string;
    documentId: string;
    expectedChecksum: string;
    allowedDocumentTypes: readonly string[];
  },
): Promise<VerifiedExecutionSource> {
  if (
    !/^[0-9a-f-]{36}$/i.test(input.entityId) ||
    !/^[0-9a-f-]{36}$/i.test(input.documentId) ||
    !/^[a-f0-9]{64}$/.test(input.expectedChecksum) ||
    input.allowedDocumentTypes.length === 0
  ) {
    throw new Error('Invalid execution source request');
  }

  const { data, error } = await client
    .from('documents')
    .select(
      'id, entity_id, file_name, mime_type, storage_bucket, storage_key, checksum, document_type',
    )
    .eq('id', input.documentId)
    .eq('entity_id', input.entityId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Execution source document not found');
  }

  const document = data as ExecutionDocumentRow;

  if (
    !input.allowedDocumentTypes.includes(document.document_type) ||
    document.checksum !== input.expectedChecksum ||
    !document.storage_bucket ||
    !document.storage_key
  ) {
    throw new Error('Execution source provenance mismatch');
  }

  const format = resolveFormat(document.mime_type);

  const { data: file, error: downloadError } = await client.storage
    .from(document.storage_bucket)
    .download(document.storage_key);

  if (downloadError || !file) {
    throw new Error('Execution source download failed');
  }

  if (file.size === 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Invalid execution source size');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes.length === 0 || bytes.length > MAX_SOURCE_BYTES) {
    throw new Error('Invalid execution source size');
  }

  const checksum = createHash('sha256')
    .update(bytes)
    .digest('hex');

  if (
    checksum !== document.checksum ||
    checksum !== input.expectedChecksum
  ) {
    throw new Error('Execution source checksum mismatch');
  }

  return {
    documentId: document.id,
    entityId: document.entity_id,
    fileName: document.file_name,
    mimeType: document.mime_type,
    format,
    storageBucket: document.storage_bucket,
    storageKey: document.storage_key,
    checksum,
    bytes,
  };
}
