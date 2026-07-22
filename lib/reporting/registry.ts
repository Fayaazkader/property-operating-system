// lib/reporting/registry.ts

export type ReportCategory = 'financial' | 'operational' | 'tenant' | 'supplier' | 'maintenance' | 'executive';
export type ReportFormat = 'pdf' | 'excel' | 'csv';
export type ReportOrientation = 'portrait' | 'landscape';
export type PaperSize = 'A4' | 'Letter';

export interface ReportDefinition {
  id: string;
  title: string;
  category: ReportCategory;
  orientation: ReportOrientation;
  paperSize: PaperSize;
  formats: ReportFormat[];
  permission: string;
  description?: string;
  defaultFilename: string;
  defaultGrouping?: string;
  defaultSort?: string;
  supportsScheduling: boolean;
  supportsEmail: boolean;
  supportsMergedPack: boolean;
  supportsDrillDown: boolean;
}

export const reportRegistry: ReportDefinition[] = [
  { id: 'trial-balance', title: 'Trial Balance', category: 'financial', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Trial-Balance', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
  { id: 'income-statement', title: 'Income Statement', category: 'financial', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Income-Statement', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
  { id: 'balance-sheet', title: 'Balance Sheet', category: 'financial', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Balance-Sheet', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
  { id: 'cash-flow', title: 'Cash Flow Statement', category: 'financial', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Cash-Flow', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
  { id: 'general-ledger', title: 'General Ledger', category: 'financial', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'General-Ledger', supportsScheduling: false, supportsEmail: true, supportsMergedPack: false, supportsDrillDown: true },
  { id: 'journal-report', title: 'Journal Report', category: 'financial', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Journal-Report', supportsScheduling: false, supportsEmail: false, supportsMergedPack: false, supportsDrillDown: true },
  { id: 'vat-report', title: 'VAT Report', category: 'financial', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'VAT-Report', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'budget-vs-actual', title: 'Budget vs Actual', category: 'financial', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Budget-vs-Actual', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
  { id: 'rent-roll', title: 'Rent Roll', category: 'operational', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Rent-Roll', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'lease-expiry', title: 'Lease Expiry Schedule', category: 'operational', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Lease-Expiry', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'vacancy-report', title: 'Vacancy Report', category: 'operational', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Vacancy-Report', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'recovery-analysis', title: 'Recovery Analysis', category: 'operational', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Recovery-Analysis', supportsScheduling: true, supportsEmail: true, supportsMergedPack: false, supportsDrillDown: false },
  { id: 'tenant-ledger', title: 'Tenant Ledger', category: 'tenant', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Tenant-Ledger', supportsScheduling: false, supportsEmail: true, supportsMergedPack: false, supportsDrillDown: true },
  { id: 'tenant-statement', title: 'Tenant Statement', category: 'tenant', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Tenant-Statement', supportsScheduling: true, supportsEmail: true, supportsMergedPack: false, supportsDrillDown: false },
  { id: 'aged-debtors', title: 'Aged Debtors', category: 'tenant', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Aged-Debtors', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'deposit-register', title: 'Deposit Register', category: 'tenant', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Deposit-Register', supportsScheduling: false, supportsEmail: true, supportsMergedPack: false, supportsDrillDown: false },
  { id: 'tenancy-schedule', title: 'Tenancy Schedule', category: 'tenant', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Tenancy-Schedule', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'supplier-ledger', title: 'Supplier Ledger', category: 'supplier', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Supplier-Ledger', supportsScheduling: false, supportsEmail: true, supportsMergedPack: false, supportsDrillDown: true },
  { id: 'aged-creditors', title: 'Aged Creditors', category: 'supplier', orientation: 'landscape', paperSize: 'A4', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', defaultFilename: 'Aged-Creditors', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: false },
  { id: 'portfolio-summary', title: 'Portfolio Summary', category: 'executive', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel'], permission: 'reports.view', defaultFilename: 'Portfolio-Summary', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
  { id: 'noi-report', title: 'NOI Report', category: 'executive', orientation: 'portrait', paperSize: 'A4', formats: ['pdf', 'excel'], permission: 'reports.view', defaultFilename: 'NOI-Report', supportsScheduling: true, supportsEmail: true, supportsMergedPack: true, supportsDrillDown: true },
];

export function getReport(id: string): ReportDefinition | undefined { return reportRegistry.find(r => r.id === id); }
export function getReportsByCategory(category: ReportCategory): ReportDefinition[] { return reportRegistry.filter(r => r.category === category); }
export const reportCategories: { key: ReportCategory; label: string }[] = [
  { key: 'financial', label: 'Financial' }, { key: 'operational', label: 'Operational' }, { key: 'tenant', label: 'Tenant' }, { key: 'supplier', label: 'Supplier' }, { key: 'executive', label: 'Executive' },
];
