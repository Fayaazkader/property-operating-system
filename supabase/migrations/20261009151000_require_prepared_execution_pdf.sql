-- AssetFlow Phase 1: require committed signing PDF.
-- Preserve existing invitation, OTP and signing invariants.
-- Apply only after 20261009150000.
BEGIN;
-- issue_execution_signing_invitation
CREATE OR REPLACE FUNCTION public.issue_execution_signing_invitation(
  p_execution_id uuid,
  p_participant_id uuid,
  p_document_version_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_document public.execution_document_versions%ROWTYPE;
  v_invitation_id uuid;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_expires_at <= now()
     OR p_expires_at > now() + interval '7 days' THEN
    RAISE EXCEPTION 'Invalid invitation parameters';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.status NOT IN ('ready', 'sent', 'viewed', 'partially_signed')
     OR v_execution.is_locked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Execution is not eligible for signing invitations';
  END IF;

  SELECT *
  INTO v_document
  FROM public.execution_document_versions
  WHERE id = p_document_version_id
    AND execution_id = p_execution_id;

  IF NOT FOUND
     OR NULLIF(btrim(v_document.document_checksum), '') IS NULL
     OR v_document.status <> 'active'
     OR v_document.version <> v_execution.version
     OR v_document.document_checksum IS DISTINCT FROM v_execution.sha_hash
  THEN
    RAISE EXCEPTION 'Current frozen execution document required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_signing_documents sd
    WHERE sd.execution_id = v_execution.id
      AND sd.document_version_id = v_document.id
      AND sd.entity_id = v_document.entity_id
      AND sd.source_document_id = v_document.document_id
      AND sd.source_checksum = v_document.document_checksum
      AND sd.status = 'committed'
      AND sd.committed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Committed signing PDF required';
  END IF;

  PERFORM 1
  FROM public.execution_signing_invitations
  WHERE participant_id = p_participant_id
    AND consumed_at IS NULL
    AND revoked_at IS NULL
  FOR UPDATE;

  PERFORM 1
  FROM public.execution_participants
  WHERE id = p_participant_id
    AND execution_id = p_execution_id
    AND status IN ('pending', 'sent', 'viewed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant is not eligible';
  END IF;

  -- Count replacements even when earlier links were revoked.
  IF (
    SELECT count(*)
    FROM public.execution_signing_invitations
    WHERE participant_id = p_participant_id
      AND created_at > now() - interval '10 minutes'
  ) >= 2 THEN
    RAISE EXCEPTION 'Invitation replacement cooldown active';
  END IF;

  IF (
    SELECT count(*)
    FROM public.execution_signing_invitations
    WHERE participant_id = p_participant_id
      AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'Daily invitation limit exceeded';
  END IF;

  UPDATE public.execution_signing_invitations
  SET revoked_at = now()
  WHERE participant_id = p_participant_id
    AND consumed_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.execution_signing_invitations (
    execution_id,
    participant_id,
    document_version_id,
    token_hash,
    expires_at,
    created_by
  )
  VALUES (
    p_execution_id,
    p_participant_id,
    p_document_version_id,
    p_token_hash,
    p_expires_at,
    p_created_by
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.execution_events (
    execution_id,
    event_type,
    event_data,
    created_by
  )
  VALUES (
    p_execution_id,
    'signing_invitation_issued',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'participant_id', p_participant_id,
      'document_version_id', p_document_version_id
    ),
    p_created_by
  );

  RETURN v_invitation_id;
END;
$function$;


-- SOURCE: supabase\migrations\20261009002000_correct_execution_rpc_authority.sql

-- validate_execution_signing_invitation
CREATE OR REPLACE FUNCTION public.validate_execution_signing_invitation(
  p_token_hash text
)
RETURNS TABLE (
  invitation_id uuid,
  execution_id uuid,
  participant_id uuid,
  document_version_id uuid,
  document_checksum text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.execution_id,
    i.participant_id,
    i.document_version_id,
    d.document_checksum,
    i.expires_at
  FROM public.execution_signing_invitations i
  JOIN public.executions e
    ON e.id = i.execution_id
  JOIN public.execution_participants p
    ON p.id = i.participant_id
   AND p.execution_id = i.execution_id
  JOIN public.execution_document_versions d
    ON d.id = i.document_version_id
   AND d.execution_id = i.execution_id
  WHERE i.token_hash = p_token_hash
    AND i.expires_at > now()
    AND i.consumed_at IS NULL
    AND i.revoked_at IS NULL
    AND e.deleted_at IS NULL
    AND e.is_locked = true
    AND e.status IN ('ready', 'sent', 'viewed', 'partially_signed')
    AND p.status IN ('pending', 'sent', 'viewed')
    AND d.status = 'active'
    AND d.version = e.version
    AND NULLIF(btrim(d.document_checksum), '') IS NOT NULL
    AND d.document_checksum = e.sha_hash
    AND EXISTS (
      SELECT 1
      FROM public.execution_signing_documents sd
      WHERE sd.execution_id = e.id
        AND sd.document_version_id = d.id
        AND sd.entity_id = d.entity_id
        AND sd.source_document_id = d.document_id
        AND sd.source_checksum = d.document_checksum
        AND sd.status = 'committed'
        AND sd.committed_at IS NOT NULL
    );
END;
$function$;


-- SOURCE: supabase\migrations\20261009140000_correct_execution_signature_authority.sql

-- record_execution_participant_signature
CREATE OR REPLACE FUNCTION public.record_execution_participant_signature(
  p_token_hash text,
  p_verification_id uuid,
  p_evidence_id uuid,
  p_signature_method text,
  p_consent_version text,
  p_authority_declaration text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_timezone text DEFAULT NULL
)
RETURNS TABLE (
  recorded_participant_id uuid,
  recorded_execution_id uuid,
  recorded_signed_at timestamptz,
  remaining_participants integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_invitation public.execution_signing_invitations%ROWTYPE;
  v_participant public.execution_participants%ROWTYPE;
  v_document public.execution_document_versions%ROWTYPE;
  v_verification public.execution_signer_verifications%ROWTYPE;
  v_evidence public.execution_signature_evidence%ROWTYPE;
  v_email text;
  v_remaining integer;
  v_signed_at timestamptz;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_evidence_id IS NULL
     OR p_verification_id IS NULL
     OR p_signature_method NOT IN ('drawn', 'typed', 'uploaded')
     OR NULLIF(btrim(p_consent_version), '') IS NULL
     OR length(p_consent_version) > 128
     OR length(COALESCE(p_authority_declaration, '')) > 2000
     OR length(COALESCE(p_ip_address, '')) > 64
     OR length(COALESCE(p_user_agent, '')) > 1024
     OR length(COALESCE(p_timezone, '')) > 100 THEN
    RAISE EXCEPTION 'Invalid signature evidence';
  END IF;

  -- Consistent lock order: execution, invitation, participant,
  -- document, verification.
  SELECT e.*
  INTO v_execution
  FROM public.executions e
  JOIN public.execution_signing_invitations i
    ON i.execution_id = e.id
  WHERE i.token_hash = p_token_hash
  FOR UPDATE OF e;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid signing invitation';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.execution_signing_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.consumed_at IS NOT NULL
     OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Signing invitation unavailable';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.execution_participants
  WHERE id = v_invitation.participant_id
    AND execution_id = v_invitation.execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_participant.status NOT IN ('pending', 'sent', 'viewed')
     OR v_participant.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Participant cannot sign';
  END IF;

  SELECT *
  INTO v_document
  FROM public.execution_document_versions
  WHERE id = v_invitation.document_version_id
    AND execution_id = v_invitation.execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.deleted_at IS NOT NULL
     OR v_execution.is_locked IS DISTINCT FROM true
     OR v_execution.status NOT IN
        ('sent', 'viewed', 'partially_signed')
     OR v_document.status <> 'active'
     OR v_document.version IS DISTINCT FROM v_execution.version
     OR NULLIF(btrim(v_document.document_checksum), '') IS NULL
     OR v_document.document_checksum IS DISTINCT FROM v_execution.sha_hash THEN
    RAISE EXCEPTION 'Execution document is not valid for signing';
  END IF;

  v_email := lower(btrim(v_participant.email));

  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_signing_documents sd
    WHERE sd.execution_id = v_execution.id
      AND sd.document_version_id = v_document.id
      AND sd.entity_id = v_document.entity_id
      AND sd.source_document_id = v_document.document_id
      AND sd.source_checksum = v_document.document_checksum
      AND sd.status = 'committed'
      AND sd.committed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Committed signing PDF required';
  END IF;

  IF NULLIF(v_email, '') IS NULL THEN
    RAISE EXCEPTION 'Participant email missing';
  END IF;

  SELECT *
  INTO v_verification
  FROM public.execution_signer_verifications
  WHERE id = p_verification_id
    AND invitation_id = v_invitation.id
  FOR UPDATE;

  IF NOT FOUND
     OR v_verification.channel <> 'email'
     OR v_verification.delivery_status <> 'accepted'
     OR v_verification.verified_at IS NULL
     OR v_verification.revoked_at IS NOT NULL
     OR v_verification.participant_email_snapshot IS DISTINCT FROM v_email
     OR v_verification.verified_at < v_verification.created_at
     OR v_verification.verified_at > now() THEN
    RAISE EXCEPTION 'Verified email challenge required';
  END IF;

  -- Bind a pre-verified, private evidence object to the exact
  -- invitation, participant, document and OTP verification.
  SELECT *
  INTO v_evidence
  FROM public.execution_signature_evidence
  WHERE id = p_evidence_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_evidence.status <> 'staged'
     OR v_evidence.committed_at IS NOT NULL
     OR v_evidence.execution_id <> v_execution.id
     OR v_evidence.participant_id <> v_participant.id
     OR v_evidence.document_version_id <> v_document.id
     OR v_evidence.invitation_id <> v_invitation.id
     OR v_evidence.verification_id <> v_verification.id
     OR v_evidence.bucket_id <> 'execution-evidence'
     OR NULLIF(btrim(v_evidence.storage_path), '') IS NULL THEN
    RAISE EXCEPTION 'Valid staged signature evidence required';
  END IF;

  -- An execution must have an explicit participant manifest.
  IF NOT EXISTS (
    SELECT 1
    FROM public.execution_participants
    WHERE execution_id = v_execution.id
  ) THEN
    RAISE EXCEPTION 'Execution participant manifest missing';
  END IF;

  -- Sequential signing: no higher-order participant may sign while
  -- an earlier-order participant remains unsigned.
  IF v_execution.signing_order = 'sequential'
     AND EXISTS (
       SELECT 1
       FROM public.execution_participants earlier
       WHERE earlier.execution_id = v_execution.id
         AND COALESCE(earlier.signing_order, 1)
             < COALESCE(v_participant.signing_order, 1)
         AND earlier.signed_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Earlier signatories must sign first';
  END IF;

  v_signed_at := clock_timestamp();

  UPDATE public.execution_participants
  SET status = 'signed',
      signed_at = v_signed_at,
      otp_verified_at = v_verification.verified_at,
      ip_address = p_ip_address,
      user_agent = p_user_agent,
      signature_data = jsonb_build_object(
        'schema_version', 1,
        'method', p_signature_method,
        'evidence_id', v_evidence.id,
        'signature_sha256', v_evidence.content_sha256,
        'document_version_id', v_document.id,
        'document_checksum', v_document.document_checksum,
        'invitation_id', v_invitation.id,
        'verification_id', v_verification.id,
        'verified_at', v_verification.verified_at,
        'signed_at', v_signed_at,
        'consent_version', p_consent_version,
        'authority_declaration', p_authority_declaration,
        'timezone', p_timezone
      ),
      updated_at = v_signed_at
  WHERE id = v_participant.id
    AND execution_id = v_execution.id;

  UPDATE public.execution_signature_evidence
  SET status = 'committed',
      committed_at = v_signed_at
  WHERE id = v_evidence.id
    AND status = 'staged';

  UPDATE public.execution_signing_invitations
  SET consumed_at = v_signed_at
  WHERE id = v_invitation.id
    AND consumed_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.execution_events (
    execution_id,
    event_type,
    event_data,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    v_execution.id,
    'signed',
    jsonb_build_object(
      'participant_id', v_participant.id,
      'invitation_id', v_invitation.id,
      'verification_id', v_verification.id,
      'document_version_id', v_document.id,
      'document_checksum', v_document.document_checksum,
      'evidence_id', v_evidence.id,
      'signature_sha256', v_evidence.content_sha256,
      'signature_method', p_signature_method,
      'consent_version', p_consent_version,
      'signed_at', v_signed_at
    ),
    p_ip_address,
    p_user_agent,
    v_signed_at
  );

  SELECT count(*)::integer
  INTO v_remaining
  FROM public.execution_participants
  WHERE execution_id = v_execution.id
    AND signed_at IS NULL;

  -- Even when everyone has signed, execution is NOT complete.
  -- The signed PDF, certificate and evidence must be assembled
  -- and durably verified by a separate governed finalisation step.
  UPDATE public.executions
  SET status = 'partially_signed',
      updated_at = v_signed_at
  WHERE id = v_execution.id;

  recorded_participant_id := v_participant.id;
  recorded_execution_id := v_execution.id;
  recorded_signed_at := v_signed_at;
  remaining_participants := v_remaining;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_execution_signing_invitation(uuid,uuid,uuid,text,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_execution_signing_invitation(uuid,uuid,uuid,text,timestamptz,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.validate_execution_signing_invitation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_execution_signing_invitation(text) TO service_role;

REVOKE ALL ON FUNCTION public.record_execution_participant_signature(text,uuid,uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_execution_participant_signature(text,uuid,uuid,text,text,text,text,text,text) TO service_role;
COMMIT;
