-- Revoke a failed-delivery challenge without exposing signing tokens.
-- This function is callable only through the server's service-role client.

CREATE OR REPLACE FUNCTION public.revoke_execution_verification_challenge(
  p_verification_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation_id uuid;
BEGIN
  -- Match the invitation-first lock order used by the OTP lifecycle.
  SELECT v.invitation_id
  INTO v_invitation_id
  FROM public.execution_signer_verifications AS v
  WHERE v.id = p_verification_id;

  IF v_invitation_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.execution_signing_invitations AS i
  WHERE i.id = v_invitation_id
  FOR UPDATE;

  UPDATE public.execution_signer_verifications AS v
  SET revoked_at = now()
  WHERE v.id = p_verification_id
    AND v.invitation_id = v_invitation_id
    AND v.verified_at IS NULL
    AND v.revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION
  public.revoke_execution_verification_challenge(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.revoke_execution_verification_challenge(uuid)
TO service_role;
