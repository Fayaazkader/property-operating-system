BEGIN;

DO $test$
DECLARE
  v_entity uuid := gen_random_uuid();
  v_sep uuid := gen_random_uuid();
  v_oct uuid := gen_random_uuid();
  v_nov uuid := gen_random_uuid();
  v_dec uuid := gen_random_uuid();
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
  'Financial period lifecycle' AS test,
  8 AS checks_completed,
  'Test transaction rolled back' AS persistence;