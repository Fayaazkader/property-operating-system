BEGIN;

-- Email-only OTP issuance. The caller must supply the HMAC of the
-- nominated participant's current email, not an arbitrary destination.
-- A shared database secret is deliberately NOT introduced here:
-- the server remains responsible for HMAC generation and email delivery.
-- We bind challenges to the participant and reject changed destinations
-- during verification in the application layer.

ALTER TABLE public.execution_signer_verifications
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.execution_signer_verifications
  ADD CONSTRAINT execution_verification_delivery_status_check
  CHECK (delivery_status IN ('pending', 'accepted', 'failed'));

-- A challenge cannot verify until the email provider accepted delivery.
-- Invitation-first locking avoids inversion with challenge issuance.
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
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_code_hash IS NULL
     OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  SELECT i.id INTO v_invitation_id
  FROM public.execution_signing_invitations i
  WHERE i.token_hash = p_token_hash
    AND i.revoked_at IS NULL
    AND i.consumed_at IS NULL
    AND i.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_challenge
  FROM public.execution_signer_verifications v
  WHERE v.id = p_verification_id
    AND v.invitation_id = v_invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.channel <> 'email'
     OR v_challenge.delivery_status <> 'accepted'
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
    SELECT COALESCE(sum(v.attempts), 0)
    FROM public.execution_signer_verifications v
    WHERE v.invitation_id = v_invitation_id
  ) >= 10 THEN
    RETURN false;
  END IF;

  v_valid := v_challenge.code_hash = p_code_hash;

  UPDATE public.execution_signer_verifications v
  SET attempts = v.attempts + 1,
      verified_at = CASE WHEN v_valid THEN now() ELSE v.verified_at END,
      revoked_at = CASE
        WHEN NOT v_valid AND v.attempts + 1 >= 5 THEN now()
        ELSE v.revoked_at
      END
  WHERE v.id = p_verification_id;

  RETURN v_valid;
END;
$function$;

-- Only the server may acknowledge provider acceptance.
-- Both acknowledgement and revocation lock invitation before challenge.
CREATE OR REPLACE FUNCTION public.complete_execution_verification_delivery(
  p_verification_id uuid,
  p_accepted boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation_id uuid;
BEGIN
  SELECT v.invitation_id INTO v_invitation_id
  FROM public.execution_signer_verifications v
  WHERE v.id = p_verification_id;

  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM 1
  FROM public.execution_signing_invitations i
  WHERE i.id = v_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  IF p_accepted THEN
    UPDATE public.execution_signer_verifications v
    SET delivery_status = 'accepted'
    WHERE v.id = p_verification_id
      AND v.invitation_id = v_invitation_id
      AND v.delivery_status = 'pending'
      AND v.revoked_at IS NULL
      AND v.verified_at IS NULL
      AND v.expires_at > now()
      AND EXISTS (
        SELECT 1
        FROM public.execution_signing_invitations i
        WHERE i.id = v_invitation_id
          AND i.revoked_at IS NULL
          AND i.consumed_at IS NULL
          AND i.expires_at > now()
      );
  ELSE
    UPDATE public.execution_signer_verifications v
    SET delivery_status = 'failed',
        revoked_at = now()
    WHERE v.id = p_verification_id
      AND v.invitation_id = v_invitation_id
      AND v.delivery_status = 'pending'
      AND v.verified_at IS NULL
      AND v.revoked_at IS NULL;
  END IF;

  RETURN FOUND;
END;
$function$;

-- Retire the earlier standalone revocation function; the delivery
-- completion RPC is now the canonical delivery lifecycle boundary.
REVOKE ALL ON FUNCTION
  public.revoke_execution_verification_challenge(uuid)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.complete_execution_verification_delivery(uuid, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.complete_execution_verification_delivery(uuid, boolean)
TO service_role;

REVOKE ALL ON FUNCTION
  public.verify_execution_verification_for_invitation(text, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.verify_execution_verification_for_invitation(text, uuid, text)
TO service_role;

COMMIT;
