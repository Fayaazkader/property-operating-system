// lib/reporting/renderers/factory.ts
// Renderer Factory — All renderers consume ReportLayout, are interchangeable

import type { ReportLayout } from '../layout/engine';
import { exportToCSV } from './csv';
import { renderXLSX } from './xlsx';
import { renderPDF } from './pdf';

export type RendererFormat = 'pdf' | 'xlsx' | 'csv';

export interface Renderer {
  render(layout: ReportLayout, filename: string): void;
}

const rendererMap: Record<RendererFormat, Renderer> = {
  csv: {
    render: (layout, filename) => {
      const section = layout.sections[0];
      if (!section) return;
      const allRows = section.table.totals ? [...section.table.rows, section.table.totals] : section.table.rows;
      exportToCSV(section.table.headers, allRows, filename);
    },
  },
  xlsx: {
    render: (layout, filename) => renderXLSX(layout, filename),
  },
  pdf: {
    render: (layout, filename) => renderPDF(layout, filename),
  },
};

export function getRenderer(format: RendererFormat): Renderer | undefined {
  return rendererMap[format];
}
