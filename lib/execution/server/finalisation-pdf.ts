import 'server-only';

import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';

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

/** One-based page; normalized top-left coordinates on the displayed crop box. */
export interface FinalisationField {
  id: string;
  participantId: string;
  type: 'signature' | 'initial' | 'date';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FinalisationManifest {
  executionId: string;
  documentVersionId: string;
  originalSha256: string;
  fields: FinalisationField[];
}

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
  const pdf = await PDFDocument.load(args.originalPdf, { ignoreEncryption: false });
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
    const crop = page.getCropBox();
    const media = page.getMediaBox();
    const angle = ((page.getRotation().angle % 360) + 360) % 360;
    if (![0, 90, 180, 270].includes(angle) ||
        ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
        crop.width <= 0 || crop.height <= 0 || crop.x < media.x || crop.y < media.y ||
        crop.x + crop.width > media.x + media.width || crop.y + crop.height > media.y + media.height) {
      throw new Error('Unsupported PDF page geometry');
    }
    const displayWidth = angle % 180 ? crop.height : crop.width;
    const displayHeight = angle % 180 ? crop.width : crop.height;
    const width = field.width * displayWidth;
    const height = field.height * displayHeight;
    const u = field.x * displayWidth;
    const v = (1 - field.y - field.height) * displayHeight;
    // Map displayed bottom-left to native PDF coordinates, retaining /Rotate.
    const point = (du: number, dv: number) => {
      const a = u + du, b = v + dv;
      const [x, y] = angle === 0 ? [a, b] : angle === 90 ? [crop.width - b, a]
        : angle === 180 ? [crop.width - a, crop.height - b] : [b, crop.height - a];
      return { x: crop.x + x, y: crop.y + y };
    };
    if (field.type === 'date') {
      const text = new Date(signer.signedAt).toISOString().slice(0, 10);
      const size = Math.min(12, height / 1.3, width / font.widthOfTextAtSize(text, 1));
      if (size < 6) throw new Error('Date field is too small to render legibly');
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
