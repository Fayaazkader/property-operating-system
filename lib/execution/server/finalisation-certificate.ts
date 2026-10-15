import 'server-only';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { FinalisationPdfResult } from './finalisation-pdf';

export interface CertificateSigner {
  participantId: string;
  name: string;
  email: string | null;
  signedAt: string;
  evidence: Record<string, unknown>;
}
/** Detached certificate hashes the complete executed PDF, avoiding circular hashes.
 * Non-WinAnsi characters are escaped reversibly; no evidence is silently dropped.
 */
export async function assembleExecutionCertificate(input: {
  executionId: string; documentVersionId: string; sourcePdfSha256: string;
  executedPdfSha256: string; manifestSha256: string; signers: CertificateSigner[];
}): Promise<FinalisationPdfResult> {
  if (![input.sourcePdfSha256, input.executedPdfSha256, input.manifestSha256].every(h => /^[a-f0-9]{64}$/.test(h)) ||
      !input.signers.length || input.signers.some(s => !Number.isFinite(Date.parse(s.signedAt)))) throw new Error('Invalid certificate evidence');
  const pdf = await PDFDocument.create();
  const date = new Date(Math.max(...input.signers.map(s => Date.parse(s.signedAt))));
  pdf.setCreationDate(date); pdf.setModificationDate(date);
  pdf.setTitle('AssetFlow execution certificate'); pdf.setProducer('AssetFlow'); pdf.setCreator('AssetFlow');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]), y = 790;
  function line(value: string, heading = false) {
    const safe = value.replace(/[^\x20-\x7e]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
    const activeFont = heading ? bold : font;
    let remaining = safe;
    do {
      let count = Math.min(remaining.length, 100);
      while (count > 1 && activeFont.widthOfTextAtSize(remaining.slice(0,count),9) > 505) count--;
      if (y < 55) { page = pdf.addPage([595.28, 841.89]); y = 790; }
      page.drawText(remaining.slice(0,count), { x: 45, y, size: 9, font: activeFont }); y -= 14;
      remaining = remaining.slice(count);
    } while (remaining.length);
  }
  line('ASSETFLOW — CERTIFICATE OF EXECUTION', true);
  line(`Execution: ${input.executionId}`); line(`Document version: ${input.documentVersionId}`);
  line(`Signing PDF SHA-256: ${input.sourcePdfSha256}`);
  line(`Executed PDF SHA-256: ${input.executedPdfSha256}`);
  line(`Frozen manifest SHA-256: ${input.manifestSha256}`);
  line('This detached certificate binds the entire executed PDF by SHA-256.');
  line('Electronic signature evidence is retained in private canonical records.');
  for (const signer of input.signers) {
    line(''); line(`Participant: ${signer.participantId}`, true);
    line(`Name: ${signer.name}`); line(`Email: ${signer.email ?? ''}`);
    line(`Signed at (UTC): ${new Date(signer.signedAt).toISOString()}`);
    // This is the canonical participant signature_data object: no OTP codes or invitation tokens.
    for (const [key, value] of Object.entries(signer.evidence).sort(([a],[b]) => a.localeCompare(b))) {
      line(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    }
  }
  const bytes = await pdf.save();
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Certificate exceeds storage limit');
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), pageCount: pdf.getPageCount() };
}
