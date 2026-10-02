-- Normalize a claimed lease-template recovery when the template attachment
-- already committed but the upload ledger did not reach its terminal state.
--
-- This is intentionally narrow:
--   * no template mutation
--   * no document mutation
--   * no Storage mutation
--   * exact generation + active recovery lease required
--   * exact template/document/checksum/storage identity required
--   * only a positively established existing attachment may be normalized

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_claimed_lease_template_upload_attachment(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_generation bigint
)
RETURNS public.lease_template_upload_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_template public.lease_templates%ROWTYPE;
    v_document public.documents%ROWTYPE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
    THEN
        RAISE EXCEPTION 'Invalid attachment normalization request'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.entity_users AS eu
        WHERE eu.entity_id = p_entity_id
          AND eu.user_id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'Actor does not belong to entity'
            USING ERRCODE = '42501';
    END IF;

    IF public.has_entity_permission(
        p_entity_id,
        p_actor_id,
        'leasing.template.edit'
    ) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Actor cannot recover lease templates'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Preliminary read identifies the template only. No state decision is
     * taken until the governed lock order is established.
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

    SELECT *
    INTO v_template
    FROM public.lease_templates
    WHERE id = v_attempt.template_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lease template not found'
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
        RAISE EXCEPTION 'Upload attempt changed during normalization'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.status = 'attached' THEN
        IF v_template.source_document_id IS DISTINCT FROM v_attempt.document_id
           OR v_attempt.document_id IS NULL
        THEN
            RAISE EXCEPTION 'Attached ledger conflicts with template source'
                USING ERRCODE = '23514';
        END IF;

        PERFORM public.lock_canonical_document_reference(v_attempt.document_id);

        SELECT *
        INTO v_document
        FROM public.documents
        WHERE id = v_attempt.document_id
        FOR UPDATE;

        IF NOT FOUND
           OR v_document.entity_id IS DISTINCT FROM p_entity_id
           OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
           OR v_document.uploaded_by IS DISTINCT FROM v_attempt.actor_id
           OR v_document.checksum IS DISTINCT FROM v_attempt.checksum
           OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
           OR v_document.status IS DISTINCT FROM 'received'
        THEN
            RAISE EXCEPTION 'Attached canonical document does not match upload attempt'
                USING ERRCODE = '23514';
        END IF;

        RETURN v_attempt;
    END IF;

    IF v_attempt.status = 'cleaned_up' THEN
        RAISE EXCEPTION 'Cleaned upload cannot be normalized as attached'
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.status NOT IN (
        'reserved',
        'processing',
        'attaching',
        'failed',
        'reconciliation_required'
    ) THEN
        RAISE EXCEPTION 'Unsupported upload state for attachment normalization'
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION 'Recovery claim has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL
       OR v_attempt.lease_expires_at <= now()
    THEN
        RAISE EXCEPTION 'Recovery claim is not active'
            USING ERRCODE = '55006';
    END IF;

    IF v_attempt.document_id IS NULL
       OR v_template.source_document_id IS DISTINCT FROM v_attempt.document_id
    THEN
        RAISE EXCEPTION 'Template is not attached to the attempt document'
            USING ERRCODE = '23514';
    END IF;

    PERFORM public.lock_canonical_document_reference(v_attempt.document_id);

    SELECT *
    INTO v_document
    FROM public.documents
    WHERE id = v_attempt.document_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_document.entity_id IS DISTINCT FROM p_entity_id
       OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
       OR v_document.uploaded_by IS DISTINCT FROM v_attempt.actor_id
       OR v_document.checksum IS DISTINCT FROM v_attempt.checksum
       OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
       OR v_document.status IS DISTINCT FROM 'received'
    THEN
        RAISE EXCEPTION 'Attached canonical document does not match upload attempt'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.lease_template_upload_attempts
    SET status = 'attached',
        updated_at = now(),
        completed_at = now(),
        lease_expires_at = NULL,
        error_code = NULL,
        error_message = NULL
    WHERE id = v_attempt.id
      AND entity_id = p_entity_id
      AND lease_generation = p_expected_generation
      AND status IN (
          'reserved',
          'processing',
          'attaching',
          'failed',
          'reconciliation_required'
      )
    RETURNING * INTO v_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attachment normalization lost recovery ownership'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.normalize_claimed_lease_template_upload_attachment(
        uuid,
        uuid,
        uuid,
        bigint
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.normalize_claimed_lease_template_upload_attachment(
        uuid,
        uuid,
        uuid,
        bigint
    )
TO service_role;

COMMENT ON FUNCTION
    public.normalize_claimed_lease_template_upload_attachment(
        uuid,
        uuid,
        uuid,
        bigint
    )
IS
'Normalizes a claimed nonterminal lease-template upload to attached only when the template already points to the exact canonical attempt document. Requires the current fenced generation and an active recovery lease. Performs no template, document, or Storage mutation.';

COMMIT;
