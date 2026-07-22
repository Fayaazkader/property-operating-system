// lib/reporting/providers/factory.ts
import { getTrialBalanceData } from './trial-balance';
import { getIncomeStatementData } from './income-statement';
import { getBalanceSheetData } from './balance-sheet';
import { getCashFlowData } from './cash-flow';
import { getAgedDebtorsData } from './aged-debtors';
import { getRentRollData } from './rent-roll';
import type { ReportScope, ReportData } from '../types';

type ProviderFn = (scope: ReportScope) => Promise<ReportData>;

const providerMap: Record<string, ProviderFn> = {
  'trial-balance': async (scope) => { const d = await getTrialBalanceData(scope.entityId || '', scope.fromDate || ''); return { metadata: { reportId: 'trial-balance', title: 'Trial Balance', generatedAt: new Date().toISOString(), scope }, ...d }; },
  'income-statement': async (scope) => { const d = await getIncomeStatementData(scope.entityId || '', scope.fromDate || ''); return { metadata: { reportId: 'income-statement', title: 'Income Statement', generatedAt: new Date().toISOString(), scope }, ...d }; },
  'balance-sheet': async (scope) => { const d = await getBalanceSheetData(scope.entityId || '', scope.fromDate || ''); return { metadata: { reportId: 'balance-sheet', title: 'Balance Sheet', generatedAt: new Date().toISOString(), scope }, ...d }; },
  'cash-flow': async (scope) => { const d = await getCashFlowData(scope.entityId || '', scope.fromDate || ''); return { metadata: { reportId: 'cash-flow', title: 'Cash Flow Statement', generatedAt: new Date().toISOString(), scope }, ...d }; },
  'aged-debtors': async (scope) => { const d = await getAgedDebtorsData(scope.entityId || ''); return { metadata: { reportId: 'aged-debtors', title: 'Aged Debtors', generatedAt: new Date().toISOString(), scope }, ...d }; },
  'rent-roll': async (scope) => { const d = await getRentRollData(scope.entityId || ''); return { metadata: { reportId: 'rent-roll', title: 'Rent Roll', generatedAt: new Date().toISOString(), scope }, ...d }; },
};

export function getProvider(reportId: string): ProviderFn | undefined { return providerMap[reportId]; }
