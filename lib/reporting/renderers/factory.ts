// lib/reporting/renderers/factory.ts
import type { ReportLayout } from '../layout/engine';
import { renderPDF } from './pdf';
import { renderXLSX } from './xlsx';

export type RendererFormat = 'pdf' | 'xlsx' | 'csv';

export interface RenderResult {
  blob: Blob;
  extension: string;
  mimeType: string;
  fileSize?: number;
  filenameSuggestion?: string;
}

export interface DocumentRenderer {
  readonly mimeType: string;
  readonly extension: string;
  render(layout: ReportLayout, signal?: AbortSignal): Promise<RenderResult>;
}

function csvRenderer(): DocumentRenderer {
  return {
    mimeType: 'text/csv', extension: 'csv',
    render: async (layout, signal) => {
      if (signal?.aborted) throw new Error('Export cancelled');
      const s = layout.sections[0];
      if (!s) return { blob: new Blob(), extension: 'csv', mimeType: 'text/csv' };
      const rows = s.table.totals ? [...s.table.rows, s.table.totals] : s.table.rows;
      const csv = [s.table.headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
      if (signal?.aborted) throw new Error('Export cancelled');
      const blob = new Blob([csv], { type: 'text/csv' });
      return { blob, extension: 'csv', mimeType: 'text/csv', fileSize: blob.size };
    }
  };
}

const rendererMap: Record<RendererFormat, DocumentRenderer> = {
  csv: csvRenderer(),
  xlsx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx',
    render: async (layout, signal) => {
      if (signal?.aborted) throw new Error('Export cancelled');
      const blob = await renderXLSX(layout);
      return { blob, extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: blob.size };
    }
  },
  pdf: {
    mimeType: 'application/pdf', extension: 'pdf',
    render: async (layout, signal) => {
      if (signal?.aborted) throw new Error('Export cancelled');
      const blob = await renderPDF(layout);
      return { blob, extension: 'pdf', mimeType: 'application/pdf', fileSize: blob.size };
    }
  },
};

export function getRenderer(format: RendererFormat): DocumentRenderer | undefined {
  return rendererMap[format];
}
