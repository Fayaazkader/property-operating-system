import 'server-only';

import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { executionFieldGeometry, executionDateFontSize } from '../pdf-field-geometry';

export interface FinalisationImage {
  bytes: Uint8Array;
  contentType: 'image/png' | 'image/jpeg';
  sha256: string;
}

export interface FinalisationSigner {
  participantId: string;
  name: string;
  email: string | null;
  signedAt: string;
  signatureBytes: Uint8Array;
  signatureContentType: 'image/png' | 'image/jpeg';
  signatureSha256: string;
  initials?: FinalisationImage;
}

export type { ExecutionField as FinalisationField, ExecutionFieldManifest as FinalisationManifest } from '../field-manifest';
import type { ExecutionFieldManifest as FinalisationManifest } from '../field-manifest';

export interface FinalisationPdfResult {
  bytes: Uint8Array;
  sha256: string;
  pageCount: number;
}

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Render only trusted, frozen fields and committed evidence supplied by the server.
 * This function does not establish database authority or freeze a manifest.
 */
export async function assembleExecutedPdf(args: {
  originalPdf: Uint8Array;
  originalSha256: string;
  executionId: string;
  documentVersionId: string;
  manifest: FinalisationManifest;
  signers: FinalisationSigner[];
}): Promise<FinalisationPdfResult> {
  if (!/^[a-f0-9]{64}$/.test(args.originalSha256) || hash(args.originalPdf) !== args.originalSha256) {
    throw new Error('Original signing PDF checksum mismatch');
  }
  const manifest = args.manifest;
  if (!args.executionId || !args.documentVersionId || !manifest ||
      manifest.executionId !== args.executionId ||
      manifest.documentVersionId !== args.documentVersionId ||
      manifest.originalSha256 !== args.originalSha256 ||
      !Array.isArray(manifest.fields) || !manifest.fields.length) {
    throw new Error('Signing manifest does not bind the original document');
  }
  if (!args.signers.length) throw new Error('No signatories supplied');
  const signers = new Map<string, FinalisationSigner>();
  for (const signer of args.signers) {
    if (!signer.participantId || signers.has(signer.participantId) ||
        !signer.name.trim() || !Number.isFinite(Date.parse(signer.signedAt))) {
      throw new Error('Invalid or duplicate signatory metadata');
    }
    if (hash(signer.signatureBytes) !== signer.signatureSha256 ||
        (signer.initials && hash(signer.initials.bytes) !== signer.initials.sha256)) {
      throw new Error('Signature evidence checksum mismatch');
    }
    signers.set(signer.participantId, signer);
  }
  const pdf = await PDFDocument.load(args.originalPdf, { ignoreEncryption: false, updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ids = new Set<string>();
  const signedParticipants = new Set<string>();
  for (const field of manifest.fields) {
    const signer = signers.get(field.participantId);
    if (!field.id || ids.has(field.id) || !signer ||
        !['signature', 'initial', 'date'].includes(field.type) ||
        !Number.isInteger(field.page) || field.page < 1 || field.page > pdf.getPageCount() ||
        ![field.x, field.y, field.width, field.height].every(Number.isFinite) ||
        field.x < 0 || field.y < 0 || field.width <= 0 || field.height <= 0 ||
        field.x + field.width > 1 || field.y + field.height > 1) {
      throw new Error('Invalid signing field placement or participant');
    }
    ids.add(field.id);
    const page = pdf.getPage(field.page - 1);
    const { width, height, angle, point } = executionFieldGeometry(page, field);
    if (field.type === 'date') {
      const text = new Date(signer.signedAt).toISOString().slice(0, 10);
      const size = executionDateFontSize(font,text,width,height);
      page.drawText(text, { ...point(0, (height - size) / 2), size, font, rotate: degrees(angle) });
    } else {
      const evidence = field.type === 'initial' ? signer.initials : {
        bytes: signer.signatureBytes, contentType: signer.signatureContentType, sha256: signer.signatureSha256,
      };
      if (!evidence) throw new Error('Required initials evidence missing');
      if (!['image/png', 'image/jpeg'].includes(evidence.contentType)) {
        throw new Error('Unsupported signature image type');
      }
      const image = evidence.contentType === 'image/png'
        ? await pdf.embedPng(evidence.bytes) : await pdf.embedJpg(evidence.bytes);
      const scale = Math.min(width / image.width, height / image.height);
      const w = image.width * scale, h = image.height * scale;
      page.drawImage(image, { ...point((width - w) / 2, (height - h) / 2),
        width: w, height: h, rotate: degrees(angle) });
      if (field.type === 'signature') signedParticipants.add(signer.participantId);
    }
  }
  if ([...signers.keys()].some(id => !signedParticipants.has(id))) {
    throw new Error('Every participant requires a signature field');
  }
  const bytes = await pdf.save();
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Final executed PDF exceeds storage limit');
  return { bytes, sha256: hash(bytes), pageCount: pdf.getPageCount() };
}
