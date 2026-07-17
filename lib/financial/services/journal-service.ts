// lib/financial/services/journal-service.ts
// Journal business logic. Enriches raw journals with totals.

import { journalData } from '../data/journal-data';

export interface JournalSummary {
  id: string;
  journal_number: string;
  journal_type: string;
  description: string;
  source_event: string;
  is_posted: boolean;
  posted_at: string;
  created_at: string;
  total_debits: number;
  total_credits: number;
  line_count: number;
}

export const journalService = {
  async list(params: { entityId: string; periodId: string; page?: number; pageSize?: number }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const [journals, total] = await Promise.all([
      journalData.list(params.entityId, params.periodId, pageSize, offset),
      journalData.count(params.entityId, params.periodId),
    ]);

    // Single query for all line totals — no N+1
    const journalIds = journals.map(j => j.id);
    const totals = await journalData.getLineTotals(journalIds);

    const enriched: JournalSummary[] = journals.map(j => ({
      ...j,
      total_debits: totals[j.id]?.total_debits || 0,
      total_credits: totals[j.id]?.total_credits || 0,
      line_count: totals[j.id]?.line_count || 0,
    }));

    return { journals: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getDetail(params: { journalId: string }) {
    return journalData.get(params.journalId);
  }
};
