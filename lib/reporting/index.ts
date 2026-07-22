export { reportRegistry, getReport, getReportsByCategory, reportCategories } from './registry';
export type { ReportDefinition, ReportCategory, ReportFormat, ReportOrientation } from './registry';
export { getProvider } from './providers/factory';
export { buildReportLayout } from './layout/engine';
export { exportToCSV } from './renderers/csv';
export { executeReport } from './execution-service';
export type { ReportScope, ReportData } from './types';
