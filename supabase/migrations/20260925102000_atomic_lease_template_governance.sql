/*
 * Atomic lease-template governance.
 *
 * Authoritative transaction boundaries for:
 *   1. mapping review mutations;
 *   2. final reusable-template approval.
 *
 * The customer's original legal document is never modified here.
 * fields remains analysis/extraction data.
 * field_mapping remains reusable document-to-AssetFlow mapping data.
 *
 * Fine-grained lease-template permission keys do not yet exist in the
 * canonical AssetFlow permission authority. Until RBAC consolidation adds
 * them, these functions require explicit user/entity membership.
 */


/* ========================================================================
 * CANONICAL LEASE FIELD METADATA
 * ====================================================================== */

/*
 * Resolve canonical AssetFlow lease-field metadata inside the database
 * governance boundary.
 *
 * This intentionally mirrors lib/lease/templates/field-registry.ts.
 * Aliases are NOT accepted here. Aliases are discovery conveniences;
 * persisted approved mappings must use canonical AssetFlow keys.
 */
CREATE OR REPLACE FUNCTION public.lease_template_field_definition(
  p_field_key text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_field_key
    WHEN 'tenant_name' THEN
      jsonb_build_object(
        'key', 'tenant_name',
        'label', 'Tenant / Lessee Name',
        'type', 'text',
        'required', true
      )

    WHEN 'landlord_name' THEN
      jsonb_build_object(
        'key', 'landlord_name',
        'label', 'Landlord / Lessor Name',
        'type', 'text',
        'required', true
      )

    WHEN 'tenant_registration_number' THEN
      jsonb_build_object(
        'key', 'tenant_registration_number',
        'label', 'Tenant Registration Number',
        'type', 'text',
        'required', false
      )

    WHEN 'landlord_registration_number' THEN
      jsonb_build_object(
        'key', 'landlord_registration_number',
        'label', 'Landlord Registration Number',
        'type', 'text',
        'required', false
      )

    WHEN 'tenant_vat_number' THEN
      jsonb_build_object(
        'key', 'tenant_vat_number',
        'label', 'Tenant VAT Number',
        'type', 'text',
        'required', false
      )

    WHEN 'landlord_vat_number' THEN
      jsonb_build_object(
        'key', 'landlord_vat_number',
        'label', 'Landlord VAT Number',
        'type', 'text',
        'required', false
      )

    WHEN 'tenant_email' THEN
      jsonb_build_object(
        'key', 'tenant_email',
        'label', 'Tenant Email',
        'type', 'email',
        'required', false
      )

    WHEN 'landlord_email' THEN
      jsonb_build_object(
        'key', 'landlord_email',
        'label', 'Landlord Email',
        'type', 'email',
        'required', false
      )

    WHEN 'tenant_phone' THEN
      jsonb_build_object(
        'key', 'tenant_phone',
        'label', 'Tenant Telephone',
        'type', 'phone',
        'required', false
      )

    WHEN 'landlord_phone' THEN
      jsonb_build_object(
        'key', 'landlord_phone',
        'label', 'Landlord Telephone',
        'type', 'phone',
        'required', false
      )

    WHEN 'property_name' THEN
      jsonb_build_object(
        'key', 'property_name',
        'label', 'Property Name',
        'type', 'text',
        'required', true
      )

    WHEN 'unit_number' THEN
      jsonb_build_object(
        'key', 'unit_number',
        'label', 'Unit / Shop Number',
        'type', 'text',
        'required', true
      )

    WHEN 'lease_commencement_date' THEN
      jsonb_build_object(
        'key', 'lease_commencement_date',
        'label', 'Lease Commencement Date',
        'type', 'date',
        'required', true
      )

    WHEN 'lease_expiry_date' THEN
      jsonb_build_object(
        'key', 'lease_expiry_date',
        'label', 'Lease Expiry Date',
        'type', 'date',
        'required', true
      )

    WHEN 'monthly_rental' THEN
      jsonb_build_object(
        'key', 'monthly_rental',
        'label', 'Monthly Rental',
        'type', 'currency',
        'required', true
      )

    WHEN 'rental_escalation' THEN
      jsonb_build_object(
        'key', 'rental_escalation',
        'label', 'Rental Escalation',
        'type', 'percentage',
        'required', false
      )

    WHEN 'deposit_amount' THEN
      jsonb_build_object(
        'key', 'deposit_amount',
        'label', 'Deposit Amount',
        'type', 'currency',
        'required', false
      )

    WHEN 'lease_fee' THEN
      jsonb_build_object(
        'key', 'lease_fee',
        'label', 'Lease / Administration Fee',
        'type', 'currency',
        'required', false
      )

    ELSE NULL
  END;
$$;


/* ========================================================================
 * 1. ATOMIC MAPPING REVIEW
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.review_lease_template_mapping(
  p_template_id uuid,
  p_entity_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_action text,
  p_mapping_id text DEFAULT NULL,
  p_suggestion_id text DEFAULT NULL,
  p_field_key text DEFAULT NULL,
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
  v_suggestions jsonb;

  v_mapping jsonb;
  v_suggestion jsonb;
  v_target jsonb;
  v_field_definition jsonb;

  v_mapping_index integer;
  v_existing_index integer;

  v_new_mapping jsonb;

  v_now timestamptz := now();
BEGIN
  /*
   * STEP 1: Authorisation.
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

  IF p_action NOT IN ('confirm', 'correct', 'reject', 'assign') THEN
    RAISE EXCEPTION
      'Unsupported lease-template mapping action.';
  END IF;

  /*
   * STEP 2: Lock the template.
   *
   * This is the authoritative concurrency boundary for mapping review.
   * Every mutation of the JSONB mapping state serialises on this row.
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

  v_suggestions :=
    CASE
      WHEN jsonb_typeof(v_template.ai_suggestions) = 'array'
        THEN v_template.ai_suggestions
      ELSE '[]'::jsonb
    END;

  /*
   * STEP 3: CONFIRM / CORRECT / REJECT.
   */
  IF p_action IN ('confirm', 'correct', 'reject') THEN
    IF p_mapping_id IS NULL OR btrim(p_mapping_id) = '' THEN
      RAISE EXCEPTION 'Mapping id is required.';
    END IF;

    SELECT
      item.value,
      (item.ordinality - 1)::integer
    INTO
      v_mapping,
      v_mapping_index
    FROM jsonb_array_elements(v_mappings)
      WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value ->> 'id' = p_mapping_id
    LIMIT 1;

    IF v_mapping IS NULL THEN
      RAISE EXCEPTION 'Lease-template mapping not found.';
    END IF;

    /*
     * CONFIRM:
     * Existing system-proposed canonical mapping accepted by human.
     */
    IF p_action = 'confirm' THEN
      v_target := v_mapping -> 'target';

      IF v_target IS NULL
         OR jsonb_typeof(v_target) <> 'object'
         OR COALESCE(v_target ->> 'targetId', '') = '' THEN
        RAISE EXCEPTION
          'A mapping cannot be confirmed without a valid document target.';
      END IF;

      v_field_definition :=
        public.lease_template_field_definition(
          v_mapping ->> 'fieldKey'
        );

      IF v_field_definition IS NULL THEN
        RAISE EXCEPTION
          'A mapping cannot be confirmed with a non-canonical lease field.';
      END IF;

      /*
       * Re-normalise semantic metadata from the canonical registry even
       * when the mapping originated from automated discovery.
       */
      v_new_mapping :=
        v_mapping
        || jsonb_build_object(
          'fieldKey', v_field_definition ->> 'key',
          'label', v_field_definition ->> 'label',
          'type', v_field_definition ->> 'type',
          'required',
            (v_field_definition ->> 'required')::boolean,
          'status', 'confirmed',
          'source', 'user',
          'approved', false
        );

      v_new_mapping :=
        v_new_mapping - 'approvedBy' - 'approvedAt';

    /*
     * CORRECT:
     * Human changes the semantic interpretation while retaining the
     * discovered document target.
     */
    ELSIF p_action = 'correct' THEN
      IF p_field_key IS NULL OR btrim(p_field_key) = '' THEN
        RAISE EXCEPTION
          'A canonical field is required when correcting a mapping.';
      END IF;

      v_field_definition :=
        public.lease_template_field_definition(p_field_key);

      IF v_field_definition IS NULL THEN
        RAISE EXCEPTION
          'The supplied lease field is not canonical.';
      END IF;

      v_target := v_mapping -> 'target';

      IF v_target IS NULL
         OR jsonb_typeof(v_target) <> 'object'
         OR COALESCE(v_target ->> 'targetId', '') = '' THEN
        RAISE EXCEPTION
          'A mapping cannot be corrected without a valid document target.';
      END IF;

      v_new_mapping :=
        v_mapping
        || jsonb_build_object(
          'fieldKey', v_field_definition ->> 'key',
          'label', v_field_definition ->> 'label',
          'type', v_field_definition ->> 'type',
          'required',
            (v_field_definition ->> 'required')::boolean,
          'status', 'confirmed',
          'source', 'user',
          'approved', false
        );

      v_new_mapping :=
        v_new_mapping - 'approvedBy' - 'approvedAt';

    /*
     * REJECT:
     * Human explicitly decides that this proposed reusable mapping should
     * not participate in template population.
     */
    ELSE
      v_new_mapping :=
        v_mapping
        || jsonb_build_object(
          'status', 'rejected',
          'source', 'user',
          'approved', false
        );

      v_new_mapping :=
        v_new_mapping - 'approvedBy' - 'approvedAt';
    END IF;

    v_mappings :=
      jsonb_set(
        v_mappings,
        ARRAY[v_mapping_index::text],
        v_new_mapping,
        false
      );

  /*
   * STEP 4: ASSIGN AN UNRESOLVED DOCUMENT TARGET.
   */
  ELSE
    IF p_suggestion_id IS NULL
       OR btrim(p_suggestion_id) = '' THEN
      RAISE EXCEPTION 'Suggestion id is required.';
    END IF;

    IF p_field_key IS NULL
       OR btrim(p_field_key) = '' THEN
      RAISE EXCEPTION
        'A canonical field is required when assigning a target.';
    END IF;

    v_field_definition :=
      public.lease_template_field_definition(p_field_key);

    IF v_field_definition IS NULL THEN
      RAISE EXCEPTION
        'The supplied lease field is not canonical.';
    END IF;

    SELECT item.value
    INTO v_suggestion
    FROM jsonb_array_elements(v_suggestions)
      WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value ->> 'id' = p_suggestion_id
    LIMIT 1;

    IF v_suggestion IS NULL THEN
      RAISE EXCEPTION 'Lease-template suggestion not found.';
    END IF;

    v_target := v_suggestion -> 'target';

    IF v_target IS NULL
       OR jsonb_typeof(v_target) <> 'object'
       OR COALESCE(v_target ->> 'targetId', '') = '' THEN
      RAISE EXCEPTION
        'The unresolved suggestion does not contain a valid document target.';
    END IF;

    /*
     * A target may already have a rejected mapping.
     *
     * Replace the existing target mapping rather than appending a second
     * deterministic mapping identity.
     */
    SELECT
      (item.ordinality - 1)::integer
    INTO v_existing_index
    FROM jsonb_array_elements(v_mappings)
      WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value -> 'target' ->> 'targetId'
          = v_target ->> 'targetId'
    LIMIT 1;

    v_new_mapping :=
      jsonb_build_object(
        'id',
          'mapping-'
          || (v_field_definition ->> 'key')
          || '-'
          || (v_target ->> 'targetId'),

        'fieldKey',
          v_field_definition ->> 'key',

        'label',
          v_field_definition ->> 'label',

        'type',
          v_field_definition ->> 'type',

        'required',
          (v_field_definition ->> 'required')::boolean,

        'target',
          v_target,

        'status',
          'confirmed',

        'confidence',
          COALESCE(
            v_suggestion -> 'confidence',
            '{}'::jsonb
          ),

        'evidence',
          COALESCE(
            v_suggestion -> 'evidence',
            'null'::jsonb
          ),

        'source',
          'user',

        'approved',
          false
      );

    IF v_existing_index IS NOT NULL THEN
      v_mappings :=
        jsonb_set(
          v_mappings,
          ARRAY[v_existing_index::text],
          v_new_mapping,
          false
        );
    ELSE
      v_mappings :=
        v_mappings || jsonb_build_array(v_new_mapping);
    END IF;

    /*
     * Remove only the unresolved suggestion that has now been assigned.
     */
    SELECT COALESCE(
      jsonb_agg(item.value ORDER BY item.ordinality),
      '[]'::jsonb
    )
    INTO v_suggestions
    FROM jsonb_array_elements(v_suggestions)
      WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value ->> 'id' <> p_suggestion_id;
  END IF;

  /*
   * STEP 5: Persist.
   */
  UPDATE public.lease_templates
  SET
    field_mapping = v_mappings,
    ai_suggestions = v_suggestions,
    updated_at = v_now
  WHERE id = p_template_id
    AND entity_id = p_entity_id;

  /*
   * STEP 6: Immutable audit record.
   *
   * The audit insert is inside the same PostgreSQL transaction. Failure
   * therefore rolls back the mapping mutation.
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
    CASE
      WHEN p_action = 'reject' THEN 'reject'
      ELSE 'update'
    END,
    'lease_template_mapping',
    p_template_id,
    v_template.template_name,
    jsonb_build_object(
      'field_mapping', v_template.field_mapping,
      'ai_suggestions', v_template.ai_suggestions
    ),
    jsonb_build_object(
      'action', p_action,
      'mappingId', p_mapping_id,
      'suggestionId', p_suggestion_id,
      'fieldKey',
        CASE
          WHEN p_action = 'confirm'
            THEN v_new_mapping ->> 'fieldKey'
          ELSE p_field_key
        END,
      'field_mapping', v_mappings,
      'ai_suggestions', v_suggestions
    ),
    p_user_agent,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'field_mapping', v_mappings,
    'ai_suggestions', v_suggestions
  );
END;
$$;


/* ========================================================================
 * 2. ATOMIC FINAL APPROVAL
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.approve_lease_template(
  p_template_id uuid,
  p_entity_id uuid,
  p_user_id uuid,
  p_user_email text,
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
  v_suggestions jsonb;
  v_approved_mappings jsonb;

  v_confirmed_count integer := 0;
  v_suggested_count integer := 0;
  v_unresolved_count integer := 0;
  v_unreviewed_count integer := 0;
  v_invalid_confirmed_count integer := 0;
  v_unresolved_target_count integer := 0;
  v_critical_finding_count integer := 0;

  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  /*
   * STEP 1: Authorisation.
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

  /*
   * STEP 2: Lock template.
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
      'This lease template is not currently awaiting approval.';
  END IF;

  IF v_template.source_document_id IS NULL THEN
    RAISE EXCEPTION
      'A source document is required before approval.';
  END IF;

  v_mappings :=
    CASE
      WHEN jsonb_typeof(v_template.field_mapping) = 'array'
        THEN v_template.field_mapping
      ELSE '[]'::jsonb
    END;

  v_suggestions :=
    CASE
      WHEN jsonb_typeof(v_template.ai_suggestions) = 'array'
        THEN v_template.ai_suggestions
      ELSE '[]'::jsonb
    END;

  /*
   * STEP 3: Validate complete human review state.
   */
  SELECT COUNT(*)
  INTO v_confirmed_count
  FROM jsonb_array_elements(v_mappings) AS item(value)
  WHERE item.value ->> 'status' = 'confirmed';

  SELECT COUNT(*)
  INTO v_suggested_count
  FROM jsonb_array_elements(v_mappings) AS item(value)
  WHERE item.value ->> 'status' = 'suggested';

  SELECT COUNT(*)
  INTO v_unresolved_count
  FROM jsonb_array_elements(v_mappings) AS item(value)
  WHERE item.value ->> 'status' = 'unresolved';

  /*
   * Unknown/malformed status is also unsafe. Approval requires every
   * mapping to have reached an explicit terminal human-review state.
   */
  SELECT COUNT(*)
  INTO v_unreviewed_count
  FROM jsonb_array_elements(v_mappings) AS item(value)
  WHERE COALESCE(item.value ->> 'status', '')
        NOT IN ('confirmed', 'rejected');

  /*
   * Every confirmed mapping must:
   *   - use a canonical AssetFlow field;
   *   - contain a valid document target.
   */
  SELECT COUNT(*)
  INTO v_invalid_confirmed_count
  FROM jsonb_array_elements(v_mappings) AS item(value)
  WHERE item.value ->> 'status' = 'confirmed'
    AND (
      public.lease_template_field_definition(
        item.value ->> 'fieldKey'
      ) IS NULL
      OR item.value -> 'target' IS NULL
      OR jsonb_typeof(item.value -> 'target') <> 'object'
      OR COALESCE(
        item.value -> 'target' ->> 'targetId',
        ''
      ) = ''
    );

  /*
   * Any still-present target-bearing suggestion represents unresolved
   * reusable document structure and therefore blocks approval.
   *
   * Non-target informational/warning suggestions remain review context.
   */
  SELECT COUNT(*)
  INTO v_unresolved_target_count
  FROM jsonb_array_elements(v_suggestions) AS item(value)
  WHERE item.value -> 'target' IS NOT NULL
    AND jsonb_typeof(item.value -> 'target') = 'object'
    AND COALESCE(
      item.value -> 'target' ->> 'targetId',
      ''
    ) <> '';

  /*
   * Critical analysis findings always block approval.
   */
  SELECT COUNT(*)
  INTO v_critical_finding_count
  FROM jsonb_array_elements(v_suggestions) AS item(value)
  WHERE lower(
    COALESCE(item.value ->> 'severity', '')
  ) = 'critical';

  IF v_confirmed_count = 0 THEN
    RAISE EXCEPTION
      'At least one confirmed reusable mapping is required before approval.';
  END IF;

  IF v_suggested_count > 0 THEN
    RAISE EXCEPTION
      'All suggested mappings must be reviewed before approval.';
  END IF;

  IF v_unresolved_count > 0 THEN
    RAISE EXCEPTION
      'All unresolved mappings must be resolved before approval.';
  END IF;

  IF v_unreviewed_count > 0 THEN
    RAISE EXCEPTION
      'Every mapping must be explicitly confirmed or rejected before approval.';
  END IF;

  IF v_invalid_confirmed_count > 0 THEN
    RAISE EXCEPTION
      'One or more confirmed mappings contain an invalid canonical field or document target.';
  END IF;

  IF v_unresolved_target_count > 0 THEN
    RAISE EXCEPTION
      'All unresolved document targets must be reviewed before approval.';
  END IF;

  IF v_critical_finding_count > 0 THEN
    RAISE EXCEPTION
      'Critical template-analysis findings must be resolved before approval.';
  END IF;

  /*
   * STEP 4: Final mapping approval metadata.
   *
   * Confirmed mappings become approved.
   * Rejected mappings remain rejected and explicitly unapproved.
   */
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN item.value ->> 'status' = 'confirmed' THEN
          item.value
          || jsonb_build_object(
            'approved', true,
            'approvedBy', p_user_id,
            'approvedAt', v_now
          )

        ELSE
          (
            item.value
            || jsonb_build_object(
              'approved',
              false
            )
          )
          - 'approvedBy'
          - 'approvedAt'
      END
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_approved_mappings
  FROM jsonb_array_elements(v_mappings)
    WITH ORDINALITY AS item(value, ordinality);

  /*
   * STEP 5: Activate reusable template atomically.
   *
   * fields is intentionally untouched.
   */
  UPDATE public.lease_templates AS lt
  SET
    field_mapping = v_approved_mappings,
    status = 'active',
    review_status = 'approved',
    reviewed_by = p_user_id,
    reviewed_at = v_now,
    updated_at = v_now
  WHERE lt.id = p_template_id
    AND lt.entity_id = p_entity_id
  RETURNING to_jsonb(lt)
  INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION
      'Lease template approval update failed.';
  END IF;

  /*
   * STEP 6: Immutable approval audit.
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
    'approve',
    'lease_template',
    p_template_id,
    v_template.template_name,
    jsonb_build_object(
      'status', v_template.status,
      'review_status', v_template.review_status,
      'field_mapping', v_template.field_mapping
    ),
    jsonb_build_object(
      'status', 'active',
      'review_status', 'approved',
      'field_mapping', v_approved_mappings,
      'reviewed_by', p_user_id,
      'reviewed_at', v_now
    ),
    p_user_agent,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'template', v_result
  );
END;
$$;


/* ========================================================================
 * 3. EXECUTION PRIVILEGES
 * ====================================================================== */

/*
 * Governance RPCs are server-side only.
 *
 * They are SECURITY DEFINER because the trusted API uses the service role.
 * Each function still independently verifies the authenticated user's
 * explicit entity membership.
 */

REVOKE ALL ON FUNCTION public.lease_template_field_definition(
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.review_lease_template_mapping(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_lease_template(
  uuid,
  uuid,
  uuid,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lease_template_field_definition(
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.review_lease_template_mapping(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.approve_lease_template(
  uuid,
  uuid,
  uuid,
  text,
  text
) TO service_role;
