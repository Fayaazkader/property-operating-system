-- Atomically complete a claimed lease-template upload recovery.
--
-- The recovery claimant is authorized through recovery_actor_id while
-- actor_id remains immutable provenance for the original uploader.
--
-- Preconditions:
--   * current fenced recovery generation
--   * current recovery claimant
--   * active recovery lease
--   * attempt is in processing after governed resume
--   * template remains draft/pending/unattached
--   * canonical document exactly matches the original upload provenance
--
-- The template attachment and terminal upload-ledger transition commit in the
-- same PostgreSQL transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_claimed_lease_template_upload_recovery(
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
    IF p_template_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_document_id IS NULL
       OR p_upload_attempt_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
       OR p_checksum IS NULL
       OR btrim(p_checksum) = ''
    THEN
        RAISE EXCEPTION 'Invalid recovery completion request'
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
        RAISE EXCEPTION 'Lease-template recovery completion access denied'
            USING ERRCODE = '42501';
    END IF;

    -- Established lock order: template -> attempt -> advisory document -> row.
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
      AND document_id = p_document_id
      AND checksum = p_checksum
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recovery upload reservation not found or mismatched'
            USING ERRCODE = '23514';
    END IF;

    /*
     * A successful terminal replay is observationally safe only when the
     * template already points to this attempt document.
     */
    IF v_attempt.status = 'attached' THEN
        IF v_template.source_document_id IS DISTINCT FROM p_document_id THEN
            RAISE EXCEPTION 'Attached recovery ledger conflicts with template source'
                USING ERRCODE = '23514';
        END IF;

        PERFORM public.lock_canonical_document_reference(p_document_id);

        SELECT *
        INTO v_document
        FROM public.documents
        WHERE id = p_document_id
        FOR UPDATE;

        IF NOT FOUND
           OR v_document.entity_id IS DISTINCT FROM p_entity_id
           OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
           OR v_document.uploaded_by IS DISTINCT FROM v_attempt.actor_id
           OR v_document.checksum IS DISTINCT FROM v_attempt.checksum
           OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
           OR v_document.status IS DISTINCT FROM 'received'
        THEN
            RAISE EXCEPTION 'Attached canonical document does not match recovery attempt'
                USING ERRCODE = '23514';
        END IF;

        RETURN v_template;
    END IF;

    IF v_attempt.status = 'cleaned_up' THEN
        RAISE EXCEPTION 'Cleaned upload cannot be completed as attached'
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION 'Recovery generation has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.recovery_actor_id IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Recovery claimant has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL
       OR v_attempt.lease_expires_at <= now()
    THEN
        RAISE EXCEPTION 'Recovery lease is not active'
            USING ERRCODE = '55006';
    END IF;

    IF v_attempt.status IS DISTINCT FROM 'processing' THEN
        RAISE EXCEPTION 'Recovered upload is not ready for completion'
            USING ERRCODE = '23514';
    END IF;

    IF v_template.status IS DISTINCT FROM 'draft'
       OR v_template.review_status IS DISTINCT FROM 'pending'
       OR v_template.source_document_id IS NOT NULL
    THEN
        RAISE EXCEPTION 'Template is not eligible for recovered attachment'
            USING ERRCODE = '23514';
    END IF;

    PERFORM public.lock_canonical_document_reference(p_document_id);

    SELECT *
    INTO v_document
    FROM public.documents
    WHERE id = p_document_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    /*
     * uploaded_by is checked against attempt.actor_id, not the recovery
     * claimant. Recovery must preserve original-upload provenance.
     */
    IF NOT FOUND
       OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
       OR v_document.uploaded_by IS DISTINCT FROM v_attempt.actor_id
       OR v_document.checksum IS DISTINCT FROM p_checksum
       OR v_document.status IS DISTINCT FROM 'received'
       OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
    THEN
        RAISE EXCEPTION 'Invalid recovered lease-template source document'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.lease_templates AS lt
        WHERE lt.entity_id = p_entity_id
          AND lt.source_document_id = p_document_id
          AND lt.id IS DISTINCT FROM p_template_id
    ) THEN
        RAISE EXCEPTION 'Source document is already attached to another template'
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
        RAISE EXCEPTION 'Recovered template attachment state changed'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET status = 'attached',
        recovery_actor_id = NULL,
        updated_at = now(),
        completed_at = now(),
        lease_expires_at = NULL,
        error_code = NULL,
        error_message = NULL
    WHERE id = v_attempt.id
      AND entity_id = p_entity_id
      AND template_id = p_template_id
      AND document_id = p_document_id
      AND lease_generation = p_expected_generation
      AND recovery_actor_id = p_actor_id
      AND status = 'processing'
      AND lease_expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recovery completion lost claimant ownership or state'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_template;
END;
$$;

REVOKE ALL ON FUNCTION
    public.complete_claimed_lease_template_upload_recovery(
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
    public.complete_claimed_lease_template_upload_recovery(
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

COMMENT ON FUNCTION
    public.complete_claimed_lease_template_upload_recovery(
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
IS
'Atomically attaches the exact canonical source document and terminates a governed claimed lease-template recovery. Authorizes the recovery claimant separately from immutable original-uploader provenance.';

COMMIT;
