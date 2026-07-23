import { getTrialBalanceData } from './trial-balance';
import { getIncomeStatementData } from './income-statement';
import { getBalanceSheetData } from './balance-sheet';
import { getCashFlowData } from './cash-flow';
import { getGeneralLedgerData } from './general-ledger';
import { getJournalReportData } from './journal-report';
import { getVatReportData } from './vat-report';
import { getAgedDebtorsData } from './aged-debtors';
import { getAgedCreditorsData } from './aged-creditors';
import { getRentRollData } from './rent-roll';
import { getTenantLedgerData } from './tenant-ledger';
import type { ReportScope, ReportData } from '../types';

type ProviderFn = (scope: ReportScope) => Promise<ReportData>;

const providerMap: Record<string, ProviderFn> = {
  // Financial reports — use periodId
  'trial-balance': async (scope) => {
    const d = await getTrialBalanceData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'trial-balance', title: 'Trial Balance', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'income-statement': async (scope) => {
    const d = await getIncomeStatementData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'income-statement', title: 'Income Statement', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'balance-sheet': async (scope) => {
    const d = await getBalanceSheetData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'balance-sheet', title: 'Balance Sheet', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'cash-flow': async (scope) => {
    const d = await getCashFlowData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'cash-flow', title: 'Cash Flow Statement', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'general-ledger': async (scope) => {
    const d = await getGeneralLedgerData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'general-ledger', title: 'General Ledger', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'journal-report': async (scope) => {
    const d = await getJournalReportData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'journal-report', title: 'Journal Report', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'vat-report': async (scope) => {
    const d = await getVatReportData(scope.entityId || '', scope.periodId || '');
    return { metadata: { reportId: 'vat-report', title: 'VAT Report', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  // Position reports — use entityId only
  'aged-debtors': async (scope) => {
    const d = await getAgedDebtorsData(scope.entityId || '');
    return { metadata: { reportId: 'aged-debtors', title: 'Aged Debtors', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'aged-creditors': async (scope) => {
    const d = await getAgedCreditorsData(scope.entityId || '');
    return { metadata: { reportId: 'aged-creditors', title: 'Aged Creditors', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  'rent-roll': async (scope) => {
    const d = await getRentRollData(scope.entityId || '');
    return { metadata: { reportId: 'rent-roll', title: 'Rent Roll', generatedAt: new Date().toISOString(), scope }, ...d };
  },
  // Tenant-scoped — uses tenantId
  'tenant-ledger': async (scope) => {
    const d = await getTenantLedgerData(scope.entityId || '', scope.tenantId);
    return { metadata: { reportId: 'tenant-ledger', title: 'Tenant Ledger', generatedAt: new Date().toISOString(), scope }, ...d };
  },
};

export function getProvider(reportId: string): ProviderFn | undefined { return providerMap[reportId]; }
