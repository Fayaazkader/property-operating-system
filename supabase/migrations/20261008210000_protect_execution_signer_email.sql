BEGIN;

-- An invitation is tied to the nominated participant's email.
-- Changing that email requires revoking the invitation first.
-- This prevents an outstanding OTP from remaining valid after
-- an authorised signatory's email is changed.

CREATE OR REPLACE FUNCTION
public.prevent_execution_signer_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN

    IF EXISTS (
      SELECT 1
      FROM public.execution_signing_invitations i
      WHERE i.participant_id = OLD.id
        AND i.execution_id = OLD.execution_id
        AND i.revoked_at IS NULL
        AND i.consumed_at IS NULL
    ) THEN
      RAISE EXCEPTION
        'Revoke the signing invitation before changing the participant email';
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS
  execution_participant_email_change_guard
ON public.execution_participants;

CREATE TRIGGER execution_participant_email_change_guard
BEFORE UPDATE OF email
ON public.execution_participants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_execution_signer_email_change();

REVOKE ALL ON FUNCTION
  public.prevent_execution_signer_email_change()
FROM PUBLIC, anon, authenticated;

COMMIT;
