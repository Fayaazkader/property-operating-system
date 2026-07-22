// lib/reporting/registry.ts
// Report Registry — Metadata only. Provider resolution via factory.

export type ReportCategory = 'financial' | 'operational' | 'tenant' | 'supplier' | 'maintenance' | 'executive';
export type ReportFormat = 'pdf' | 'excel' | 'csv';
export type ReportOrientation = 'portrait' | 'landscape';

export interface ReportDefinition {
  id: string;
  title: string;
  category: ReportCategory;
  orientation: ReportOrientation;
  formats: ReportFormat[];
  permission: string;
  description?: string;
  defaultSort?: string;
  defaultGrouping?: string;
}

export const reportRegistry: ReportDefinition[] = [
  { id: 'trial-balance', title: 'Trial Balance', category: 'financial', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'All GL accounts with debit/credit balances' },
  { id: 'income-statement', title: 'Income Statement', category: 'financial', orientation: 'portrait', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Revenue, expenses, and net income' },
  { id: 'balance-sheet', title: 'Balance Sheet', category: 'financial', orientation: 'portrait', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Assets, liabilities, and equity' },
  { id: 'cash-flow', title: 'Cash Flow Statement', category: 'financial', orientation: 'portrait', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Operating, investing, and financing cash flows' },
  { id: 'general-ledger', title: 'General Ledger', category: 'financial', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'All journal entries for a period' },
  { id: 'journal-report', title: 'Journal Report', category: 'financial', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Journals with debit/credit totals' },
  { id: 'vat-report', title: 'VAT Report', category: 'financial', orientation: 'portrait', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Output VAT, input VAT, net payable' },
  { id: 'budget-vs-actual', title: 'Budget vs Actual', category: 'financial', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Budgeted vs actual with variance' },
  { id: 'rent-roll', title: 'Rent Roll', category: 'operational', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'All tenants with current charges' },
  { id: 'lease-expiry', title: 'Lease Expiry Schedule', category: 'operational', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Leases expiring within selected period' },
  { id: 'vacancy-report', title: 'Vacancy Report', category: 'operational', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Vacant units with days vacant' },
  { id: 'recovery-analysis', title: 'Recovery Analysis', category: 'operational', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Recoveries vs actual expenses' },
  { id: 'tenant-ledger', title: 'Tenant Ledger', category: 'tenant', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Full transaction history per tenant' },
  { id: 'tenant-statement', title: 'Tenant Statement', category: 'tenant', orientation: 'portrait', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Statement of account' },
  { id: 'aged-debtors', title: 'Aged Debtors', category: 'tenant', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Outstanding by aging bucket' },
  { id: 'deposit-register', title: 'Deposit Register', category: 'tenant', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'All tenant deposits held' },
  { id: 'tenancy-schedule', title: 'Tenancy Schedule', category: 'tenant', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'All tenants with lease details' },
  { id: 'supplier-ledger', title: 'Supplier Ledger', category: 'supplier', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Full transaction history per supplier' },
  { id: 'aged-creditors', title: 'Aged Creditors', category: 'supplier', orientation: 'landscape', formats: ['pdf', 'excel', 'csv'], permission: 'reports.view', description: 'Outstanding payables by aging bucket' },
  { id: 'portfolio-summary', title: 'Portfolio Summary', category: 'executive', orientation: 'portrait', formats: ['pdf', 'excel'], permission: 'reports.view', description: 'Key metrics across portfolio' },
  { id: 'noi-report', title: 'NOI Report', category: 'executive', orientation: 'portrait', formats: ['pdf', 'excel'], permission: 'reports.view', description: 'Net operating income per property' },
];

export function getReport(id: string): ReportDefinition | undefined {
  return reportRegistry.find(r => r.id === id);
}

export function getReportsByCategory(category: ReportCategory): ReportDefinition[] {
  return reportRegistry.filter(r => r.category === category);
}

export const reportCategories: { key: ReportCategory; label: string }[] = [
  { key: 'financial', label: 'Financial' },
  { key: 'operational', label: 'Operational' },
  { key: 'tenant', label: 'Tenant' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'executive', label: 'Executive' },
];
