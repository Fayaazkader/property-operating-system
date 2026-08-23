// lib/document-intelligence/field-extractor.ts
// Adaptive field extraction

import type { DocumentEvidence } from './ocr-adapter';

export interface ExtractedField {
  value: string | number | Array<any> | undefined;
  confidence: number;
  evidence?: DocumentEvidence[];
}

export interface InvoiceLineItem {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface ExtractionResult {
  fields: Record<string, ExtractedField>;
  missingFields: string[];
  overallConfidence: number;
  requiresHumanReview: boolean;
}

function extractWithConfidence(text: string, pattern: RegExp, fieldName: string): ExtractedField {
  const match = text.match(pattern);
  if (match && match[1]) {
    return { value: match[1].trim(), confidence: 85 };
  }
  return { value: undefined, confidence: 0 };
}

function parseAmount(val: string): string {
  return val.replace(/[^\d.]/g, '');
}

// Extract line items from raw OCR text (with newlines preserved)
function extractLineItems(rawText: string): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find the table structure: Description, Qty, Unit Price, Amount
  // Then each line item is 4 consecutive lines matching that pattern
  for (let i = 0; i < lines.length - 3; i++) {
    const desc = lines[i];
    const qty = lines[i + 1];
    const unitPrice = lines[i + 2];
    const amount = lines[i + 3];
    
    // Skip if this is a header or known non-item
    if (/description|qty|unit|price|amount|subtotal|vat|total|due|invoice|date|number|reference|payment|bank|account|branch|name/i.test(desc)) continue;
    
    // Check if qty is a number
    if (!/^\d+(\.\d+)?$/.test(qty)) continue;
    
    // Check if unit price and amount are R values
    const unitMatch = unitPrice.match(/R\s*([\d,]+\.?\d*)/i);
    const amountMatch = amount.match(/R\s*([\d,]+\.?\d*)/i);
    if (!unitMatch || !amountMatch) continue;
    
    items.push({
      description: desc,
      qty: parseFloat(qty),
      unit_price: parseFloat(unitMatch[1].replace(/,/g, '')),
      amount: parseFloat(amountMatch[1].replace(/,/g, '')),
    });
    
    // Skip past this item to avoid double-matching
    i += 3;
  }
  
  return items;
}

