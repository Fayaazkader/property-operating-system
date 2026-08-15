// lib/document-intelligence/field-extractor.ts
// Deterministic field extraction with per-field confidence

export interface ExtractedField {
  value: string | number | undefined;
  confidence: number;
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

export function extractInvoiceFields(text: string): ExtractionResult {
  const fields: Record<string, ExtractedField> = {};
  const missing: string[] = [];

  // Invoice number
  const invoiceNumber = extractWithConfidence(
    text,
    /invoice\s*(?:no|number|#)?[:\s]*([A-Z0-9-]+)/i,
    'invoice_number'
  );
  fields.invoice_number = invoiceNumber;
  if (!invoiceNumber.value) missing.push('invoice_number');

  // Amount
  const amount = extractWithConfidence(
    text,
    /(?:total|amount|balance)[:\s]*R?\s*([\d,]+\.?\d*)/i,
    'invoice_amount'
  );
  fields.invoice_amount = amount;
  if (!amount.value) missing.push('invoice_amount');

  // Supplier
  const supplier = extractWithConfidence(
    text,
    /(?:from|supplier|vendor)[:\s]*([^\n]+)/i,
    'supplier_name'
  );
  fields.supplier_name = supplier;
  if (!supplier.value) missing.push('supplier_name');

  // Due date
  const dueDate = extractWithConfidence(
    text,
    /(?:due|payment\s*due)[:\s]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i,
    'due_date'
  );
  fields.due_date = dueDate;

  // VAT
  const vat = extractWithConfidence(
    text,
    /(?:vat|tax)[:\s]*R?\s*([\d,]+\.?\d*)/i,
    'vat_amount'
  );
  fields.vat_amount = vat;

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

export function extractLeaseFields(text: string): ExtractionResult {
  const fields: Record<string, ExtractedField> = {};
  const missing: string[] = [];

  const tenantName = extractWithConfidence(
    text,
    /(?:tenant|lessee|applicant)[:\s]*([^\n]+)/i,
    'tenant_name'
  );
  fields.tenant_name = tenantName;
  if (!tenantName.value) missing.push('tenant_name');

  const rentalAmount = extractWithConfidence(
    text,
    /(?:monthly\s*rental|rental\s*amount|rent)[:\s]*R?\s*([\d,]+\.?\d*)/i,
    'rental_amount'
  );
  fields.rental_amount = rentalAmount;
  if (!rentalAmount.value) missing.push('rental_amount');

  const startDate = extractWithConfidence(
    text,
    /(?:start|commencement)[\s:]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i,
    'lease_start_date'
  );
  fields.lease_start_date = startDate;

  const endDate = extractWithConfidence(
    text,
    /(?:end|expiry)[\s:]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i,
    'lease_end_date'
  );
  fields.lease_end_date = endDate;

  if (!startDate.value || !endDate.value) missing.push('lease_dates');

  const deposit = extractWithConfidence(
    text,
    /(?:deposit)[:\s]*R?\s*([\d,]+\.?\d*)/i,
    'deposit_amount'
  );
  fields.deposit_amount = deposit;

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
