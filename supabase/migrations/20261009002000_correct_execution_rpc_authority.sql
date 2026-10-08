BEGIN;

-- Restrict execution through database privileges.
-- Preserve existing validation, locking and rate limits.

CREATE OR REPLACE FUNCTION public.issue_execution_signing_invitation(
  p_execution_id uuid,
  p_participant_id uuid,
  p_document_version_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_execution public.executions%ROWTYPE;
  v_document public.execution_document_versions%ROWTYPE;
  v_invitation_id uuid;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_expires_at <= now()
     OR p_expires_at > now() + interval '7 days' THEN
    RAISE EXCEPTION 'Invalid invitation parameters';
  END IF;

  SELECT *
  INTO v_execution
  FROM public.executions
  WHERE id = p_execution_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_execution.status NOT IN ('ready', 'sent', 'viewed', 'partially_signed')
     OR v_execution.is_locked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Execution is not eligible for signing invitations';
  END IF;

  SELECT *
  INTO v_document
  FROM public.execution_document_versions
  WHERE id = p_document_version_id
    AND execution_id = p_execution_id;

  IF NOT FOUND
     OR NULLIF(btrim(v_document.document_checksum), '') IS NULL
     OR v_document.status <> 'active'
     OR v_document.version <> v_execution.version
     OR v_document.document_checksum IS DISTINCT FROM v_execution.sha_hash
  THEN
    RAISE EXCEPTION 'Current frozen execution document required';
  END IF;

  PERFORM 1
  FROM public.execution_signing_invitations
  WHERE participant_id = p_participant_id
    AND consumed_at IS NULL
    AND revoked_at IS NULL
  FOR UPDATE;

  PERFORM 1
  FROM public.execution_participants
  WHERE id = p_participant_id
    AND execution_id = p_execution_id
    AND status IN ('pending', 'sent', 'viewed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant is not eligible';
  END IF;

  -- Count replacements even when earlier links were revoked.
  IF (
    SELECT count(*)
    FROM public.execution_signing_invitations
    WHERE participant_id = p_participant_id
      AND created_at > now() - interval '10 minutes'
  ) >= 2 THEN
    RAISE EXCEPTION 'Invitation replacement cooldown active';
  END IF;

  IF (
    SELECT count(*)
    FROM public.execution_signing_invitations
    WHERE participant_id = p_participant_id
      AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'Daily invitation limit exceeded';
  END IF;

  UPDATE public.execution_signing_invitations
  SET revoked_at = now()
  WHERE participant_id = p_participant_id
    AND consumed_at IS NULL
    AND revoked_at IS NULL;

  INSERT INTO public.execution_signing_invitations (
    execution_id,
    participant_id,
    document_version_id,
    token_hash,
    expires_at,
    created_by
  )
  VALUES (
    p_execution_id,
    p_participant_id,
    p_document_version_id,
    p_token_hash,
    p_expires_at,
    p_created_by
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.execution_events (
    execution_id,
    event_type,
    event_data,
    created_by
  )
  VALUES (
    p_execution_id,
    'signing_invitation_issued',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'participant_id', p_participant_id,
      'document_version_id', p_document_version_id
    ),
    p_created_by
  );

  RETURN v_invitation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_execution_signing_invitation(uuid, uuid, uuid, text, timestamptz, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_execution_signing_invitation(uuid, uuid, uuid, text, timestamptz, uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.validate_execution_signing_invitation(
  p_token_hash text
)
RETURNS TABLE (
  invitation_id uuid,
  execution_id uuid,
  participant_id uuid,
  document_version_id uuid,
  document_checksum text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.execution_id,
    i.participant_id,
    i.document_version_id,
    d.document_checksum,
    i.expires_at
  FROM public.execution_signing_invitations i
  JOIN public.executions e
    ON e.id = i.execution_id
  JOIN public.execution_participants p
    ON p.id = i.participant_id
   AND p.execution_id = i.execution_id
  JOIN public.execution_document_versions d
    ON d.id = i.document_version_id
   AND d.execution_id = i.execution_id
  WHERE i.token_hash = p_token_hash
    AND i.expires_at > now()
    AND i.consumed_at IS NULL
    AND i.revoked_at IS NULL
    AND e.deleted_at IS NULL
    AND e.is_locked = true
    AND e.status IN ('ready', 'sent', 'viewed', 'partially_signed')
    AND p.status IN ('pending', 'sent', 'viewed')
    AND d.status = 'active'
    AND d.version = e.version
    AND NULLIF(btrim(d.document_checksum), '') IS NOT NULL
    AND d.document_checksum = e.sha_hash;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_execution_signing_invitation(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.validate_execution_signing_invitation(text)
TO service_role;

COMMIT;
