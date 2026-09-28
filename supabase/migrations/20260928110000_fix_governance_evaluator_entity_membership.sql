BEGIN;

-- Correct governance evaluator entity membership semantics.
-- auth_entities() returns uuid[], so membership must use ANY().

CREATE OR REPLACE FUNCTION public.evaluate_governance_internal(
  p_entity_id uuid,
  p_domain text,
  p_workflow_stage text,
  p_reference_type text,
  p_reference_id uuid,
  p_reference_version_id uuid,
  p_portfolio_id uuid,
  p_property_type_id uuid,
  p_property_id uuid,
  p_counterparty_id uuid,
  p_effective_date date,
  p_canonical_actual_values jsonb,
  p_context_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_evaluation_id uuid;
  v_rule record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_actual_value jsonb;
  v_passed boolean;
  v_outcome text;
  v_overall_outcome text := 'PASS';
  v_policy_snapshot jsonb := '[]'::jsonb;
  v_rule_count integer := 0;
BEGIN
  -- ------------------------------------------------------------------------
  -- Authority and input contract
  -- ------------------------------------------------------------------------

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for governance evaluation';
  END IF;

  IF NOT (
    p_entity_id = ANY(public.auth_entities())
  ) THEN
    RAISE EXCEPTION
      'User does not have access to entity %',
      p_entity_id;
  END IF;

  IF NOT public.has_entity_permission(
    v_actor_id,
    p_entity_id,
    'governance.evaluate'
  ) THEN
    RAISE EXCEPTION
      'User does not have governance.evaluate permission for entity %',
      p_entity_id;
  END IF;

  IF p_domain IS NULL OR btrim(p_domain) = '' THEN
    RAISE EXCEPTION 'Governance evaluation domain is required';
  END IF;

  IF p_reference_type IS NULL OR btrim(p_reference_type) = '' THEN
    RAISE EXCEPTION 'Governance evaluation reference type is required';
  END IF;

  IF p_reference_id IS NULL THEN
    RAISE EXCEPTION 'Governance evaluation reference id is required';
  END IF;

  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'Governance evaluation effective date is required';
  END IF;

  IF p_canonical_actual_values IS NULL
     OR jsonb_typeof(p_canonical_actual_values) <> 'object' THEN
    RAISE EXCEPTION
      'Canonical governance actual values must be a JSON object';
  END IF;

  IF p_context_snapshot IS NULL
     OR jsonb_typeof(p_context_snapshot) <> 'object' THEN
    RAISE EXCEPTION
      'Governance context snapshot must be a JSON object';
  END IF;

  PERFORM public.validate_governance_evaluation_context(
    p_entity_id,
    p_portfolio_id,
    p_property_type_id,
    p_property_id,
    p_counterparty_id
  );

  -- ------------------------------------------------------------------------
  -- PASS 1
  --
  -- Resolve and evaluate the complete policy before writing any evidence.
  -- This allows the immutable evaluation header to be inserted once with its
  -- final outcome and final policy snapshot.
  -- ------------------------------------------------------------------------

  FOR v_rule IN
    SELECT *
    FROM public.resolve_governance_policy_internal(
      p_entity_id,
      p_domain,
      p_workflow_stage,
      p_reference_type,
      p_reference_id,
      p_portfolio_id,
      p_property_type_id,
      p_property_id,
      p_counterparty_id,
      p_effective_date
    )
  LOOP
    v_rule_count := v_rule_count + 1;

    IF p_canonical_actual_values ? v_rule.rule_key THEN
      v_actual_value := p_canonical_actual_values -> v_rule.rule_key;
    ELSE
      v_actual_value := NULL;
    END IF;

    v_passed := public.evaluate_governance_value(
      v_rule.value_type,
      v_rule.evaluation_operator,
      v_rule.required_value,
      v_actual_value
    );

    IF v_passed THEN
      v_outcome := 'PASS';
    ELSE
      v_outcome := v_rule.failure_outcome;
    END IF;

    IF v_outcome = 'BLOCK' THEN
      v_overall_outcome := 'BLOCK';

    ELSIF v_outcome = 'REQUIRES_APPROVAL'
      AND v_overall_outcome <> 'BLOCK' THEN
      v_overall_outcome := 'REQUIRES_APPROVAL';

    ELSIF v_outcome = 'WARNING'
      AND v_overall_outcome NOT IN (
        'BLOCK',
        'REQUIRES_APPROVAL'
      ) THEN
      v_overall_outcome := 'WARNING';
    END IF;

    v_policy_snapshot := v_policy_snapshot || jsonb_build_array(
      jsonb_build_object(
        'rule_definition_id', v_rule.rule_definition_id,
        'rule_key', v_rule.rule_key,
        'value_type', v_rule.value_type,
        'governance_class', v_rule.governance_class,
        'inheritance_mode', v_rule.inheritance_mode,
        'evaluation_operator', v_rule.evaluation_operator,
        'required_value', v_rule.required_value,
        'failure_outcome', v_rule.failure_outcome,
        'policy_rule_id', v_rule.policy_rule_id,
        'policy_set_id', v_rule.policy_set_id,
        'source_scope_type', v_rule.source_scope_type,
        'source_scope_id', v_rule.source_scope_id,
        'exception_id', v_rule.applied_exception_id,
        'provenance', v_rule.provenance
      )
    );

    v_result := jsonb_build_object(
      'rule_definition_id', v_rule.rule_definition_id,
      'rule_key', v_rule.rule_key,
      'policy_rule_id', v_rule.policy_rule_id,
      'exception_id', v_rule.applied_exception_id,
      'outcome', v_outcome,
      'required_value', v_rule.required_value,
      'actual_value', v_actual_value,
      'source_scope_type', v_rule.source_scope_type,
      'source_scope_id', v_rule.source_scope_id,
      'explanation',
        CASE
          WHEN v_passed THEN
            format(
              'Rule %s satisfied using operator %s.',
              v_rule.rule_key,
              v_rule.evaluation_operator
            )
          ELSE
            format(
              'Rule %s failed using operator %s; configured failure outcome is %s.',
              v_rule.rule_key,
              v_rule.evaluation_operator,
              v_rule.failure_outcome
            )
        END,
      'evidence',
        jsonb_build_object(
          'rule_key', v_rule.rule_key,
          'value_type', v_rule.value_type,
          'governance_class', v_rule.governance_class,
          'inheritance_mode', v_rule.inheritance_mode,
          'evaluation_operator', v_rule.evaluation_operator,
          'provenance', v_rule.provenance
        )
    );

    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION
      'No applicable active governance rules were resolved for entity %, domain %, stage %',
      p_entity_id,
      p_domain,
      COALESCE(p_workflow_stage, '<none>');
  END IF;

  -- ------------------------------------------------------------------------
  -- PASS 2
  --
  -- The complete outcome is now known. Insert the immutable evaluation
  -- header once, followed by immutable per-rule evidence.
  -- ------------------------------------------------------------------------

  INSERT INTO public.governance_evaluations (
    entity_id,
    domain,
    workflow_stage,
    reference_type,
    reference_id,
    reference_version_id,
    portfolio_id,
    property_type_id,
    property_id,
    counterparty_id,
    effective_date,
    overall_outcome,
    context_snapshot,
    policy_snapshot,
    evaluated_by,
    evaluated_at
  )
  VALUES (
    p_entity_id,
    p_domain,
    p_workflow_stage,
    p_reference_type,
    p_reference_id,
    p_reference_version_id,
    p_portfolio_id,
    p_property_type_id,
    p_property_id,
    p_counterparty_id,
    p_effective_date,
    v_overall_outcome,
    p_context_snapshot,
    v_policy_snapshot,
    v_actor_id,
    now()
  )
  RETURNING id INTO v_evaluation_id;

  FOR v_result IN
    SELECT value
    FROM jsonb_array_elements(v_results)
  LOOP
    INSERT INTO public.governance_evaluation_results (
      evaluation_id,
      rule_definition_id,
      policy_rule_id,
      exception_id,
      outcome,
      required_value,
      actual_value,
      source_scope_type,
      source_scope_id,
      explanation,
      evidence
    )
    VALUES (
      v_evaluation_id,
      (v_result ->> 'rule_definition_id')::uuid,
      NULLIF(v_result ->> 'policy_rule_id', '')::uuid,
      NULLIF(v_result ->> 'exception_id', '')::uuid,
      v_result ->> 'outcome',
      v_result -> 'required_value',
      v_result -> 'actual_value',
      v_result ->> 'source_scope_type',
      NULLIF(v_result ->> 'source_scope_id', '')::uuid,
      v_result ->> 'explanation',
      v_result -> 'evidence'
    );
  END LOOP;

  RETURN v_evaluation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_governance_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, date, jsonb, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.evaluate_governance_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, date, jsonb, jsonb
) FROM anon;

REVOKE ALL ON FUNCTION public.evaluate_governance_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, date, jsonb, jsonb
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.evaluate_governance_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, date, jsonb, jsonb
) TO service_role, postgres;

COMMIT;
