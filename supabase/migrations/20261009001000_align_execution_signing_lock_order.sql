BEGIN;

-- Align OTP issuance and verification with invitation replacement:
-- execution -> invitation -> participant -> verification.
-- Enforce participant-wide verification attempt limits at commit time.

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

  -- Serialize with invitation replacement before locking the invitation.
  PERFORM 1
  FROM public.executions e
  JOIN public.execution_signing_invitations i
    ON i.execution_id = e.id
  WHERE i.id = p_invitation_id
  FOR UPDATE OF e;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution unavailable';
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

CREATE OR REPLACE FUNCTION public.verify_execution_verification_for_invitation(
  p_token_hash text,
  p_verification_id uuid,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation public.execution_signing_invitations%ROWTYPE;
  v_challenge public.execution_signer_verifications%ROWTYPE;
  v_email text;
  v_valid boolean;
BEGIN
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_code_hash IS NULL
     OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  -- Serialize with invitation replacement before locking the invitation.
  PERFORM 1
  FROM public.executions e
  JOIN public.execution_signing_invitations i
    ON i.execution_id = e.id
  WHERE i.token_hash = p_token_hash
  FOR UPDATE OF e;

  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_invitation
  FROM public.execution_signing_invitations
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
    AND consumed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  SELECT lower(btrim(email))
  INTO v_email
  FROM public.execution_participants
  WHERE id = v_invitation.participant_id
    AND execution_id = v_invitation.execution_id
    AND status IN ('pending', 'sent', 'viewed')
  FOR UPDATE;

  IF NOT FOUND OR v_email IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_challenge
  FROM public.execution_signer_verifications
  WHERE id = p_verification_id
    AND invitation_id = v_invitation.id
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.channel <> 'email'
     OR v_challenge.delivery_status <> 'accepted'
     OR v_challenge.participant_email_snapshot IS DISTINCT FROM v_email
     OR v_challenge.verified_at IS NOT NULL
     OR v_challenge.revoked_at IS NOT NULL
     OR v_challenge.expires_at <= now()
     OR v_challenge.attempts >= 5 THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.validate_execution_signing_invitation(p_token_hash);

  IF NOT FOUND THEN RETURN false; END IF;

  IF (
    SELECT COALESCE(sum(attempts), 0)
    FROM public.execution_signer_verifications
    WHERE invitation_id = v_invitation.id
  ) >= 10 THEN
    RETURN false;
  END IF;

  -- Enforce the participant-wide attempt limit at verification time.
  -- The participant row is locked, serializing competing OTP attempts.
  IF (
    SELECT COALESCE(sum(v.attempts), 0)
    FROM public.execution_signer_verifications v
    JOIN public.execution_signing_invitations i
      ON i.id = v.invitation_id
    WHERE i.participant_id = v_invitation.participant_id
      AND i.execution_id = v_invitation.execution_id
      AND v.created_at > now() - interval '24 hours'
  ) >= 20 THEN
    RETURN false;
  END IF;

  v_valid := v_challenge.code_hash = p_code_hash;

  UPDATE public.execution_signer_verifications
  SET attempts = attempts + 1,
      verified_at = CASE WHEN v_valid THEN now() ELSE verified_at END,
      revoked_at = CASE
        WHEN NOT v_valid AND attempts + 1 >= 5 THEN now()
        ELSE revoked_at
      END
  WHERE id = p_verification_id;

  RETURN v_valid;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.issue_execution_email_challenge(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.issue_execution_email_challenge(uuid, uuid, text, text)
TO service_role;

REVOKE ALL ON FUNCTION
  public.verify_execution_verification_for_invitation(text, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.verify_execution_verification_for_invitation(text, uuid, text)
TO service_role;

COMMIT;
