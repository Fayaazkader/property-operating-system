// lib/financial/api/index.ts
// Financial API — Thin layer. All public functions take request objects.

import { statementService } from '../services/statement-service';
import { journalService } from '../services/journal-service';
import { closeService } from '../services/close-service';
import { vatEngine } from '../vat-engine';
import { periodData } from '../data/period-data';

export const financialApi = {
  // Statements
  trialBalance: (params: { entityId: string; periodId: string }) => statementService.getTrialBalance(params),
  incomeStatement: (params: { entityId: string; periodId: string }) => statementService.getIncomeStatement(params),

  // Journals
  journals: (params: { entityId: string; periodId: string; page?: number; pageSize?: number }) => journalService.list(params),
  journalDetail: (params: { journalId: string }) => journalService.getDetail(params),

  // VAT
  vatReturn: (params: { entityId: string; periodId: string }) => vatEngine.getVatReturn(params.entityId, params.periodId),
  calculateVat: (params: { entityId: string; periodId: string }) => vatEngine.calculateVat(params.entityId, params.periodId),

  // Close
  closeStatus: (params: { entityId: string; periodId: string }) => closeService.getStatus(params),
  closePeriod: (params: { periodId: string; userId: string }) => closeService.closePeriod(params),

  // Periods
  periods: (params: { entityId: string }) => periodData.list(params.entityId),
};
