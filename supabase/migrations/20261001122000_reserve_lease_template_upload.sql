-- AssetFlow: governed reservation of a lease-template source upload.
--
-- Reservation is the ownership boundary for an upload attempt.
-- The database allocates the attempt/document identifiers and deterministic
-- storage key before any external Storage write occurs.
--
-- A reservation does NOT imply that any storage object or document row exists.

BEGIN;

CREATE FUNCTION public.reserve_lease_template_upload(
    p_entity_id uuid,
    p_template_id uuid,
    p_actor_id uuid,
    p_checksum text,
    p_file_extension text
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_template public.lease_templates%ROWTYPE;
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_document_id uuid := gen_random_uuid();
    v_extension text;
    v_storage_key text;
BEGIN
    IF p_entity_id IS NULL
       OR p_template_id IS NULL
       OR p_actor_id IS NULL
    THEN
        RAISE EXCEPTION 'Upload reservation identifiers are required'
            USING ERRCODE = '22023';
    END IF;

    IF p_checksum IS NULL
       OR p_checksum !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'Invalid upload checksum'
            USING ERRCODE = '22023';
    END IF;

    v_extension := lower(btrim(COALESCE(p_file_extension, '')));

    IF v_extension NOT IN ('pdf', 'docx') THEN
        RAISE EXCEPTION 'Unsupported lease-template source extension'
            USING ERRCODE = '22023';
    END IF;

    -- Re-establish exact legal-entity membership and operational authority
    -- inside the database boundary.
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
        RAISE EXCEPTION 'Lease-template upload reservation access denied'
            USING ERRCODE = '42501';
    END IF;

    -- Serialize reservation against template attachment/state changes.
    SELECT *
    INTO v_template
    FROM public.lease_templates
    WHERE id = p_template_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lease template not found for entity'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_template.status IS DISTINCT FROM 'draft'
       OR v_template.review_status IS DISTINCT FROM 'pending'
       OR v_template.source_document_id IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Lease template is not eligible for source upload'
            USING ERRCODE = '23514';
    END IF;

    -- The object key is deterministic and exclusively owned by this attempt.
    -- No user-supplied filename participates in the storage path.
    v_storage_key :=
        'lease-templates/' ||
        p_entity_id::text || '/' ||
        p_template_id::text || '/' ||
        v_document_id::text || '.' ||
        v_extension;

    INSERT INTO public.lease_template_upload_attempts (
        entity_id,
        template_id,
        document_id,
        actor_id,
        checksum,
        storage_key,
        status,
        lease_expires_at,
        error_code,
        error_message
    )
    VALUES (
        p_entity_id,
        p_template_id,
        v_document_id,
        p_actor_id,
        p_checksum,
        v_storage_key,
        'reserved',
        now() + interval '30 minutes',
        NULL,
        NULL
    )
    RETURNING * INTO v_attempt;

    RETURN v_attempt;

EXCEPTION
    WHEN unique_violation THEN
        -- Do not silently reuse another attempt. Existing failed,
        -- reconciliation-required and attached attempts intentionally retain
        -- their reservation until a dedicated governed operation resolves them.
        RAISE EXCEPTION
            'An active lease-template upload reservation already exists'
            USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION
    public.reserve_lease_template_upload(
        uuid,
        uuid,
        uuid,
        text,
        text
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.reserve_lease_template_upload(
        uuid,
        uuid,
        uuid,
        text,
        text
    )
TO service_role;

COMMENT ON FUNCTION public.reserve_lease_template_upload(
    uuid,
    uuid,
    uuid,
    text,
    text
) IS
'Creates the governed ownership reservation for a lease-template source upload. Validates entity authority and template eligibility, allocates the document ID and deterministic storage key, and preserves active checksum/template uniqueness until verified cleanup.';

COMMIT;
