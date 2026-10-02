-- Recovery-owned diagnostic transition for lease-template uploads.
--
-- A recovery claim deliberately preserves the interrupted upload's diagnostic
-- status while incrementing its fencing generation and granting a new
-- time-bounded recovery lease.
--
-- Once claimed inspection establishes that the attempt must be reconciled
-- rather than resumed/attached, recovery needs to move reserved/processing/
-- attaching into reconciliation_required WITHOUT surrendering that recovery
-- ownership. The normal-worker reconciliation RPC cannot be used here because
-- it clears lease_expires_at.
--
-- This operation changes diagnostic state only. It does not inspect or mutate
-- Storage, attach a source, delete a canonical document, or mark cleaned_up.

BEGIN;

CREATE FUNCTION public.mark_claimed_lease_template_upload_for_reconciliation(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_generation bigint,
    p_error_code text,
    p_error_message text
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_template public.lease_templates%ROWTYPE;
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_error_code text;
    v_error_message text;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
    THEN
        RAISE EXCEPTION
            'Claimed reconciliation identifiers and generation are required'
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
            'Claimed reconciliation requires an error code and message'
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
        RAISE EXCEPTION
            'Lease-template claimed reconciliation access denied'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Resolve only the template identity before taking the established locks.
     * No state decision is made from this unlocked snapshot.
     */
    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts
    WHERE id = p_attempt_id
      AND entity_id = p_entity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload attempt not found'
            USING ERRCODE = 'P0002';
    END IF;

    /*
     * Preserve the lease-template upload lock order:
     * template -> attempt.
     */
    SELECT *
    INTO v_template
    FROM public.lease_templates
    WHERE id = v_attempt.template_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Lease template not found for claimed reconciliation'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts
    WHERE id = p_attempt_id
      AND entity_id = p_entity_id
      AND template_id = v_template.id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Upload attempt changed during claimed reconciliation'
            USING ERRCODE = '40001';
    END IF;

    /*
     * Terminal outcomes cannot be converted into reconciliation.
     */
    IF v_attempt.status IN ('attached', 'cleaned_up') THEN
        RAISE EXCEPTION
            'Terminal upload state cannot enter claimed reconciliation: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.status NOT IN (
        'reserved',
        'processing',
        'attaching',
        'failed',
        'reconciliation_required'
    ) THEN
        RAISE EXCEPTION
            'Unsupported upload state for claimed reconciliation: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    /*
     * Generation plus an unexpired recovery lease proves the caller still owns
     * the claim. Unlike the normal-worker reconciliation RPC, this operation
     * deliberately preserves lease_expires_at.
     */
    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION
            'Lease-template upload recovery ownership lost'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.recovery_actor_id IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Lease-template upload recovery claimant has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL
       OR v_attempt.lease_expires_at <= now()
    THEN
        RAISE EXCEPTION
            'Lease-template upload recovery lease expired'
            USING ERRCODE = '55006';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET status = 'reconciliation_required',
        error_code = v_error_code,
        error_message = v_error_message,
        updated_at = now()
    WHERE id = v_attempt.id
      AND entity_id = p_entity_id
      AND template_id = v_template.id
      AND lease_generation = p_expected_generation
      AND recovery_actor_id = p_actor_id
      AND status = v_attempt.status
      AND lease_expires_at > now()
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Claimed reconciliation lost recovery ownership'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.mark_claimed_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.mark_claimed_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text
    )
TO service_role;

COMMENT ON FUNCTION
    public.mark_claimed_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text
    )
IS
'Moves a currently claimed nonterminal lease-template upload into reconciliation_required while preserving its fencing generation and active recovery lease. Performs no Storage, attachment, document deletion or cleanup mutation.';

COMMIT;
