// lib/platform/documents/ocr/types.ts

export interface OCRProvider {
  name: string;
  extractText(fileBuffer: Buffer, mimeType: string): Promise<OCRResult>;
}

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  processedAt: string;
}
