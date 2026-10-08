BEGIN;

CREATE TABLE public.execution_signer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  invitation_id uuid NOT NULL
    REFERENCES public.execution_signing_invitations(id)
    ON DELETE RESTRICT,

  code_hash text NOT NULL,

  channel text NOT NULL
    CHECK (channel IN ('email', 'sms')),

  destination_hash text NOT NULL,

  expires_at timestamptz NOT NULL,

  attempts integer NOT NULL DEFAULT 0
    CHECK (attempts BETWEEN 0 AND 5),

  verified_at timestamptz,
  revoked_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT execution_verification_code_hash_check
    CHECK (code_hash ~ '^[a-f0-9]{64}$'),

  CONSTRAINT execution_verification_destination_hash_check
    CHECK (destination_hash ~ '^[a-f0-9]{64}$'),

  CONSTRAINT execution_verification_expiry_check
    CHECK (expires_at > created_at),

  CONSTRAINT execution_verification_terminal_check
    CHECK (
      NOT (
        verified_at IS NOT NULL
        AND revoked_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX execution_verification_one_active
  ON public.execution_signer_verifications(invitation_id)
  WHERE verified_at IS NULL
    AND revoked_at IS NULL;

CREATE INDEX execution_verification_invitation_idx
  ON public.execution_signer_verifications(
    invitation_id,
    created_at DESC
  );

ALTER TABLE public.execution_signer_verifications
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON public.execution_signer_verifications
  FROM anon, authenticated;

GRANT ALL PRIVILEGES
  ON public.execution_signer_verifications
  TO service_role;


-- Create or replace an OTP challenge for a valid invitation.
-- The application must independently establish the participant's
-- authorised email/SMS destination and deliver the OTP securely.
CREATE OR REPLACE FUNCTION public.issue_execution_verification_challenge(
  p_invitation_id uuid,
  p_verification_id uuid,
  p_code_hash text,
  p_channel text,
  p_destination_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation public.execution_signing_invitations%ROWTYPE;
  v_previous_challenges integer;
  v_previous_attempts integer;
  v_last_challenge_at timestamptz;
BEGIN
  IF current_user <> 'service_role'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_verification_id IS NULL
     OR p_code_hash !~ '^[a-f0-9]{64}$'
     OR p_destination_hash !~ '^[a-f0-9]{64}$'
     OR p_channel NOT IN ('email', 'sms') THEN
    RAISE EXCEPTION 'Invalid verification challenge';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.execution_signing_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.consumed_at IS NOT NULL
     OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Signing invitation is not active';
  END IF;

  PERFORM 1
  FROM public.executions e
  JOIN public.execution_participants p
    ON p.execution_id = e.id
  JOIN public.execution_document_versions d
    ON d.execution_id = e.id
  WHERE e.id = v_invitation.execution_id
    AND p.id = v_invitation.participant_id
    AND d.id = v_invitation.document_version_id
    AND e.deleted_at IS NULL
    AND e.is_locked = true
    AND e.status IN ('ready', 'sent', 'viewed', 'partially_signed')
    AND p.status IN ('pending', 'sent', 'viewed')
    AND d.status = 'active'
    AND d.version = e.version
    AND NULLIF(btrim(d.document_checksum), '') IS NOT NULL
    AND d.document_checksum = e.sha_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signing invitation is not eligible';
  END IF;

  SELECT
    count(*)::integer,
    COALESCE(sum(attempts), 0)::integer,
    max(created_at)
  INTO
    v_previous_challenges,
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
    RAISE EXCEPTION 'Verification resend cooldown active';
  END IF;

  UPDATE public.execution_signer_verifications
  SET revoked_at = now()
  WHERE invitation_id = p_invitation_id
    AND verified_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.execution_signer_verifications (
    id,
    invitation_id,
    code_hash,
    channel,
    destination_hash,
    expires_at
  )
  VALUES (
    p_verification_id,
    p_invitation_id,
    p_code_hash,
    p_channel,
    p_destination_hash,
    now() + interval '5 minutes'
  );

  RETURN p_verification_id;
END;
$function$;

-- Atomic verification: a failed attempt is persisted, even when
-- the supplied hash is incorrect. No signature is committed here.
CREATE OR REPLACE FUNCTION public.verify_execution_verification_challenge(
  p_verification_id uuid,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_challenge public.execution_signer_verifications%ROWTYPE;
  v_valid boolean;
BEGIN
  IF current_user <> 'service_role'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_code_hash IS NULL
     OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.execution_signer_verifications
  WHERE id = p_verification_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.verified_at IS NOT NULL
     OR v_challenge.revoked_at IS NOT NULL
     OR v_challenge.expires_at <= now()
     OR v_challenge.attempts >= 5 THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.execution_signing_invitations
  WHERE id = v_challenge.invitation_id
  FOR UPDATE;

  PERFORM 1
  FROM public.execution_signing_invitations i
  JOIN public.executions e
    ON e.id = i.execution_id
  JOIN public.execution_participants p
    ON p.id = i.participant_id
   AND p.execution_id = i.execution_id
  JOIN public.execution_document_versions d
    ON d.id = i.document_version_id
   AND d.execution_id = i.execution_id
  WHERE i.id = v_challenge.invitation_id
    AND i.revoked_at IS NULL
    AND i.consumed_at IS NULL
    AND i.expires_at > now()
    AND e.deleted_at IS NULL
    AND e.is_locked = true
    AND e.status IN ('ready', 'sent', 'viewed', 'partially_signed')
    AND p.status IN ('pending', 'sent', 'viewed')
    AND d.status = 'active'
    AND d.version = e.version
    AND NULLIF(btrim(d.document_checksum), '') IS NOT NULL
    AND d.document_checksum = e.sha_hash;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF (
    SELECT COALESCE(sum(attempts), 0)
    FROM public.execution_signer_verifications
    WHERE invitation_id = v_challenge.invitation_id
  ) >= 10 THEN
    RETURN false;
  END IF;

  v_valid := v_challenge.code_hash = p_code_hash;

  UPDATE public.execution_signer_verifications
  SET
    attempts = attempts + 1,
    verified_at = CASE
      WHEN v_valid THEN now()
      ELSE verified_at
    END,
    revoked_at = CASE
      WHEN NOT v_valid AND attempts + 1 >= 5 THEN now()
      ELSE revoked_at
    END
  WHERE id = p_verification_id;

  RETURN v_valid;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_execution_verification_challenge(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_execution_verification_challenge(
  uuid, uuid, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.verify_execution_verification_challenge(
  uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_execution_verification_challenge(
  uuid, text
) TO service_role;

COMMIT;
