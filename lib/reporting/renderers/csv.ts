// lib/reporting/renderers/csv.ts
export function exportToCSV(headers: string[], rows: string[][], filename: string): void {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(headers: string[], rows: string[][], filename: string): void {
  // For now, CSV with .xls extension opens in Excel
  exportToCSV(headers, rows, filename);
}
