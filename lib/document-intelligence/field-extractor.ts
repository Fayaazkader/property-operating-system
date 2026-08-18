// lib/document-intelligence/field-extractor.ts
// Adaptive field extraction — learns from invoice structure

export interface ExtractedField {
  value: string | number | Array<any> | undefined;
  confidence: number;
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

function extractLineItems(text: string): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const pattern = /([A-Za-z][A-Za-z\s&\/-]+?)\s+(\d+(?:\.\d+)?)\s+R\s*([\d,]+\.?\d*)\s+R\s*([\d,]+\.?\d*)/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const description = match[1].trim();
    if (description.length < 3) continue;
    if (/invoice|total|subtotal|vat|due|date|number|reference/i.test(description)) continue;
    
    items.push({
      description,
      qty: parseFloat(match[2]),
      unit_price: parseFloat(match[3].replace(/,/g, '')),
      amount: parseFloat(match[4].replace(/,/g, '')),
    });
  }
  
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.description.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractInvoiceFields(text: string): ExtractionResult {
  const fields: Record<string, ExtractedField> = {};
  const missing: string[] = [];

  const invoiceNumber = extractWithConfidence(text, /Invoice\s*(?:No|Number|#)?\.?\s*(INV-[A-Z0-9-]+)/i, 'invoice_number');
  fields.invoice_number = invoiceNumber;
  if (!invoiceNumber.value) missing.push('invoice_number');

  const totalAmount = extractWithConfidence(text, /TOTAL\s*DUE\s*R?\s*([\d,\s]+\.\d{2})/i, 'invoice_amount');
  fields.invoice_amount = totalAmount.value ? { value: parseAmount(totalAmount.value as string), confidence: 90 } : { value: undefined, confidence: 0 };

  const vatAmount = extractWithConfidence(text, /VAT\s*(?:\(\d+%\))?\s*R?\s*([\d,\s]+\.\d{2})/i, 'vat_amount');
  fields.vat_amount = vatAmount.value ? { value: parseAmount(vatAmount.value as string), confidence: 80 } : { value: undefined, confidence: 0 };

  const subtotal = extractWithConfidence(text, /Subtotal\s*R?\s*([\d,\s]+\.\d{2})/i, 'subtotal');
  fields.subtotal = subtotal.value ? { value: parseAmount(subtotal.value as string), confidence: 80 } : { value: undefined, confidence: 0 };

  const dueDate = extractWithConfidence(text, /Due\s*Date\s*(\d{1,2}\s+\w+\s+\d{4})/i, 'due_date');
  fields.due_date = dueDate.value ? { value: dueDate.value, confidence: 85 } : { value: undefined, confidence: 0 };

  const invoiceDate = extractWithConfidence(text, /Invoice\s*Date\s*(\d{1,2}\s+\w+\s+\d{4})/i, 'invoice_date');
  fields.invoice_date = invoiceDate.value ? { value: invoiceDate.value, confidence: 85 } : { value: undefined, confidence: 0 };

  const supplierMatch = text.match(/([A-Z][A-Za-z\s]+(?:\s+\(Pty\)\s+Ltd|\s+CC|\s+Ltd))/i);
  if (supplierMatch) {
    fields.supplier_name = { value: supplierMatch[1].trim(), confidence: 90 };
  } else {
    const supplier = extractWithConfidence(text, /(?:BILL\s+FROM|FROM)\s+(.+?)(?=\s+\d+\s+[A-Za-z]+\s+Road|\s+VAT|\s+BILL\s)/i, 'supplier_name');
    fields.supplier_name = supplier;
    if (!supplier.value) missing.push('supplier_name');
  }

  const lineItems = extractLineItems(text);
  fields.line_items = { value: lineItems, confidence: lineItems.length > 0 ? 85 : 0 };
  if (lineItems.length === 0) missing.push('line_items');

  const confidences = Object.values(fields).map(f => f.confidence);
  const overallConfidence = confidences.length > 0 ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;

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

  const tenantName = extractWithConfidence(text, /(?:TENANT|LESSEE|APPLICANT)[:\s]*([^\n]+?)(?=\s+(?:ID|REG|VAT|PHYSICAL|POSTAL|$))/i, 'tenant_name');
  fields.tenant_name = tenantName;
  if (!tenantName.value) missing.push('tenant_name');

  const confidences = Object.values(fields).map(f => f.confidence);
  const overallConfidence = confidences.length > 0 ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;

  return {
    fields,
    missingFields: missing,
    overallConfidence: Math.round(overallConfidence),
    requiresHumanReview: missing.length > 0 || overallConfidence < 60,
  };
}
