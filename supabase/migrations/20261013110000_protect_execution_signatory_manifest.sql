BEGIN;

CREATE OR REPLACE FUNCTION public.protect_execution_signatory_manifest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_execution_id uuid;
  v_manifest_locked boolean;
BEGIN
  -- Participants cannot be transferred between executions.
  IF TG_OP = 'UPDATE'
     AND OLD.execution_id IS DISTINCT FROM NEW.execution_id THEN
    RAISE EXCEPTION 'Changing participant execution is prohibited';
  END IF;

  v_execution_id := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.execution_id
    ELSE OLD.execution_id
  END;

  -- Do not lock the parent execution here.
  -- Governed mutation RPCs must lock execution before participant.
  SELECT *
  INTO v_execution
  FROM public.executions e
  WHERE e.id = v_execution_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution not found for participant';
  END IF;

  IF v_execution.source_type IS DISTINCT FROM 'leasing_opportunity' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    RETURN NEW;
  END IF;

  -- Nomination is the identity-freeze boundary.
  -- Readiness and subsequent states also lock the manifest.
  SELECT (
    v_execution.status IN (
      'ready',
      'sent',
      'viewed',
      'partially_signed',
      'executed',
      'activated'
    )
    OR EXISTS (
      SELECT 1
      FROM public.execution_events ev
      WHERE ev.execution_id = v_execution_id
        AND ev.event_type = 'signatories_nominated'
    )
  )
  INTO v_manifest_locked;

  IF v_manifest_locked THEN
    IF TG_OP IN ('INSERT', 'DELETE') THEN
      RAISE EXCEPTION
        'Approved execution signatories cannot be added or deleted';
    END IF;

    IF OLD.id IS DISTINCT FROM NEW.id
       OR OLD.participant_type IS DISTINCT FROM NEW.participant_type
       OR OLD.name IS DISTINCT FROM NEW.name
       OR OLD.email IS DISTINCT FROM NEW.email
       OR OLD.phone IS DISTINCT FROM NEW.phone
       OR OLD.company IS DISTINCT FROM NEW.company
       OR OLD.signing_order IS DISTINCT FROM NEW.signing_order
       OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION
        'Approved execution signatory identity is immutable';
    END IF;
  END IF;

  -- Once a signature has been recorded, its evidence-bearing
  -- participant fields cannot be rewritten.
  IF TG_OP = 'UPDATE'
     AND OLD.signed_at IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.signed_at IS DISTINCT FROM NEW.signed_at
       OR OLD.otp_verified_at IS DISTINCT FROM NEW.otp_verified_at
       OR OLD.signature_data IS DISTINCT FROM NEW.signature_data
       OR OLD.ip_address IS DISTINCT FROM NEW.ip_address
       OR OLD.user_agent IS DISTINCT FROM NEW.user_agent
     ) THEN
    RAISE EXCEPTION
      'Recorded participant signature is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS execution_signatory_manifest_guard
ON public.execution_participants;

CREATE TRIGGER execution_signatory_manifest_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.execution_participants
FOR EACH ROW
EXECUTE FUNCTION public.protect_execution_signatory_manifest();

REVOKE ALL ON FUNCTION
  public.protect_execution_signatory_manifest()
FROM PUBLIC, anon, authenticated;

COMMIT;
