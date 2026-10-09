-- Runs under service_role inside the existing rollback-only suite.
DO $test$
DECLARE
  v_execution uuid := gen_random_uuid();
  v_source uuid := gen_random_uuid();
  v_type text;
  v_snapshot jsonb;
  v_rejected boolean;
BEGIN
  FOREACH v_type IN ARRAY ARRAY[
    'manual_document',
    'lease_renewal',
    'lease_addendum',
    'supplier_contract',
    'management_agreement',
    'service_contract',
    'mandate',
    'leasing_opportunity'
  ]
  LOOP
    v_execution := gen_random_uuid();
    v_source := gen_random_uuid();
    v_snapshot := jsonb_build_object(
      'sourceType', v_type,
      'frozen', true
    );

    INSERT INTO public.executions (
      id, source_type, source_id, snapshot,
      status, provider, metadata
    )
    VALUES (
      v_execution, v_type, v_source, v_snapshot,
      'ready', 'native', '{}'::jsonb
    );

    UPDATE public.executions
    SET status = 'sent'
    WHERE id = v_execution;

    IF NOT EXISTS (
      SELECT 1
      FROM public.executions
      WHERE id = v_execution
        AND snapshot = v_snapshot
        AND status = 'sent'
    ) THEN
      RAISE EXCEPTION
        'Snapshot changed during dispatch: %', v_type;
    END IF;
  END LOOP;

  RAISE NOTICE
    'PASS: Non-lease execution snapshots preserved on dispatch';

  v_execution := gen_random_uuid();

  INSERT INTO public.executions (
    id, source_type, source_id, snapshot,
    status, provider, metadata
  )
  VALUES (
    v_execution, 'lease', gen_random_uuid(),
    '{"frozen":true}'::jsonb,
    'ready', 'native', '{}'::jsonb
  );

  v_rejected := false;

  BEGIN
    UPDATE public.executions
    SET status = 'sent'
    WHERE id = v_execution;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION
      'Missing legacy lease source was not rejected';
  END IF;

  RAISE NOTICE
    'PASS: Missing legacy lease source rejected';
END;
$test$;