export function extractInvoiceFields(text: string, rawText?: string): ExtractionResult {
  const fields: Record<string, ExtractedField> = {};
  const missing: string[] = [];

  // Use raw text for line items if provided
  const textForLines = rawText || text;

  // Invoice number
  const invoiceNumber = extractWithConfidence(
    text,
    /Invoice\s*(?:No|Number|#)?\.?\s*(INV-[A-Z0-9-]+)/i,
    'invoice_number'
  );
  fields.invoice_number = invoiceNumber;
  if (!invoiceNumber.value) missing.push('invoice_number');

  // Total amount
  const totalAmount = extractWithConfidence(
    text,
    /TOTAL\s*DUE\s*R?\s*([\d,\s]+\.\d{2})/i,
    'invoice_amount'
  );
  fields.invoice_amount = totalAmount.value ? { value: parseAmount(totalAmount.value as string), confidence: 90 } : { value: undefined, confidence: 0 };

  // VAT
  const vatAmount = extractWithConfidence(
    text,
    /VAT\s*(?:\(\d+%\))?\s*R?\s*([\d,\s]+\.\d{2})/i,
    'vat_amount'
  );
  fields.vat_amount = vatAmount.value ? { value: parseAmount(vatAmount.value as string), confidence: 80 } : { value: undefined, confidence: 0 };

  // Subtotal
  const subtotal = extractWithConfidence(
    text,
    /Subtotal\s*R?\s*([\d,\s]+\.\d{2})/i,
    'subtotal'
  );
  fields.subtotal = subtotal.value ? { value: parseAmount(subtotal.value as string), confidence: 80 } : { value: undefined, confidence: 0 };

  // Due date
  const dueDate = extractWithConfidence(
    text,
    /Due\s*Date\s*(\d{1,2}\s+\w+\s+\d{4})/i,
    'due_date'
  );
  fields.due_date = dueDate.value ? { value: dueDate.value, confidence: 85 } : { value: undefined, confidence: 0 };

  // Invoice date
  const invoiceDate = extractWithConfidence(
    text,
    /Invoice\s*Date\s*(\d{1,2}\s+\w+\s+\d{4})/i,
    'invoice_date'
  );
  fields.invoice_date = invoiceDate.value ? { value: invoiceDate.value, confidence: 85 } : { value: undefined, confidence: 0 };

  // Supplier name
  const supplierMatch = text.match(/([A-Z][A-Za-z\s]+(?:\s+\(Pty\)\s+Ltd|\s+CC|\s+Ltd))/i);
  if (supplierMatch) {
    fields.supplier_name = { value: supplierMatch[1].trim(), confidence: 90 };
  } else {
    const supplier = extractWithConfidence(
      text,
      /(?:BILL\s+FROM|FROM)\s+(.+?)(?=\s+\d+\s+[A-Za-z]+\s+Road|\s+VAT|\s+BILL\s)/i,
      'supplier_name'
    );
    fields.supplier_name = supplier;
    if (!supplier.value) missing.push('supplier_name');
  }

  // Line items from raw text (newlines preserved)
  const lineItems = extractLineItems(textForLines);
  fields.line_items = { value: lineItems, confidence: lineItems.length > 0 ? 85 : 0 };
  if (lineItems.length === 0) missing.push('line_items');

  const confidences = Object.values(fields).map(f => f.confidence);
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : 0;

  return {
    fields,
    missingFields: missing,
    overallConfidence: Math.round(overallConfidence),
    requiresHumanReview: missing.length > 0 || overallConfidence < 60,
  };
}
export function extractLeaseFields(
  text: string,
  rawText?: string
): ExtractionResult {
  const fields: Record<string, ExtractedField> = {};
  const missing: string[] = [];

  const source = rawText || text;

  function addField(
    key: string,
    value: string | number | undefined,
    confidence: number
  ) {
    fields[key] = {
      value,
      confidence: value !== undefined && value !== '' ? confidence : 0,
    };

    if (value === undefined || value === '') {
      missing.push(key);
    }
  }

  /*
   * Tenant / Lessee
   *
   * Handles structures such as:
   * Tenant: RIAZ NAO
   * Tenant: RIAZ NAO Identity Number:
   * Lessee: ABC (Pty) Ltd
   */
  const tenantMatch = source.match(
    /(?:Tenant|Lessee|Applicant)\s*:\s*([^\n]+?)(?=\s+(?:Identity\s+Number|ID\s+Number|VAT\s+Number|Registration\s+Number|VAT|$))/i
  );

  addField(
    'tenant_name',
    tenantMatch?.[1]?.trim(),
    tenantMatch ? 95 : 0
  );

  /*
   * Landlord / Lessor
   */
  const landlordMatch = source.match(
    /(?:Landlord|Lessor)\s*:\s*([^\n]+?)(?=\s+(?:Registration\s+Number|Identity\s+Number|VAT\s+Number|VAT|$))/i
  );

  addField(
    'landlord_name',
    landlordMatch?.[1]?.trim(),
    landlordMatch ? 95 : 0
  );

  /*
   * Property / premises name.
   *
   * Prefer the PREMISES section because "property" can occur
   * many times elsewhere in a lease.
   */
  const premisesMatch = source.match(
    /(?:PREMISES|PROPERTY)\s+(.{1,300}?)(?=\s+\d+\s+(?:BENEFICAL|BENEFICIAL|COMMENCEMENT|DURATION|TERM)|$)/i
  );

  let propertyName: string | undefined;

  if (premisesMatch?.[1]) {
    propertyName = premisesMatch[1]
      .replace(/\s+/g, ' ')
      .trim();
  }

  addField(
    'property_name',
    propertyName,
    propertyName ? 85 : 0
  );

  /*
   * Unit / shop / suite.
   */
  const unitMatch = source.match(
    /\b(?:Unit|Shop|Suite)\s+([A-Za-z0-9-]+)/i
  );

  addField(
    'unit_number',
    unitMatch?.[1]?.trim(),
    unitMatch ? 95 : 0
  );

  /*
   * Premises area.
   *
   * Example:
   * Unit A4 measuring approximately 352.00 m²
   */
  const areaMatch = source.match(
    /(?:measuring\s+approximately|measuring|area\s+of)\s*([\d,\s]+(?:\.\d+)?)\s*(?:m²|m2|sqm|square\s+met(?:re|er)s?)/i
  );

  addField(
    'premises_area',
    areaMatch?.[1]
      ? `${areaMatch[1].replace(/\s/g, '')} m²`
      : undefined,
    areaMatch ? 90 : 0
  );

  /*
   * Commencement date.
   *
   * Example:
   * commence on 1 September 2024
   */
  const commencementMatch = source.match(
    /(?:commence|commencing|commencement\s+date)\s*(?:on|:)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  );

  addField(
    'lease_commencement_date',
    commencementMatch?.[1]?.trim(),
    commencementMatch ? 95 : 0
  );

  /*
   * Expiry / termination date.
   *
   * Example:
   * terminates on 31 August 2025
   */
  const expiryMatch = source.match(
    /(?:terminates?|termination|expires?|expiry)\s*(?:on|date|:)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  );

  addField(
    'lease_expiry_date',
    expiryMatch?.[1]?.trim(),
    expiryMatch ? 95 : 0
  );

  /*
   * Rental.
   *
   * Deliberately supports several common South African lease
   * formulations without assuming a specific legal wording.
   */
  const rentalMatch = source.match(
    /(?:monthly\s+rental|monthly\s+rent|basic\s+rental|rental\s+per\s+month|rent)\s*(?:is|of|:)?\s*R?\s*([\d,\s]+(?:\.\d{2})?)/i
  );

  const rentalValue = rentalMatch?.[1]
    ? rentalMatch[1].replace(/[,\s]/g, '')
    : undefined;

  addField(
    'rental_amount',
    rentalValue ? Number(rentalValue) : undefined,
    rentalValue ? 85 : 0
  );

  /*
   * Rental escalation.
   *
   * Examples:
   * 8% escalation
   * escalation of 8%
   * annual increase of 8%
   */
  const escalationMatch = source.match(
    /(?:escalation|annual\s+increase|annual\s+escalation)[^%]{0,80}?(\d+(?:\.\d+)?)\s*%/i
  );

  addField(
    'rental_escalation',
    escalationMatch?.[1]
      ? Number(escalationMatch[1])
      : undefined,
    escalationMatch ? 80 : 0
  );

  /*
   * Deposit.
   */
  const depositMatch = source.match(
    /(?:deposit|security\s+deposit)\s*(?:is|of|:)?\s*R?\s*([\d,\s]+(?:\.\d{2})?)/i
  );

  const depositValue = depositMatch?.[1]
    ? depositMatch[1].replace(/[,\s]/g, '')
    : undefined;

  addField(
    'deposit_amount',
    depositValue ? Number(depositValue) : undefined,
    depositValue ? 85 : 0
  );

  /*
   * Tenant registration number.
   */
  const registrationMatch = source.match(
    /(?:registration\s+number|company\s+registration)\s*:?\s*([A-Z0-9\/-]+)/i
  );

  addField(
    'tenant_registration_number',
    registrationMatch?.[1]?.trim(),
    registrationMatch ? 90 : 0
  );

  /*
   * Tenant VAT number.
   */
  const vatMatch = source.match(
    /VAT\s+Number\s*:?\s*([A-Z0-9\/-]+)/i
  );

  addField(
    'tenant_vat_number',
    vatMatch?.[1]?.trim(),
    vatMatch ? 90 : 0
  );

  /*
   * Tenant email.
   */
  const emailMatch = source.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );

  addField(
    'tenant_email',
    emailMatch?.[0]?.trim(),
    emailMatch ? 95 : 0
  );

  /*
   * Tenant telephone.
   */
  const phoneMatch = source.match(
    /(?:telephone|tel|phone|cell|mobile)\s*(?:number)?\s*:?\s*(\+?\d[\d\s()-]{7,}\d)/i
  );

  addField(
    'tenant_phone',
    phoneMatch?.[1]?.trim(),
    phoneMatch ? 90 : 0
  );

  /*
   * Identity number.
   */
  const identityMatch = source.match(
    /(?:Identity\s+Number|ID\s+Number)\s*:?\s*([0-9]{6,20})/i
  );

  addField(
    'tenant_identity_number',
    identityMatch?.[1]?.trim(),
    identityMatch ? 90 : 0
  );

  /*
   * Calculate confidence from fields that actually exist.
   *
   * We don't punish a lease because it doesn't contain an email,
   * telephone number, etc. Confidence reflects the quality of the
   * information AssetFlow actually managed to identify.
   */
  const detectedFields = Object.values(fields).filter(
    field =>
      field.value !== undefined &&
      field.value !== ''
  );

  const overallConfidence =
    detectedFields.length > 0
      ? Math.round(
          detectedFields.reduce(
            (sum, field) => sum + field.confidence,
            0
          ) / detectedFields.length
        )
      : 0;

  /*
   * A lease still requires human review even when extraction
   * confidence is high. Extraction is advisory and never constitutes
   * legal approval.
   */
  return {
    fields,
    missingFields: missing,
    overallConfidence,
    requiresHumanReview: true,
  };
}
