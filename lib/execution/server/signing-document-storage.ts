import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

const BUCKET = 'execution-documents';
const MAX_PDF_BYTES = 30 * 1024 * 1024;

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertUuid(value: string, label: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`Invalid ${label}`);
  }
}

export interface SigningDocumentInput {
  executionId: string;
  documentVersionId: string;
  entityId: string;
  sourceDocumentId: string;
  sourceChecksum: string;
  pdfBytes: Uint8Array;
  pdfChecksum: string;
  pageCount: number;
  conversionProvider: 'original-pdf' | 'gotenberg';
}

export interface CommittedSigningDocument {
  signingDocumentId: string;
  storageBucket: string;
  storagePath: string;
  pdfChecksum: string;
}

export async function storeAndCommitSigningDocument(
  client: SupabaseClient,
  input: SigningDocumentInput,
): Promise<CommittedSigningDocument> {
  assertUuid(input.executionId, 'execution ID');
  assertUuid(input.documentVersionId, 'document version ID');
  assertUuid(input.entityId, 'entity ID');
  assertUuid(input.sourceDocumentId, 'source document ID');

  if (
    !/^[a-f0-9]{64}$/.test(input.sourceChecksum) ||
    !/^[a-f0-9]{64}$/.test(input.pdfChecksum)
  ) {
    throw new Error('Invalid signing document checksum');
  }

  if (
    input.pdfBytes.length === 0 ||
    input.pdfBytes.length > MAX_PDF_BYTES ||
    !Number.isInteger(input.pageCount) ||
    input.pageCount < 1 ||
    input.pageCount > 500
  ) {
    throw new Error('Invalid signing PDF metadata');
  }

  if (sha256(input.pdfBytes) !== input.pdfChecksum) {
    throw new Error('Signing PDF checksum mismatch');
  }

  const pdf = await PDFDocument.load(input.pdfBytes, {
    ignoreEncryption: false,
  });

  if (pdf.getPageCount() !== input.pageCount) {
    throw new Error('Signing PDF page count mismatch');
  }

  const path =
    `${input.executionId}/${input.documentVersionId}/${randomUUID()}.pdf`;

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, Buffer.from(input.pdfBytes), {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Signing PDF upload failed: ${uploadError.message}`);
  }

  let committed = false;
  let registrationAttempted = false;
  let stagedId: string | null = null;

  try {
    const { data: storedFile, error: downloadError } =
      await client.storage.from(BUCKET).download(path);

    if (downloadError || !storedFile) {
      throw new Error('Signing PDF read-back failed');
    }

    if (storedFile.size !== input.pdfBytes.length) {
      throw new Error('Stored signing PDF size mismatch');
    }

    const storedBytes = new Uint8Array(
      await storedFile.arrayBuffer(),
    );

    if (sha256(storedBytes) !== input.pdfChecksum) {
      throw new Error('Stored signing PDF checksum mismatch');
    }

    const storedPdf = await PDFDocument.load(storedBytes, {
      ignoreEncryption: false,
    });

    if (storedPdf.getPageCount() !== input.pageCount) {
      throw new Error('Stored signing PDF page count mismatch');
    }

    registrationAttempted = true;

    const { data: registeredId, error: stageError } =
      await client.rpc('stage_execution_signing_document', {
        p_execution_id: input.executionId,
        p_document_version_id: input.documentVersionId,
        p_entity_id: input.entityId,
        p_source_document_id: input.sourceDocumentId,
        p_source_checksum: input.sourceChecksum,
        p_pdf_checksum: input.pdfChecksum,
        p_storage_path: path,
        p_page_count: input.pageCount,
        p_content_length: storedBytes.length,
        p_conversion_provider: input.conversionProvider,
      });

    if (stageError || typeof registeredId !== 'string') {
      throw new Error(
        `Signing PDF registration failed: ${
          stageError?.message ?? 'Missing staged record'
        }`,
      );
    }

    stagedId = registeredId;

    const { data: committedId, error: commitError } =
      await client.rpc('commit_execution_signing_document', {
        p_document_id: stagedId,
      });

    if (commitError || committedId !== stagedId) {
      throw new Error(
        `Signing PDF commit failed: ${
          commitError?.message ?? 'Unexpected commit result'
        }`,
      );
    }

    committed = true;

    return {
      signingDocumentId: committedId,
      storageBucket: BUCKET,
      storagePath: path,
      pdfChecksum: input.pdfChecksum,
    };
  } finally {
    if (!committed) {
      if (registrationAttempted) {
        // RPC responses may be lost after the database commits.
        // Preserve the object for reconciliation in every ambiguous case.
        console.error(
          'Execution signing PDF requires reconciliation',
          {
            executionId: input.executionId,
            documentVersionId: input.documentVersionId,
            storagePath: path,
            stagedId,
          },
        );
      } else {
        try {
          const { error } = await client.storage
            .from(BUCKET)
            .remove([path]);

          if (error) {
            console.error(
              'Execution signing PDF cleanup requires reconciliation',
              { storagePath: path, error: error.message },
            );
          }
        } catch {
          console.error(
            'Execution signing PDF cleanup requires reconciliation',
            { storagePath: path },
          );
        }
      }
    }
  }
}
