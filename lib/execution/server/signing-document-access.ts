import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateSigningInvitation } from './invitation-validation';

const MAX_PDF_BYTES = 30 * 1024 * 1024;

export async function loadInvitedSigningDocument(
  client: SupabaseClient,
  token: string,
): Promise<Uint8Array | null> {
  const invitation = await validateSigningInvitation(client, token);

  if (!invitation) return null;

  const { data: document, error } = await client
    .from('execution_signing_documents')
    .select(
      'bucket_id, storage_path, pdf_checksum, content_length, source_checksum, status, committed_at',
    )
    .eq('execution_id', invitation.execution_id)
    .eq('document_version_id', invitation.document_version_id)
    .eq('status', 'committed')
    .maybeSingle();

  if (
    error ||
    !document ||
    !document.committed_at ||
    document.bucket_id !== 'execution-documents' ||
    document.source_checksum !== invitation.document_checksum ||
    !Number.isSafeInteger(document.content_length) ||
    document.content_length < 1 ||
    document.content_length > MAX_PDF_BYTES ||
    !/^[a-f0-9]{64}$/.test(document.pdf_checksum)
  ) {
    throw new Error('Committed signing document unavailable');
  }

  const { data: file, error: downloadError } = await client.storage
    .from('execution-documents')
    .download(document.storage_path);

  if (downloadError || !file) {
    throw new Error('Signing document storage unavailable');
  }

  if (file.size !== document.content_length) {
    throw new Error('Signing document size mismatch');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const checksum = createHash('sha256')
    .update(bytes)
    .digest('hex');

  if (checksum !== document.pdf_checksum) {
    throw new Error('Signing document integrity verification failed');
  }

  if (
    bytes.length < 5 ||
    Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-'
  ) {
    throw new Error('Invalid signing PDF');
  }

  return bytes;
}