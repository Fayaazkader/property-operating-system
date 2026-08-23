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
  evidence?: DocumentEvidence[];
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
export interface DocumentEvidenceLocation {
  type: 'bbox' | 'text_range' | 'region';

  page?: number;

  x?: number;
  y?: number;
  width?: number;
  height?: number;

  startOffset?: number;
  endOffset?: number;
}

export interface DocumentEvidence {
  text: string;
  confidence?: number;
  location?: DocumentEvidenceLocation;

  source:
    | 'pdf_text'
    | 'ocr'
    | 'docx_text'
    | 'doc_text'
    | 'image_ocr'
    | 'docusign';
}

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

async function extractPdfNativeText(
  buffer: ArrayBuffer
): Promise<{
  text: string;
  rawText: string;
  evidence: DocumentEvidence[];
  pageCount: number;
}> {
  return new Promise((resolve) => {
    try {
      const PDFParserMod = require('pdf2json');
      const PDFParser = PDFParserMod.default || PDFParserMod;
      const parser = new PDFParser();

      parser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let rawText = '';
          const evidence: DocumentEvidence[] = [];
          const pages = pdfData.Pages || [];

          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const page = pages[pageIndex];
            const texts = page.Texts || [];

            for (const text of texts) {
              const decoded = (text.R || [])
                .map((r: any) => safeDecode(r.T || ''))
                .join(' ');

              if (!decoded.trim()) continue;

              rawText += decoded + '\n';

              evidence.push({
                text: decoded,
                source: 'pdf_text',
                location: {
                  type: 'bbox',
                  page: pageIndex + 1,
                  x: typeof text.x === 'number' ? text.x : undefined,
                  y: typeof text.y === 'number' ? text.y : undefined,
                  width:
                    typeof text.w === 'number'
                      ? text.w
                      : undefined,
                  height:
                    typeof text.h === 'number'
                      ? text.h
                      : undefined,
                },
              });
            }

            rawText += '\n';
          }

          const normalized = rawText
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          resolve({
            text: normalized,
            rawText: rawText.trim(),
            evidence,
            pageCount: pages.length,
          });
        } catch {
          resolve({
            text: '',
            rawText: '',
            evidence: [],
            pageCount: 0,
          });
        }
      });

      parser.on('pdfParser_dataError', () =>
        resolve({
          text: '',
          rawText: '',
          evidence: [],
          pageCount: 0,
        })
      );

      parser.parseBuffer(Buffer.from(buffer));
    } catch (err) {
      console.error('pdf2json failed:', err);

      resolve({
        text: '',
        rawText: '',
        evidence: [],
        pageCount: 0,
      });
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
): Promise<{
  text: string;
  rawText: string;
  confidence: number;
  pageCount: number;
  evidence: DocumentEvidence[];
}> {
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
    const evidence: DocumentEvidence[] = [];

    for (const page of pages) {
      if (!page.content) continue;

      const { data } = await worker.recognize(page.content);

const ocrPage = data as typeof data & {
  words?: Array<{
    text?: string;
    confidence?: number;
    bbox?: {
      x0?: number;
      y0?: number;
      x1?: number;
      y1?: number;
    };
  }>;
};

if (Array.isArray(ocrPage.words)) {
  for (const word of ocrPage.words) {
    if (!word.text?.trim()) continue;

    evidence.push({
      text: word.text.trim(),
      confidence:
        typeof word.confidence === 'number'
          ? word.confidence
          : undefined,
      source: 'ocr',
      location: {
        type: 'bbox',
        page: page.pageNumber,
        x: word.bbox?.x0,
        y: word.bbox?.y0,
        width:
          typeof word.bbox?.x0 === 'number' &&
          typeof word.bbox?.x1 === 'number'
            ? word.bbox.x1 - word.bbox.x0
            : undefined,
        height:
          typeof word.bbox?.y0 === 'number' &&
          typeof word.bbox?.y1 === 'number'
            ? word.bbox.y1 - word.bbox.y0
            : undefined,
      },
    });
  }
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
  evidence,
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
  const { text, rawText } =
  await extractLegacyDocText(buffer);

  if (!text) {
    throw new Error('Unable to extract text from legacy Word document');
  }

  return {
    text,
    rawText,
    confidence: 100,
    evidence: [],
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

    return {
      text,
      rawText,
      confidence: 100,
      evidence: [],
      provider: 'mammoth',
      method: 'native_docx',
      processedAt: new Date().toISOString(),
    };
  }

    if (
    normalizedFileType === 'application/pdf' ||
    normalizedFileType.includes('pdf')
  ) {
    const { text, rawText, evidence, pageCount } =
  await extractPdfNativeText(buffer);

    if (text.length > 20) {
      return {
  text,
  rawText,
  confidence: 95,
  provider: 'pdf2json',
  method: 'native_text',
  evidence,
  pageCount,
  processedAt: new Date().toISOString(),
};
    }

    const scanned = await extractScannedPdfText(buffer);

    return {
  text: scanned.text,
  rawText: scanned.rawText,
  confidence: scanned.confidence,
  provider: 'tesseract',
  method: 'ocr_pdf_page',
  pageCount: scanned.pageCount,
  evidence: scanned.evidence,
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

const ocrPage = data as typeof data & {
  words?: Array<{
    text?: string;
    confidence?: number;
    bbox?: {
      x0?: number;
      y0?: number;
      x1?: number;
      y1?: number;
    };
  }>;
};

const evidence: DocumentEvidence[] = [];

if (Array.isArray(ocrPage.words)) {
  for (const word of ocrPage.words) {
    if (!word.text?.trim()) continue;

    evidence.push({
      text: word.text.trim(),
      confidence:
        typeof word.confidence === 'number'
          ? word.confidence
          : undefined,
      source: 'image_ocr',
      location: {
        type: 'bbox',
        page: 1,
        x: word.bbox?.x0,
        y: word.bbox?.y0,
        width:
          typeof word.bbox?.x0 === 'number' &&
          typeof word.bbox?.x1 === 'number'
            ? word.bbox.x1 - word.bbox.x0
            : undefined,
        height:
          typeof word.bbox?.y0 === 'number' &&
          typeof word.bbox?.y1 === 'number'
            ? word.bbox.y1 - word.bbox.y0
            : undefined,
      },
    });
  }
}

await worker.terminate();

return {
  text: data.text || '',
  rawText: data.text || '',
  confidence: data.confidence || 0,
  provider: 'tesseract',
  method: 'ocr_image',
  pageCount: 1,
  evidence,
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
