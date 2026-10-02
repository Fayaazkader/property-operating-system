-- Fence stale lease-template upload workers.
--
-- lease_expires_at identifies when recovery may consider taking ownership,
-- but expiry alone does not revoke an existing worker. lease_generation is
-- the fencing token: every normal mutating operation must present the
-- generation it received from the durable reservation. A future governed
-- recovery takeover increments the generation under row lock, permanently
-- preventing an older worker from mutating the attempt afterwards.

BEGIN;

ALTER TABLE public.lease_template_upload_attempts
    ADD COLUMN lease_generation bigint NOT NULL DEFAULT 1;

ALTER TABLE public.lease_template_upload_attempts
    ADD CONSTRAINT lease_template_upload_attempts_generation_positive
    CHECK (lease_generation > 0);

COMMENT ON COLUMN public.lease_template_upload_attempts.lease_generation IS
'Monotonic fencing token for upload ownership. Normal workers must present the current generation. Governed recovery takeover increments it under row lock.';


-- ---------------------------------------------------------------------------
-- Normal upload state transitions.
-- ---------------------------------------------------------------------------

DROP FUNCTION public.transition_lease_template_upload_attempt(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text
);

CREATE FUNCTION public.transition_lease_template_upload_attempt(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_generation bigint,
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
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
       OR p_expected_status IS NULL
       OR p_new_status IS NULL
    THEN
        RAISE EXCEPTION 'Upload transition parameters are required'
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

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION
            'Upload worker lease has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.status IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION
            'Upload attempt state changed: expected %, found %',
            p_expected_status,
            v_attempt.status
            USING ERRCODE = '40001';
    END IF;

    -- Terminal states remain owned by their dedicated governed operations.
    IF p_new_status IN ('attached', 'cleaned_up') THEN
        RAISE EXCEPTION
            'Status % requires its dedicated governed operation',
            p_new_status
            USING ERRCODE = '42501';
    END IF;

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
      AND lease_generation = p_expected_generation
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload transition lost concurrent ownership or state'
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
        bigint,
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
        bigint,
        text,
        text,
        text,
        text
    )
TO service_role;


-- ---------------------------------------------------------------------------
-- Failure-boundary reconciliation.
--
-- Terminal states may be returned to resolve a lost response, because this
-- path performs no mutation in that case. Any nonterminal mutation requires
-- the caller still to own the current generation.
-- ---------------------------------------------------------------------------

DROP FUNCTION public.mark_lease_template_upload_for_reconciliation(
    uuid,
    uuid,
    uuid,
    text,
    text
);

CREATE FUNCTION public.mark_lease_template_upload_for_reconciliation(
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

    -- A terminal result is observational only. This preserves lost-response
    -- recovery without allowing a stale worker to mutate newer ownership.
    IF v_attempt.status IN ('attached', 'cleaned_up') THEN
        RETURN v_attempt;
    END IF;

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION
            'Upload worker lease has been superseded'
            USING ERRCODE = '40001';
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
      AND lease_generation = p_expected_generation
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload reconciliation lost worker ownership'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.mark_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.mark_lease_template_upload_for_reconciliation(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text
    )
TO service_role;

COMMENT ON FUNCTION public.mark_lease_template_upload_for_reconciliation(
    uuid,
    uuid,
    uuid,
    bigint,
    text,
    text
) IS
'Atomically records an uncertain lease-template upload outcome. Nonterminal mutation requires the current fencing generation; attached/cleaned_up terminal outcomes may be returned observationally for lost-response recovery.';


-- ---------------------------------------------------------------------------
-- Atomic template attachment.
-- ---------------------------------------------------------------------------

DROP FUNCTION public.attach_lease_template_source(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    uuid
);

