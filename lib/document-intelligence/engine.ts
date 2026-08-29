// lib/document-intelligence/engine.ts
// Document Intelligence Engine — Real OCR with pluggable adapter

import { supabase } from "@/lib/supabase";
import { orchestrator } from "@/lib/conversation/workflow-orchestrator";
import { publish } from "@/lib/platform/events/event-bus";
import {
  extractTextFromBuffer,
  type DocumentEvidence,
} from "./ocr-adapter";
import { classifyDocument, DocumentType } from "./classifier";
import { extractInvoiceFields, extractLeaseFields, ExtractionResult } from "./field-extractor";
import type { SupabaseClient } from '@supabase/supabase-js';
import { matchEvidence } from "./evidence-matcher";
import type { LeaseTemplateFieldEvidence } from '@/lib/lease/templates/types';

export type { DocumentType };

export interface ExtractedFields {
  [key: string]: any;
  confidence: number;
  requiresHumanReview: boolean;
  missingFields: string[];
  invoice_date?: string;
  due_date?: string;
  subtotal?: number;
  vat_amount?: number;
}

export interface DocumentResult {
  documentType: DocumentType;
  extractedFields: ExtractedFields;
  fieldEvidence?: Record<string, import('./ocr-adapter').DocumentEvidence[]>;
  workflowId?: string;
  message: string;
  ocrText?: string;
  rawOcrText?: string;
  ocrConfidence?: number;
}

function toExtractedFields(result: ExtractionResult): ExtractedFields {
  const fields: ExtractedFields = {
    confidence: result.overallConfidence,
    requiresHumanReview: result.requiresHumanReview,
    missingFields: result.missingFields,
  };

  for (const [key, field] of Object.entries(result.fields)) {
    fields[key] = field.value;
  }

  return fields;
}

function buildFieldEvidence(
  extraction: ExtractionResult,
  evidence: DocumentEvidence[]
): Record<string, DocumentEvidence[]> {
  const fieldEvidence: Record<string, DocumentEvidence[]> = {};

  if (!evidence.length) {
    return fieldEvidence;
  }

  for (const [key, field] of Object.entries(extraction.fields)) {
    if (
      field.value === undefined ||
      field.value === null ||
      field.value === ''
    ) {
      continue;
    }

    if (Array.isArray(field.value)) {
      continue;
    }

    const matches = matchEvidence(
      field.value,
      evidence
    );

    if (matches.length > 0) {
      fieldEvidence[key] = matches;
    }
  }

  return fieldEvidence;
}

function toLeaseFieldEvidence(
  evidence: DocumentEvidence[]
): LeaseTemplateFieldEvidence[] {
  return evidence.map(item => ({
    text: item.text,
    page: item.location?.page,
    startOffset: item.location?.startOffset,
    endOffset: item.location?.endOffset,
    boundingBox:
      item.location?.x !== undefined &&
      item.location?.y !== undefined &&
      item.location?.width !== undefined &&
      item.location?.height !== undefined
        ? {
            x: item.location.x,
            y: item.location.y,
            width: item.location.width,
            height: item.location.height,
          }
        : undefined,
  }));
}

