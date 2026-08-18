// lib/document-intelligence/ocr-adapter.ts
// OCR Adapter — PDF text extraction via pdf2json

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  rawText: string;
  confidence: number;
  provider: string;
  method: 'native_text' | 'ocr_image' | 'ocr_pdf_page';
  pageCount?: number;
  processedAt: string;
}

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

async function extractPdfNativeText(buffer: ArrayBuffer): Promise<{ text: string; rawText: string }> {
  return new Promise((resolve) => {
    try {
      const PDFParserMod = require('pdf2json');
      const PDFParser = PDFParserMod.default || PDFParserMod;
      const parser = new PDFParser();
      
      parser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let rawText = '';
          const pages = pdfData.Pages || [];
          for (const page of pages) {
            const texts = page.Texts || [];
            for (const text of texts) {
              const decoded = (text.R || []).map((r: any) => safeDecode(r.T || '')).join(' ');
              rawText += decoded + '\n';
            }
            rawText += '\n';
          }
          
          const normalized = rawText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          resolve({ text: normalized, rawText: rawText.trim() });
        } catch {
          resolve({ text: '', rawText: '' });
        }
      });
      
      parser.on('pdfParser_dataError', () => resolve({ text: '', rawText: '' }));
      
      parser.parseBuffer(Buffer.from(buffer));
    } catch (err) {
      console.error('pdf2json failed:', err);
      resolve({ text: '', rawText: '' });
    }
  });
}

export async function extractTextFromBuffer(
  buffer: ArrayBuffer,
  fileType: string = 'image/png'
): Promise<OCRResult> {

  if (fileType === 'application/pdf' || fileType.includes('pdf')) {
    const { text, rawText } = await extractPdfNativeText(buffer);
    if (text.length > 20) {
      return {
        text,
        rawText,
        confidence: 95,
        provider: 'pdf2json',
        method: 'native_text',
        processedAt: new Date().toISOString(),
      };
    }

    return {
      text: '',
      rawText: '',
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
    rawText: data.text || '',
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
