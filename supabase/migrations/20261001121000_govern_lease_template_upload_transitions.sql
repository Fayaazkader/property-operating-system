-- Govern lease-template upload-attempt state transitions.
--
-- Important:
--   * Failure does not release a reservation.
--   * Only verified cleanup may produce cleaned_up.
--   * Only attach_lease_template_source may produce attached.
--   * Expiry permits later recovery inspection/takeover; it does not imply
--     that resources are safe to delete.
--   * Failure reasons remain durable for audit/support purposes.

BEGIN;

COMMENT ON INDEX public.idx_lease_template_upload_attempts_active_checksum IS
'Prevents another active reservation for the same entity/source checksum. Failed and reconciliation-required attempts intentionally continue blocking until verified cleanup changes the attempt to cleaned_up.';

COMMENT ON INDEX public.idx_lease_template_upload_attempts_active_template IS
'Prevents another active upload targeting the same lease template. Failed and reconciliation-required attempts intentionally continue blocking until verified cleanup changes the attempt to cleaned_up.';

CREATE FUNCTION public.transition_lease_template_upload_attempt(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_status text,
    p_new_status text,
    p_error_code text DEFAULT NULL,
    p_error_message text DEFAULT NULL
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_error_code text;
    v_error_message text;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_status IS NULL
       OR p_new_status IS NULL
    THEN
        RAISE EXCEPTION 'Upload transition parameters are required'
            USING ERRCODE = '22023';
    END IF;

    -- Authority is evaluated again inside the database boundary.
    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = p_actor_id
          AND uea.entity_id = p_entity_id
    )
       OR public.has_entity_permission(
            p_actor_id,
            p_entity_id,
            'leasing.template.edit'
          ) IS DISTINCT FROM TRUE
    THEN
        RAISE EXCEPTION 'Lease-template upload transition access denied'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts
    WHERE id = p_attempt_id
      AND entity_id = p_entity_id
      AND actor_id = p_actor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload attempt not found or mismatched'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_attempt.status IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION
            'Upload attempt state changed: expected %, found %',
            p_expected_status,
            v_attempt.status
            USING ERRCODE = '40001';
    END IF;

    -- attached is owned exclusively by the atomic attachment RPC.
    -- cleaned_up is owned exclusively by the future verified-cleanup RPC.
    IF p_new_status IN ('attached', 'cleaned_up') THEN
        RAISE EXCEPTION
            'Status % requires its dedicated governed operation',
            p_new_status
            USING ERRCODE = '42501';
    END IF;

    -- Explicit state machine. No backward/arbitrary transitions.
    IF NOT (
        (p_expected_status = 'reserved'
            AND p_new_status IN (
                'processing',
                'failed',
                'reconciliation_required'
            ))
        OR
        (p_expected_status = 'processing'
            AND p_new_status IN (
                'attaching',
                'failed',
                'reconciliation_required'
            ))
        OR
        (p_expected_status = 'attaching'
            AND p_new_status IN (
                'failed',
                'reconciliation_required'
            ))
        OR
        (p_expected_status = 'failed'
            AND p_new_status = 'reconciliation_required')
    ) THEN
        RAISE EXCEPTION
            'Invalid lease-template upload transition: % -> %',
            p_expected_status,
            p_new_status
            USING ERRCODE = '23514';
    END IF;

    IF p_new_status IN ('failed', 'reconciliation_required') THEN
        v_error_code = NULLIF(
            left(btrim(COALESCE(p_error_code, '')), 100),
            ''
        );
        v_error_message = NULLIF(
            left(btrim(COALESCE(p_error_message, '')), 1000),
            ''
        );

        IF v_error_code IS NULL OR v_error_message IS NULL THEN
            RAISE EXCEPTION
                'Failure and reconciliation states require an error code and message'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        v_error_code = NULL;
        v_error_message = NULL;
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET status = p_new_status,
        error_code = v_error_code,
        error_message = v_error_message,
        lease_expires_at = CASE
            WHEN p_new_status IN ('processing', 'attaching')
                THEN now() + interval '30 minutes'
            WHEN p_new_status IN ('failed', 'reconciliation_required')
                THEN NULL
            ELSE lease_expires_at
        END,
        updated_at = now()
    WHERE id = v_attempt.id
      AND status = p_expected_status
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload transition lost concurrent state change'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.transition_lease_template_upload_attempt(
        uuid,
        uuid,
        uuid,
        text,
        text,
        text,
        text
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.transition_lease_template_upload_attempt(
        uuid,
        uuid,
        uuid,
        text,
        text,
        text,
        text
    )
TO service_role;


-- ---------------------------------------------------------------------------
-- Failure-boundary reconciliation command.
--
-- The application may lose certainty about the last committed state after an
-- exception or network failure. Resolve that uncertainty under a database row
-- lock rather than performing an inspect-then-update race in application code.
--
-- Terminal attached/cleaned_up states are never overwritten here.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.mark_lease_template_upload_for_reconciliation(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_error_code text,
    p_error_message text
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_error_code text;
    v_error_message text;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
    THEN
        RAISE EXCEPTION 'Upload reconciliation identifiers are required'
            USING ERRCODE = '22023';
    END IF;

    v_error_code := NULLIF(
        left(btrim(COALESCE(p_error_code, '')), 100),
        ''
    );

    v_error_message := NULLIF(
        left(btrim(COALESCE(p_error_message, '')), 1000),
        ''
    );

    IF v_error_code IS NULL OR v_error_message IS NULL THEN
        RAISE EXCEPTION
            'Upload reconciliation requires an error code and message'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = p_actor_id
          AND uea.entity_id = p_entity_id
    )
       OR public.has_entity_permission(
            p_actor_id,
            p_entity_id,
            'leasing.template.edit'
          ) IS DISTINCT FROM TRUE
    THEN
        RAISE EXCEPTION 'Lease-template upload reconciliation access denied'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts
    WHERE id = p_attempt_id
      AND entity_id = p_entity_id
      AND actor_id = p_actor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload attempt not found or mismatched'
            USING ERRCODE = 'P0002';
    END IF;

    -- Never overwrite a successfully attached attempt or a future
    -- verified-cleanup terminal state. Returning the durable row lets the
    -- caller distinguish those outcomes without creating a second race.
    IF v_attempt.status IN ('attached', 'cleaned_up') THEN
        RETURN v_attempt;
    END IF;

    IF v_attempt.status NOT IN (
        'reserved',
        'processing',
        'attaching',
        'failed',
        'reconciliation_required'
    ) THEN
        RAISE EXCEPTION
            'Unsupported upload state for reconciliation: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET status = 'reconciliation_required',
        error_code = v_error_code,
        error_message = v_error_message,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE id = v_attempt.id
    RETURNING * INTO v_attempt;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.mark_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        text,
        text
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.mark_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        text,
        text
    )
TO service_role;

COMMENT ON FUNCTION public.mark_lease_template_upload_for_reconciliation(
    uuid,
    uuid,
    uuid,
    text,
    text
) IS
'Atomically records an uncertain lease-template upload outcome under row lock. Active/nonterminal attempts become reconciliation_required; attached and cleaned_up terminal attempts are returned unchanged and are never overwritten.';

COMMIT;
