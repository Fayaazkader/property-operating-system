DO $test$
DECLARE
  v_failed boolean;
BEGIN
  -- Direct insertion must be rejected before FK validation.
  v_failed := false;

  BEGIN
    INSERT INTO public.execution_signing_documents (
      execution_id,
      document_version_id,
      entity_id,
      source_document_id,
      source_checksum,
      pdf_checksum,
      storage_path,
      page_count,
      content_length,
      conversion_provider
    )
    VALUES (
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      repeat('a', 64),
      repeat('b', 64),
      'tests/direct-write.pdf',
      1,
      100,
      'original-pdf'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Governed registration required%' THEN
      RAISE EXCEPTION
        'Unexpected direct-insert rejection: %', SQLERRM;
    END IF;

    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Direct insertion unexpectedly succeeded';
  END IF;

  RAISE NOTICE 'PASS: Ungoverned insertion rejected';

  -- Registration must reject an execution that does not exist.
  v_failed := false;

  BEGIN
    PERFORM public.stage_execution_signing_document(
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      repeat('a', 64),
      repeat('b', 64),
      'tests/missing-execution.pdf',
      1,
      100,
      'original-pdf'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Execution not eligible for PDF preparation%' THEN
      RAISE EXCEPTION
        'Unexpected registration rejection: %', SQLERRM;
    END IF;

    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Invalid execution registration succeeded';
  END IF;

  RAISE NOTICE 'PASS: Invalid execution rejected';

  -- Commit must reject a nonexistent staged document.
  v_failed := false;

  BEGIN
    PERFORM public.commit_execution_signing_document(
      gen_random_uuid()
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Signing document not found%' THEN
      RAISE EXCEPTION
        'Unexpected commit rejection: %', SQLERRM;
    END IF;

    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Invalid document commit succeeded';
  END IF;

  RAISE NOTICE 'PASS: Invalid commit rejected';
END
$test$;
