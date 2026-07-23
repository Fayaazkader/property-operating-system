import { getTrialBalanceData } from './trial-balance';
import { getIncomeStatementData } from './income-statement';
import { getBalanceSheetData } from './balance-sheet';
import { getCashFlowData } from './cash-flow';
import { getGeneralLedgerData } from './general-ledger';
import { getJournalReportData } from './journal-report';
import { getVatReportData } from './vat-report';
import { getBudgetVsActualData } from './budget-vs-actual';
import { getAgedDebtorsData } from './aged-debtors';
import { getAgedCreditorsData } from './aged-creditors';
import { getRentRollData } from './rent-roll';
import { getTenantLedgerData } from './tenant-ledger';
import { getTenantStatementData } from './tenant-statement';
import { getSupplierLedgerData } from './supplier-ledger';
import { getLeaseExpiryData } from './lease-expiry';
import { getVacancyReportData } from './vacancy-report';
import { getDepositRegisterData } from './deposit-register';
import { getTenancyScheduleData } from './tenancy-schedule';
import { getRecoveryAnalysisData } from './recovery-analysis';
import { getPortfolioSummaryData } from './portfolio-summary';
import { getNoiReportData } from './noi-report';
import type { ReportScope, ReportData } from '../types';

type ProviderFn = (scope: ReportScope) => Promise<ReportData>;

const providerMap: Record<string, ProviderFn> = {
  'trial-balance': async (s) => ({ metadata: { reportId: 'trial-balance', title: 'Trial Balance', generatedAt: new Date().toISOString(), scope: s }, ...(await getTrialBalanceData(s.entityId || '', s.periodId || '')) }),
  'income-statement': async (s) => ({ metadata: { reportId: 'income-statement', title: 'Income Statement', generatedAt: new Date().toISOString(), scope: s }, ...(await getIncomeStatementData(s.entityId || '', s.periodId || '')) }),
  'balance-sheet': async (s) => ({ metadata: { reportId: 'balance-sheet', title: 'Balance Sheet', generatedAt: new Date().toISOString(), scope: s }, ...(await getBalanceSheetData(s.entityId || '', s.periodId || '')) }),
  'cash-flow': async (s) => ({ metadata: { reportId: 'cash-flow', title: 'Cash Flow Statement', generatedAt: new Date().toISOString(), scope: s }, ...(await getCashFlowData(s.entityId || '', s.periodId || '')) }),
  'general-ledger': async (s) => ({ metadata: { reportId: 'general-ledger', title: 'General Ledger', generatedAt: new Date().toISOString(), scope: s }, ...(await getGeneralLedgerData(s.entityId || '', s.periodId || '')) }),
  'journal-report': async (s) => ({ metadata: { reportId: 'journal-report', title: 'Journal Report', generatedAt: new Date().toISOString(), scope: s }, ...(await getJournalReportData(s.entityId || '', s.periodId || '')) }),
  'vat-report': async (s) => ({ metadata: { reportId: 'vat-report', title: 'VAT Report', generatedAt: new Date().toISOString(), scope: s }, ...(await getVatReportData(s.entityId || '', s.periodId || '')) }),
  'budget-vs-actual': async (s) => ({ metadata: { reportId: 'budget-vs-actual', title: 'Budget vs Actual', generatedAt: new Date().toISOString(), scope: s }, ...(await getBudgetVsActualData(s.entityId || '', s.periodId || '')) }),
  'aged-debtors': async (s) => ({ metadata: { reportId: 'aged-debtors', title: 'Aged Debtors', generatedAt: new Date().toISOString(), scope: s }, ...(await getAgedDebtorsData(s.entityId || '')) }),
  'aged-creditors': async (s) => ({ metadata: { reportId: 'aged-creditors', title: 'Aged Creditors', generatedAt: new Date().toISOString(), scope: s }, ...(await getAgedCreditorsData(s.entityId || '')) }),
  'rent-roll': async (s) => ({ metadata: { reportId: 'rent-roll', title: 'Rent Roll', generatedAt: new Date().toISOString(), scope: s }, ...(await getRentRollData(s.entityId || '')) }),
  'tenant-ledger': async (s) => ({ metadata: { reportId: 'tenant-ledger', title: 'Tenant Ledger', generatedAt: new Date().toISOString(), scope: s }, ...(await getTenantLedgerData(s.entityId || '', s.tenantId)) }),
  'tenant-statement': async (s) => ({ metadata: { reportId: 'tenant-statement', title: 'Tenant Statement', generatedAt: new Date().toISOString(), scope: s }, ...(await getTenantStatementData(s.entityId || '', s.tenantId)) }),
  'supplier-ledger': async (s) => ({ metadata: { reportId: 'supplier-ledger', title: 'Supplier Ledger', generatedAt: new Date().toISOString(), scope: s }, ...(await getSupplierLedgerData(s.entityId || '', s.supplierId)) }),
  'lease-expiry': async (s) => ({ metadata: { reportId: 'lease-expiry', title: 'Lease Expiry Schedule', generatedAt: new Date().toISOString(), scope: s }, ...(await getLeaseExpiryData(s.entityId || '')) }),
  'vacancy-report': async (s) => ({ metadata: { reportId: 'vacancy-report', title: 'Vacancy Report', generatedAt: new Date().toISOString(), scope: s }, ...(await getVacancyReportData(s.entityId || '')) }),
  'deposit-register': async (s) => ({ metadata: { reportId: 'deposit-register', title: 'Deposit Register', generatedAt: new Date().toISOString(), scope: s }, ...(await getDepositRegisterData(s.entityId || '')) }),
  'tenancy-schedule': async (s) => ({ metadata: { reportId: 'tenancy-schedule', title: 'Tenancy Schedule', generatedAt: new Date().toISOString(), scope: s }, ...(await getTenancyScheduleData(s.entityId || '')) }),
  'recovery-analysis': async (s) => ({ metadata: { reportId: 'recovery-analysis', title: 'Recovery Analysis', generatedAt: new Date().toISOString(), scope: s }, ...(await getRecoveryAnalysisData(s.entityId || '', s.periodId)) }),
  'portfolio-summary': async (s) => ({ metadata: { reportId: 'portfolio-summary', title: 'Portfolio Summary', generatedAt: new Date().toISOString(), scope: s }, ...(await getPortfolioSummaryData(s.entityId || '')) }),
  'noi-report': async (s) => ({ metadata: { reportId: 'noi-report', title: 'NOI Report', generatedAt: new Date().toISOString(), scope: s }, ...(await getNoiReportData(s.entityId || '', s.periodId)) }),
};

export function getProvider(reportId: string): ProviderFn | undefined { return providerMap[reportId]; }
