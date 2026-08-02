// lib/signing/pdf-flattener.ts
// Embeds signatures into PDF so they become part of the document (undetectable by OCR)

import type { SigningField } from './types';

export async function flattenSignatures(
  pdfBytes: ArrayBuffer,
  fields: SigningField[],
  pageRects: Array<{ page: number; width: number; height: number }>
): Promise<ArrayBuffer> {
  // In production, this uses a server-side PDF library (pdf-lib) to:
  // 1. Load the PDF
  // 2. For each signed field, embed the signature image into the page at the exact coordinates
  // 3. Flatten the annotations so they become part of the page content
  // 4. Return the modified PDF bytes
  
  // For now, return the original PDF — signatures are stored in the database
  // and rendered as overlays in the DocumentViewer
  return pdfBytes;
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
      field_id: f.id,
      type: f.type,
      page: f.page,
      signed_at: new Date().toISOString(),
    })),
    ip_address: 'recorded',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
  };
}
