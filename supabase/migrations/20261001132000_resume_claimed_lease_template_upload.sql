-- Governed resume of a claimed lease-template upload recovery.
--
-- Recovery ownership is represented by the current fencing generation plus an
-- unexpired recovery lease. This operation allows a recovery worker to resume
-- deterministic document/template analysis from a durable checkpoint without
-- surrendering that ownership.
--
-- It does not inspect Storage, delete resources, attach a source, or mark an
-- attempt attached/cleaned_up.
--
-- Lock order remains template -> attempt.

BEGIN;

CREATE FUNCTION public.resume_claimed_lease_template_upload(
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
    v_template public.lease_templates%ROWTYPE;
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_document public.documents%ROWTYPE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
    THEN
        RAISE EXCEPTION
            'Claimed recovery resume identifiers and generation are required'
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
        RAISE EXCEPTION
            'Lease-template claimed recovery resume access denied'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Resolve only the template identity before taking the established locks.
     * No recovery decision is made from this unlocked snapshot.
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
        RAISE EXCEPTION
            'Lease template not found for claimed recovery resume'
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
            'Upload attempt changed during claimed recovery resume'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.status IN ('attached', 'cleaned_up') THEN
        RAISE EXCEPTION
            'Terminal upload cannot be resumed: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    /*
     * A claimed recovery may originate from an interrupted normal-worker state
     * or from a previously recorded failure/reconciliation state.
     */
    IF v_attempt.status NOT IN (
        'reserved',
        'processing',
        'attaching',
        'failed',
        'reconciliation_required'
    ) THEN
        RAISE EXCEPTION
            'Unsupported upload state for claimed recovery resume: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

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

    /*
     * Resume is only safe when the template remains unattached and in the
     * pre-review state expected by the normal attachment boundary.
     */
    IF v_template.status IS DISTINCT FROM 'draft'
       OR v_template.review_status IS DISTINCT FROM 'pending'
       OR v_template.source_document_id IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Lease template is not eligible for upload recovery resume'
            USING ERRCODE = '23514';
    END IF;

    /*
     * Recovery analysis is reconstructed from the canonical document's durable
     * OCR checkpoint. Therefore the document must still be the exact canonical
     * source reserved by this attempt and raw OCR must already be persisted.
     */
    IF v_attempt.document_id IS NULL THEN
        RAISE EXCEPTION
            'Upload recovery has no canonical document to resume'
            USING ERRCODE = '23514';
    END IF;

    /*
     * Preserve the canonical-document serialization order used by governed
     * cleanup and logical-reference writers:
     *   template -> attempt -> advisory(document identity) -> document.
     */
    PERFORM public.lock_canonical_document_reference(v_attempt.document_id);

    SELECT *
    INTO v_document
    FROM public.documents
    WHERE id = v_attempt.document_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_document.document_type IS DISTINCT FROM 'lease_template_source'
       OR v_document.uploaded_by IS DISTINCT FROM v_attempt.actor_id
       OR v_document.checksum IS DISTINCT FROM v_attempt.checksum
       OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
       OR v_document.status IS DISTINCT FROM 'received'
       OR NULLIF(btrim(v_document.raw_ocr_text), '') IS NULL
    THEN
        RAISE EXCEPTION
            'Lease-template recovery checkpoint is missing or mismatched'
            USING ERRCODE = '23514';
    END IF;

    /*
     * Return the claimed attempt to processing while retaining the same fencing
     * generation. Refresh the recovery lease because subsequent deterministic
     * analysis and attachment remain owned by this recovery worker.
     *
     * Historical failure diagnostics are cleared only when resume is accepted.
     */
    UPDATE public.lease_template_upload_attempts
    SET status = 'processing',
        error_code = NULL,
        error_message = NULL,
        lease_expires_at = now() + interval '30 minutes',
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
            'Claimed recovery resume lost ownership or state'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.resume_claimed_lease_template_upload(uuid, uuid, uuid, bigint)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.resume_claimed_lease_template_upload(uuid, uuid, uuid, bigint)
TO service_role;

COMMENT ON FUNCTION
    public.resume_claimed_lease_template_upload(uuid, uuid, uuid, bigint)
IS
'Resumes a currently claimed nonterminal lease-template upload from its durable raw-OCR checkpoint under the existing fencing generation and an active recovery lease. Requires an exact canonical document identity and an unattached draft/pending template; performs no Storage mutation, attachment, deletion or terminal transition.';

COMMIT;
