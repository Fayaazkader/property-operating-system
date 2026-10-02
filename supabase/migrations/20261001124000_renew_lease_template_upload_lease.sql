-- Renew an actively owned lease-template upload worker lease.
--
-- Renewal does not transfer ownership and does not change lease_generation.
-- An expired lease cannot be revived by the normal worker. Once expiry has
-- occurred, governed recovery owns the decision about what happens next.

BEGIN;

CREATE FUNCTION public.renew_lease_template_upload_lease(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_generation bigint,
    p_expected_status text
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
       OR p_expected_status IS NULL
    THEN
        RAISE EXCEPTION 'Upload lease renewal parameters are required'
            USING ERRCODE = '22023';
    END IF;

    IF p_expected_status NOT IN ('processing', 'attaching') THEN
        RAISE EXCEPTION
            'Upload lease cannot be renewed in status %',
            p_expected_status
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
        RAISE EXCEPTION 'Lease-template upload renewal access denied'
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

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION 'Upload worker lease has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.status IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION
            'Upload attempt state changed: expected %, found %',
            p_expected_status,
            v_attempt.status
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL THEN
        RAISE EXCEPTION 'Upload worker does not hold a renewable lease'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at <= now() THEN
        RAISE EXCEPTION 'Upload worker lease has expired'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET lease_expires_at = now() + interval '30 minutes',
        updated_at = now()
    WHERE id = v_attempt.id
      AND status = p_expected_status
      AND lease_generation = p_expected_generation
      AND lease_expires_at > now()
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload lease renewal lost worker ownership or expired'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.renew_lease_template_upload_lease(
        uuid,
        uuid,
        uuid,
        bigint,
        text
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.renew_lease_template_upload_lease(
        uuid,
        uuid,
        uuid,
        bigint,
        text
    )
TO service_role;

COMMIT;
