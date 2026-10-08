BEGIN;

-- Participant-wide invitation and OTP issuance limits.
-- Replaces the existing service-role-only functions.

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
  IF current_user <> 'service_role'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

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

CREATE OR REPLACE FUNCTION public.issue_execution_email_challenge(
  p_invitation_id uuid,
  p_verification_id uuid,
  p_code_hash text,
  p_destination_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation public.execution_signing_invitations%ROWTYPE;
  v_email text;
  v_previous_challenges integer;
  v_previous_attempts integer;
  v_last_challenge_at timestamptz;
BEGIN
  IF p_verification_id IS NULL
     OR p_code_hash !~ '^[a-f0-9]{64}$'
     OR p_destination_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid verification parameters';
  END IF;

  SELECT * INTO v_invitation
  FROM public.execution_signing_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.consumed_at IS NOT NULL
     OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation unavailable';
  END IF;

  SELECT lower(btrim(p.email))
  INTO v_email
  FROM public.execution_participants p
  WHERE p.id = v_invitation.participant_id
    AND p.execution_id = v_invitation.execution_id
    AND p.status IN ('pending', 'sent', 'viewed')
  FOR UPDATE;

  IF NOT FOUND OR v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Participant email unavailable';
  END IF;

  PERFORM 1
  FROM public.executions e
  JOIN public.execution_document_versions d
    ON d.execution_id = e.id
  WHERE e.id = v_invitation.execution_id
    AND d.id = v_invitation.document_version_id
    AND e.deleted_at IS NULL
    AND e.is_locked = true
    AND e.status IN ('ready', 'sent', 'viewed', 'partially_signed')
    AND d.status = 'active'
    AND d.version = e.version
    AND NULLIF(btrim(d.document_checksum), '') IS NOT NULL
    AND d.document_checksum = e.sha_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frozen document unavailable';
  END IF;

  -- Count OTP issuance across every invitation for this participant.
  -- The participant row is already locked by this transaction.
  IF (
    SELECT count(*)
    FROM public.execution_signer_verifications v
    JOIN public.execution_signing_invitations i
      ON i.id = v.invitation_id
    WHERE i.participant_id = v_invitation.participant_id
      AND i.execution_id = v_invitation.execution_id
      AND v.created_at > now() - interval '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION 'Daily participant verification limit exceeded';
  END IF;

  IF (
    SELECT COALESCE(sum(v.attempts), 0)
    FROM public.execution_signer_verifications v
    JOIN public.execution_signing_invitations i
      ON i.id = v.invitation_id
    WHERE i.participant_id = v_invitation.participant_id
      AND i.execution_id = v_invitation.execution_id
      AND v.created_at > now() - interval '24 hours'
  ) >= 20 THEN
    RAISE EXCEPTION 'Daily participant verification attempts exceeded';
  END IF;

  SELECT count(*)::integer,
         COALESCE(sum(attempts), 0)::integer,
         max(created_at)
  INTO v_previous_challenges,
       v_previous_attempts,
       v_last_challenge_at
  FROM public.execution_signer_verifications
  WHERE invitation_id = p_invitation_id;

  IF v_previous_challenges >= 5
     OR v_previous_attempts >= 10 THEN
    RAISE EXCEPTION 'Verification limit exceeded';
  END IF;

  IF v_last_challenge_at IS NOT NULL
     AND v_last_challenge_at > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Verification cooldown active';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.execution_signer_verifications
    WHERE invitation_id = p_invitation_id
      AND verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Invitation already verified';
  END IF;

  UPDATE public.execution_signer_verifications
  SET revoked_at = now()
  WHERE invitation_id = p_invitation_id
    AND verified_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.execution_signer_verifications (
    id, invitation_id, code_hash, channel,
    destination_hash, participant_email_snapshot, expires_at
  )
  VALUES (
    p_verification_id, p_invitation_id, p_code_hash, 'email',
    p_destination_hash, v_email, now() + interval '5 minutes'
  );

  RETURN jsonb_build_object(
    'verification_id', p_verification_id,
    'destination', v_email
  );
END;
$function$;

REVOKE ALL ON FUNCTION
  public.issue_execution_signing_invitation(
    uuid, uuid, uuid, text, timestamptz, uuid
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.issue_execution_signing_invitation(
    uuid, uuid, uuid, text, timestamptz, uuid
  )
TO service_role;

REVOKE ALL ON FUNCTION
  public.issue_execution_email_challenge(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.issue_execution_email_challenge(uuid, uuid, text, text)
TO service_role;

COMMIT;
