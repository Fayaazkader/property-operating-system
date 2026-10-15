import 'server-only';

import { createHash } from 'node:crypto';
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';

export interface FinalisationSigner {
  participantId: string;
  name: string;
  email: string | null;
  signedAt: string;
  signatureBytes: Uint8Array;
  signatureContentType: 'image/png' | 'image/jpeg';
  signatureSha256: string;
}

export interface FinalisationPdfResult {
  bytes: Uint8Array;
  sha256: string;
  pageCount: number;
}

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeText(value: string, maxLength = 100): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, maxLength);
}

export async function assembleExecutedPdf(args: {
  originalPdf: Uint8Array;
  originalSha256: string;
  executionId: string;
  documentVersionId: string;
  signers: FinalisationSigner[];
}): Promise<FinalisationPdfResult> {
  if (hash(args.originalPdf) !== args.originalSha256) {
    throw new Error('Original signing PDF checksum mismatch');
  }

  if (args.signers.length === 0) {
    throw new Error('No signatories supplied');
  }

  const pdf = await PDFDocument.load(args.originalPdf, {
    ignoreEncryption: false,
  });

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const signer of args.signers) {
    if (
      !signer.participantId ||
      !signer.name.trim() ||
      !Number.isFinite(Date.parse(signer.signedAt))
    ) {
      throw new Error('Invalid signatory metadata');
    }

    if (hash(signer.signatureBytes) !== signer.signatureSha256) {
      throw new Error('Signature evidence checksum mismatch');
    }

    const image =
      signer.signatureContentType === 'image/png'
        ? await pdf.embedPng(signer.signatureBytes)
        : await pdf.embedJpg(signer.signatureBytes);

    const page = pdf.addPage([595.28, 841.89]);

    page.drawText('EXECUTION SIGNATURE RECORD', {
      x: 50,
      y: 775,
      size: 17,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });

    page.drawText(
      'This page records a verified electronic signing event.',
      { x: 50, y: 748, size: 10, font },
    );

    const details = [
      ['Execution', args.executionId],
      ['Document version', args.documentVersionId],
      ['Participant', signer.participantId],
      ['Name', signer.name],
      ['Email', signer.email ?? 'Not provided'],
      ['Signed at (UTC)', new Date(signer.signedAt).toISOString()],
      ['Signature SHA-256', signer.signatureSha256],
    ];

    let y = 700;

    for (const [label, value] of details) {
      page.drawText(`${label}:`, {
        x: 50,
        y,
        size: 10,
        font: bold,
      });

      page.drawText(safeText(value, 105), {
        x: 50,
        y: y - 17,
        size: 9,
        font,
      });

      y -= 52;
    }

    const maxWidth = 320;
    const maxHeight = 130;
    const scale = Math.min(
      maxWidth / image.width,
      maxHeight / image.height,
      1,
    );

    page.drawText('Recorded signature', {
      x: 50,
      y: 315,
      size: 11,
      font: bold,
    });

    page.drawImage(image, {
      x: 50,
      y: 160,
      width: image.width * scale,
      height: image.height * scale,
    });

    page.drawText(
      'Electronic signature evidence is retained separately.',
      { x: 50, y: 105, size: 9, font },
    );
  }

  const bytes = await pdf.save();

  if (bytes.length > 30 * 1024 * 1024) {
    throw new Error('Final executed PDF exceeds storage limit');
  }

  return {
    bytes,
    sha256: hash(bytes),
    pageCount: pdf.getPageCount(),
  };
}
