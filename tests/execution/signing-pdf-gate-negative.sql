-- Requires an outer transaction, service_role and ON_ERROR_STOP.
-- Synthetic records only; all changes must roll back.

DO $test$
DECLARE
  v_execution uuid := gen_random_uuid();
  v_participant uuid := gen_random_uuid();
  v_version uuid := gen_random_uuid();
  v_invitation uuid := gen_random_uuid();
  v_verification uuid := gen_random_uuid();
  v_evidence uuid := gen_random_uuid();

  v_token_hash text := encode(gen_random_bytes(32), 'hex');
  v_document_hash text := encode(gen_random_bytes(32), 'hex');
  v_signature_hash text := encode(gen_random_bytes(32), 'hex');

  v_rejected boolean := false;
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
    'AssetFlow Gate Test',
    'gate@example.invalid', 1, 'sent'
  );

  INSERT INTO public.execution_document_versions (
    id, execution_id, version, document_url,
    snapshot, status, document_checksum
  )
  VALUES (
    v_version, v_execution, 1,
    'test://frozen-document',
    '{}'::jsonb, 'active', v_document_hash
  );

  INSERT INTO public.execution_signing_invitations (
    id, execution_id, participant_id,
    document_version_id, token_hash, expires_at
  )
  VALUES (
    v_invitation, v_execution, v_participant,
    v_version, v_token_hash, now() + interval '1 hour'
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
    v_version, v_invitation, v_verification,
    'execution-evidence',
    v_execution::text || '/test/' || v_evidence::text || '.png',
    v_signature_hash, 'image/png', 128, 'staged'
  );

  -- An invitation without a committed PDF must not validate.
  IF EXISTS (
    SELECT 1
    FROM public.validate_execution_signing_invitation(
      v_token_hash
    )
  ) THEN
    RAISE EXCEPTION
      'Invitation validated without committed signing PDF';
  END IF;

  RAISE NOTICE
    'PASS: Invitation validation requires committed PDF';

  -- Even if a legacy invitation exists, signing must fail.
  BEGIN
    PERFORM *
    FROM public.record_execution_participant_signature(
      v_token_hash,
      v_verification,
      v_evidence,
      'drawn',
      'assetflow-execution-consent-v1',
      'I confirm my authority to sign',
      '127.0.0.1',
      'AssetFlow PDF gate test',
      'Africa/Johannesburg'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Committed signing PDF required%' THEN
      RAISE EXCEPTION
        'Unexpected signature rejection: %', SQLERRM;
    END IF;

    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION
      'Signature recorded without committed signing PDF';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.execution_participants
    WHERE id = v_participant
      AND signed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.execution_signature_evidence
    WHERE id = v_evidence
      AND status = 'committed'
  ) THEN
    RAISE EXCEPTION
      'Rejected signature caused persistent state changes';
  END IF;

  RAISE NOTICE
    'PASS: Signature recording requires committed PDF';

  RAISE NOTICE
    'PASS: Rejected signing leaves participant and evidence unchanged';
END
$test$;
