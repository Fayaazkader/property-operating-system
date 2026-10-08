BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS
  execution_participants_execution_id_id_unique
  ON public.execution_participants (execution_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS
  execution_document_versions_execution_id_id_unique
  ON public.execution_document_versions (execution_id, id);

CREATE TABLE public.execution_signing_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id uuid NOT NULL
    REFERENCES public.executions(id) ON DELETE RESTRICT,

  participant_id uuid NOT NULL,

  token_hash text NOT NULL UNIQUE,

  document_version_id uuid NOT NULL,

  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,

  CONSTRAINT execution_invitation_participant_fk
    FOREIGN KEY (execution_id, participant_id)
    REFERENCES public.execution_participants (execution_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT execution_invitation_document_fk
    FOREIGN KEY (execution_id, document_version_id)
    REFERENCES public.execution_document_versions (execution_id, id)
    ON DELETE RESTRICT,

  CONSTRAINT execution_invitation_expiry_check
    CHECK (expires_at > created_at),

  CONSTRAINT execution_invitation_terminal_check
    CHECK (NOT (
      consumed_at IS NOT NULL
      AND revoked_at IS NOT NULL
    ))
);

CREATE UNIQUE INDEX execution_invitation_one_active_per_participant
  ON public.execution_signing_invitations (participant_id)
  WHERE consumed_at IS NULL
    AND revoked_at IS NULL;

CREATE INDEX execution_invitation_participant_idx
  ON public.execution_signing_invitations
  (participant_id, created_at DESC);

CREATE INDEX execution_invitation_execution_idx
  ON public.execution_signing_invitations
  (execution_id, created_at DESC);

ALTER TABLE public.execution_signing_invitations
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON public.execution_signing_invitations
  FROM anon, authenticated;

GRANT ALL PRIVILEGES
  ON public.execution_signing_invitations
  TO service_role;


-- Invitation issuance is serialised per participant.
-- Only a frozen execution document may receive an invitation.
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
  IF current_user <> 'service_role'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

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
  FROM public.execution_participants
  WHERE id = p_participant_id
    AND execution_id = p_execution_id
    AND status IN ('pending', 'sent', 'viewed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant is not eligible';
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

REVOKE ALL ON FUNCTION public.issue_execution_signing_invitation(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_execution_signing_invitation(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO service_role;


-- Resolve a signing invitation without consuming it.
-- Possession of a link is NOT identity verification or consent to sign.
-- The service-role-only function returns no plaintext token.
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
  IF current_user <> 'service_role'
     AND session_user <> 'service_role' THEN
    RAISE EXCEPTION 'Service authority required';
  END IF;

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
