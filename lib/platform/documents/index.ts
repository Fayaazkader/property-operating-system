// lib/platform/documents/index.ts
// Document Intelligence Platform — Public API
export * from './types';
export * from './engine';
export * from './classification-engine';
export { getOCRAdapter, registerOCRAdapter } from './ocr';
export type { OCRResult } from './ocr';
