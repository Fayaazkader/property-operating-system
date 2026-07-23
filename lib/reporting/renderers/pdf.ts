// lib/reporting/renderers/pdf.ts
// PDF Renderer — Generates A4 PDFs via browser print with exact sizing
// Replace with jsPDF/Puppeteer for server-side when needed

import type { ReportLayout } from '../layout/engine';

export function renderPDF(layout: ReportLayout, filename: string): void {
  const isLandscape = layout.orientation === 'landscape';
  const pageSize = isLandscape ? 'A4 landscape' : 'A4 portrait';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${layout.header.reportTitle}</title>
<style>
  @page { size: ${pageSize}; margin: 12mm 10mm 15mm 10mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Inter, -apple-system, sans-serif; font-size: 8.5pt; color: #1a1a1a; line-height: 1.4; }
  .header { margin-bottom: 5mm; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 3mm; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left .company { font-size: 11pt; font-weight: 700; }
  .header-left .title { font-size: 10pt; font-weight: 600; color: #333; margin-top: 1mm; }
  .header-left .period { font-size: 7pt; color: #666; margin-top: 0.5mm; }
  .header-right { text-align: right; font-size: 7pt; color: #888; }
  .section-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #555; background: #f5f5f5; padding: 2mm 3mm; margin: 4mm 0 2mm 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #f5f5f5; font-size: 7pt; font-weight: 600; text-transform: uppercase; color: #555; padding: 2mm 2mm; text-align: left; border-bottom: 1px solid #ccc; position: sticky; top: 0; }
  td { padding: 1.5mm 2mm; font-size: 7.5pt; border-bottom: 0.3px solid #eee; }
  .totals-row td { font-weight: 700; border-top: 1px solid #1a1a1a; background: #fafafa; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 6pt; color: #aaa; padding: 2mm 10mm; border-top: 0.3px solid #eee; }
  .footer .powered { font-size: 5.5pt; color: #ccc; margin-top: 0.5mm; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="company">${layout.header.companyName}</div>
      <div class="title">${layout.header.reportTitle}</div>
      ${layout.header.period ? `<div class="period">Period: ${layout.header.period}</div>` : ''}
    </div>
    <div class="header-right">
      <div>${new Date(layout.header.generatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div>${new Date(layout.header.generatedAt).toLocaleTimeString('en-ZA')}</div>
    </div>
  </div>
  ${layout.sections.map(s => `
    ${s.title ? `<div class="section-title">${s.title}</div>` : ''}
    <table>
      <thead><tr>${s.table.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${s.table.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}${s.table.totals ? `<tr class="totals-row">${s.table.totals.map(c => `<td>${c}</td>`).join('')}</tr>` : ''}</tbody>
    </table>
  `).join('')}
  <div class="footer">
    <div>${layout.footer.companyName} — ${layout.header.reportTitle}</div>
    <div>Generated ${new Date(layout.footer.generatedAt).toLocaleString('en-ZA')}</div>
    <div class="powered">${layout.poweredBy || 'Powered by AssetFlow — Commercial Property Operating System'}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
      URL.revokeObjectURL(url);
    };
  }
}
