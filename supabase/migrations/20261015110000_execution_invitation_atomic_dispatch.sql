-- AssetFlow: atomic ownership of invitation email dispatch.
-- A committed claim authorizes one provider submission attempt.
-- Ambiguous provider outcomes must never be retried automatically.

BEGIN;

ALTER TABLE public.execution_invitation_delivery_attempts
  DROP CONSTRAINT IF EXISTS
    execution_invitation_delivery_attempts_status_check;

ALTER TABLE public.execution_invitation_delivery_attempts
  ADD CONSTRAINT execution_invitation_delivery_attempts_status_check
  CHECK (
    status IN (
      'pending',
      'sending',
      'provider_accepted',
      'delivered',
      'failed',
      'delivery_unknown'
    )
  );

-- Treat pending and sending as unresolved delivery states.
DROP INDEX public.execution_invitation_delivery_one_pending;

CREATE UNIQUE INDEX execution_invitation_delivery_one_pending
  ON public.execution_invitation_delivery_attempts(invitation_id)
  WHERE status IN ('pending', 'sending');

CREATE OR REPLACE FUNCTION public.guard_execution_invitation_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('delivered', 'failed')
       AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Terminal delivery record is immutable';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.execution_id IS DISTINCT FROM OLD.execution_id
       OR NEW.invitation_id IS DISTINCT FROM OLD.invitation_id
       OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
       OR NEW.channel IS DISTINCT FROM OLD.channel
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.attempted_at IS DISTINCT FROM OLD.attempted_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Delivery attempt identity is immutable';
    END IF;

    IF OLD.status = 'pending' THEN
      IF NEW.status NOT IN ('pending', 'sending') THEN
        RAISE EXCEPTION 'Invalid pending delivery transition';
      END IF;
    ELSIF OLD.status = 'sending' THEN
      IF NEW.status NOT IN (
        'sending',
        'provider_accepted',
        'failed',
        'delivery_unknown'
      ) THEN
        RAISE EXCEPTION 'Invalid sending delivery transition';
      END IF;
    ELSIF OLD.status = 'provider_accepted' THEN
      IF NEW.status NOT IN (
        'provider_accepted',
        'delivered',
        'failed'
      ) THEN
        RAISE EXCEPTION 'Invalid accepted delivery transition';
      END IF;
    ELSIF OLD.status = 'delivery_unknown' THEN
      IF NEW.status NOT IN (
        'delivery_unknown',
        'provider_accepted',
        'failed'
      ) THEN
        RAISE EXCEPTION 'Invalid unknown delivery transition';
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Terminal delivery state is immutable';
    END IF;

    IF OLD.provider_message_id IS NOT NULL
       AND NEW.provider_message_id
         IS DISTINCT FROM OLD.provider_message_id THEN
      RAISE EXCEPTION 'Provider message identity is immutable';
    END IF;

    IF OLD.acknowledged_at IS NOT NULL
       AND NEW.acknowledged_at
         IS DISTINCT FROM OLD.acknowledged_at THEN
      RAISE EXCEPTION 'Provider acknowledgement is immutable';
    END IF;

    IF OLD.delivered_at IS NOT NULL
       AND NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
      RAISE EXCEPTION 'Delivery timestamp is immutable';
    END IF;

    IF OLD.failed_at IS NOT NULL
       AND NEW.failed_at IS DISTINCT FROM OLD.failed_at THEN
      RAISE EXCEPTION 'Failure timestamp is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION
  public.claim_execution_invitation_email_dispatch(
    p_delivery_attempt_id uuid
  )
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_attempt public.execution_invitation_delivery_attempts%ROWTYPE;
  v_invitation public.execution_signing_invitations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.execution_invitation_delivery_attempts
  WHERE id = p_delivery_attempt_id
  FOR UPDATE;

  IF NOT FOUND OR v_attempt.status <> 'pending' THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.execution_signing_invitations
  WHERE id = v_attempt.invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.execution_id <> v_attempt.execution_id
     OR v_invitation.participant_id <> v_attempt.participant_id
     OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.consumed_at IS NOT NULL
     OR v_invitation.expires_at <= now() THEN
    RETURN false;
  END IF;

  UPDATE public.execution_invitation_delivery_attempts
  SET status = 'sending'
  WHERE id = p_delivery_attempt_id
    AND status = 'pending';

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.claim_execution_invitation_email_dispatch(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.claim_execution_invitation_email_dispatch(uuid)
  TO service_role;

COMMIT;
