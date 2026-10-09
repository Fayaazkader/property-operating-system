-- Synthetic records only. Requires outer BEGIN and ROLLBACK.
-- The source entity is read-only; all inserted records are synthetic.

DO $test$
DECLARE
  v_entity uuid;
  v_execution uuid := gen_random_uuid();
  v_source uuid := gen_random_uuid();
  v_version uuid := gen_random_uuid();
  v_source_hash text := encode(gen_random_bytes(32), 'hex');
  v_pdf_hash text := encode(gen_random_bytes(32), 'hex');
  v_path text := 'tests/' || gen_random_uuid()::text || '.pdf';
  v_invitation_token text := encode(gen_random_bytes(32), 'hex');
  v_invitation_id uuid;
  v_signer uuid := gen_random_uuid();
  v_verification uuid := gen_random_uuid();
  v_evidence uuid := gen_random_uuid();
  v_signature_hash text := encode(gen_random_bytes(32), 'hex');
  v_sign_result record;
  v_staged uuid;
  v_committed uuid;
  v_rejected boolean;
  v_count integer;
BEGIN
  SELECT id INTO v_entity
  FROM public.entities
  ORDER BY id
  LIMIT 1;

  IF v_entity IS NULL THEN
    RAISE EXCEPTION
      'Fixture prerequisite missing: no entity exists';
  END IF;

  INSERT INTO public.documents (
    id,
    entity_id,
    file_name,
    mime_type,
    storage_key,
    checksum,
    document_type,
    status
  )
  VALUES (
    v_source,
    v_entity,
    'assetflow-rollback-test.pdf',
    'application/pdf',
    'tests/rollback-source.pdf',
    v_source_hash,
    'unknown',
    'approved'
  );

  INSERT INTO public.executions (
    id,
    source_type,
    source_id,
    version,
    snapshot,
    status,
    provider,
    signing_order,
    is_locked,
    sha_hash
  )
  VALUES (
    v_execution,
    'manual_document',
    v_source,
    1,
    '{}'::jsonb,
    'ready',
    'native',
    'sequential',
    true,
    v_source_hash
  );

  INSERT INTO public.execution_document_versions (
    id,
    execution_id,
    version,
    document_url,
    snapshot,
    status,
    document_id,
    document_checksum,
    entity_id
  )
  VALUES (
    v_version,
    v_execution,
    1,
    'test://rollback-source',
    '{}'::jsonb,
    'active',
    v_source,
    v_source_hash,
    v_entity
  );

  v_staged := public.stage_execution_signing_document(
    v_execution,
    v_version,
    v_entity,
    v_source,
    v_source_hash,
    v_pdf_hash,
    v_path,
    2,
    1024,
    'original-pdf'
  );

  IF v_staged IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.execution_signing_documents
    WHERE id = v_staged
      AND execution_id = v_execution
      AND document_version_id = v_version
      AND status = 'staged'
      AND committed_at IS NULL
      AND pdf_checksum = v_pdf_hash
  ) THEN
    RAISE EXCEPTION 'Valid PDF registration failed';
  END IF;

  RAISE NOTICE 'PASS: Valid PDF registered as staged';

  v_committed :=
    public.commit_execution_signing_document(v_staged);

  IF v_committed IS DISTINCT FROM v_staged OR NOT EXISTS (
    SELECT 1
    FROM public.execution_signing_documents
    WHERE id = v_staged
      AND status = 'committed'
      AND committed_at IS NOT NULL
      AND pdf_checksum = v_pdf_hash
  ) THEN
    RAISE EXCEPTION 'PDF commit failed';
  END IF;

  RAISE NOTICE 'PASS: PDF committed against frozen source';

  v_rejected := false;
  BEGIN
    PERFORM public.commit_execution_signing_document(v_staged);
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Duplicate commit unexpectedly succeeded';
  END IF;

  RAISE NOTICE 'PASS: Duplicate commit rejected';

  v_rejected := false;
  BEGIN
    PERFORM public.stage_execution_signing_document(
      v_execution,
      v_version,
      v_entity,
      v_source,
      v_source_hash,
      v_pdf_hash,
      'tests/' || gen_random_uuid()::text || '.pdf',
      2,
      1024,
      'original-pdf'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Second committed-version registration succeeded';
  END IF;

  RAISE NOTICE 'PASS: Second registration rejected';

  v_rejected := false;
  BEGIN
    UPDATE public.execution_signing_documents
    SET pdf_checksum = repeat('f', 64)
    WHERE id = v_staged;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Committed PDF metadata was mutable';
  END IF;

  RAISE NOTICE 'PASS: Committed PDF metadata immutable';

  v_rejected := false;
  BEGIN
    DELETE FROM public.execution_signing_documents
    WHERE id = v_staged;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Committed PDF record was deletable';
  END IF;

  RAISE NOTICE 'PASS: Committed PDF deletion rejected';

  SELECT count(*) INTO v_count
  FROM public.execution_signing_documents
  WHERE document_version_id = v_version
    AND status = 'committed';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Expected one committed PDF, found %', v_count;
  END IF;

  RAISE NOTICE
    'PASS: Exactly one committed PDF for execution version';
  INSERT INTO public.execution_participants (
    id, execution_id, participant_type, name,
    email, signing_order, status
  )
  VALUES (
    v_signer, v_execution, 'signatory',
    'AssetFlow Prepared PDF Test Signer',
    'prepared@example.invalid', 1, 'pending'
  );

  v_invitation_id := public.issue_execution_signing_invitation(
    v_execution,
    v_signer,
    v_version,
    v_invitation_token,
    now() + interval '1 hour',
    NULL
  );

  IF v_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Prepared execution invitation not issued';
  END IF;

  RAISE NOTICE 'PASS: Prepared PDF permits invitation issuance';

  IF NOT EXISTS (
    SELECT 1
    FROM public.validate_execution_signing_invitation(
      v_invitation_token
    )
    WHERE execution_id = v_execution
      AND participant_id = v_signer
      AND document_version_id = v_version
  ) THEN
    RAISE EXCEPTION 'Prepared execution invitation did not validate';
  END IF;

  RAISE NOTICE 'PASS: Prepared PDF permits invitation validation';

  INSERT INTO public.execution_signer_verifications (
    id, invitation_id, code_hash, channel,
    destination_hash, expires_at, verified_at,
    delivery_status
  )
  VALUES (
    v_verification, v_invitation_id,
    encode(gen_random_bytes(32), 'hex'),
    'email',
    encode(gen_random_bytes(32), 'hex'),
    now() + interval '10 minutes',
    now(),
    'accepted'
  );

  INSERT INTO public.execution_signature_evidence (
    id, execution_id, participant_id,
    document_version_id, invitation_id,
    verification_id, bucket_id, storage_path,
    content_sha256, content_type,
    content_length, status
  )
  VALUES (
    v_evidence, v_execution, v_signer,
    v_version, v_invitation_id, v_verification,
    'execution-evidence',
    v_execution::text || '/test/' || v_evidence::text || '.png',
    v_signature_hash, 'image/png', 128, 'staged'
  );

  UPDATE public.executions
  SET status = 'sent'
  WHERE id = v_execution;

  SELECT *
  INTO v_sign_result
  FROM public.record_execution_participant_signature(
    v_invitation_token,
    v_verification,
    v_evidence,
    'drawn',
    'assetflow-execution-consent-v1',
    'I confirm my authority to sign',
    '127.0.0.1',
    'AssetFlow prepared PDF transaction test',
    'Africa/Johannesburg'
  );

  IF v_sign_result.recorded_execution_id IS DISTINCT FROM v_execution
     OR v_sign_result.recorded_participant_id IS DISTINCT FROM v_signer
     OR v_sign_result.remaining_participants IS DISTINCT FROM 0
     OR NOT EXISTS (
       SELECT 1
       FROM public.execution_participants
       WHERE id = v_signer
         AND status = 'signed'
         AND signed_at IS NOT NULL
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.execution_signature_evidence
       WHERE id = v_evidence
         AND status = 'committed'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.execution_signing_invitations
       WHERE id = v_invitation_id
         AND consumed_at IS NOT NULL
     )
  THEN
    RAISE EXCEPTION
      'Prepared PDF signature transaction did not complete';
  END IF;

  RAISE NOTICE
    'PASS: Prepared PDF permits atomic verified signature';

END
$test$;
