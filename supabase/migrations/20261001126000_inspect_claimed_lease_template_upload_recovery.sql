-- Inspect a claimed lease-template upload recovery under fenced ownership.
--
-- This function is intentionally read-only with respect to application state.
-- It locks the relevant rows so its returned evidence is internally consistent,
-- but it does not inspect Storage, delete resources, attach a source or mark an
-- attempt cleaned_up. External Storage must be inspected separately.
--
-- Lock order remains template -> attempt -> document.

BEGIN;

CREATE FUNCTION public.inspect_claimed_lease_template_upload_recovery(
    p_attempt_id uuid,
    p_entity_id uuid,
    p_actor_id uuid,
    p_expected_generation bigint
)
RETURNS TABLE (
    attempt_id uuid,
    attempt_status text,
    lease_generation bigint,
    lease_expires_at timestamptz,
    template_id uuid,
    document_id uuid,
    storage_key text,
    checksum text,
    template_exists boolean,
    document_exists boolean,
    document_matches_attempt boolean,
    document_attached_to_attempt_template boolean,
    document_attached_to_any_template boolean,
    template_has_different_document boolean,
    child_document_count bigint,
    document_relationship_count bigint,
    document_review_count bigint,
    supplier_invoice_count bigint,
    bank_statement_coverage_count bigint,
    has_cleanup_blockers boolean,
    requires_storage_inspection boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_template public.lease_templates%ROWTYPE;
    v_attempt public.lease_template_upload_attempts%ROWTYPE;
    v_document public.documents%ROWTYPE;

    v_child_document_count bigint := 0;
    v_document_relationship_count bigint := 0;
    v_document_review_count bigint := 0;
    v_supplier_invoice_count bigint := 0;
    v_bank_statement_coverage_count bigint := 0;

    v_document_matches boolean := FALSE;
    v_attached_to_attempt_template boolean := FALSE;
    v_attached_to_any_template boolean := FALSE;
    v_template_has_different_document boolean := FALSE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_entity_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_generation IS NULL
       OR p_expected_generation <= 0
    THEN
        RAISE EXCEPTION 'Recovery inspection parameters are required'
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
        RAISE EXCEPTION 'Lease-template upload recovery inspection access denied'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Preliminary lookup identifies the template only. No recovery decision is
     * made until the established lock order has been acquired.
     */
    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts AS a
    WHERE a.id = p_attempt_id
      AND a.entity_id = p_entity_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload attempt not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_template
    FROM public.lease_templates AS t
    WHERE t.id = v_attempt.template_id
      AND t.entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lease template not found for recovery inspection'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_attempt
    FROM public.lease_template_upload_attempts AS a
    WHERE a.id = p_attempt_id
      AND a.entity_id = p_entity_id
      AND a.template_id = v_template.id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Upload attempt changed during recovery inspection'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.status IN ('attached', 'cleaned_up') THEN
        RAISE EXCEPTION
            'Terminal upload does not require claimed recovery inspection'
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.status NOT IN (
        'reserved',
        'processing',
        'attaching',
        'failed',
        'reconciliation_required'
    ) THEN
        RAISE EXCEPTION
            'Unsupported upload state for recovery inspection: %',
            v_attempt.status
            USING ERRCODE = '23514';
    END IF;

    IF v_attempt.lease_generation IS DISTINCT FROM p_expected_generation THEN
        RAISE EXCEPTION 'Upload recovery ownership has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.recovery_actor_id IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'Lease-template upload recovery claimant has been superseded'
            USING ERRCODE = '40001';
    END IF;

    IF v_attempt.lease_expires_at IS NULL
       OR v_attempt.lease_expires_at <= now()
    THEN
        RAISE EXCEPTION 'Upload recovery lease is not active'
            USING ERRCODE = '55006';
    END IF;

    IF v_attempt.document_id IS NOT NULL THEN
        SELECT *
        INTO v_document
        FROM public.documents AS d
        WHERE d.id = v_attempt.document_id
          AND d.entity_id = p_entity_id
        FOR UPDATE;

        IF FOUND THEN
            v_document_matches :=
                v_document.entity_id = v_attempt.entity_id
                AND v_document.checksum IS NOT DISTINCT FROM v_attempt.checksum
                AND v_document.storage_key IS NOT DISTINCT FROM v_attempt.storage_key
                AND v_document.document_type = 'lease_template_source'
                AND v_document.uploaded_by IS NOT DISTINCT FROM v_attempt.actor_id
                AND v_document.status = 'received';

            SELECT count(*)
            INTO v_child_document_count
            FROM public.documents AS child
            WHERE child.parent_document_id = v_document.id;

            SELECT count(*)
            INTO v_document_relationship_count
            FROM public.document_relationships AS rel
            WHERE rel.document_id = v_document.id;

            /*
             * document_reviews.document_id is text in the existing schema,
             * so compare against the UUID's canonical text representation.
             */
            SELECT count(*)
            INTO v_document_review_count
            FROM public.document_reviews AS review
            WHERE review.document_id = v_document.id::text;

            SELECT count(*)
            INTO v_supplier_invoice_count
            FROM public.supplier_invoices_new AS invoice
            WHERE invoice.document_id = v_document.id;

            SELECT count(*)
            INTO v_bank_statement_coverage_count
            FROM public.bank_statements AS statement
            WHERE statement.coverage_evidence_document_id = v_document.id;

            SELECT EXISTS (
                SELECT 1
                FROM public.lease_templates AS lt
                WHERE lt.entity_id = p_entity_id
                  AND lt.source_document_id = v_document.id
            )
            INTO v_attached_to_any_template;
        END IF;
    END IF;

    v_attached_to_attempt_template :=
        v_attempt.document_id IS NOT NULL
        AND v_template.source_document_id = v_attempt.document_id;

    v_template_has_different_document :=
        v_template.source_document_id IS NOT NULL
        AND v_template.source_document_id
            IS DISTINCT FROM v_attempt.document_id;

    RETURN QUERY
    SELECT
        v_attempt.id,
        v_attempt.status,
        v_attempt.lease_generation,
        v_attempt.lease_expires_at,
        v_attempt.template_id,
        v_attempt.document_id,
        v_attempt.storage_key,
        v_attempt.checksum,
        TRUE,
        (v_document.id IS NOT NULL),
        v_document_matches,
        v_attached_to_attempt_template,
        v_attached_to_any_template,
        v_template_has_different_document,
        v_child_document_count,
        v_document_relationship_count,
        v_document_review_count,
        v_supplier_invoice_count,
        v_bank_statement_coverage_count,
        (
            v_template_has_different_document
            OR v_attached_to_any_template
            OR v_child_document_count > 0
            OR v_document_relationship_count > 0
            OR v_document_review_count > 0
            OR v_supplier_invoice_count > 0
            OR v_bank_statement_coverage_count > 0
            OR (
                v_document.id IS NOT NULL
                AND NOT v_document_matches
            )
        ),
        (v_attempt.storage_key IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION
    public.inspect_claimed_lease_template_upload_recovery(
        uuid,
        uuid,
        uuid,
        bigint
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.inspect_claimed_lease_template_upload_recovery(
        uuid,
        uuid,
        uuid,
        bigint
    )
TO service_role;

COMMENT ON FUNCTION
    public.inspect_claimed_lease_template_upload_recovery(
        uuid,
        uuid,
        uuid,
        bigint
    )
IS
'Returns database-side cleanup evidence for a currently claimed lease-template upload recovery. Requires the current fencing generation and an unexpired recovery lease; performs no resource deletion or terminal state transition.';

COMMIT;
