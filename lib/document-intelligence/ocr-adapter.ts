// lib/document-intelligence/ocr-adapter.ts
// OCR Adapter — PDF text extraction via pdf-parse with disableWorker

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
    const pdfParseMod: any = await import('pdf-parse');
    const PDFParse = pdfParseMod.PDFParse || pdfParseMod.default?.PDFParse || pdfParseMod;
    const parser = new PDFParse({
      data: Buffer.from(buffer),
      disableWorker: true,
      verbosity: 0,
    });
    const result = await parser.getText();
    return result?.text?.trim() || '';
  } catch (err) {
    console.error('pdf-parse extraction failed:', err);
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
