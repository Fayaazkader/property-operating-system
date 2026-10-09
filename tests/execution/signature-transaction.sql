-- AssetFlow Phase 1: verified signature transaction regression test.
-- Synthetic records only. All changes must be rolled back.
-- Run only with an explicit outer transaction and ON_ERROR_STOP.
-- Never run this file with automatic commits.

DO $test$
DECLARE
  v_execution uuid := gen_random_uuid();
  v_participant uuid := gen_random_uuid();
  v_document uuid := gen_random_uuid();
  v_invitation uuid := gen_random_uuid();
  v_verification uuid := gen_random_uuid();
  v_evidence uuid := gen_random_uuid();

  v_token_hash text := encode(gen_random_bytes(32), 'hex');
  v_document_hash text := encode(gen_random_bytes(32), 'hex');
  v_signature_hash text := encode(gen_random_bytes(32), 'hex');

  v_result record;
  v_duplicate_rejected boolean := false;
  v_event_count integer;
BEGIN
  INSERT INTO public.executions (
    id, source_type, source_id, version, snapshot,
    status, provider, signing_order, is_locked, sha_hash
  )
  VALUES (
    v_execution, 'manual_document', gen_random_uuid(),
    1, '{}'::jsonb, 'sent', 'native',
    'sequential', true, v_document_hash
  );

  INSERT INTO public.execution_participants (
    id, execution_id, participant_type, name,
    email, signing_order, status
  )
  VALUES (
    v_participant, v_execution, 'signatory',
    'AssetFlow Test Signer',
    'signer@example.invalid', 1, 'sent'
  );

  INSERT INTO public.execution_document_versions (
    id, execution_id, version, document_url,
    snapshot, status, document_checksum
  )
  VALUES (
    v_document, v_execution, 1,
    'test://frozen-document',
    '{}'::jsonb, 'active', v_document_hash
  );

  INSERT INTO public.execution_signing_invitations (
    id, execution_id, participant_id,
    document_version_id, token_hash, expires_at
  )
  VALUES (
    v_invitation, v_execution, v_participant,
    v_document, v_token_hash, now() + interval '1 hour'
  );

  INSERT INTO public.execution_signer_verifications (
    id, invitation_id, code_hash, channel,
    destination_hash, expires_at, verified_at,
    delivery_status
  )
  VALUES (
    v_verification, v_invitation,
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
    v_evidence, v_execution, v_participant,
    v_document, v_invitation, v_verification,
    'execution-evidence',
    v_execution::text || '/test/' || v_evidence::text || '.png',
    v_signature_hash, 'image/png', 128, 'staged'
  );

  SELECT *
  INTO v_result
  FROM public.record_execution_participant_signature(
    v_token_hash,
    v_verification,
    v_evidence,
    'drawn',
    'assetflow-execution-consent-v1',
    'I confirm my authority to sign',
    '127.0.0.1',
    'AssetFlow transaction test',
    'Africa/Johannesburg'
  );

  IF v_result.recorded_execution_id IS DISTINCT FROM v_execution
     OR v_result.recorded_participant_id IS DISTINCT FROM v_participant
     OR v_result.remaining_participants IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Signing RPC returned incorrect result';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.execution_participants
    WHERE id = v_participant
      AND status = 'signed'
      AND signed_at IS NOT NULL
      AND signature_data->>'evidence_id' = v_evidence::text
  ) THEN
    RAISE EXCEPTION 'Participant signature not committed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.execution_signature_evidence
    WHERE id = v_evidence
      AND status = 'committed'
      AND committed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Evidence not committed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.execution_signing_invitations
    WHERE id = v_invitation AND consumed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Invitation not consumed';
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.execution_events
  WHERE execution_id = v_execution
    AND event_type = 'signed';

  IF v_event_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one signing event';
  END IF;

  BEGIN
    PERFORM *
    FROM public.record_execution_participant_signature(
      v_token_hash,
      v_verification,
      v_evidence,
      'drawn',
      'assetflow-execution-consent-v1'
    );
  EXCEPTION WHEN OTHERS THEN
    v_duplicate_rejected := true;
  END;

  IF NOT v_duplicate_rejected THEN
    RAISE EXCEPTION 'Duplicate signature was accepted';
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.execution_events
  WHERE execution_id = v_execution
    AND event_type = 'signed';

  IF v_event_count <> 1 THEN
    RAISE EXCEPTION 'Duplicate attempt modified signing events';
  END IF;

  RAISE NOTICE
    'PASS: Signature recorded atomically; duplicate rejected; one signing event';
END;
$test$;
