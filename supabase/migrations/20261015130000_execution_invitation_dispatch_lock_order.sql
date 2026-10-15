-- Align atomic dispatch with recovery lock ordering.
-- Sending is unresolved and must block ordinary reissuance.

BEGIN;

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

  -- Read identity without taking a delivery-attempt row lock.
  SELECT *
  INTO v_attempt
  FROM public.execution_invitation_delivery_attempts
  WHERE id = p_delivery_attempt_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Match recovery's execution -> participant -> attempt lock order.
  PERFORM 1
  FROM public.executions
  WHERE id = v_attempt.execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.execution_participants
  WHERE id = v_attempt.participant_id
    AND execution_id = v_attempt.execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
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

CREATE OR REPLACE FUNCTION
  public.issue_execution_signing_invitation_with_delivery(
    p_execution_id uuid,
    p_participant_id uuid,
    p_document_version_id uuid,
    p_token_hash text,
    p_expires_at timestamptz,
    p_created_by uuid
  )
RETURNS TABLE (
  invitation_id uuid,
  delivery_attempt_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_participant public.execution_participants%ROWTYPE;
  v_invitation_id uuid;
  v_attempt_id uuid;
BEGIN
  -- Serialise all dispatch requests for this execution.
  SELECT *
  INTO v_execution
  FROM public.executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution not found';
  END IF;

  SELECT *
  INTO v_participant
  FROM public.execution_participants
  WHERE id = p_participant_id
    AND execution_id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  -- A usable invitation must never be silently replaced.
  IF EXISTS (
    SELECT 1
    FROM public.execution_signing_invitations
    WHERE execution_id = p_execution_id
      AND participant_id = p_participant_id
      AND consumed_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Active invitation already exists';
  END IF;

  -- Unresolved delivery outcomes require manual reconciliation.
  -- Historical accepted or delivered invitations do not permanently
  -- block reissue once their signing invitation is no longer usable.
  IF EXISTS (
    SELECT 1
    FROM public.execution_invitation_delivery_attempts da
    WHERE da.execution_id = p_execution_id
      AND da.participant_id = p_participant_id
      AND da.status IN ('pending', 'sending', 'delivery_unknown')
  ) THEN
    RAISE EXCEPTION 'Unresolved delivery requires review';
  END IF;

  -- Enforce the frozen participant signing sequence.
  IF v_execution.signing_order = 'sequential'
     AND EXISTS (
       SELECT 1
       FROM public.execution_participants earlier
       WHERE earlier.execution_id = p_execution_id
         AND COALESCE(earlier.signing_order, 1)
             < COALESCE(v_participant.signing_order, 1)
         AND earlier.signed_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Earlier signatories must sign first';
  END IF;

  -- Existing RPC retains the document, PDF, eligibility,
  -- cooldown, invitation and audit-event checks.
  v_invitation_id :=
    public.issue_execution_signing_invitation(
      p_execution_id,
      p_participant_id,
      p_document_version_id,
      p_token_hash,
      p_expires_at,
      p_created_by
    );

  v_attempt_id :=
    public.reserve_execution_invitation_delivery(
      v_invitation_id,
      p_created_by
    );

  invitation_id := v_invitation_id;
  delivery_attempt_id := v_attempt_id;
  RETURN NEXT;
END;
$function$;

COMMIT;
