-- ============================================================
-- GENERATED LEASE DOCUMENT REGISTRATION
-- ============================================================
-- Atomically registers an already-rendered contractual lease artifact
-- in the canonical document registry together with immutable generation
-- provenance and discoverability relationships.
--
-- Storage bytes are uploaded before this RPC. If this RPC fails, the
-- application must remove the uploaded object.
--
-- Generation authority remains:
--   approved commercial version
--   + approved lease template/version
--   + exact rendered artifact checksum.
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_generated_lease_document(
    p_actor_id uuid,
    p_entity_id uuid,
    p_opportunity_id uuid,
    p_commercial_version_id uuid,
    p_template_id uuid,
    p_template_version integer,
    p_template_source_document_id uuid,
    p_template_source_checksum text,
    p_generated_checksum text,
    p_file_name text,
    p_mime_type text,
    p_file_size_bytes integer,
    p_storage_bucket text,
    p_storage_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_document_id uuid;
    v_existing_document_id uuid;
    v_approved_version_id uuid;
    v_version_entity_id uuid;
    v_version_opportunity_id uuid;
BEGIN
    -- --------------------------------------------------------
    -- Caller identity
    --
    -- When invoked under an authenticated user JWT, the claimed actor
    -- must be that user. Server-side service-role orchestration has no
    -- auth.uid() and is permitted only because EXECUTE is not granted
    -- to browser roles by this migration.
    -- --------------------------------------------------------
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_actor_id THEN
        RAISE EXCEPTION 'Generated lease actor does not match authenticated caller.';
    END IF;

    -- --------------------------------------------------------
    -- Basic fail-closed input validation
    -- --------------------------------------------------------
    IF p_actor_id IS NULL
       OR p_entity_id IS NULL
       OR p_opportunity_id IS NULL
       OR p_commercial_version_id IS NULL
       OR p_template_id IS NULL
       OR p_template_source_document_id IS NULL THEN
        RAISE EXCEPTION 'Generated lease registration requires complete authority identity.';
    END IF;

    IF p_template_version IS NULL OR p_template_version <= 0 THEN
        RAISE EXCEPTION 'Generated lease registration requires a valid template version.';
    END IF;

    IF NULLIF(btrim(p_template_source_checksum), '') IS NULL
       OR NULLIF(btrim(p_generated_checksum), '') IS NULL THEN
        RAISE EXCEPTION 'Generated lease registration requires source and generated checksums.';
    END IF;

    IF NULLIF(btrim(p_file_name), '') IS NULL
       OR NULLIF(btrim(p_mime_type), '') IS NULL
       OR NULLIF(btrim(p_storage_bucket), '') IS NULL
       OR NULLIF(btrim(p_storage_key), '') IS NULL THEN
        RAISE EXCEPTION 'Generated lease registration requires complete artifact storage identity.';
    END IF;

    IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 THEN
        RAISE EXCEPTION 'Generated lease artifact must contain bytes.';
    END IF;

    -- --------------------------------------------------------
    -- Permission authority
    -- --------------------------------------------------------
    IF public.has_entity_permission(
        p_actor_id,
        p_entity_id,
        'leasing.document.generate'
    ) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Lease-document generation permission required.';
    END IF;

    -- --------------------------------------------------------
    -- Commercial authority
    --
    -- Lock the opportunity so its approved-version pointer cannot
    -- change during registration.
    -- --------------------------------------------------------
    SELECT approved_terms_version_id
      INTO v_approved_version_id
      FROM public.leasing_opportunities
     WHERE id = p_opportunity_id
       AND entity_id = p_entity_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leasing opportunity not found within authorised entity.';
    END IF;

    IF v_approved_version_id IS NULL
       OR v_approved_version_id <> p_commercial_version_id THEN
        RAISE EXCEPTION 'Generated lease commercial authority is not the currently approved version.';
    END IF;

    SELECT entity_id, opportunity_id
      INTO v_version_entity_id, v_version_opportunity_id
      FROM public.leasing_opportunity_versions
     WHERE id = p_commercial_version_id;

    IF NOT FOUND
       OR v_version_entity_id <> p_entity_id
       OR v_version_opportunity_id <> p_opportunity_id THEN
        RAISE EXCEPTION 'Approved commercial version does not match generated lease authority.';
    END IF;

    -- --------------------------------------------------------
    -- Template authority
    --
    -- The application has already selected the template through the
    -- governed applicability service and verified the actual stored
    -- source bytes. Re-check immutable identity here before creating
    -- contractual provenance.
    -- --------------------------------------------------------
    PERFORM 1
      FROM public.lease_templates
     WHERE id = p_template_id
       AND entity_id = p_entity_id
       AND version = p_template_version
       AND source_document_id = p_template_source_document_id
       AND source_document_checksum = p_template_source_checksum
       AND status = 'active'
       AND review_status = 'approved';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lease template authority no longer matches the approved generation source.';
    END IF;

    -- Canonical source document must still agree with template provenance.
    PERFORM 1
      FROM public.documents
     WHERE id = p_template_source_document_id
       AND entity_id = p_entity_id
       AND document_type = 'lease_template_source'
       AND checksum = p_template_source_checksum;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Canonical lease-template source provenance no longer matches.';
    END IF;

    -- --------------------------------------------------------
    -- Authority-based idempotency
    --
    -- Same entity + approved commercial version + exact template version
    -- represents one generation identity.
    -- --------------------------------------------------------
    SELECT document_id
      INTO v_existing_document_id
      FROM public.lease_generated_document_provenance
     WHERE entity_id = p_entity_id
       AND commercial_version_id = p_commercial_version_id
       AND template_id = p_template_id
       AND template_version = p_template_version;

    IF v_existing_document_id IS NOT NULL THEN
        PERFORM 1
          FROM public.documents
         WHERE id = v_existing_document_id
           AND entity_id = p_entity_id
           AND checksum = p_generated_checksum
           AND storage_bucket = p_storage_bucket
           AND storage_key = p_storage_key
           AND document_type = 'generated_lease';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Generation identity already exists with a different artifact.';
        END IF;

        RETURN v_existing_document_id;
    END IF;

    -- --------------------------------------------------------
    -- Canonical artifact
    -- --------------------------------------------------------
    INSERT INTO public.documents (
        entity_id,
        file_name,
        mime_type,
        file_size_bytes,
        storage_provider,
        storage_bucket,
        storage_key,
        storage_version,
        checksum,
        document_type,
        classified_by,
        status,
        extracted_fields,
        requires_review,
        version_number,
        is_latest_version,
        source,
        tags,
        uploaded_by
    )
    VALUES (
        p_entity_id,
        p_file_name,
        p_mime_type,
        p_file_size_bytes,
        'supabase',
        p_storage_bucket,
        p_storage_key,
        'v1',
        p_generated_checksum,
        'generated_lease',
        'rules',
        'review',
        '{}'::jsonb,
        true,
        1,
        true,
        'automation',
        ARRAY['lease', 'generated', 'contractual'],
        p_actor_id
    )
    RETURNING id INTO v_document_id;

    -- --------------------------------------------------------
    -- Immutable generation provenance
    -- --------------------------------------------------------
    INSERT INTO public.lease_generated_document_provenance (
        entity_id,
        document_id,
        opportunity_id,
        commercial_version_id,
        template_id,
        template_version,
        template_source_document_id,
        template_source_checksum,
        generated_checksum,
        created_by
    )
    VALUES (
        p_entity_id,
        v_document_id,
        p_opportunity_id,
        p_commercial_version_id,
        p_template_id,
        p_template_version,
        p_template_source_document_id,
        p_template_source_checksum,
        p_generated_checksum,
        p_actor_id
    );

    -- --------------------------------------------------------
    -- Discoverability relationships.
    -- These are navigation/index relationships only.
    -- They are NOT the contractual provenance authority.
    -- --------------------------------------------------------
    INSERT INTO public.document_relationships (
        document_id,
        related_entity_type,
        related_entity_id,
        relationship_type
    )
    VALUES
        (
            v_document_id,
            'leasing_opportunity',
            p_opportunity_id,
            'generated_from'
        ),
        (
            v_document_id,
            'leasing_commercial_version',
            p_commercial_version_id,
            'generated_from'
        ),
        (
            v_document_id,
            'lease_template',
            p_template_id,
            'generated_from'
        ),
        (
            v_document_id,
            'lease_template_source',
            p_template_source_document_id,
            'generated_from'
        )
    ON CONFLICT (
        document_id,
        related_entity_type,
        related_entity_id
    )
    DO NOTHING;

    RETURN v_document_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.register_generated_lease_document(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    integer,
    uuid,
    text,
    text,
    text,
    text,
    integer,
    text,
    text
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.register_generated_lease_document(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    integer,
    uuid,
    text,
    text,
    text,
    text,
    integer,
    text,
    text
)
FROM anon, authenticated;

COMMENT ON FUNCTION public.register_generated_lease_document(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    integer,
    uuid,
    text,
    text,
    text,
    text,
    integer,
    text,
    text
)
IS
'Atomically registers a deterministic generated lease artifact, immutable generation provenance, and discoverability relationships after verified server-side rendering.';
