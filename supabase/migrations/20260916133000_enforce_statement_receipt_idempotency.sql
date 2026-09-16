ALTER TABLE public.statements_generated
  ADD COLUMN IF NOT EXISTS source_journal_id uuid;

CREATE INDEX IF NOT EXISTS idx_statements_generated_source_journal
  ON public.statements_generated (source_journal_id);

CREATE UNIQUE INDEX IF NOT EXISTS statements_generated_source_journal_unique
  ON public.statements_generated (source_journal_id)
  WHERE source_journal_id IS NOT NULL;
