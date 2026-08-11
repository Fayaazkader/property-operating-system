// lib/revenue/services/invoice-pdf.service.ts
// Renders invoice PDF from database invoice record

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface InvoicePDFData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  tenant_name: string;
  property_name: string;
  entity_name: string;
  entity_address: string;
  bank_details: string;
  line_items: Array<{ description: string; amount: number; vat_rate?: number }>;
  sub_total: number;
  vat_amount: number;
  total: number;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  let y = height - 50;

  // Header
  page.drawText('TAX INVOICE', { x: 50, y, size: 20, font: boldFont, color: rgb(0, 0, 0) });
  y -= 30;
  page.drawText(data.entity_name, { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.entity_address, { x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;

  // Invoice meta
  page.drawText(`Invoice: ${data.invoice_number}`, { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Date: ${data.invoice_date}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(`Due: ${data.due_date}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 25;

  // Bill To
  page.drawText('Bill To:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(data.tenant_name, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.property_name, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;

  // Divider
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // Table header
  page.drawText('Description', { x: 50, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText('Amount', { x: width - 120, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 15;

  // Line items
  for (const item of data.line_items) {
    page.drawText(item.description, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(`R${item.amount.toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
    y -= 15;
  }

  // Subtotals
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  
  page.drawText('Sub Total:', { x: width - 250, y, size: 9, font, color: rgb(0, 0, 0) });
  page.drawText(`R${data.sub_total.toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  
  page.drawText('VAT (15%):', { x: width - 250, y, size: 9, font, color: rgb(0, 0, 0) });
  page.drawText(`R${data.vat_amount.toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 18;
  
  page.drawLine({ start: { x: width - 250, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  
  page.drawText('TOTAL DUE:', { x: width - 250, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(`R${data.total.toLocaleString()}`, { x: width - 120, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 35;

  // Bank details
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;
  page.drawText('Banking Details:', { x: 50, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.bank_details, { x: 50, y, size: 9, font: monoFont, color: rgb(0, 0, 0) });

  return pdfDoc.save();
}
