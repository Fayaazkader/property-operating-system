import type { ReportLayout } from '../layout/engine';
import { renderPDF } from './pdf';
import { downloadBlob } from './download';
export type RendererFormat = 'pdf' | 'xlsx' | 'csv';
export interface Renderer { render(layout: ReportLayout, filename: string): Promise<Blob>; }
const rendererMap: Record<RendererFormat, Renderer> = {
  csv: { render: async (layout, filename) => { const s = layout.sections[0]; if (!s) return new Blob(); const rows = s.table.totals ? [...s.table.rows, s.table.totals] : s.table.rows; const csv = [s.table.headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); downloadBlob(blob, `${filename}.csv`); return blob; } },
  xlsx: { render: async (layout, filename) => { const s = layout.sections[0]; if (!s) return new Blob(); const rows = s.table.totals ? [...s.table.rows, s.table.totals] : s.table.rows; const tsv = [s.table.headers.join('\t'), ...rows.map(r => r.map(c => `"${c}"`).join('\t'))].join('\n'); const blob = new Blob([tsv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); downloadBlob(blob, `${filename}.xls`); return blob; } },
  pdf: { render: async (layout, filename) => { const blob = await renderPDF(layout, filename); downloadBlob(blob, `${filename}.pdf`); return blob; } },
};
export function getRenderer(format: RendererFormat): Renderer | undefined { return rendererMap[format]; }
