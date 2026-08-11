// lib/revenue/invoice-pdf-generator.ts
// Generates professional invoice PDFs for email and WhatsApp delivery

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface InvoiceData {
  invoice_number: string;
  tenant_name: string;
  property_name: string;
  period: string;
  due_date: string;
  line_items: Array<{ description: string; amount: number }>;
  sub_total: number;
  vat_amount: number;
  total: number;
  entity_name: string;
  entity_address: string;
  bank_details: string;
  reference: string;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;

  page.drawText('TAX INVOICE', { x: 50, y, size: 20, font: boldFont, color: rgb(0, 0, 0) });
  y -= 30;

  page.drawText(data.entity_name, { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.entity_address, { x: 50, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;

  page.drawText(`Invoice Number: ${data.invoice_number}`, { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Date: ${new Date().toLocaleDateString('en-ZA')}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(`Period: ${data.period}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(`Due Date: ${data.due_date}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 25;

  page.drawText('Bill To:', { x: 50, y, size: 10, font: boldFont, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(data.tenant_name, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.property_name, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 25;

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  page.drawText('Description', { x: 50, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText('Amount', { x: width - 120, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 15;

  for (const item of data.line_items) {
    page.drawText(item.description, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
    page.drawText(`R${item.amount.toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
    y -= 15;
  }

  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText('Sub Total:', { x: width - 250, y, size: 9, font, color: rgb(0, 0, 0) });
  page.drawText(`R${data.sub_total.toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(`VAT (${Math.round(data.vat_amount / data.sub_total * 100)}%):`, { x: width - 250, y, size: 9, font, color: rgb(0, 0, 0) });
  page.drawText(`R${data.vat_amount.toLocaleString()}`, { x: width - 120, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawLine({ start: { x: width - 250, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText('TOTAL DUE:', { x: width - 250, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  page.drawText(`R${data.total.toLocaleString()}`, { x: width - 120, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  y -= 35;

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;
  page.drawText('Banking Details:', { x: 50, y, size: 9, font: boldFont, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(data.bank_details, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 15;
  page.drawText(`Reference: ${data.reference}`, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 30;

  page.drawText('Thank you for your prompt payment.', { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

  return pdfDoc.save();
}
