-- Permit audited recovery chains without bypassing unresolved deliveries.
-- Preserve historical delivery evidence and existing authorization.

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_cancelled_execution_invitation(
    p_attempt_id uuid,
    p_document_version_id uuid,
    p_token_hash text,
    p_expires_at timestamptz,
    p_actor_id uuid,
    p_reason text,
    p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    invitation_id uuid,
    delivery_attempt_id uuid,
    recovery_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_attempt public.execution_invitation_delivery_attempts%ROWTYPE;
    v_invitation public.execution_signing_invitations%ROWTYPE;
    v_execution public.executions%ROWTYPE;
    v_participant public.execution_participants%ROWTYPE;
    v_new_invitation uuid;
    v_new_attempt uuid;
    v_recovery uuid;
BEGIN
    IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Service role required';
    END IF;

    IF p_actor_id IS NULL
       OR length(btrim(coalesce(p_reason, ''))) < 15
       OR p_evidence IS NULL
       OR jsonb_typeof(p_evidence) <> 'object'
       OR p_token_hash !~ '^[a-f0-9]{64}$'
       OR p_expires_at <= now()
       OR p_expires_at > now() + interval '7 days'
    THEN
        RAISE EXCEPTION 'Invalid recovery replacement parameters';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.execution_invitation_delivery_attempts
    WHERE id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery attempt not found';
    END IF;

    SELECT *
    INTO v_execution
    FROM public.executions
    WHERE id = v_attempt.execution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Execution not found';
    END IF;

    SELECT *
    INTO v_participant
    FROM public.execution_participants
    WHERE id = v_attempt.participant_id
      AND execution_id = v_execution.id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Participant not found';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.execution_invitation_delivery_attempts
    WHERE id = p_attempt_id
    FOR UPDATE;

    SELECT *
    INTO v_invitation
    FROM public.execution_signing_invitations
    WHERE id = v_attempt.invitation_id
      AND execution_id = v_attempt.execution_id
      AND participant_id = v_attempt.participant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation identity mismatch';
    END IF;

    IF v_attempt.status NOT IN ('pending', 'sending', 'delivery_unknown')
       OR v_invitation.revoked_at IS NULL
       OR v_invitation.consumed_at IS NOT NULL
    THEN
        RAISE EXCEPTION 'Cancelled uncertain invitation required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.execution_invitation_delivery_recoveries r
        WHERE r.delivery_attempt_id = p_attempt_id
          AND r.decision = 'cancelled'
    ) THEN
        RAISE EXCEPTION 'Audited cancellation required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.execution_invitation_delivery_recoveries r
        WHERE r.delivery_attempt_id = p_attempt_id
          AND r.decision = 'replaced'
    ) THEN
        RAISE EXCEPTION 'Recovery replacement already used';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.execution_document_versions dv
        JOIN public.leasing_opportunities lo
          ON lo.id = v_execution.source_id
         AND lo.entity_id = dv.entity_id
        WHERE dv.id = p_document_version_id
          AND dv.execution_id = v_execution.id
          AND dv.version = v_execution.version
          AND dv.document_checksum = v_execution.sha_hash
          AND v_execution.source_type = 'leasing_opportunity'
          AND v_execution.deleted_at IS NULL
          AND public.has_entity_permission(
              p_actor_id,
              dv.entity_id,
              'leasing.execution.send'
          ) IS TRUE
    ) THEN
        RAISE EXCEPTION 'Recovery actor lacks execution authority';
    END IF;

    -- Block other unresolved attempts unless their invitation was
    -- revoked and both cancellation and replacement were audited.
    -- Historical delivery evidence remains unchanged.
    IF EXISTS (
        SELECT 1
        FROM public.execution_invitation_delivery_attempts da
        JOIN public.execution_signing_invitations prior_invitation
          ON prior_invitation.id = da.invitation_id
         AND prior_invitation.execution_id = da.execution_id
         AND prior_invitation.participant_id = da.participant_id
        WHERE da.execution_id = v_attempt.execution_id
          AND da.participant_id = v_attempt.participant_id
          AND da.id <> p_attempt_id
          AND da.status IN ('pending', 'sending', 'delivery_unknown')
          AND NOT (
              prior_invitation.revoked_at IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM public.execution_invitation_delivery_recoveries r
                  WHERE r.delivery_attempt_id = da.id
                    AND r.decision = 'cancelled'
              )
              AND EXISTS (
                  SELECT 1
                  FROM public.execution_invitation_delivery_recoveries r
                  WHERE r.delivery_attempt_id = da.id
                    AND r.decision = 'replaced'
              )
          )
    ) THEN
        RAISE EXCEPTION 'Another unresolved delivery requires review';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.execution_signing_invitations si
        WHERE si.execution_id = v_attempt.execution_id
          AND si.participant_id = v_attempt.participant_id
          AND si.consumed_at IS NULL
          AND si.revoked_at IS NULL
          AND si.expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Another active invitation exists';
    END IF;

    IF v_execution.signing_order = 'sequential'
       AND EXISTS (
           SELECT 1
           FROM public.execution_participants earlier
           WHERE earlier.execution_id = v_execution.id
             AND COALESCE(earlier.signing_order, 1)
                 < COALESCE(v_participant.signing_order, 1)
             AND earlier.signed_at IS NULL
       )
    THEN
        RAISE EXCEPTION 'Earlier signatories must sign first';
    END IF;

    -- The existing RPC retains the frozen PDF, participant eligibility,
    -- replacement cooldown, daily limits and invitation audit checks.
    v_new_invitation := public.issue_execution_signing_invitation(
        v_attempt.execution_id,
        v_attempt.participant_id,
        p_document_version_id,
        p_token_hash,
        p_expires_at,
        p_actor_id
    );

    v_new_attempt := public.reserve_execution_invitation_delivery(
        v_new_invitation,
        p_actor_id
    );

    INSERT INTO public.execution_invitation_delivery_recoveries (
        delivery_attempt_id,
        execution_id,
        invitation_id,
        participant_id,
        decision,
        reason,
        evidence,
        actor_id
    )
    VALUES (
        v_attempt.id,
        v_attempt.execution_id,
        v_attempt.invitation_id,
        v_attempt.participant_id,
        'replaced',
        p_reason,
        p_evidence || jsonb_build_object(
            'replacement_invitation_id', v_new_invitation,
            'replacement_delivery_attempt_id', v_new_attempt
        ),
        p_actor_id
    )
    RETURNING id INTO v_recovery;

    INSERT INTO public.execution_events (
        execution_id,
        event_type,
        event_data,
        created_by
    )
    VALUES (
        v_attempt.execution_id,
        'invitation_delivery_replaced_after_cancellation',
        jsonb_build_object(
            'recovery_id', v_recovery,
            'previous_invitation_id', v_attempt.invitation_id,
            'previous_delivery_attempt_id', v_attempt.id,
            'replacement_invitation_id', v_new_invitation,
            'replacement_delivery_attempt_id', v_new_attempt,
            'original_delivery_status', v_attempt.status
        ),
        p_actor_id
    );

    invitation_id := v_new_invitation;
    delivery_attempt_id := v_new_attempt;
    recovery_id := v_recovery;
    RETURN NEXT;
END;
$function$;

COMMIT;
