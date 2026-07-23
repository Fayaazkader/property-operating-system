// lib/platform/documents/ocr/none-adapter.ts
// Default OCR adapter — returns empty, placeholder for real OCR

import type { OCRProvider, OCRResult } from './types';

export class NoneOCRAdapter implements OCRProvider {
  name = 'none';

  async extractText(_fileBuffer: ArrayBuffer, _mimeType: string): Promise<OCRResult> {
    return {
      text: '',
      confidence: 0,
      provider: 'none',
      processedAt: new Date().toISOString(),
    };
  }
}