export async function processDocument(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  tenantId?: string,
  metadata?: any,
  db: SupabaseClient = supabase
): Promise<DocumentResult> {

  // Run OCR
    const ocrResult = await extractTextFromBuffer(fileBuffer, mimeType);

    console.log("OCR TEXT:", ocrResult.text.slice(0, 800));
        console.log("RAW TEXT has newlines:", ocrResult.rawText.includes('\n'));
    console.log("RAW TEXT length:", ocrResult.rawText.length);
    const ocrText = ocrResult.text;
  // Classify
  const documentType = classifyDocument(fileName, mimeType, ocrText);

  // Extract fields
  let extraction: ExtractionResult;
  if (documentType === 'invoice' || documentType === 'purchase_order') {
    extraction = extractInvoiceFields(ocrText, ocrResult.rawText);
  } else if (documentType === 'lease_application' || documentType === 'signed_lease') {
    extraction = extractLeaseFields(ocrText, ocrResult.rawText);
  } else {
    extraction = {
      fields: {},
      missingFields: ['document_type_unknown'],
      overallConfidence: 30,
      requiresHumanReview: true,
    };
  }

  const extractedFields = toExtractedFields(extraction);

const fieldEvidence = buildFieldEvidence(
  extraction,
  ocrResult.evidence || []
);

  // Log the document
  await supabase.from("communications").insert({
    tenant_id: tenantId || null,
    event_type: "document_received",
    channel: metadata?.channel || "upload",
    message_body: `Document: ${fileName} (${documentType})`,
    status: extractedFields.requiresHumanReview ? "review" : "processed",
    source_type: "document",
    source_id: metadata?.documentId || `DOC-${Date.now()}`,
  });

  // Workflow routing — same as before
  let workflowId: string | undefined;
    switch (documentType) {
    case "lease_application":
      workflowId = "lease_application_intake";

      await orchestrator.execute(
        "lease_application_intake",
        { fileBuffer, fileName, tenantId, extractedFields }
      );

      await publish("document.processed", {
        source: "document-intelligence",
        version: "1",
        correlationId: metadata?.correlationId || crypto.randomUUID(),
        payload: {
          documentType,
          workflowId,
          eventType: "lease_application_received",
          tenantId,
          fileName,
          extractedFields,
        },
      });
      break;

    case "signed_lease":
      workflowId = "lease_activation";

      await orchestrator.execute(
        "lease_activation",
        { fileBuffer, fileName, tenantId, extractedFields }
      );

      await publish("document.processed", {
        source: "document-intelligence",
        version: "1",
        correlationId: metadata?.correlationId || crypto.randomUUID(),
        payload: {
          documentType,
          workflowId,
          eventType: "lease_signed",
          tenantId,
          fileName,
          extractedFields,
        },
      });
      break;

    case "invoice":
      workflowId = "invoice_intake";

      await publish("document.processed", {
        source: "document-intelligence",
        version: "1",
        correlationId: metadata?.correlationId || crypto.randomUUID(),
        payload: {
          documentType,
          workflowId,
          eventType: "invoice_received",
          tenantId,
          fileName,
          extractedFields,
        },
      });
      break;

    case "maintenance_photo":
      workflowId = "maintenance_photo_attached";

      await publish("document.processed", {
        source: "document-intelligence",
        version: "1",
        correlationId: metadata?.correlationId || crypto.randomUUID(),
        payload: {
          documentType,
          workflowId,
          eventType: "maintenance_photo_received",
          tenantId,
          fileName,
          extractedFields,
        },
      });
      break;

    default:
      await publish("document.processed", {
        source: "document-intelligence",
        version: "1",
        correlationId: metadata?.correlationId || crypto.randomUUID(),
        payload: {
          documentType,
          eventType: "document_received",
          tenantId,
          fileName,
        },
      });
  }

  return {
  documentType,
  extractedFields,
  fieldEvidence,
  workflowId,
  message: extractedFields.requiresHumanReview
    ? `${documentType.replace(/_/g, ' ')} received. Some fields need review.`
    : `${documentType.replace(/_/g, ' ')} processed successfully.${workflowId ? ' Workflow started.' : ''}`,
  ocrText: ocrResult.text,
  rawOcrText: ocrResult.rawText,
  ocrConfidence: ocrResult.confidence,
};
}

export async function intakeFromWhatsApp(
  mediaUrl: string,
  fileName: string,
  mimeType: string,
  tenantId: string,
  tenantName: string,
  caption?: string
): Promise<DocumentResult> {
    const response = await fetch(mediaUrl);
  const buffer = await response.arrayBuffer();
  return processDocument(buffer, fileName, mimeType, tenantId, {
    tenant_name: tenantName,
    channel: 'whatsapp',
    caption,
  });
}
