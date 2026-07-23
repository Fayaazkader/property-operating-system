// lib/reporting/renderers/pdf.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportLayout } from '../layout/engine';

export async function renderPDF(layout: ReportLayout): Promise<Blob> {
  const isLandscape = layout.orientation === 'landscape';
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;

  doc.setFontSize(14); doc.setTextColor(26, 26, 26);
  doc.text(layout.header.companyName, margin, y); y += 6;
  doc.setFontSize(11); doc.setTextColor(51, 51, 51);
  doc.text(layout.header.reportTitle, margin, y); y += 4;
  if (layout.header.period) { doc.setFontSize(8); doc.setTextColor(102, 102, 102); doc.text(`Period: ${layout.header.period}`, margin, y); y += 4; }
  doc.setFontSize(7); doc.setTextColor(136, 136, 136);
  doc.text(`Generated: ${new Date(layout.header.generatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - margin, margin + 4, { align: 'right' });
  y += 4;
  doc.setDrawColor(26, 26, 26); doc.setLineWidth(0.3); doc.line(margin, y, pageWidth - margin, y); y += 6;

  for (const section of layout.sections) {
    if (section.title) { doc.setFillColor(245, 245, 245); doc.rect(margin, y, pageWidth - margin * 2, 6, 'F'); doc.setFontSize(7); doc.setTextColor(85, 85, 85); doc.text(section.title, margin + 2, y + 4); y += 8; }
    if (section.table.rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [section.table.headers], body: section.table.rows,
        foot: section.table.totals ? [section.table.totals] : undefined,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
        headStyles: { fillColor: [245, 245, 245], textColor: [85, 85, 85], fontStyle: 'bold', fontSize: 6.5 },
        footStyles: { fillColor: [250, 250, 250], textColor: [26, 26, 26], fontStyle: 'bold', fontSize: 7 },
        didDrawPage: () => {
          const ph = doc.internal.pageSize.getHeight();
          doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.1);
          doc.line(margin, ph - 14, pageWidth - margin, ph - 14);
          doc.setFontSize(6); doc.setTextColor(170, 170, 170);
          doc.text(`${layout.footer.companyName} — ${layout.header.reportTitle}`, margin, ph - 10);
          doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, pageWidth - margin, ph - 10, { align: 'right' });
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }
  return doc.output('blob');
}
