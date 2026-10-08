BEGIN;

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

  -- Read the invitation ID without taking a challenge row lock.
  SELECT *
  INTO v_challenge
  FROM public.execution_signer_verifications
  WHERE id = p_verification_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Use the same lock order as challenge issuance:
  -- invitation first, challenge second.
  PERFORM 1
  FROM public.execution_signing_invitations
  WHERE id = v_challenge.invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
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

REVOKE ALL ON FUNCTION public.verify_execution_verification_challenge(
  uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_execution_verification_challenge(
  uuid, text
) TO service_role;

COMMIT;
