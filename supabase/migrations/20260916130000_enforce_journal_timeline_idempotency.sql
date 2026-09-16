CREATE UNIQUE INDEX IF NOT EXISTS financial_timeline_journal_lifecycle_unique
  ON public.financial_timeline (reference_type, reference_id, event_type)
  WHERE reference_type = 'journal';
