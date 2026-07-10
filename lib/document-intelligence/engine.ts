// Document Intelligence Engine
// Detects document type, extracts fields, validates, and starts workflows

import { supabase } from "@/lib/supabase";
import { orchestrator } from "@/lib/conversation/workflow-orchestrator";
import { publish } from "@/lib/conversation/event-bus";

export type DocumentType = 
  | "lease_application"
  | "signed_lease"
  | "invoice"
  | "purchase_order"
  | "bank_statement"
  | "meter_reading"
  | "inspection_report"
  | "maintenance_photo"
  | "quote"
  | "id_document"
  | "unknown";

export type ExtractedFields = {
  tenant_name?: string;
  company_registration?: string;
  rental_amount?: number;
  deposit_amount?: number;
  escalation_percent?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  parking_bays?: number;
  property_name?: string;
  invoice_number?: string;
  invoice_amount?: number;
  supplier_name?: string;
  meter_reading?: number;
  meter_date?: string;
  confidence: number;
  requiresHumanReview: boolean;
  missingFields: string[];
};

export type DocumentResult = {
  documentType: DocumentType;
  extractedFields: ExtractedFields;
  workflowId?: string;
  message: string;
};

// Document type detection based on filename patterns and content hints
function detectDocumentType(fileName: string, mimeType: string, content?: string): DocumentType {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase();

  if (name.includes("lease") && (name.includes("application") || name.includes("offer"))) return "lease_application";
  if (name.includes("lease") && (name.includes("signed") || name.includes("executed"))) return "signed_lease";
  if (name.includes("invoice") || name.includes("bill")) return "invoice";
  if (name.includes("po") || name.includes("purchase") || name.includes("order")) return "purchase_order";
  if (name.includes("bank") || name.includes("statement")) return "bank_statement";
  if (name.includes("meter") || name.includes("reading") || name.includes("consumption")) return "meter_reading";
  if (name.includes("inspection") || name.includes("report")) return "inspection_report";
  if (name.includes("quote") || name.includes("estimate") || name.includes("proposal")) return "quote";
  if (type.includes("image") && (name.includes("photo") || name.includes("img") || name.includes("pic"))) return "maintenance_photo";
  if (name.includes("id") || name.includes("identity") || name.includes("passport")) return "id_document";

  return "unknown";
}

// Simulated field extraction (replace with real OCR/AI in production)
function extractFields(documentType: DocumentType, content?: string, metadata?: any): ExtractedFields {
  const missingFields: string[] = [];
  let confidence = 85;

  switch (documentType) {
    case "lease_application":
      return {
        tenant_name: metadata?.tenant_name || undefined,
        company_registration: metadata?.company_registration || undefined,
        rental_amount: metadata?.rental_amount || undefined,
        deposit_amount: metadata?.deposit_amount || undefined,
        escalation_percent: metadata?.escalation_percent || undefined,
        lease_start_date: metadata?.lease_start_date || undefined,
        lease_end_date: metadata?.lease_end_date || undefined,
        parking_bays: metadata?.parking_bays || undefined,
        property_name: metadata?.property_name || undefined,
        confidence: metadata ? 90 : 75,
        requiresHumanReview: !metadata,
        missingFields: !metadata ? ["tenant_name", "rental_amount", "lease_dates"] : [],
      };

    case "signed_lease":
      return {
        tenant_name: metadata?.tenant_name || undefined,
        rental_amount: metadata?.rental_amount || undefined,
        lease_start_date: metadata?.start_date || undefined,
        lease_end_date: metadata?.end_date || undefined,
        confidence: 95,
        requiresHumanReview: false,
        missingFields: [],
      };

    case "invoice":
      return {
        invoice_number: metadata?.invoice_number || undefined,
        invoice_amount: metadata?.amount || undefined,
        supplier_name: metadata?.supplier_name || undefined,
        confidence: 88,
        requiresHumanReview: !metadata,
        missingFields: !metadata ? ["invoice_number", "invoice_amount"] : [],
      };

    case "maintenance_photo":
      return {
        property_name: metadata?.property_name || undefined,
        confidence: 70,
        requiresHumanReview: true,
        missingFields: ["issue_description"],
      };

    default:
      return { confidence: 50, requiresHumanReview: true, missingFields: ["document_type_unknown"] };
  }
}

// Main intake function
export async function processDocument(
  fileUrl: string,
  fileName: string,
  mimeType: string,
  tenantId?: string,
  metadata?: any
): Promise<DocumentResult> {
  const documentType = detectDocumentType(fileName, mimeType);
  const extractedFields = extractFields(documentType, undefined, metadata);

  // Log the document
  await supabase.from("communications").insert({
    tenant_id: tenantId || null,
    event_type: "document_received",
    channel: metadata?.channel || "upload",
    message_body: `Document: ${fileName} (${documentType})`,
    status: extractedFields.requiresHumanReview ? "review" : "processed",
    source_type: "document",
    source_id: `DOC-${Date.now()}`,
  });

  // Route to appropriate workflow
  let workflowId: string | undefined;

  switch (documentType) {
    case "lease_application":
      workflowId = "lease_application_intake";
      await orchestrator.execute("lease_application_intake", {
        fileUrl, fileName, tenantId, extractedFields,
      });
      publish("document_processed", { event: "lease_application_received", tenantId, data: extractedFields });
      break;

    case "signed_lease":
      workflowId = "lease_activation";
      await orchestrator.execute("lease_activation", {
        fileUrl, fileName, tenantId, extractedFields,
      });
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
      ? `📄 ${documentType.replace(/_/g, " ")} received. Some fields need review before processing.`
      : `✅ ${documentType.replace(/_/g, " ")} processed successfully.${workflowId ? " Workflow started." : ""}`,
  };
}

// Quick intake from WhatsApp — process a forwarded document
export async function intakeFromWhatsApp(
  mediaUrl: string,
  fileName: string,
  tenantId: string,
  tenantName: string,
  caption?: string
): Promise<DocumentResult> {
  return processDocument(mediaUrl, fileName, "application/pdf", tenantId, {
    tenant_name: tenantName,
    channel: "whatsapp",
    caption,
  });
}
