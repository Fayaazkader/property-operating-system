import * as XLSX from 'xlsx';
import type { ReportLayout } from '../layout/engine';

export async function renderXLSX(layout: ReportLayout): Promise<Blob> {
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < layout.sections.length; i++) {
    const section = layout.sections[i];
    const sheetName = (section.title || `Sheet${i + 1}`).substring(0, 31);
    const sheetData: string[][] = [section.table.headers];
    for (const row of section.table.rows) sheetData.push(row);
    if (section.table.totals) sheetData.push(section.table.totals);
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  const metaData = [['Report', layout.header.reportTitle], ['Company', layout.header.companyName], ['Generated', new Date(layout.header.generatedAt).toLocaleString('en-ZA')]];
  const metaWs = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
