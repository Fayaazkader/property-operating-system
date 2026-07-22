// lib/reporting/execution-service.ts
import { getReport } from './registry';
import { getProvider } from './providers/factory';
import { buildReportLayout } from './layout/engine';
import { exportToCSV } from './renderers/csv';
import { supabase } from '@/lib/supabase';
import type { ReportScope } from './types';
import type { ReportFormat } from './registry';

export interface ExecutionParams {
  reportId: string;
  scope: ReportScope;
  format: ReportFormat;
  companyName?: string;
  companyLogo?: string;
  userId?: string;
}

export async function executeReport(params: ExecutionParams): Promise<void> {
  const report = getReport(params.reportId);
  if (!report) throw new Error(`Unknown report: ${params.reportId}`);

  const provider = getProvider(params.reportId);
  if (!provider) throw new Error(`No provider for: ${params.reportId}`);

  const data = await provider(params.scope);
  const layout = buildReportLayout({
    companyName: params.companyName || 'Company',
    companyLogo: params.companyLogo,
    reportTitle: report.title,
    orientation: report.orientation,
    period: params.scope.fromDate,
    sections: [{ headers: data.headers, rows: data.rows, totals: data.totals }],
  });

  const filename = `${report.defaultFilename}-${new Date().toISOString().split('T')[0]}`;
  if (params.format === 'csv' || params.format === 'excel') {
    const allRows = data.totals ? [...data.rows, data.totals] : data.rows;
    exportToCSV(data.headers, allRows, filename);
  } else if (params.format === 'pdf') {
    window.print();
  }

  // Audit log
  await supabase.from('report_audit_log').insert({
    user_id: params.userId,
    report_id: params.reportId,
    report_title: report.title,
    scope: params.scope,
    format: params.format,
    generated_at: new Date().toISOString(),
  });
}
