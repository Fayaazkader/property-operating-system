CREATE UNIQUE INDEX IF NOT EXISTS sub_ledger_entries_journal_line_ledger_type_unique
  ON public.sub_ledger_entries (journal_line_id, ledger_type);
