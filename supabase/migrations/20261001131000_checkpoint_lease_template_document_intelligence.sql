-- Persist lease-template OCR/extraction results behind the upload worker's
-- fencing token so interrupted processing can be recovered deterministically.

BEGIN;

CREATE FUNCTION public.checkpoint_lease_template_document_intelligence(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_generation bigint,
    p_ocr_text text,
    p_raw_ocr_text text,
    p_ocr_confidence numeric,
    p_extracted_fields jsonb,
    p_extraction_confidence numeric
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_document public.documents%ROWTYPE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
    THEN
        RAISE EXCEPTION 'Document-intelligence checkpoint parameters are required'
            USING ERRCODE = '22023';
    END IF;

    IF p_ocr_text IS NULL
       OR p_raw_ocr_text IS NULL
       OR p_extracted_fields IS NULL
       OR p_ocr_confidence IS NULL
       OR p_extraction_confidence IS NULL
    THEN
        RAISE EXCEPTION 'Document-intelligence checkpoint payload is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_ocr_confidence < 0
       OR p_ocr_confidence > 1
       OR p_extraction_confidence < 0
       OR p_extraction_confidence > 1
    THEN
        RAISE EXCEPTION 'Document confidence values must be between 0 and 1'
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
        RAISE EXCEPTION 'Lease-template document checkpoint access denied'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Lock the upload attempt before the canonical document. Recovery paths
     * that need the template lock use template -> attempt -> document, so this
     * operation never introduces the inverse document -> attempt ordering.
     */
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

    IF v_attempt.status IS DISTINCT FROM 'processing' THEN
        RAISE EXCEPTION
            'Document-intelligence checkpoint requires processing state; found %',
            v_attempt.status
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL
       OR v_attempt.lease_expires_at <= now()
    THEN
        RAISE EXCEPTION 'Upload worker lease has expired'
            USING ERRCODE = '40001';
    END IF;

    SELECT *
    INTO v_document
    FROM public.documents
    WHERE id = v_attempt.document_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
       OR v_document.uploaded_by IS DISTINCT FROM p_actor_id
       OR v_document.checksum IS DISTINCT FROM v_attempt.checksum
       OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
       OR v_document.status IS DISTINCT FROM 'received'
    THEN
        RAISE EXCEPTION 'Canonical lease-template source document is invalid'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.documents
    SET ocr_text = p_ocr_text,
        raw_ocr_text = p_raw_ocr_text,
        ocr_confidence = p_ocr_confidence,
        extracted_fields = p_extracted_fields,
        extraction_confidence = p_extraction_confidence,
        requires_review = true,
        updated_at = now()
    WHERE id = v_document.id
      AND entity_id = p_entity_id
      AND document_type = 'lease_template_source'
      AND uploaded_by IS NOT DISTINCT FROM p_actor_id
      AND checksum IS NOT DISTINCT FROM v_attempt.checksum
      AND storage_key IS NOT DISTINCT FROM v_attempt.storage_key
      AND status = 'received'
    RETURNING * INTO v_document;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Canonical lease-template source changed during checkpoint'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_document;
END;
$$;

REVOKE ALL ON FUNCTION
    public.checkpoint_lease_template_document_intelligence(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text,
        numeric,
        jsonb,
        numeric
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.checkpoint_lease_template_document_intelligence(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text,
        numeric,
        jsonb,
        numeric
    )
TO service_role;

COMMENT ON FUNCTION
    public.checkpoint_lease_template_document_intelligence(
        uuid,
        uuid,
        uuid,
        bigint,
        text,
        text,
        numeric,
        jsonb,
        numeric
    ) IS
'Persists normalized/raw OCR and extracted-field intelligence for an actively owned lease-template upload. Requires processing state, current fencing generation, an unexpired worker lease, and an exact canonical source-document identity match.';

COMMIT;
