BEGIN;

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
  v_invitation_id uuid;
  v_challenge public.execution_signer_verifications%ROWTYPE;
  v_valid boolean;
BEGIN
  IF current_user <> 'service_role'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_code_hash IS NULL
     OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  SELECT id
  INTO v_invitation_id
  FROM public.execution_signing_invitations
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
    AND consumed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.execution_signer_verifications
  WHERE id = p_verification_id
    AND invitation_id = v_invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.verified_at IS NOT NULL
     OR v_challenge.revoked_at IS NOT NULL
     OR v_challenge.expires_at <= now()
     OR v_challenge.attempts >= 5 THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.validate_execution_signing_invitation(p_token_hash);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF (
    SELECT COALESCE(sum(attempts), 0)
    FROM public.execution_signer_verifications
    WHERE invitation_id = v_invitation_id
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

REVOKE ALL ON FUNCTION public.verify_execution_verification_for_invitation(
  text, uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_execution_verification_for_invitation(
  text, uuid, text
) TO service_role;

-- Retire the old verification function so callers cannot bypass
-- invitation-token binding.
REVOKE ALL ON FUNCTION public.verify_execution_verification_challenge(
  uuid, text
) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