CREATE FUNCTION public.attach_lease_template_source(
    p_template_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_document_id uuid,
    p_checksum text,
    p_field_mapping jsonb,
    p_ai_suggestions jsonb,
    p_fields jsonb,
    p_upload_attempt_id uuid,
    p_expected_generation bigint
)
RETURNS public.lease_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_template public.lease_templates%ROWTYPE;
    v_document public.documents%ROWTYPE;
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
BEGIN
    IF p_actor_id IS NULL
       OR p_entity_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
       OR NOT EXISTS (
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
        RAISE EXCEPTION 'Lease-template attachment access denied'
            USING ERRCODE = '42501';
    END IF;

    -- Maintain the established lock order: template first, attempt second.
    SELECT *
    INTO v_template
    FROM public.lease_templates
    WHERE id = p_template_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lease template not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts
    WHERE id = p_upload_attempt_id
      AND entity_id = p_entity_id
      AND template_id = p_template_id
      AND actor_id = p_actor_id
      AND document_id = p_document_id
      AND checksum = p_checksum
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload reservation not found or mismatched'
            USING ERRCODE = '23514';
    END IF;

    -- Idempotent lost-response replay is observationally safe.
    IF v_attempt.status = 'attached'
       AND v_template.source_document_id = p_document_id
    THEN
        RETURN v_template;
    END IF;

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION 'Upload worker lease has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.status IS DISTINCT FROM 'attaching' THEN
        RAISE EXCEPTION 'Upload is not ready for attachment'
            USING ERRCODE = '23514';
    END IF;

    IF v_template.status IS DISTINCT FROM 'draft'
       OR v_template.review_status IS DISTINCT FROM 'pending'
       OR v_template.source_document_id IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Template already has a source or is under review'
            USING ERRCODE = '23514';
    END IF;

    SELECT *
    INTO v_document
    FROM public.documents
    WHERE id = p_document_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
       OR v_document.uploaded_by IS DISTINCT FROM p_actor_id
       OR v_document.checksum IS DISTINCT FROM p_checksum
       OR v_document.status IS DISTINCT FROM 'received'
       OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
    THEN
        RAISE EXCEPTION 'Invalid lease-template source document'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.lease_templates AS lt
        WHERE lt.entity_id = p_entity_id
          AND lt.source_document_id = p_document_id
    ) THEN
        RAISE EXCEPTION 'Source document is already attached'
            USING ERRCODE = '23505';
    END IF;

    UPDATE public.lease_templates
    SET source_document_id = v_document.id,
        source_document_checksum = v_document.checksum,
        source_file_name = v_document.file_name,
        source_mime_type = v_document.mime_type,
        source_document_url = v_document.storage_key,
        field_mapping = COALESCE(p_field_mapping, '[]'::jsonb),
        ai_suggestions = COALESCE(p_ai_suggestions, '[]'::jsonb),
        clause_suggestions = '[]'::jsonb,
        fields = COALESCE(p_fields, '[]'::jsonb),
        review_status = 'in_review',
        updated_at = now()
    WHERE id = p_template_id
      AND entity_id = p_entity_id
      AND status = 'draft'
      AND review_status = 'pending'
      AND source_document_id IS NULL
    RETURNING * INTO v_template;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template attachment state changed'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET status = 'attached',
        updated_at = now(),
        completed_at = now(),
        lease_expires_at = NULL,
        error_code = NULL,
        error_message = NULL
    WHERE id = p_upload_attempt_id
      AND status = 'attaching'
      AND lease_generation = p_expected_generation;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload completion lost worker ownership or state'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_template;
END;
$$;

REVOKE ALL ON FUNCTION
    public.attach_lease_template_source(
        uuid,
        uuid,
        uuid,
        uuid,
        text,
        jsonb,
        jsonb,
        jsonb,
        uuid,
        bigint
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.attach_lease_template_source(
        uuid,
        uuid,
        uuid,
        uuid,
        text,
        jsonb,
        jsonb,
        jsonb,
        uuid,
        bigint
    )
TO service_role;

COMMENT ON FUNCTION public.attach_lease_template_source(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    uuid,
    bigint
) IS
'Atomically attaches a validated lease-template source document and completes its upload attempt. Nonterminal attachment requires the current fencing generation; an already-attached matching result remains idempotently readable.';

COMMIT;
