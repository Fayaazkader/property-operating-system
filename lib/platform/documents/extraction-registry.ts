// lib/platform/documents/extraction-registry.ts
import type { ExtractionProvider, ExtractionResult } from './extraction-engine';
import { leaseExtractionProvider } from './extraction-engine';
import type { OCRResult } from './ocr/types';
import type { DocumentClass } from './classifier';

// Placeholder providers — to be built in later phases
const noopProvider: ExtractionProvider = {
  name: 'noop',
  extract: () => ({ fields: {}, overallConfidence: 0, requiresReview: true, warnings: ['Extraction not yet implemented for this document type'] }),
};

const registry: Record<DocumentClass, ExtractionProvider> = {
  lease: leaseExtractionProvider,
  invoice: noopProvider,
  statement: noopProvider,
  supplier_invoice: noopProvider,
  utility_bill: noopProvider,
  unknown: noopProvider,
};

export function getExtractionProvider(documentClass: DocumentClass): ExtractionProvider {
  return registry[documentClass] || noopProvider;
}
