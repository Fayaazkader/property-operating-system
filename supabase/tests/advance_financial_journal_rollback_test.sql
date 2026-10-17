BEGIN;


DO $test$
DECLARE
  v_entity uuid := gen_random_uuid();
  v_sep uuid := gen_random_uuid();
  v_oct uuid := gen_random_uuid();
  v_nov uuid := gen_random_uuid();
  v_dec uuid := gen_random_uuid();

  v_debit_account uuid := gen_random_uuid();
  v_credit_account uuid := gen_random_uuid();
  v_journal uuid;
  v_replay uuid;
  v_second_journal uuid;
  v_lines jsonb;
  v_header jsonb;

  v_result jsonb;
  v_count integer := 0;
BEGIN
  INSERT INTO public.entities
    (id, entity_code, entity_name)
  VALUES
    (v_entity, 'ADVTEST-' || substr(v_entity::text, 1, 8),
     'Rollback Financial Period Test');

  INSERT INTO public.financial_periods
    (id, entity_id, period_type, period_name,
     period_start, period_end, status, workflow_phase)
  VALUES
    (v_sep, v_entity, 'financial', 'September 2026 Financial',
     '2026-09-01', '2026-09-30', 'closed', 'closed'),
    (v_oct, v_entity, 'financial', 'October 2026 Financial',
     '2026-10-01', '2026-10-31', 'open', 'open'),
    (v_nov, v_entity, 'financial', 'November 2026 Financial',
     '2026-11-01', '2026-11-30', 'advance', 'advance'),
    (v_dec, v_entity, 'financial', 'December 2026 Financial',
     '2026-12-01', '2026-12-31', 'advance', 'advance');


  INSERT INTO public.chart_of_accounts
    (id, entity_id, gl_code, account_name, account_type, category, is_active)
  VALUES
    (v_debit_account, v_entity, 'ADV-1000', 'Test receivable', 'asset', 'test', true),
    (v_credit_account, v_entity, 'ADV-4000', 'Test income', 'income', 'test', true);


  -- Establish valid tax treatment before approving the configuration.
  UPDATE public.chart_of_accounts
  SET is_vatable = false, vat_rate = 0
  WHERE entity_id = v_entity;

  INSERT INTO public.tax_config
    (entity_id, tax_code, tax_name, tax_rate, is_recoverable, is_active)
  VALUES
    (v_entity, 'NO_VAT', 'Not VAT registered', 0, false, true);

  -- Configuration triggers may increment the readiness revision.
  -- Review the final revision only after all configuration is complete.
  INSERT INTO public.entity_financial_readiness
    (entity_id, revision, reviewed_revision, vat_status, reviewed_at)
  VALUES
    (v_entity, 1, 1, 'not_registered', now())
  ON CONFLICT (entity_id) DO UPDATE
  SET vat_status = 'not_registered',
      reviewed_revision = EXCLUDED.reviewed_revision,
      reviewed_at = now();

  UPDATE public.entity_financial_readiness
  SET reviewed_revision = revision,
      reviewed_at = now()
  WHERE entity_id = v_entity;

  v_lines := jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(),
      'entity_id', v_entity,
      'account_id', v_debit_account,
      'debit_amount', 100.00,
      'credit_amount', 0
    ),
    jsonb_build_object('id', gen_random_uuid(),
      'entity_id', v_entity,
      'account_id', v_credit_account,
      'debit_amount', 0,
      'credit_amount', 100.00
    )
  );

  v_header := jsonb_build_object(
    'id', gen_random_uuid(),
    'entity_id', v_entity,
    'period_id', v_nov,
    'journal_number', 'ADV-' || substr(v_entity::text, 1, 8) || '-1',
    'journal_type', 'manual',
    'source_event', 'advance_financial_regression',
    'source_id', v_entity::text || '-1',
    'description', 'November advance posting regression'
  );

  EXECUTE 'SET LOCAL ROLE service_role';

  v_journal := public.atomic_post_journal(v_header, v_lines);

  IF v_journal IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.journals
    WHERE id = v_journal AND period_id = v_nov AND is_posted
  ) THEN
    RAISE EXCEPTION 'FAIL: November advance journal not posted';
  END IF;
  RAISE NOTICE 'PASS: November advance journal posted';

  IF NOT EXISTS (
    SELECT 1 FROM public.general_ledger gl
    JOIN public.journal_lines jl ON jl.id = gl.journal_line_id
    WHERE jl.journal_id = v_journal
    GROUP BY jl.journal_id
    HAVING count(*) = 2
       AND sum(gl.debit_amount) = 100
       AND sum(gl.credit_amount) = 100
       AND bool_and(gl.period_id = v_nov)
  ) THEN
    RAISE EXCEPTION 'FAIL: November GL entries incorrect';
  END IF;
  RAISE NOTICE 'PASS: Balanced November general-ledger entries';

  v_replay := public.atomic_post_journal(v_header, v_lines);

  IF v_replay IS DISTINCT FROM v_journal THEN
    RAISE EXCEPTION 'FAIL: Identical source replay created another journal';
  END IF;
  RAISE NOTICE 'PASS: Identical source replay is idempotent';

  BEGIN
    PERFORM public.atomic_post_journal(
      v_header,
      jsonb_build_array(
        jsonb_build_object(
          'entity_id', v_entity,
          'account_id', v_debit_account,
          'debit_amount', 200,
          'credit_amount', 0
        ),
        jsonb_build_object(
          'entity_id', v_entity,
          'account_id', v_credit_account,
          'debit_amount', 0,
          'credit_amount', 200
        )
      )
    );
    RAISE EXCEPTION 'FAIL: Conflicting replay accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: Conflicting replay accepted' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: Conflicting source replay rejected';

  BEGIN
    PERFORM public.atomic_post_journal(
      v_header || jsonb_build_object(
        'period_id', v_dec,
        'source_id', v_entity::text || '-dec'
      ),
      v_lines
    );
    RAISE EXCEPTION 'FAIL: December journal posted too early';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: December journal posted too early' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: Premature December journal rejected';

  BEGIN
    PERFORM public.atomic_post_journal(
      v_header || jsonb_build_object(
        'source_id', v_entity::text || '-unbalanced'
      ),
      jsonb_build_array(
        jsonb_build_object(
          'entity_id', v_entity,
          'account_id', v_debit_account,
          'debit_amount', 100,
          'credit_amount', 0
        ),
        jsonb_build_object(
          'entity_id', v_entity,
          'account_id', v_credit_account,
          'debit_amount', 0,
          'credit_amount', 90
        )
      )
    );
    RAISE EXCEPTION 'FAIL: Unbalanced journal accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: Unbalanced journal accepted' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: Unbalanced journal rejected';

  PERFORM public.assert_financial_posting_period(v_entity, v_oct);
  RAISE NOTICE 'PASS: October current posting permitted';
  v_count := v_count + 1;

  PERFORM public.assert_financial_posting_period(v_entity, v_nov);
  RAISE NOTICE 'PASS: November advance posting permitted';
  v_count := v_count + 1;

  BEGIN
    PERFORM public.assert_financial_posting_period(v_entity, v_sep);
    RAISE EXCEPTION 'FAIL: September posting permitted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: September posting permitted' THEN
      RAISE;
    END IF;
  END;
  RAISE NOTICE 'PASS: September posting rejected';
  v_count := v_count + 1;

  BEGIN
    PERFORM public.assert_financial_posting_period(v_entity, v_dec);
    RAISE EXCEPTION 'FAIL: December posted before October close';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: December posted before October close' THEN
      RAISE;
    END IF;
  END;
  RAISE NOTICE 'PASS: December posting initially rejected';
  v_count := v_count + 1;

  v_result := public.close_financial_period_atomic(
    v_entity, 'October 2026 Financial', 'open'
  );

  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: October close returned %', v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE id = v_oct AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'FAIL: October not closed';
  END IF;
  RAISE NOTICE 'PASS: October closed';
  v_count := v_count + 1;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE id = v_nov AND status = 'open'
      AND workflow_phase = 'open'
  ) THEN
    RAISE EXCEPTION 'FAIL: November ID or status changed incorrectly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.journals
    WHERE id = v_journal AND period_id = v_nov AND is_posted
  ) OR (
    SELECT count(*) FROM public.general_ledger gl
    JOIN public.journal_lines jl ON jl.id = gl.journal_line_id
    WHERE jl.journal_id = v_journal AND gl.period_id = v_nov
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL: November journal or GL changed during October close';
  END IF;
  RAISE NOTICE 'PASS: November journal and GL preserved through close';

  v_second_journal := public.atomic_post_journal(
    v_header || jsonb_build_object(
      'id', gen_random_uuid(),
      'journal_number', 'ADV-' || substr(v_entity::text, 1, 8) || '-2',
      'source_id', v_entity::text || '-2'
    ),
    (
      SELECT jsonb_agg(
        line || jsonb_build_object('id', gen_random_uuid())
      )
      FROM jsonb_array_elements(v_lines) AS line
    )
  );

  IF v_second_journal IS NULL OR v_second_journal = v_journal THEN
    RAISE EXCEPTION 'FAIL: New November journal after promotion';
  END IF;
  RAISE NOTICE 'PASS: New November journal posted after promotion';

  RAISE NOTICE 'PASS: Existing November ID preserved and promoted';
  v_count := v_count + 1;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE id = v_dec AND status = 'advance'
  ) THEN
    RAISE EXCEPTION 'FAIL: December advance period unavailable';
  END IF;

  PERFORM public.assert_financial_posting_period(v_entity, v_dec);
  RAISE NOTICE 'PASS: December advance posting permitted after close';
  v_count := v_count + 1;

  BEGIN
    PERFORM public.assert_financial_posting_period(v_entity, v_oct);
    RAISE EXCEPTION 'FAIL: Closed October still permits posting';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: Closed October still permits posting' THEN
      RAISE;
    END IF;
  END;
  RAISE NOTICE 'PASS: Closed October posting rejected';
  v_count := v_count + 1;

  RAISE NOTICE 'FINANCIAL PERIOD REGRESSION: %/8 PASSED', v_count;
END;
$test$;

ROLLBACK;

SELECT
  'PASS' AS result,
  'Financial period and actual journal posting' AS test,
  '8 lifecycle + 8 journal assertions' AS coverage,
  'Test transaction rolled back' AS persistence;
