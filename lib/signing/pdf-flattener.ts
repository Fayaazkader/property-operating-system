// lib/signing/pdf-flattener.ts
// Embeds signatures into PDF and generates audit certificate page

import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import type { SigningField } from './types';

function base64ToBytes(base64: string): Uint8Array {
  if (typeof window !== 'undefined' && typeof atob !== 'undefined') {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export async function flattenSignatures(
  pdfBytes: ArrayBuffer,
  fields: SigningField[],
  pageRects: Array<{ page: number; width: number; height: number }>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    if (!field.value) continue;
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const rect = pageRects.find(r => r.page === field.page);
    if (!rect) continue;

    const x = field.x * rect.width;
    const y = rect.height - (field.y * rect.height) - (field.height * rect.height);
    const w = field.width * rect.width;
    const h = field.height * rect.height;

    try {
      if (field.type === 'signature' || field.type === 'initial' || field.type === 'witness') {
        const base64 = field.value.split(',')[1];
        if (base64) {
          const imageBytes = base64ToBytes(base64);
          const mimeType = field.value.split(';')[0].split(':')[1] || 'image/png';
let image;
if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
  image = await pdfDoc.embedJpg(imageBytes);
} else {
  image = await pdfDoc.embedPng(imageBytes);
}
          page.drawImage(image, { x, y, width: w, height: h, opacity: 0.9 });
        }
      } else if (field.type === 'date' || field.type === 'text') {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText(field.value, { x, y: y + h - 12, size: 10, font, color: rgb(0, 0, 0) });
      } else if (field.type === 'checkbox') {
        const font = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);
        page.drawText('✓', { x, y, size: 14, font, color: rgb(0, 0, 0) });
      }
    } catch (err) {
      console.warn(`Failed to embed field ${field.id}:`, err);
    }
  }

  return pdfDoc.save();
}

export function generateSignatureCertificate(
  requestId: string,
  fields: SigningField[],
  signerName: string,
  signerEmail: string
): Record<string, any> {
  return {
    certificate_id: crypto.randomUUID(),
    request_id: requestId,
    signed_by: { name: signerName, email: signerEmail },
    signed_at: new Date().toISOString(),
    fields_signed: fields.filter(f => f.value).map(f => ({
      field_id: f.id, type: f.type, page: f.page,
      signed_at: new Date().toISOString(),
    })),
  };
}

export async function generateCertificatePage(
  requestId: string, signerName: string, signerEmail: string,
  fields: SigningField[], documentName: string, pdfHash: string, certificateId?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  let y = height - 50;

  page.drawText('Certificate of Completion', { x: 50, y, size: 18, font: boldFont, color: rgb(0, 0, 0) });
  y -= 30;
  page.drawText(`Certificate ID: ${crypto.randomUUID().split('-')[0].toUpperCase()}`, { x: 50, y, size: 9, font: monoFont, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 25;

  page.drawText('Document:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(documentName, { x: 150, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText('Signed by:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(signerName, { x: 150, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText('Email:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(signerEmail, { x: 150, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText('Signed at:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(new Date().toLocaleString(), { x: 150, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 25;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 25;

  page.drawText('Fields Signed:', { x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 20;
  for (const field of fields.filter(f => f.value)) {
    page.drawText(`${field.type} — Page ${field.page} — ${field.signerRole || 'signer'}`, { x: 70, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 15;
    if (y < 60) break;
  }

    y -= 30;
  page.drawText('Document Integrity:', { x: 50, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 20;
  page.drawText('SHA-256 (Executed Document)', { x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 15;
  page.drawText(pdfHash, { x: 50, y, size: 8, font: monoFont, color: rgb(0.3, 0.3, 0.3) });
  y -= 25;
  page.drawText('Verification:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText('This document was signed using AssetFlow\'s digital execution platform.', { x: 50, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 15;
  page.drawText('The SHA-256 hash above represents the executed document excluding this certificate page.', { x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  return pdfDoc.save();
}
export interface ExecutionPackage {
  packageBytes: Uint8Array;
  certificate: {
    id: string;
    hash: string;
    algorithm: string;
  };
}

export async function createExecutionPackage(
  originalPdfBytes: ArrayBuffer,
  fields: SigningField[],
  pageRects: Array<{ page: number; width: number; height: number }>,
  requestId: string, signerName: string, signerEmail: string, documentName: string
): Promise<ExecutionPackage> {
  const certificateId = crypto.randomUUID();

  // 1. Flatten signatures onto the executed document
  console.log('Flattening fields:., fields.length, .pageRects:', pageRects);
  const signedPdf = await flattenSignatures(originalPdfBytes, fields, pageRects);

  // 2. Hash the executed document only (not the certificate page)
  const hashBuffer = await crypto.subtle.digest('SHA-256', signedPdf as BufferSource);
  const pdfHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  // 3. Generate certificate page with the document hash
  const certPdf = await generateCertificatePage(requestId, signerName, signerEmail, fields, documentName, pdfHash, certificateId);

  // 4. Merge executed PDF + certificate page (single merge, hash stays valid)
  const signedDoc = await PDFDocument.load(signedPdf, { ignoreEncryption: true });
  const certDoc = await PDFDocument.load(certPdf, { ignoreEncryption: true });
  const mergedDoc = await PDFDocument.create();
  const signedPages = await mergedDoc.copyPages(signedDoc, signedDoc.getPageIndices());
  signedPages.forEach(p => mergedDoc.addPage(p));
  const certPages = await mergedDoc.copyPages(certDoc, certDoc.getPageIndices());
  certPages.forEach(p => mergedDoc.addPage(p));

  return {
    packageBytes: await mergedDoc.save(),
    certificate: { id: certificateId, hash: pdfHash, algorithm: 'SHA-256' },
  };
}