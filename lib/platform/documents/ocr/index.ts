// lib/platform/documents/ocr/index.ts
// OCR Adapter Registry

import { NoneOCRAdapter } from './none-adapter';
import { AzureOCRAdapter } from './azure-adapter';
import type { OCRProvider, OCRResult } from './types';

const adapters: Map<string, OCRProvider> = new Map();
adapters.set('none', new NoneOCRAdapter());
adapters.set('azure', new AzureOCRAdapter());
// Future: adapters.set('azure', new AzureOCRAdapter());
// Future: adapters.set('google', new GoogleVisionAdapter());
// Future: adapters.set('aws', new AWSTextractAdapter());
// Future: adapters.set('openai', new OpenAIAdapter());

export function getOCRAdapter(provider: string): OCRProvider {
  return adapters.get(provider) || adapters.get('none')!;
}

export function registerOCRAdapter(name: string, adapter: OCRProvider): void {
  adapters.set(name, adapter);
}

export type { OCRProvider, OCRResult };
