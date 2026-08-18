// lib/document-intelligence/engine.ts
// Document Intelligence Engine — Real OCR with pluggable adapter

import { supabase } from "@/lib/supabase";
import { orchestrator } from "@/lib/conversation/workflow-orchestrator";
import { publish } from "@/lib/conversation/event-bus";
import { extractTextFromBuffer } from "./ocr-adapter";
import { classifyDocument, DocumentType } from "./classifier";
import { extractInvoiceFields, extractLeaseFields, ExtractionResult } from "./field-extractor";
import type { SupabaseClient } from '@supabase/supabase-js';

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
  workflowId?: string;
  message: string;
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
    extraction = extractLeaseFields(ocrText);
  } else {
    extraction = {
      fields: {},
      missingFields: ['document_type_unknown'],
      overallConfidence: 30,
      requiresHumanReview: true,
    };
  }

  const extractedFields = toExtractedFields(extraction);

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
            await orchestrator.execute("lease_application_intake", { fileBuffer, fileName, tenantId, extractedFields });
      publish("document_processed", { event: "lease_application_received", tenantId, data: extractedFields });
      break;
    case "signed_lease":
      workflowId = "lease_activation";
            await orchestrator.execute("lease_activation", { fileBuffer, fileName, tenantId, extractedFields });
      publish("document_processed", { event: "lease_signed", tenantId, data: extractedFields });
      break;
    case "invoice":
      workflowId = "invoice_intake";
      publish("document_processed", { event: "invoice_received", data: extractedFields });
      break;
    case "maintenance_photo":
      workflowId = "maintenance_photo_attached";
      publish("document_processed", { event: "maintenance_photo_received", tenantId, data: extractedFields });
      break;
    default:
      publish("document_processed", { event: "document_received", data: { type: documentType } });
  }

  return {
    documentType,
    extractedFields,
    workflowId,
    message: extractedFields.requiresHumanReview
      ? `${documentType.replace(/_/g, ' ')} received. Some fields need review.`
      : `${documentType.replace(/_/g, ' ')} processed successfully.${workflowId ? ' Workflow started.' : ''}`,
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
