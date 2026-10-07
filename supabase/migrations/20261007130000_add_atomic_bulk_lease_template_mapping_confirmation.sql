BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_lease_template_mappings(
  p_template_id uuid,
  p_entity_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_mapping_ids jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.lease_templates%ROWTYPE;
  v_mappings jsonb;
  v_mapping_ids jsonb;
  v_new_mappings jsonb;

  v_requested_count integer := 0;
  v_distinct_count integer := 0;
  v_found_count integer := 0;
  v_invalid_count integer := 0;

  v_now timestamptz := now();
BEGIN
  /*
   * STEP 1: Authorisation.
   *
   * Bulk review has exactly the same authority boundary as an
   * individual mapping confirmation.
   */
  IF p_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_entity_access uea
       WHERE uea.user_id = p_user_id
         AND uea.entity_id = p_entity_id
     ) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  IF public.has_entity_permission(
    p_user_id,
    p_entity_id,
    'leasing.template.review'
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION
      'Access denied: leasing.template.review required.'
      USING ERRCODE = '42501';
  END IF;

  /*
   * STEP 2: Validate the requested set before locking/mutating state.
   */
  IF p_mapping_ids IS NULL
     OR jsonb_typeof(p_mapping_ids) <> 'array'
     OR jsonb_array_length(p_mapping_ids) = 0 THEN
    RAISE EXCEPTION
      'At least one mapping id is required.';
  END IF;

  /*
   * Every array element must be a non-empty JSON string.
   */
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_mapping_ids) AS item(value)
    WHERE jsonb_typeof(item.value) <> 'string'
       OR btrim(item.value #>> '{}') = ''
  ) THEN
    RAISE EXCEPTION
      'Every mapping id must be a non-empty string.';
  END IF;

  SELECT
    COUNT(*),
    COUNT(DISTINCT item.value #>> '{}')
  INTO
    v_requested_count,
    v_distinct_count
  FROM jsonb_array_elements(p_mapping_ids) AS item(value);

  IF v_requested_count <> v_distinct_count THEN
    RAISE EXCEPTION
      'Duplicate mapping ids are not allowed.';
  END IF;

  v_mapping_ids := p_mapping_ids;

  /*
   * STEP 3: Lock the template once.
   *
   * This makes the entire bulk operation all-or-nothing and serialises
   * against individual review, re-analysis and approval mutations.
   */
  SELECT *
  INTO v_template
  FROM public.lease_templates
  WHERE id = p_template_id
    AND entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease template not found.';
  END IF;

  IF v_template.status <> 'draft'
     OR v_template.review_status <> 'in_review' THEN
    RAISE EXCEPTION
      'Lease template is not currently available for mapping review.';
  END IF;

  v_mappings :=
    CASE
      WHEN jsonb_typeof(v_template.field_mapping) = 'array'
        THEN v_template.field_mapping
      ELSE '[]'::jsonb
    END;

  /*
   * STEP 4: Validate the complete selected set before changing anything.
   *
   * A bulk confirmation may only accept current machine suggestions.
   * Already-confirmed/rejected mappings cannot be silently re-reviewed.
   */
  SELECT COUNT(*)
  INTO v_found_count
  FROM jsonb_array_elements(v_mappings) AS mapping(value)
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_mapping_ids) AS requested(value)
    WHERE requested.value #>> '{}'
          = mapping.value ->> 'id'
  );

  IF v_found_count <> v_requested_count THEN
    RAISE EXCEPTION
      'One or more selected lease-template mappings were not found.';
  END IF;

  SELECT COUNT(*)
  INTO v_invalid_count
  FROM jsonb_array_elements(v_mappings) AS mapping(value)
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_mapping_ids) AS requested(value)
    WHERE requested.value #>> '{}'
          = mapping.value ->> 'id'
  )
  AND (
    mapping.value ->> 'status' <> 'suggested'
    OR mapping.value -> 'target' IS NULL
    OR jsonb_typeof(mapping.value -> 'target') <> 'object'
    OR COALESCE(
      mapping.value -> 'target' ->> 'targetId',
      ''
    ) = ''
    OR public.lease_template_field_definition(
      mapping.value ->> 'fieldKey'
    ) IS NULL
  );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'One or more selected mappings cannot be confirmed.';
  END IF;

  /*
   * STEP 5: Confirm every selected mapping while preserving array order.
   *
   * Canonical semantic metadata is re-normalised exactly as it is in
   * review_lease_template_mapping(confirm).
   */
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_mapping_ids) AS requested(value)
          WHERE requested.value #>> '{}'
                = mapping.value ->> 'id'
        )
        THEN
          (
            mapping.value
            || jsonb_build_object(
              'fieldKey',
                field_definition.definition ->> 'key',
              'label',
                field_definition.definition ->> 'label',
              'type',
                field_definition.definition ->> 'type',
              'required',
                (
                  field_definition.definition ->> 'required'
                )::boolean,
              'status',
                'confirmed',
              'source',
                'user',
              'approved',
                false
            )
          )
          - 'approvedBy'
          - 'approvedAt'
        ELSE mapping.value
      END
      ORDER BY mapping.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_new_mappings
  FROM jsonb_array_elements(v_mappings)
    WITH ORDINALITY AS mapping(value, ordinality)
  LEFT JOIN LATERAL (
    SELECT public.lease_template_field_definition(
      mapping.value ->> 'fieldKey'
    ) AS definition
  ) AS field_definition
    ON TRUE;

  /*
   * STEP 6: Persist once.
   */
  UPDATE public.lease_templates
  SET
    field_mapping = v_new_mappings,
    updated_at = v_now
  WHERE id = p_template_id
    AND entity_id = p_entity_id
    AND status = 'draft'
    AND review_status = 'in_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Lease template state changed during bulk mapping review.';
  END IF;

  /*
   * STEP 7: One immutable audit event for the atomic user decision.
   */
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
    'lease_template_mapping',
    p_template_id,
    v_template.template_name,
    jsonb_build_object(
      'field_mapping',
      v_template.field_mapping
    ),
    jsonb_build_object(
      'action',
      'bulk_confirm',
      'mappingIds',
      v_mapping_ids,
      'confirmedCount',
      v_requested_count,
      'field_mapping',
      v_new_mappings
    ),
    p_user_agent,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'confirmedCount', v_requested_count,
    'field_mapping', v_new_mappings,
    'ai_suggestions',
      CASE
        WHEN jsonb_typeof(v_template.ai_suggestions) = 'array'
          THEN v_template.ai_suggestions
        ELSE '[]'::jsonb
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_lease_template_mappings(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_lease_template_mappings(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  text
) TO service_role;

COMMIT;
