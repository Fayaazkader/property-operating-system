// lib/document-intelligence/ocr-adapter.ts
// OCR Adapter — PDF text extraction via pdfjs-dist legacy (no worker, no canvas needed)

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
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.js');
    
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorker: false,
      isEvalSupported: false,
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
    }
    
    await pdf.destroy();
    return fullText.trim();
  } catch (err) {
    console.error('pdfjs text extraction failed:', err);
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
        provider: 'pdfjs-dist',
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
