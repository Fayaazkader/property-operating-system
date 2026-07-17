// lib/revenue/api.ts
// Revenue API — Thin layer

import { statementService } from './services/statement-service';

export const revenueApi = {
  generateStatement: (params: { entityId: string; tenantId: string; options?: any }) =>
    statementService.generate(params.entityId, params.tenantId, params.options),
  
  getStatementHistory: (params: { entityId: string; tenantId: string }) =>
    statementService.getHistory(params.entityId, params.tenantId),
};
