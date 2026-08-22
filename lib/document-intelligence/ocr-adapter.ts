// lib/document-intelligence/ocr-adapter.ts
// OCR Adapter — PDF text extraction via pdf2json

import { createWorker } from 'tesseract.js';
import path from 'path';
import mammoth from 'mammoth';
import { pdfToPng } from 'pdf-to-png-converter';
import WordExtractor from 'word-extractor';

export interface OCRResult {
  text: string;
  rawText: string;
  confidence: number;
  provider: string;
  method:
  | 'native_text'
  | 'native_doc'
  | 'native_docx'
  | 'ocr_image'
  | 'ocr_pdf_page';
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

async function extractDocxText(
  buffer: ArrayBuffer
): Promise<{ text: string; rawText: string }> {
  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(buffer),
    });

    const rawText = result.value.trim();
    const text = rawText.replace(/\s+/g, ' ').trim();

    return {
      text,
      rawText,
    };
  } catch (error) {
    console.error('DOCX text extraction failed:', error);

    return {
      text: '',
      rawText: '',
    };
  }
}

async function extractScannedPdfText(
  buffer: ArrayBuffer
): Promise<{ text: string; rawText: string; confidence: number; pageCount: number }> {
  const pages = await pdfToPng(buffer, {
    viewportScale: 1.5,
    returnPageContent: true,
    processPagesInParallel: true,
    concurrencyLimit: 2,
    renderInWorkerThreads: false,
  });

  if (!pages.length) {
    throw new Error('Unable to render scanned PDF pages');
  }

  const workerPath = path.join(
    process.cwd(),
    'node_modules',
    'tesseract.js',
    'src',
    'worker-script',
    'node',
    'index.js'
  );

  const worker = await createWorker('eng', undefined, {
    workerPath,
  });

  try {
    const pageTexts: string[] = [];
    const confidences: number[] = [];

    for (const page of pages) {
      if (!page.content) continue;

      const { data } = await worker.recognize(page.content);

      pageTexts.push(
        `\n--- Page ${page.pageNumber} ---\n${data.text || ''}`
      );

      if (typeof data.confidence === 'number') {
        confidences.push(data.confidence);
      }
    }

    const rawText = pageTexts.join('\n').trim();
    const text = rawText.replace(/\s+/g, ' ').trim();

    const confidence = confidences.length
      ? Math.round(
          confidences.reduce((sum, value) => sum + value, 0) /
            confidences.length
        )
      : 0;

    return {
      text,
      rawText,
      confidence,
      pageCount: pages.length,
    };
  } finally {
    await worker.terminate();
  }
}

async function extractLegacyDocText(
  buffer: ArrayBuffer
): Promise<{ text: string; rawText: string }> {
  try {
    const extractor = new WordExtractor();

    const document = await extractor.extract(
      Buffer.from(buffer)
    );

    const rawText = document.getBody().trim();
    const text = rawText.replace(/\s+/g, ' ').trim();

    return {
      text,
      rawText,
    };
  } catch (error) {
    console.error('Legacy DOC text extraction failed:', error);

    return {
      text: '',
      rawText: '',
    };
  }
}

export async function extractTextFromBuffer(
  buffer: ArrayBuffer,
  fileType: string = 'image/png'
): Promise<OCRResult> {
    const normalizedFileType = fileType.toLowerCase();
    if (
  normalizedFileType === 'application/msword' ||
  normalizedFileType.endsWith('.doc')
) {
  const { text, rawText } = await extractLegacyDocText(buffer);

  if (!text) {
    throw new Error('Unable to extract text from legacy Word document');
  }

  return {
    text,
    rawText,
    confidence: 100,
    provider: 'word-extractor',
    method: 'native_doc',
    processedAt: new Date().toISOString(),
  };
}

  if (
  normalizedFileType.includes('wordprocessingml.document') ||
  normalizedFileType.includes('docx')
) {
    const { text, rawText } = await extractDocxText(buffer);

    if (!text) {
      throw new Error('Unable to extract text from Word document');
    }

    const scanned = await extractScannedPdfText(buffer);

return {
  text: scanned.text,
  rawText: scanned.rawText,
  confidence: scanned.confidence,
  provider: 'tesseract',
  method: 'ocr_pdf_page',
  pageCount: scanned.pageCount,
  processedAt: new Date().toISOString(),
};
  }

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
  const workerPath = path.join(
  process.cwd(),
  'node_modules',
  'tesseract.js',
  'src',
  'worker-script',
  'node',
  'index.js'
);

const worker = await createWorker('eng', undefined, {
  workerPath,
});
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
