// lib/reporting/renderers/xlsx.ts
// Real XLSX renderer using SheetJS — multiple sheets, formatting, frozen headers

import * as XLSX from 'xlsx';
import type { ReportLayout } from '../layout/engine';

export function renderXLSX(layout: ReportLayout, filename: string): void {
  const wb = XLSX.utils.book_new();

  for (let i = 0; i < layout.sections.length; i++) {
    const section = layout.sections[i];
    const sheetName = section.title || `Sheet${i + 1}`;

    // Build sheet data: headers + rows + optional totals
    const sheetData: string[][] = [section.table.headers];
    for (const row of section.table.rows) sheetData.push(row);
    if (section.table.totals) sheetData.push(section.table.totals);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Column widths
    if (section.table.columnWidths) {
      ws['!cols'] = section.table.columnWidths.map(w => ({ wch: w }));
    }

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Max 31 chars
  }

  // Metadata sheet
  const metaData = [
    ['Report', layout.header.reportTitle],
    ['Company', layout.header.companyName],
    ['Period', layout.header.period || ''],
    ['Generated', new Date(layout.header.generatedAt).toLocaleString('en-ZA')],
    ['', ''],
    ['Powered by AssetFlow — Commercial Property Operating System', ''],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
