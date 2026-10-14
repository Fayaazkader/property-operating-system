-- AssetFlow: governed signing invitation email delivery.
-- Records provider acceptance separately from actual delivery.
-- Never store signing URLs, tokens or token hashes here.

BEGIN;

-- Enforce invitation ownership across execution and participant.
CREATE UNIQUE INDEX IF NOT EXISTS
  execution_invitation_identity_unique
  ON public.execution_signing_invitations
  (id, execution_id, participant_id);

CREATE TABLE public.execution_invitation_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  execution_id uuid NOT NULL
    REFERENCES public.executions(id) ON DELETE RESTRICT,

  invitation_id uuid NOT NULL
    REFERENCES public.execution_signing_invitations(id)
    ON DELETE RESTRICT,

  participant_id uuid NOT NULL,

  channel text NOT NULL DEFAULT 'email'
    CHECK (channel = 'email'),

  provider text NOT NULL DEFAULT 'resend'
    CHECK (provider = 'resend'),

  status text NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'provider_accepted',
        'delivered',
        'failed',
        'delivery_unknown'
      )
    ),

  provider_message_id text,

  -- A provider HTTP rejection is definitive; a timeout is not.
  failure_category text
    CHECK (
      failure_category IS NULL
      OR failure_category IN (
        'provider_rejected',
        'configuration_error',
        'delivery_bounced',
        'delivery_complained'
      )
    ),

  attempted_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,

  created_by uuid,

  CONSTRAINT execution_invitation_delivery_identity_fk
    FOREIGN KEY (execution_id, participant_id)
    REFERENCES public.execution_participants(execution_id, id),

  CONSTRAINT execution_invitation_delivery_invitation_identity_fk
    FOREIGN KEY (invitation_id, execution_id, participant_id)
    REFERENCES public.execution_signing_invitations
      (id, execution_id, participant_id),

  CONSTRAINT execution_invitation_delivery_provider_id_unique
    UNIQUE (provider, provider_message_id),

  CONSTRAINT execution_invitation_delivery_ack_check
    CHECK (
      status NOT IN ('provider_accepted', 'delivered')
      OR (
        provider_message_id IS NOT NULL
        AND acknowledged_at IS NOT NULL
      )
    ),

  CONSTRAINT execution_invitation_delivery_delivered_check
    CHECK (
      status <> 'delivered'
      OR delivered_at IS NOT NULL
    ),

  CONSTRAINT execution_invitation_delivery_failed_check
    CHECK (
      status <> 'failed'
      OR (
        failed_at IS NOT NULL
        AND failure_category IS NOT NULL
      )
    ),

  CONSTRAINT execution_invitation_delivery_failure_state_check
    CHECK (
      failure_category IS NULL
      OR status = 'failed'
    )
);

CREATE INDEX execution_invitation_delivery_execution_idx
  ON public.execution_invitation_delivery_attempts
  (execution_id, attempted_at DESC);

CREATE INDEX execution_invitation_delivery_invitation_idx
  ON public.execution_invitation_delivery_attempts
  (invitation_id, attempted_at DESC);

CREATE UNIQUE INDEX execution_invitation_delivery_one_pending
  ON public.execution_invitation_delivery_attempts(invitation_id)
  WHERE status = 'pending';

-- Delivery attempts are append-only in identity and move forward
-- through a controlled state machine. A retry requires a new attempt.
CREATE OR REPLACE FUNCTION public.guard_execution_invitation_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
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
      IF NEW.status NOT IN (
        'pending',
        'provider_accepted',
        'failed',
        'delivery_unknown'
      ) THEN
        RAISE EXCEPTION 'Invalid pending delivery transition';
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

CREATE TRIGGER guard_execution_invitation_delivery_trigger
BEFORE UPDATE ON public.execution_invitation_delivery_attempts
FOR EACH ROW
EXECUTE FUNCTION public.guard_execution_invitation_delivery();

