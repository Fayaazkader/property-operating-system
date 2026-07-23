// lib/platform/documents/review-model.ts

export interface ReviewField<T = any> {
  value: T;
  confidence: number;
  source: 'keyValue' | 'regex' | 'table' | 'manual';
  reviewed: boolean;
  original?: string;
  correctedValue?: T;
  pageNumber?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  keyName?: string;
  matchedPattern?: string;
}

export interface DocumentReview {
  documentId: string;
  documentClass: string;
  ocrConfidence: number;
  extractionConfidence: number;
  fields: Record<string, ReviewField>;
  warnings: string[];
  rawOCR?: unknown;
  originalFileName: string;
  createdAt: string;
  status: 'pending_review' | 'reviewed' | 'accepted' | 'rejected';
}

export function createReviewFromExtraction(
  documentId: string,
  documentClass: string,
  fileName: string,
  ocrConfidence: number,
  fields: Record<string, { value: any; confidence: number }>,
  warnings: string[],
  rawOCR?: unknown
): DocumentReview {
  const reviewFields: Record<string, ReviewField> = {};

  for (const [key, field] of Object.entries(fields)) {
    if (!field) continue;
    reviewFields[key] = {
      value: field.value,
      confidence: field.confidence,
      source: field.confidence > 0.8 ? 'keyValue' : 'regex',
      reviewed: field.confidence > 0.9,
      original: String(field.value),
    };
  }

  const confidences = Object.values(reviewFields).map(f => f.confidence);
  const avgConfidence = confidences.length > 0 ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;

  return {
    documentId,
    documentClass,
    ocrConfidence,
    extractionConfidence: Math.round(avgConfidence * 100) / 100,
    fields: reviewFields,
    warnings,
    rawOCR,
    originalFileName: fileName,
    createdAt: new Date().toISOString(),
    status: avgConfidence > 0.85 && warnings.length === 0 ? 'accepted' : 'pending_review',
  };
}
