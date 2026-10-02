-- Governed recovery ownership for interrupted lease-template uploads.
--
-- Recovery ownership is represented by the existing monotonic fencing
-- generation plus a time-bounded lease. Claiming recovery does not change
-- the diagnostic upload status, inspect Storage, attach a source, delete a
-- resource or mark an attempt cleaned_up.
--
-- Lock order remains template first, attempt second to match the attachment
-- path and avoid introducing a conflicting lock order.

BEGIN;

CREATE FUNCTION public.claim_lease_template_upload_recovery(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_template public.lease_templates%ROWTYPE;
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
    THEN
        RAISE EXCEPTION 'Recovery claim identifiers are required'
            USING ERRCODE = '22023';
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
        RAISE EXCEPTION 'Lease-template upload recovery access denied'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Resolve the attempt before taking locks only to identify its template.
     * No decision is made from this unlocked snapshot.
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
     * Established lock order: template first, attempt second.
     */
    SELECT *
    INTO v_template
    FROM public.lease_templates
    WHERE id = v_attempt.template_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lease template not found for upload recovery'
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
        RAISE EXCEPTION 'Upload attempt changed during recovery claim'
            USING ERRCODE = '40001';
    END IF;

    /*
     * Terminal states are observationally safe and require no takeover.
     */
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
            'Unsupported upload state for recovery: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    /*
     * Active normal-worker states may only be taken over after expiry.
     * A missing lease on one of these states is inconsistent and therefore
     * requires manual reconciliation rather than an automatic takeover.
     */
    IF v_attempt.status IN ('reserved', 'processing', 'attaching') THEN
        IF v_attempt.lease_expires_at IS NULL THEN
            RAISE EXCEPTION
                'Active upload state has no recovery-safe lease'
                USING ERRCODE = '23514';
        END IF;

        IF v_attempt.lease_expires_at > now() THEN
            RAISE EXCEPTION
                'Upload worker lease is still active'
                USING ERRCODE = '55006';
        END IF;
    END IF;

    /*
     * failed/reconciliation_required normally have no lease. If a recovery
     * worker has already claimed either state, its unexpired lease prevents
     * another recovery worker from stealing that ownership.
     */
    IF v_attempt.status IN ('failed', 'reconciliation_required')
       AND v_attempt.lease_expires_at IS NOT NULL
       AND v_attempt.lease_expires_at > now()
    THEN
        RAISE EXCEPTION
            'Upload recovery lease is still active'
            USING ERRCODE = '55006';
    END IF;

    IF v_attempt.lease_generation = 9223372036854775807 THEN
        RAISE EXCEPTION 'Upload recovery generation exhausted'
            USING ERRCODE = '22003';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET lease_generation = lease_generation + 1,
        lease_expires_at = now() + interval '30 minutes',
        updated_at = now()
    WHERE id = v_attempt.id
      AND entity_id = p_entity_id
      AND template_id = v_template.id
      AND lease_generation = v_attempt.lease_generation
      AND status = v_attempt.status
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload recovery claim lost concurrent ownership'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.claim_lease_template_upload_recovery(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.claim_lease_template_upload_recovery(uuid, uuid, uuid)
TO service_role;

COMMENT ON FUNCTION
    public.claim_lease_template_upload_recovery(uuid, uuid, uuid)
IS
'Claims time-bounded recovery ownership of a nonterminal lease-template upload by incrementing its fencing generation under the established template-then-attempt lock order. Does not change diagnostic status or mutate upload resources.';

COMMIT;
