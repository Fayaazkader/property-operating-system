-- Final database-side cleanup of an abandoned lease-template upload.
--
-- Storage is external to the PostgreSQL transaction. The caller must first:
--   1. claim recovery ownership,
--   2. inspect the claimed attempt,
--   3. remove the exact attempt-owned Storage object when present, and
--   4. positively verify that exact Storage object is absent.
--
-- This function does not trust an earlier database inspection. It re-locks
-- and revalidates the complete database state immediately before deleting an
-- orphan canonical document and marking the attempt cleaned_up.
--
-- Lock order remains template -> attempt -> document.

BEGIN;

CREATE FUNCTION public.finalize_lease_template_upload_cleanup(
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
    v_has_document boolean := FALSE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
    THEN
        RAISE EXCEPTION 'Cleanup identifiers and generation are required'
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
        RAISE EXCEPTION 'Lease-template upload cleanup access denied'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Unlocked lookup is used only to identify the template required by the
     * established lock order. No cleanup decision is made from this snapshot.
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
        RAISE EXCEPTION 'Lease template not found for upload cleanup'
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
        RAISE EXCEPTION 'Upload attempt changed during cleanup'
            USING ERRCODE = '40001';
    END IF;

    /*
     * cleaned_up is idempotently observable. attached is deliberately not:
     * an attached source is a successful upload and must never be cleanup.
     */
    IF v_attempt.status = 'cleaned_up' THEN
        RETURN v_attempt;
    END IF;

    IF v_attempt.status = 'attached' THEN
        RAISE EXCEPTION 'Attached lease-template uploads cannot be cleaned up'
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.lease_generation <> p_expected_generation THEN
        RAISE EXCEPTION 'Lease-template upload cleanup ownership lost'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.recovery_actor_id IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Lease-template upload recovery claimant has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL
       OR v_attempt.lease_expires_at <= now()
    THEN
        RAISE EXCEPTION 'Lease-template upload recovery lease expired'
            USING ERRCODE = '55006';
    END IF;

    /*
     * Recovery must have claimed the attempt first. Normal active-worker
     * states are not directly finalizable even if a caller knows their
     * generation.
     */
    IF v_attempt.status NOT IN ('failed', 'reconciliation_required') THEN
        RAISE EXCEPTION
            'Upload state is not eligible for cleanup finalization: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    /*
     * A template source always wins over cleanup. This covers both the
     * attempt document and any conflicting source attached meanwhile.
     */
    IF v_template.source_document_id IS NOT NULL THEN
        RAISE EXCEPTION
            'Lease template has an attached source and cannot be cleaned up'
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.document_id IS NOT NULL THEN
        /*
         * Canonical-document lock order:
         *   template -> attempt -> advisory(document identity) -> document
         *
         * Logical-reference writers acquire the same transaction-scoped
         * advisory lock before creating/updating their reference. Taking it
         * before the document row lock gives future governed document paths
         * one unambiguous serialization order.
         */
        PERFORM public.lock_canonical_document_reference(v_attempt.document_id);

        SELECT *
        INTO v_document
        FROM public.documents
        WHERE id = v_attempt.document_id
        FOR UPDATE;

        v_has_document := FOUND;
    END IF;

    IF v_has_document THEN
        /*
         * The canonical row must still be exclusively the object created by
         * this upload attempt. Any identity mismatch is reconciliation, not
         * cleanup.
         */
        IF v_document.entity_id <> v_attempt.entity_id
           OR v_document.checksum IS DISTINCT FROM v_attempt.checksum
           OR v_document.storage_key IS DISTINCT FROM v_attempt.storage_key
           OR v_document.document_type <> 'lease_template_source'
           OR v_document.uploaded_by IS DISTINCT FROM v_attempt.actor_id
           OR v_document.status <> 'received'
        THEN
            RAISE EXCEPTION
                'Canonical upload document does not match recovery attempt'
                USING ERRCODE = '23514';
        END IF;

        /*
         * Recheck every known canonical-document dependency immediately
         * before deletion. Lifecycle events intentionally do not block:
         * their FK is ON DELETE CASCADE.
         */
        IF EXISTS (
            SELECT 1
            FROM public.documents AS child
            WHERE child.parent_document_id = v_document.id
        ) THEN
            RAISE EXCEPTION 'Upload document has child documents'
                USING ERRCODE = '23503';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.document_relationships AS rel
            WHERE rel.document_id = v_document.id
        ) THEN
            RAISE EXCEPTION 'Upload document has document relationships'
                USING ERRCODE = '23503';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.bank_statements AS bs
            WHERE bs.coverage_evidence_document_id = v_document.id
        ) THEN
            RAISE EXCEPTION 'Upload document is bank-statement evidence'
                USING ERRCODE = '23503';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.supplier_invoices_new AS si
            WHERE si.document_id = v_document.id
        ) THEN
            RAISE EXCEPTION 'Upload document is linked to a supplier invoice'
                USING ERRCODE = '23503';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.document_reviews AS dr
            WHERE dr.document_id = v_document.id::text
        ) THEN
            RAISE EXCEPTION 'Upload document has a document review'
                USING ERRCODE = '23503';
        END IF;

        DELETE FROM public.documents
        WHERE id = v_document.id
          AND entity_id = v_attempt.entity_id
          AND checksum IS NOT DISTINCT FROM v_attempt.checksum
          AND storage_key IS NOT DISTINCT FROM v_attempt.storage_key
          AND document_type = 'lease_template_source'
          AND uploaded_by IS NOT DISTINCT FROM v_attempt.actor_id
          AND status = 'received';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Canonical upload document changed during cleanup'
                USING ERRCODE = '40001';
        END IF;
    END IF;

    /*
     * Preserve failure diagnostics. cleaned_up means the attempt-owned
     * resources have been resolved; it does not erase why the upload failed.
     */
    UPDATE public.lease_template_upload_attempts
    SET status = 'cleaned_up',
        recovery_actor_id = NULL,
        lease_expires_at = NULL,
        completed_at = now(),
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
            'Upload cleanup lost recovery ownership'
            USING ERRCODE = '40001';
    END IF;

    RETURN v_attempt;
END;
$$;

REVOKE ALL ON FUNCTION
    public.finalize_lease_template_upload_cleanup(uuid, uuid, uuid, bigint)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.finalize_lease_template_upload_cleanup(uuid, uuid, uuid, bigint)
TO service_role;

COMMENT ON FUNCTION
    public.finalize_lease_template_upload_cleanup(uuid, uuid, uuid, bigint)
IS
'Final database-side cleanup for a claimed failed/reconciliation lease-template upload after the caller has positively verified the exact attempt-owned Storage object is absent. Revalidates ownership, source state, canonical document identity and all known dependencies before deleting an orphan document and marking the attempt cleaned_up.';

COMMIT;