ALTER TABLE public.execution_invitation_delivery_attempts
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.execution_invitation_delivery_attempts
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.execution_invitation_delivery_attempts
  TO service_role;


-- Reserve one initial delivery attempt per invitation.
-- A new invitation is required for a separately authorised replacement.
-- This function never exposes signing credentials.
CREATE OR REPLACE FUNCTION public.reserve_execution_invitation_delivery(
  p_invitation_id uuid,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation public.execution_signing_invitations%ROWTYPE;
  v_attempt_id uuid;
BEGIN
  SELECT *
  INTO v_invitation
  FROM public.execution_signing_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_invitation.consumed_at IS NOT NULL
     OR v_invitation.revoked_at IS NOT NULL
     OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation is not eligible for delivery';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.execution_invitation_delivery_attempts
    WHERE invitation_id = p_invitation_id
  ) THEN
    RAISE EXCEPTION 'Invitation delivery already attempted';
  END IF;

  INSERT INTO public.execution_invitation_delivery_attempts (
    execution_id,
    invitation_id,
    participant_id,
    status,
    created_by
  )
  VALUES (
    v_invitation.execution_id,
    v_invitation.id,
    v_invitation.participant_id,
    'pending',
    p_created_by
  )
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.reserve_execution_invitation_delivery(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.reserve_execution_invitation_delivery(uuid, uuid)
  TO service_role;


-- Issue an invitation and reserve its initial email delivery atomically.
-- Routine dispatch must never revoke an existing usable invitation.
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
      AND da.status IN ('pending', 'delivery_unknown')
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

REVOKE ALL ON FUNCTION
  public.issue_execution_signing_invitation_with_delivery(
    uuid, uuid, uuid, text, timestamptz, uuid
  )
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.issue_execution_signing_invitation_with_delivery(
    uuid, uuid, uuid, text, timestamptz, uuid
  )
  TO service_role;

-- All fixture changes and test results are rolled back.
DO $test$
DECLARE
  v_source public.execution_document_versions%ROWTYPE;
  v_execution uuid;
  v_document uuid;
  v_first uuid;
  v_second uuid;
  v_invitation uuid;
  v_attempt uuid;
  v_count integer;
  v_failed boolean;
  v_staged_document uuid;
BEGIN
  SELECT d.*
  INTO v_source
  FROM public.execution_document_versions d
  JOIN public.execution_signing_documents sd
    ON sd.document_version_id = d.id
   AND sd.execution_id = d.execution_id
  WHERE sd.status = 'committed'
    AND sd.committed_at IS NOT NULL
    AND d.document_id IS NOT NULL
    AND d.entity_id IS NOT NULL
    AND d.document_checksum ~ '^[a-f0-9]{64}$'
  ORDER BY sd.committed_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIXTURE UNAVAILABLE: No committed signing PDF source';
  END IF;

  INSERT INTO public.executions (
    source_type, source_id, version, snapshot, status,
    signing_order, is_locked, locked_at, sha_hash
  )
  VALUES (
    'leasing_opportunity',
    gen_random_uuid(),
    1,
    '{}'::jsonb,
    'under_review',
    'sequential',
    true,
    now(),
    v_source.document_checksum
  )
  RETURNING id INTO v_execution;

  INSERT INTO public.execution_document_versions (
    execution_id, version, document_url, snapshot, status,
    document_id, document_checksum, entity_id
  )
  VALUES (
    v_execution, 1, v_source.document_url, '{}'::jsonb, 'active',
    v_source.document_id, v_source.document_checksum, v_source.entity_id
  )
  RETURNING id INTO v_document;


  EXECUTE 'SET LOCAL ROLE service_role';

  SELECT public.stage_execution_signing_document(
    v_execution,
    v_document,
    sd.entity_id,
    sd.source_document_id,
    sd.source_checksum,
    sd.pdf_checksum,
    'rollback-test/' || gen_random_uuid()::text || '.pdf',
    sd.page_count,
    sd.content_length,
    sd.conversion_provider
  )
  INTO v_staged_document
  FROM public.execution_signing_documents sd
  WHERE sd.document_version_id = v_source.id
    AND sd.status = 'committed'
  ORDER BY sd.committed_at DESC
  LIMIT 1;

  IF v_staged_document IS NULL THEN
    RAISE EXCEPTION 'FIXTURE ERROR: Signing document not staged';
  END IF;

  PERFORM public.commit_execution_signing_document(
    v_staged_document
  );

  EXECUTE 'SET LOCAL ROLE postgres';


  INSERT INTO public.execution_participants (
    execution_id, participant_type, name, email, signing_order
  )
  VALUES (
    v_execution, 'tenant', 'Rollback Test First',
    'rollback-first@example.invalid', 1
  )
  RETURNING id INTO v_first;

  INSERT INTO public.execution_participants (
    execution_id, participant_type, name, email, signing_order
  )
  VALUES (
    v_execution, 'landlord', 'Rollback Test Second',
    'rollback-second@example.invalid', 2
  )
  RETURNING id INTO v_second;

  -- Freeze the completed test manifest before invitation issuance.
  UPDATE public.executions
  SET status = 'ready',
      ready_score = 100,
      updated_at = now()
  WHERE id = v_execution
    AND status = 'under_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIXTURE ERROR: Execution did not become ready';
  END IF;

  -- Sequential signing: second participant must wait.
  v_failed := false;
  BEGIN
    PERFORM public.issue_execution_signing_invitation_with_delivery(
      v_execution, v_second, v_document,
      repeat('a', 64), now() + interval '1 day', NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'FAIL: Sequential signing bypassed';
  END IF;

  -- Successful atomic issuance and reservation.
  SELECT x.invitation_id, x.delivery_attempt_id
  INTO v_invitation, v_attempt
  FROM public.issue_execution_signing_invitation_with_delivery(
    v_execution, v_first, v_document,
    repeat('b', 64), now() + interval '1 day', NULL
  ) x;

  IF v_invitation IS NULL OR v_attempt IS NULL THEN
    RAISE EXCEPTION 'FAIL: Atomic issuance returned missing IDs';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.execution_invitation_delivery_attempts
  WHERE id = v_attempt
    AND invitation_id = v_invitation
    AND execution_id = v_execution
    AND participant_id = v_first
    AND status = 'pending';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: Invitation delivery reservation missing';
  END IF;

  -- Duplicate issuance must not create another invitation.
  v_failed := false;
  BEGIN
    PERFORM public.issue_execution_signing_invitation_with_delivery(
      v_execution, v_first, v_document,
      repeat('c', 64), now() + interval '1 day', NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'FAIL: Duplicate invitation accepted';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.execution_signing_invitations
  WHERE execution_id = v_execution;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: Duplicate invitation left database records';
  END IF;

  -- Force reservation failure after the original invitation RPC runs.
  -- A pending delivery for the same participant must block issuance.
  UPDATE public.execution_signing_invitations
  SET revoked_at = now()
  WHERE id = v_invitation;

  v_failed := false;
  BEGIN
    PERFORM public.issue_execution_signing_invitation_with_delivery(
      v_execution, v_first, v_document,
      repeat('d', 64), now() + interval '1 day', NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'FAIL: Unresolved delivery allowed reissuance';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.execution_signing_invitations
  WHERE execution_id = v_execution;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: Failed issuance persisted an invitation';
  END IF;

  RAISE NOTICE 'PASS: Atomic issuance and reservation';
  RAISE NOTICE 'PASS: Sequential signing restriction';
  RAISE NOTICE 'PASS: Duplicate issuance rejected';
  RAISE NOTICE 'PASS: Unresolved delivery prevents reissuance';
  RAISE NOTICE 'PASS: No extra invitation persisted';
END;
$test$;

ROLLBACK;
