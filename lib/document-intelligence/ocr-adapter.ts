// lib/document-intelligence/ocr-adapter.ts
// OCR Adapter — Server-safe, supports PDF and images

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  method: 'native_text' | 'ocr_image' | 'ocr_pdf_page';
  pageCount?: number;
  processedAt: string;
}

async function extractPdfNativeText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParseMod = await import('pdf-parse');
    // pdf-parse ESM: function is the default export or pdfParse property
    const parser = (pdfParseMod as any).default || (pdfParseMod as any).pdf || pdfParseMod;
    const result = await parser(Buffer.from(buffer));
    return result?.text?.trim() || '';
  } catch (err) {
    console.error('pdf-parse failed:', err);
    return '';
  }
}

export async function extractTextFromBuffer(
  buffer: ArrayBuffer,
  fileType: string = 'image/png'
): Promise<OCRResult> {

  if (fileType === 'application/pdf' || fileType.includes('pdf')) {
    const nativeText = await extractPdfNativeText(buffer);
    if (nativeText.length > 20) {
      return {
        text: nativeText,
        confidence: 95,
        provider: 'pdf-parse',
        method: 'native_text',
        processedAt: new Date().toISOString(),
      };
    }

    // Fallback: try to convert PDF to image with pdfjs-dist, then Tesseract
    // Server-safe: pdfjs can render to canvas in Node (needs canvas package)
    // For now, mark empty for manual review
    return {
      text: '',
      confidence: 0,
      provider: 'tesseract',
      method: 'ocr_pdf_page',
      pageCount: 0,
      processedAt: new Date().toISOString(),
    };
  }

  // Image OCR
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(Buffer.from(buffer));
  await worker.terminate();

  return {
    text: data.text || '',
    confidence: data.confidence || 0,
    provider: 'tesseract',
    method: 'ocr_image',
    processedAt: new Date().toISOString(),
  };
}

export async function extractTextFromFile(
  file: File | Blob,
  fileType: string = 'image/png'
): Promise<OCRResult> {
  const buffer = await file.arrayBuffer();
  return extractTextFromBuffer(buffer, fileType);
}

export async function extractTextFromUrl(
  url: string,
  fileType: string = 'image/png'
): Promise<OCRResult> {
  const response = await fetch(url);
  const blob = await response.blob();
  return extractTextFromFile(blob, fileType);
}
