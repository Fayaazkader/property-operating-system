// lib/document-intelligence/field-extractor.ts
// Adaptive field extraction

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
