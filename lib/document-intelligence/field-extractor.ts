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

function parseAmount(val: string): string {
  return val.replace(/[^\d.]/g, '');
}

export function extractInvoiceFields(text: string): ExtractionResult {
  const fields: Record<string, ExtractedField> = {};
  const missing: string[] = [];

  // Invoice number — "Invoice No. INV-2026-00847"
  const invoiceNumber = extractWithConfidence(
    text,
    /Invoice\s*(?:No|Number|#)?\.?\s*(INV-[A-Z0-9-]+)/i,
    'invoice_number'
  );
  if (!invoiceNumber.value) {
    const fallback = extractWithConfidence(text, /(INV-[A-Z0-9-]+)/i, 'invoice_number');
    fields.invoice_number = fallback;
    if (!fallback.value) missing.push('invoice_number');
  } else {
    fields.invoice_number = invoiceNumber;
  }

  // Account number — "Account Number 62814590321" or "Acc No: 123456"
const accountNumber = extractWithConfidence(
  text,
  /Account\s*(?:Number|No|#)?[:\s]*([A-Z0-9-]{6,20})/i,
  'account_number'
);
fields.account_number = accountNumber;

  // Total amount — "TOTAL DUE R 30,705.00" (after VAT line)
  const totalAmount = extractWithConfidence(
    text,
    /TOTAL\s*DUE\s*R?\s*([\d,\s]+\.\d{2})/i,
    'invoice_amount'
  );
  if (!totalAmount.value) {
    const fallback = extractWithConfidence(text, /(?:Balance|Amount\s*Due|Total)\s*R?\s*([\d,\s]+\.\d{2})/i, 'invoice_amount');
    fields.invoice_amount = fallback.value ? { value: parseAmount(fallback.value as string), confidence: 70 } : { value: undefined, confidence: 0 };
    if (!fallback.value) missing.push('invoice_amount');
  } else {
    fields.invoice_amount = { value: parseAmount(totalAmount.value as string), confidence: 90 };
  }

  // VAT — "VAT (15%) R 4,005.00"
  const vatAmount = extractWithConfidence(
    text,
    /VAT\s*(?:\(\d+%\))?\s*R?\s*([\d,\s]+\.\d{2})/i,
    'vat_amount'
  );
  fields.vat_amount = vatAmount.value ? { value: parseAmount(vatAmount.value as string), confidence: 80 } : { value: undefined, confidence: 0 };

  // Subtotal — "Subtotal R 26,700.00"
  const subtotal = extractWithConfidence(
    text,
    /Subtotal\s*R?\s*([\d,\s]+\.\d{2})/i,
    'subtotal'
  );
  fields.subtotal = subtotal.value ? { value: parseAmount(subtotal.value as string), confidence: 80 } : { value: undefined, confidence: 0 };

  // Supplier VAT
const supplierVat = extractWithConfidence(text, /Supplier\s*VAT\s*(\d+)/i, 'supplier_vat');
fields.supplier_vat = supplierVat;

// Registration number
const regNumber = extractWithConfidence(text, /Registration\s*([\d/]+)/i, 'registration_number');
fields.registration_number = regNumber;

  // Due date — "Due Date 14 September 2026"
  const dueDate = extractWithConfidence(
    text,
    /Due\s*Date\s*(\d{1,2}\s+\w+\s+\d{4})/i,
    'due_date'
  );
  fields.due_date = dueDate.value ? { value: dueDate.value, confidence: 85 } : { value: undefined, confidence: 0 };

  // Invoice date — "Invoice Date 15 August 2026"
  const invoiceDate = extractWithConfidence(
    text,
    /Invoice\s*Date\s*(\d{1,2}\s+\w+\s+\d{4})/i,
    'invoice_date'
  );
  fields.invoice_date = invoiceDate.value ? { value: invoiceDate.value, confidence: 85 } : { value: undefined, confidence: 0 };

      // Supplier name — after BILL FROM or FROM, until address or contact details
  const supplier = extractWithConfidence(
    text,
    /(?:BILL\s+FROM|FROM)\s+(.+?)(?=\s+\d+\s+[A-Za-z]+(?:\s+(?:Road|Street|Ave|Avenue|Close|Drive|Lane|Crescent))|\s+VAT|\s+Reg\s|\s+accounts|\s+@|\s+PO\s|\s+BILL\s)/i,
    'supplier_name'
  );
  if (!supplier.value) {
    const fallback = extractWithConfidence(text, /FROM\s+(.+?)(?=\s+VAT|\s+BILL|\s+INVOICE)/i, 'supplier_name');
    fields.supplier_name = fallback;
    if (!fallback.value) missing.push('supplier_name');
  } else {
    fields.supplier_name = supplier;

  // Account number — "Account Number 62814590321" or "Acc No: 123456"
  const accountNumber = extractWithConfidence(
    text,
    /Account\s*(?:Number|No|#)?[:\s]*([A-Z0-9-]{6,20})/i,
    'account_number'
  );
  fields.account_number = accountNumber;

  // Supplier VAT — "Supplier VAT 4120345678"
  const supplierVat = extractWithConfidence(
    text,
    /Supplier\s*VAT\s*([0-9]+)/i,
    'supplier_vat'
  );
  fields.supplier_vat = supplierVat;

  // Registration number — "Registration 2019/456789/07"
  const regNumber = extractWithConfidence(
    text,
    /Registration\s*([0-9]{4}\/[0-9]{6}\/[0-9]{2})/i,
    'registration_number'
  );
  fields.registration_number = regNumber;
  }

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
    /(?:TENANT|LESSEE|APPLICANT)[:\s]*([^\n]+?)(?=\s+(?:ID|REG|VAT|PHYSICAL|POSTAL|$))/i,
    'tenant_name'
  );
  fields.tenant_name = tenantName;
  if (!tenantName.value) missing.push('tenant_name');

  const rentalAmount = extractWithConfidence(
    text,
    /(?:MONTHLY\s*RENTAL|RENTAL|RENT)[:\s]*R?\s*([\d,\s]+\.\d{2})/i,
    'rental_amount'
  );
  fields.rental_amount = rentalAmount;
  if (!rentalAmount.value) missing.push('rental_amount');

  const startDate = extractWithConfidence(
    text,
    /(?:START|COMMENCEMENT)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
    'lease_start_date'
  );
  fields.lease_start_date = startDate;

  const endDate = extractWithConfidence(
    text,
    /(?:END|EXPIRY)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i,
    'lease_end_date'
  );
  fields.lease_end_date = endDate;

  if (!startDate.value || !endDate.value) missing.push('lease_dates');

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
