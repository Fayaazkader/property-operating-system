// lib/reporting/renderers/factory.ts
import type { ReportLayout } from '../layout/engine';
import { renderPDF } from './pdf';
import { renderXLSX } from './xlsx';

export type RendererFormat = 'pdf' | 'xlsx' | 'csv';

export interface RenderResult {
  blob: Blob;
  extension: string;
  mimeType: string;
}

export interface DocumentRenderer {
  render(layout: ReportLayout): Promise<RenderResult>;
}

function csvRenderer(): DocumentRenderer {
  return {
    render: async (layout) => {
      const s = layout.sections[0];
      if (!s) return { blob: new Blob(), extension: 'csv', mimeType: 'text/csv' };
      const rows = s.table.totals ? [...s.table.rows, s.table.totals] : s.table.rows;
      const csv = [s.table.headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      return { blob: new Blob([csv], { type: 'text/csv' }), extension: 'csv', mimeType: 'text/csv' };
    }
  };
}

const rendererMap: Record<RendererFormat, DocumentRenderer> = {
  csv: csvRenderer(),
  xlsx: {
    render: async (layout) => {
      const blob = await renderXLSX(layout);
      return { blob, extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
  },
  pdf: {
    render: async (layout) => {
      const blob = await renderPDF(layout);
      return { blob, extension: 'pdf', mimeType: 'application/pdf' };
    }
  },
};

export function getRenderer(format: RendererFormat): DocumentRenderer | undefined {
  return rendererMap[format];
}
