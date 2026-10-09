import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'execution-evidence';
const MAX_BYTES = 2 * 1024 * 1024;

export type SignatureMethod = 'drawn' | 'typed' | 'uploaded';

export interface StoredSignatureEvidence {
  bucket: typeof BUCKET;
  path: string;
  sha256: string;
  contentType: 'image/png' | 'image/jpeg';
  contentLength: number;
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ) &&
    bytes.readUInt32BE(8) === 13 &&
    bytes.subarray(12, 16).toString('ascii') === 'IHDR' &&
    bytes.readUInt32BE(16) > 0 &&
    bytes.readUInt32BE(20) > 0 &&
    bytes.readUInt32BE(16) <= 4096 &&
    bytes.readUInt32BE(20) <= 4096
  );
}

function isJpeg(bytes: Buffer): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}

export function decodeSignatureImage(dataUrl: string): {
  bytes: Buffer;
  contentType: 'image/png' | 'image/jpeg';
  sha256: string;
} {
  if (typeof dataUrl !== 'string') {
    throw new Error('Invalid signature payload');
  }

  const match = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );

  if (!match) {
    throw new Error('Unsupported signature image format');
  }

  const encoded = match[2];

  if (encoded.length > Math.ceil(MAX_BYTES / 3) * 4 + 4) {
    throw new Error('Signature image exceeds size limit');
  }

  const bytes = Buffer.from(encoded, 'base64');

  if (
    bytes.length === 0 ||
    bytes.length > MAX_BYTES ||
    bytes.toString('base64') !== encoded
  ) {
    throw new Error('Invalid signature image encoding');
  }

  const contentType = match[1] as 'image/png' | 'image/jpeg';

  if (
    (contentType === 'image/png' && !isPng(bytes)) ||
    (contentType === 'image/jpeg' && !isJpeg(bytes))
  ) {
    throw new Error('Signature image does not match its declared format');
  }

  return {
    bytes,
    contentType,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function storeSignatureEvidence(
  serviceClient: SupabaseClient,
  args: {
    executionId: string;
    participantId: string;
    invitationId: string;
    dataUrl: string;
  },
): Promise<StoredSignatureEvidence> {
  for (const id of [
    args.executionId,
    args.participantId,
    args.invitationId,
  ]) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new Error('Invalid signature evidence reference');
    }
  }

  const { bytes, contentType, sha256 } = decodeSignatureImage(
    args.dataUrl,
  );

  const extension = contentType === 'image/png' ? 'png' : 'jpg';

  const path = [
    args.executionId,
    args.participantId,
    args.invitationId,
    `${randomUUID()}.${extension}`,
  ].join('/');

  const bucket = serviceClient.storage.from(BUCKET);

  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: '0',
  });

  if (uploadError) {
    throw new Error('Unable to store signature evidence');
  }

  try {
    const { data, error } = await bucket.download(path);

    if (error || !data) {
      throw new Error('Unable to verify stored signature evidence');
    }

    const storedBytes = Buffer.from(await data.arrayBuffer());

    const storedHash = createHash('sha256')
      .update(storedBytes)
      .digest('hex');

    if (
      storedBytes.length !== bytes.length ||
      storedHash !== sha256
    ) {
      throw new Error('Stored signature evidence integrity mismatch');
    }

    return {
      bucket: BUCKET,
      path,
      sha256,
      contentType,
      contentLength: bytes.length,
    };
  } catch (error) {
    // Best-effort cleanup. If deletion fails, a reconciliation
    // process must eventually remove this uncommitted object.
    await bucket.remove([path]).catch(() => undefined);
    throw error;
  }
}
