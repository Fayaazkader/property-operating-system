// lib/reporting/execution-service.ts
// Report Execution Service — Orchestrates: validate → provider → layout → render → audit

import { getReport } from './registry';
import { getProvider } from './providers/factory';
import { buildReportLayout } from './layout/engine';
import { exportToCSV } from './renderers/csv';
import type { ReportFormat } from './registry';

export interface ExecutionParams {
  reportId: string;
  entityId: string;
  periodId?: string;
  format: ReportFormat;
  companyName?: string;
  companyLogo?: string;
  filters?: string[];
}

export async function executeReport(params: ExecutionParams): Promise<void> {
  const report = getReport(params.reportId);
  if (!report) throw new Error(`Unknown report: ${params.reportId}`);

  const provider = getProvider(params.reportId);
  if (!provider) throw new Error(`No provider for: ${params.reportId}`);

  const data = await provider(params.entityId, params.periodId);

  const layout = buildReportLayout({
    companyName: params.companyName || 'Company',
    companyLogo: params.companyLogo,
    reportTitle: report.title,
    orientation: report.orientation,
    period: params.periodId,
    filters: params.filters,
    sections: [{ headers: data.headers, rows: data.rows, totals: data.totals }],
  });

  const filename = `${report.title}-${new Date().toISOString().split('T')[0]}`;
  if (params.format === 'csv' || params.format === 'excel') {
    const allRows = data.totals ? [...data.rows, data.totals] : data.rows;
    exportToCSV(data.headers, allRows, filename);
  } else if (params.format === 'pdf') {
    window.print();
  }

  // Audit log (placeholder)
  console.log('Report executed', { reportId: params.reportId, entityId: params.entityId, format: params.format, at: new Date().toISOString() });
}
