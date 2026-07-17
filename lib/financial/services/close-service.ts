// lib/financial/services/close-service.ts
// Close orchestration

import { financialGovernanceEngine } from '../governance-engine';

export const closeService = {
  async getStatus(params: { entityId: string; periodId: string }) {
    const [canClose, checklist, integrity] = await Promise.all([
      financialGovernanceEngine.canClosePeriod(params.entityId, params.periodId),
      financialGovernanceEngine.getCloseChecklist(params.entityId, params.periodId),
      financialGovernanceEngine.getIntegrityScore(params.entityId, params.periodId),
    ]);

    return {
      can_close: canClose.canClose,
      critical_count: canClose.criticalCount,
      warning_count: canClose.warningCount,
      checklist: checklist.map(c => ({ id: c.id, item: c.checklist_item, category: c.category, status: c.status })),
      integrity_score: integrity,
    };
  },

  async closePeriod(params: { periodId: string; userId: string }) {
    return financialGovernanceEngine.closePeriod(params.periodId, params.userId);
  }
};
