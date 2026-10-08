BEGIN;

ALTER TABLE public.execution_signer_verifications
ADD COLUMN IF NOT EXISTS participant_email_snapshot text;

-- Protect the participant row and invitation together.
-- The database records the approved email at challenge creation.
CREATE OR REPLACE FUNCTION public.capture_execution_otp_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email text;
BEGIN
  SELECT lower(btrim(p.email))
  INTO v_email
  FROM public.execution_signing_invitations i
  JOIN public.execution_participants p
    ON p.id = i.participant_id
   AND p.execution_id = i.execution_id
  WHERE i.id = NEW.invitation_id
    AND i.revoked_at IS NULL
    AND i.consumed_at IS NULL
    AND i.expires_at > now()
  FOR SHARE OF p;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Nominated participant email unavailable';
  END IF;

  IF NEW.channel <> 'email' THEN
    RAISE EXCEPTION 'Only email verification is enabled';
  END IF;

  NEW.participant_email_snapshot := v_email;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER execution_otp_email_capture
BEFORE INSERT ON public.execution_signer_verifications
FOR EACH ROW
EXECUTE FUNCTION public.capture_execution_otp_email();

-- Prevent verified OTP use if the nominated email has changed.
-- This adds an independent check alongside the existing invitation guard.
CREATE OR REPLACE FUNCTION public.check_execution_otp_email(
  p_verification_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.execution_signer_verifications v
    JOIN public.execution_signing_invitations i
      ON i.id = v.invitation_id
    JOIN public.execution_participants p
      ON p.id = i.participant_id
     AND p.execution_id = i.execution_id
    WHERE v.id = p_verification_id
      AND v.participant_email_snapshot =
          lower(btrim(p.email))
      AND v.channel = 'email'
      AND v.revoked_at IS NULL
  );
$function$;

REVOKE ALL ON FUNCTION public.check_execution_otp_email(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_execution_otp_email(uuid)
TO service_role;

REVOKE ALL ON FUNCTION public.capture_execution_otp_email()
FROM PUBLIC, anon, authenticated;

COMMIT;
