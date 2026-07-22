// lib/reporting/providers/factory.ts
// Provider Factory — Resolves report ID to its data provider

import { getTrialBalanceData } from './trial-balance';
import { getAgedDebtorsData } from './aged-debtors';
import { getRentRollData } from './rent-roll';

export interface ReportData {
  metadata: { reportId: string; title: string; generatedAt: string; entityId: string; periodId?: string; filters?: string[] };
  headers: string[];
  rows: string[][];
  totals?: string[];
  summary?: Record<string, string>;
}

type ProviderFn = (entityId: string, periodId?: string) => Promise<ReportData>;

const providerMap: Record<string, ProviderFn> = {
  'trial-balance': async (eid, pid) => { const d = await getTrialBalanceData(eid, pid || ''); return { metadata: { reportId: 'trial-balance', title: 'Trial Balance', generatedAt: new Date().toISOString(), entityId: eid, periodId: pid }, ...d }; },
  'aged-debtors': async (eid) => { const d = await getAgedDebtorsData(eid); return { metadata: { reportId: 'aged-debtors', title: 'Aged Debtors', generatedAt: new Date().toISOString(), entityId: eid }, ...d }; },
  'rent-roll': async (eid) => { const d = await getRentRollData(eid); return { metadata: { reportId: 'rent-roll', title: 'Rent Roll', generatedAt: new Date().toISOString(), entityId: eid }, ...d }; },
};

export function getProvider(reportId: string): ProviderFn | undefined {
  return providerMap[reportId];
}
