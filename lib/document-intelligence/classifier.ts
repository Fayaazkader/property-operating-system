// lib/document-intelligence/classifier.ts
// Document classification using filename + OCR text

export type DocumentType =
  | 'lease_application'
  | 'signed_lease'
  | 'invoice'
  | 'purchase_order'
  | 'bank_statement'
  | 'meter_reading'
  | 'inspection_report'
  | 'maintenance_photo'
  | 'quote'
  | 'id_document'
  | 'unknown';

export function classifyDocument(
  fileName: string,
  mimeType: string,
  ocrText: string = ''
): DocumentType {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase();
  const text = ocrText.toLowerCase();

  // Invoice — strong signals
  if (text.includes('tax invoice') || text.includes('invoice number')) return 'invoice';
  if (name.includes('invoice') || name.includes('bill')) return 'invoice';

  // Lease
  if (text.includes('lease agreement') || text.includes('lessor') || text.includes('lessee')) {
    if (text.includes('signed') || text.includes('executed')) return 'signed_lease';
    return 'lease_application';
  }
  if (name.includes('lease') && name.includes('application')) return 'lease_application';
  if (name.includes('lease') && (name.includes('signed') || name.includes('executed'))) return 'signed_lease';

  // Purchase Order
  if (text.includes('purchase order') || name.includes('purchase') || name.includes(' po ')) return 'purchase_order';

  // Bank statement
  if (text.includes('bank statement') || text.includes('statement period')) return 'bank_statement';
  if (name.includes('bank') || name.includes('statement')) return 'bank_statement';

  // Meter reading
  if (text.includes('meter reading') || text.includes('consumption')) return 'meter_reading';
  if (name.includes('meter') || name.includes('reading')) return 'meter_reading';

  // Inspection
  if (text.includes('inspection report') || name.includes('inspection')) return 'inspection_report';

  // Quote
  if (text.includes('quotation') || text.includes('quote')) return 'quote';
  if (name.includes('quote') || name.includes('estimate')) return 'quote';

  // ID document
  if (text.includes('passport') || text.includes('identity')) return 'id_document';
  if (name.includes('id') || name.includes('passport')) return 'id_document';

  // Maintenance photo
  if (type.includes('image') && (name.includes('photo') || name.includes('img'))) return 'maintenance_photo';

  return 'unknown';
}
