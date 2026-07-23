// lib/platform/documents/classifier.ts
import type { OCRResult } from './ocr/types';

export type DocumentClass = 'lease' | 'invoice' | 'statement' | 'supplier_invoice' | 'utility_bill' | 'unknown';

export interface ClassificationResult {
  documentClass: DocumentClass;
  confidence: number;
  reasons: string[];
}

const CLASSIFIERS: Record<DocumentClass, { keywords: string[] }> = {
  lease: { keywords: ['lease', 'tenant', 'lessee', 'landlord', 'lessor', 'rental', 'commencement', 'expiry', 'deposit', 'escalation', 'premises'] },
  invoice: { keywords: ['invoice', 'tax invoice', 'vat', 'subtotal', 'total due', 'payment terms'] },
  statement: { keywords: ['statement', 'balance', 'opening balance', 'closing balance', 'transaction history', 'account summary'] },
  supplier_invoice: { keywords: ['supplier', 'purchase order', 'po number', 'delivery note', 'goods received'] },
  utility_bill: { keywords: ['electricity', 'water', 'meter', 'consumption', 'kwh', 'kilolitres', 'utility', 'municipality'] },
  unknown: { keywords: [] },
};

export function classifyDocument(ocrResult: OCRResult): ClassificationResult {
  const text = ocrResult.text.toLowerCase();
  const scores: Record<string, { score: number; matches: string[] }> = {};

  for (const [docClass, config] of Object.entries(CLASSIFIERS)) {
    if (docClass === 'unknown') continue;
    const matches: string[] = [];
    for (const keyword of config.keywords) {
      if (text.includes(keyword)) matches.push(keyword);
    }
    if (matches.length > 0) {
      scores[docClass] = { score: matches.length / config.keywords.length, matches };
    }
  }

  if (Object.keys(scores).length === 0) {
    return { documentClass: 'unknown', confidence: 0, reasons: ['No keywords matched'] };
  }

  const best = Object.entries(scores).sort((a, b) => b[1].score - a[1].score)[0];
  return {
    documentClass: best[0] as DocumentClass,
    confidence: Math.round(best[1].score * 100) / 100,
    reasons: best[1].matches,
  };
}
