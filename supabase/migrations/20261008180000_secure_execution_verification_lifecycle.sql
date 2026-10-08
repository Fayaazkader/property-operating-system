BEGIN;

-- A participant may have only one successful verification
-- per invitation. A replacement invitation requires fresh OTP.
CREATE UNIQUE INDEX execution_verification_one_success
ON public.execution_signer_verifications(invitation_id)
WHERE verified_at IS NOT NULL;

-- Revoking or consuming an invitation invalidates any
-- outstanding, unverified challenges.
CREATE OR REPLACE FUNCTION public.revoke_execution_invitation_challenges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (
    (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
    OR
    (OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL)
  ) THEN
    UPDATE public.execution_signer_verifications
    SET revoked_at = now()
    WHERE invitation_id = NEW.id
      AND verified_at IS NULL
      AND revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
  execution_invitation_challenges_revoke
ON public.execution_signing_invitations;

CREATE TRIGGER execution_invitation_challenges_revoke
AFTER UPDATE OF revoked_at, consumed_at
ON public.execution_signing_invitations
FOR EACH ROW
EXECUTE FUNCTION public.revoke_execution_invitation_challenges();

REVOKE ALL ON FUNCTION public.revoke_execution_invitation_challenges()
FROM PUBLIC, anon, authenticated;

-- Prevent further OTP issuance once an invitation has already
-- completed successful verification.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_execution_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.execution_signer_verifications
    WHERE invitation_id = NEW.invitation_id
      AND verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Invitation already verified';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
  execution_verification_prevent_duplicate
ON public.execution_signer_verifications;

CREATE TRIGGER execution_verification_prevent_duplicate
BEFORE INSERT
ON public.execution_signer_verifications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_execution_verification();

REVOKE ALL ON FUNCTION public.prevent_duplicate_execution_verification()
FROM PUBLIC, anon, authenticated;

COMMIT;
