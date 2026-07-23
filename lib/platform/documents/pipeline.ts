// lib/platform/documents/pipeline.ts
import { getOCRAdapter } from './ocr';
import { classifyDocument } from './classifier';
import { getExtractionProvider } from './extraction-registry';
import { validateLeaseFields } from './validator';
import { createReviewFromExtraction } from './review-model';
import { createImportJob, updateImportJobStatus } from './import-job';
import type { DocumentReview } from './review-model';
import type { OCRResult } from './ocr/types';
import type { ImportJobStatus } from './import-job';

export interface PipelineResult {
  review: DocumentReview;
  ocrResult: OCRResult;
  documentClass: string;
  importJobId: string;
}

export async function processDocument(
  fileBuffer: Uint8Array,
  fileName: string,
  mimeType: string,
  entityId: string,
  fileUrl: string,
  ocrProvider: string = 'azure'
): Promise<PipelineResult> {
  // Create import job
  const jobId = await createImportJob(entityId, fileName, fileUrl);

  try {
    // Step 1: OCR
    await updateImportJobStatus(jobId, 'ocr_processing');
    const adapter = getOCRAdapter(ocrProvider);
    const ocrResult = await adapter.extractText(fileBuffer, mimeType);

    // Step 2: Classify
    await updateImportJobStatus(jobId, 'classifying');
    const classification = classifyDocument(ocrResult);

    // Step 3: Route to correct extraction provider
    await updateImportJobStatus(jobId, 'extracting');
    const extractor = getExtractionProvider(classification.documentClass);
    const extraction = extractor.extract(ocrResult);

    // Step 4: Validate
    await updateImportJobStatus(jobId, 'validating');
    const warnings = classification.documentClass === 'lease' 
      ? validateLeaseFields(extraction.fields as any).map(w => w.message)
      : [];

    // Step 5: Create review
    const review = createReviewFromExtraction(
      jobId,
      classification.documentClass,
      fileName,
      ocrResult.confidence,
      extraction.fields as Record<string, { value: any; confidence: number }>,
      [...extraction.warnings, ...warnings],
      ocrResult.raw
    );

    // Update job
    const status: ImportJobStatus = review.status === 'accepted' ? 'accepted' : 'pending_review';
    await updateImportJobStatus(jobId, status, {
      documentClass: classification.documentClass,
      ocrConfidence: ocrResult.confidence,
      extractionConfidence: review.extractionConfidence,
    });

    return { review, ocrResult, documentClass: classification.documentClass, importJobId: jobId };
  } catch (err: any) {
    await updateImportJobStatus(jobId, 'failed', { errorMessage: err.message });
    throw err;
  }
}
