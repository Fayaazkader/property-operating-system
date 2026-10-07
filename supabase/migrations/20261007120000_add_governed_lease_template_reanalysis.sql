-- Governed re-analysis of an attached lease-template source.
--
-- Re-analysis replaces machine-generated analysis with the current analyser
-- output while preserving human-reviewed target decisions.
--
-- Invariants:
--   * caller must have entity access and leasing.template.review
--   * template must remain draft / in_review
--   * source document identity must remain unchanged
--   * template row is locked before existing review state is read
--   * source='user' mappings survive by deterministic target.targetId
--   * fresh AI mappings/suggestions remain provisional
--   * no mapping is approved automatically
--   * mutation and audit record commit atomically

BEGIN;

CREATE OR REPLACE FUNCTION public.reanalyse_lease_template(
    p_template_id uuid,
    p_entity_id uuid,
    p_user_id uuid,
    p_user_email text,
    p_source_document_id uuid,
    p_source_document_checksum text,
    p_field_mapping jsonb,
    p_ai_suggestions jsonb,
    p_fields jsonb,
    p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_template public.lease_templates%ROWTYPE;
    v_document public.documents%ROWTYPE;

    v_existing_mappings jsonb;
    v_fresh_mappings jsonb;
    v_fresh_suggestions jsonb;
    v_merged_mappings jsonb;

    v_human_mapping jsonb;
    v_target_id text;
    v_existing_index integer;

    v_now timestamptz := now();
BEGIN
    IF p_template_id IS NULL
       OR p_entity_id IS NULL
       OR p_user_id IS NULL
       OR p_source_document_id IS NULL
       OR p_source_document_checksum IS NULL
       OR btrim(p_source_document_checksum) = ''
    THEN
        RAISE EXCEPTION 'Invalid lease-template re-analysis request'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = p_user_id
          AND uea.entity_id = p_entity_id
    )
       OR public.has_entity_permission(
            p_user_id,
            p_entity_id,
            'leasing.template.review'
          ) IS DISTINCT FROM TRUE
    THEN
        RAISE EXCEPTION
            'Lease-template re-analysis access denied: leasing.template.review required'
            USING ERRCODE = '42501';
    END IF;

    /*
     * Authoritative concurrency boundary.
     */
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

    IF v_template.status IS DISTINCT FROM 'draft'
       OR v_template.review_status IS DISTINCT FROM 'in_review'
    THEN
        RAISE EXCEPTION
            'Lease template is not currently available for re-analysis'
            USING ERRCODE = '23514';
    END IF;

    IF v_template.source_document_id IS DISTINCT FROM p_source_document_id
       OR v_template.source_document_checksum
            IS DISTINCT FROM p_source_document_checksum
    THEN
        RAISE EXCEPTION 'Lease-template source identity changed'
            USING ERRCODE = '23514';
    END IF;

    /*
     * Lock and verify the immutable canonical source document.
     */
    PERFORM public.lock_canonical_document_reference(
        p_source_document_id
    );

    SELECT *
    INTO v_document
    FROM public.documents
    WHERE id = p_source_document_id
      AND entity_id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_document.document_type
            IS DISTINCT FROM 'lease_template_source'
       OR v_document.checksum
            IS DISTINCT FROM p_source_document_checksum
       OR v_document.id
            IS DISTINCT FROM v_template.source_document_id
    THEN
        RAISE EXCEPTION
            'Lease-template canonical source document changed'
            USING ERRCODE = '23514';
    END IF;

    v_existing_mappings :=
        CASE
            WHEN jsonb_typeof(v_template.field_mapping) = 'array'
                THEN v_template.field_mapping
            ELSE '[]'::jsonb
        END;

    v_fresh_mappings :=
        CASE
            WHEN jsonb_typeof(p_field_mapping) = 'array'
                THEN p_field_mapping
            ELSE '[]'::jsonb
        END;

    v_fresh_suggestions :=
        CASE
            WHEN jsonb_typeof(p_ai_suggestions) = 'array'
                THEN p_ai_suggestions
            ELSE '[]'::jsonb
        END;

    /*
     * Start from the current analyser's machine result.
     */
    v_merged_mappings := v_fresh_mappings;

    /*
     * Human-reviewed mappings are authoritative for their exact deterministic
     * document target. Overlay them on the fresh machine analysis.
     *
     * If the current analyser still emits a mapping for the target, replace it.
     * If the analyser now leaves the target unresolved, retain the human
     * decision by appending it.
     */
    FOR v_human_mapping IN
        SELECT item.value
        FROM jsonb_array_elements(v_existing_mappings)
             AS item(value)
        WHERE item.value ->> 'source' = 'user'
    LOOP
        v_target_id :=
            v_human_mapping -> 'target' ->> 'targetId';

        IF v_target_id IS NULL OR btrim(v_target_id) = '' THEN
            RAISE EXCEPTION
                'Human-reviewed mapping has no deterministic target identity'
                USING ERRCODE = '23514';
        END IF;

        v_existing_index := NULL;

        SELECT (item.ordinality - 1)::integer
        INTO v_existing_index
        FROM jsonb_array_elements(v_merged_mappings)
             WITH ORDINALITY AS item(value, ordinality)
        WHERE item.value -> 'target' ->> 'targetId' = v_target_id
        LIMIT 1;

        IF v_existing_index IS NOT NULL THEN
            v_merged_mappings :=
                jsonb_set(
                    v_merged_mappings,
                    ARRAY[v_existing_index::text],
                    v_human_mapping,
                    false
                );
        ELSE
            v_merged_mappings :=
                v_merged_mappings
                || jsonb_build_array(v_human_mapping);
        END IF;

        /*
         * A human-reviewed target must not simultaneously remain an unresolved
         * AI suggestion.
         */
        SELECT COALESCE(
            jsonb_agg(item.value ORDER BY item.ordinality),
            '[]'::jsonb
        )
        INTO v_fresh_suggestions
        FROM jsonb_array_elements(v_fresh_suggestions)
             WITH ORDINALITY AS item(value, ordinality)
        WHERE item.value -> 'target' ->> 'targetId'
              IS DISTINCT FROM v_target_id;
    END LOOP;

    UPDATE public.lease_templates
    SET
        field_mapping = v_merged_mappings,
        ai_suggestions = v_fresh_suggestions,
        fields = COALESCE(p_fields, '[]'::jsonb),
        updated_at = v_now
    WHERE id = p_template_id
      AND entity_id = p_entity_id
      AND status = 'draft'
      AND review_status = 'in_review'
      AND source_document_id = p_source_document_id
      AND source_document_checksum = p_source_document_checksum;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Lease-template re-analysis state changed'
            USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.audit_log (
        user_id,
        user_email,
        action,
        resource_type,
        resource_id,
        resource_label,
        old_values,
        new_values,
        user_agent,
        created_at
    )
    VALUES (
        p_user_id,
        p_user_email,
        'update',
        'lease_template_analysis',
        p_template_id,
        v_template.template_name,
        jsonb_build_object(
            'field_mapping', v_template.field_mapping,
            'ai_suggestions', v_template.ai_suggestions,
            'fields', v_template.fields,
            'source_document_id', v_template.source_document_id,
            'source_document_checksum',
                v_template.source_document_checksum
        ),
        jsonb_build_object(
            'operation', 'reanalyse',
            'field_mapping', v_merged_mappings,
            'ai_suggestions', v_fresh_suggestions,
            'fields', COALESCE(p_fields, '[]'::jsonb),
            'source_document_id', p_source_document_id,
            'source_document_checksum',
                p_source_document_checksum
        ),
        p_user_agent,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'field_mapping', v_merged_mappings,
        'ai_suggestions', v_fresh_suggestions,
        'fields', COALESCE(p_fields, '[]'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reanalyse_lease_template(
    uuid,
    uuid,
    uuid,
    text,
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reanalyse_lease_template(
    uuid,
    uuid,
    uuid,
    text,
    uuid,
    text,
    jsonb,
    jsonb,
    jsonb,
    text
) TO service_role;

COMMIT;
