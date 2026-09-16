ALTER TABLE public.journal_lines
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

CREATE INDEX IF NOT EXISTS idx_journal_lines_bank_account
  ON public.journal_lines (bank_account_id);

ALTER TABLE public.journal_lines
  ADD CONSTRAINT journal_lines_bank_account_id_fkey
  FOREIGN KEY (bank_account_id)
  REFERENCES public.bank_accounts (id);

CREATE OR REPLACE FUNCTION public.atomic_post_journal(
  p_journal jsonb,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_id uuid;
  v_existing_journal_id uuid;
  v_source_event text;
  v_source_id text;
  v_line jsonb;
BEGIN
  v_journal_id := (p_journal->>'id')::uuid;
  v_source_event := p_journal->>'source_event';
  v_source_id := p_journal->>'source_id';

  /*
   * Idempotency:
   *
   * If this business source has already been posted, return the
   * existing journal rather than creating another journal/GL entry.
   *
   * source_id is nullable, so idempotency only applies when a
   * concrete source identity is supplied.
   */
  IF v_source_id IS NOT NULL AND v_source_id <> '' THEN
    SELECT id
    INTO v_existing_journal_id
    FROM public.journals
    WHERE source_event = v_source_event
      AND source_id = v_source_id
    LIMIT 1;

    IF v_existing_journal_id IS NOT NULL THEN
      RETURN v_existing_journal_id;
    END IF;
  END IF;

  /*
   * Insert journal.
   */
  INSERT INTO public.journals (
    id,
    entity_id,
    journal_number,
    journal_type,
    description,
    period_id,
    source_event,
    source_id,
    reference,
    is_posted,
    posted_at,
    created_by,
    created_at,
    explanation,
    template_id,
    template_version
  )
  VALUES (
    v_journal_id,
    (p_journal->>'entity_id')::uuid,
    p_journal->>'journal_number',
    p_journal->>'journal_type',
    p_journal->>'description',
    NULLIF(p_journal->>'period_id', '')::uuid,
    v_source_event,
    NULLIF(v_source_id, ''),
    p_journal->>'reference',
    true,
    COALESCE(
      (p_journal->>'posted_at')::timestamptz,
      now()
    ),
    p_journal->>'created_by',
    COALESCE(
      (p_journal->>'created_at')::timestamptz,
      now()
    ),
    p_journal->>'explanation',
    NULLIF(p_journal->>'template_id', '')::uuid,
    COALESCE(
      NULLIF(p_journal->>'template_version', '')::integer,
      1
    )
  );

  /*
   * Insert journal lines and corresponding GL entries.
   */
  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(p_lines)
  LOOP

    INSERT INTO public.journal_lines (
      id,
      journal_id,
      account_id,
      description,
      debit_amount,
      credit_amount,
      vat_amount,
      vat_rate,
      entity_id,
      property_id,
      lease_id,
      tenant_id,
      supplier_id,
      broker_id,
      bank_account_id,
      cost_centre,
      created_at
    )
    VALUES (
      (v_line->>'id')::uuid,
      v_journal_id,
      (v_line->>'account_id')::uuid,
      v_line->>'description',
      COALESCE((v_line->>'debit_amount')::numeric, 0),
      COALESCE((v_line->>'credit_amount')::numeric, 0),
      COALESCE((v_line->>'vat_amount')::numeric, 0),
      COALESCE((v_line->>'vat_rate')::numeric, 0),
      NULLIF(v_line->>'entity_id', '')::uuid,
      NULLIF(v_line->>'property_id', '')::uuid,
      NULLIF(v_line->>'lease_id', '')::uuid,
      NULLIF(v_line->>'tenant_id', '')::uuid,
      NULLIF(v_line->>'supplier_id', '')::uuid,
      NULLIF(v_line->>'broker_id', '')::uuid,
      NULLIF(v_line->>'bank_account_id', '')::uuid,
      v_line->>'cost_centre',
      COALESCE(
        (v_line->>'created_at')::timestamptz,
        now()
      )
    );

    INSERT INTO public.general_ledger (
      id,
      entity_id,
      account_id,
      period_id,
      journal_line_id,
      debit_amount,
      credit_amount,
      posted_at
    )
    VALUES (
      gen_random_uuid(),
      (p_journal->>'entity_id')::uuid,
      (v_line->>'account_id')::uuid,
      NULLIF(p_journal->>'period_id', '')::uuid,
      (v_line->>'id')::uuid,
      COALESCE((v_line->>'debit_amount')::numeric, 0),
      COALESCE((v_line->>'credit_amount')::numeric, 0),
      COALESCE(
        (p_journal->>'posted_at')::timestamptz,
        now()
      )
    );

  END LOOP;

  RETURN v_journal_id;

EXCEPTION
  WHEN unique_violation THEN
    /*
     * A concurrent request may have passed the initial lookup and
     * inserted the same source between the lookup and INSERT.
     *
     * Only treat the error as an idempotent replay when the source
     * identity now exists. Otherwise re-raise the original error.
     */
    IF v_source_id IS NOT NULL AND v_source_id <> '' THEN
      SELECT id
      INTO v_existing_journal_id
      FROM public.journals
      WHERE source_event = v_source_event
        AND source_id = v_source_id
      LIMIT 1;

      IF v_existing_journal_id IS NOT NULL THEN
        RETURN v_existing_journal_id;
      END IF;
    END IF;

    RAISE;
END;
$function$;
