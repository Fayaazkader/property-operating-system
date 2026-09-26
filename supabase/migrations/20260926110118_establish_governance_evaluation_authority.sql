BEGIN;

-- ============================================================================
-- ASSETFLOW
-- Canonical Governance Evaluation Authority
--
-- Establishes deterministic rule semantics, immutable governance evidence,
-- and the primitives required by domain-specific governed workflows.
-- ============================================================================


-- ============================================================================
-- 1. RULE EVALUATION SEMANTICS
-- ============================================================================

ALTER TABLE public.governance_rule_definitions
ADD COLUMN evaluation_operator text;

-- Platform invariants are AssetFlow-owned requirements. Their required value
-- belongs to the rule definition itself so that the invariant exists
-- independently of any client policy set.
ALTER TABLE public.governance_rule_definitions
ADD COLUMN platform_value jsonb;

ALTER TABLE public.governance_rule_definitions
ADD COLUMN platform_failure_outcome text;

ALTER TABLE public.governance_rule_definitions
ADD CONSTRAINT governance_rule_definitions_platform_contract_check
CHECK (
  (
    governance_class = 'platform_invariant'
    AND inheritance_mode = 'non_overridable'
    AND override_allowed = false
    AND platform_value IS NOT NULL
    AND platform_failure_outcome IN (
      'WARNING',
      'REQUIRES_APPROVAL',
      'BLOCK'
    )
  )
  OR
  (
    governance_class <> 'platform_invariant'
    AND inheritance_mode <> 'non_overridable'
    AND platform_value IS NULL
    AND platform_failure_outcome IS NULL
  )
);

ALTER TABLE public.governance_rule_definitions
ADD CONSTRAINT governance_rule_definitions_evaluation_operator_check
CHECK (
  evaluation_operator IS NULL
  OR evaluation_operator IN (
    'equals',
    'not_equals',
    'greater_than',
    'greater_than_or_equal',
    'less_than',
    'less_than_or_equal',
    'contains',
    'contains_any',
    'contains_all',
    'exists'
  )
);


ALTER TABLE public.governance_policy_rules
ADD COLUMN failure_outcome text NOT NULL DEFAULT 'REQUIRES_APPROVAL';

ALTER TABLE public.governance_policy_rules
ADD CONSTRAINT governance_policy_rules_failure_outcome_check
CHECK (
  failure_outcome IN (
    'WARNING',
    'REQUIRES_APPROVAL',
    'BLOCK'
  )
);


-- Existing definitions were created before comparator semantics existed.
-- Do not invent comparators for them. A definition cannot participate in
-- deterministic evaluation until its operator is explicitly configured.


-- ============================================================================
-- 2. VALIDATE OPERATOR / VALUE-TYPE COMPATIBILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.governance_operator_is_valid(
  p_value_type text,
  p_operator text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_operator IS NULL THEN false

    WHEN p_operator IN ('equals', 'not_equals')
      THEN p_value_type IN (
        'boolean',
        'number',
        'text',
        'date',
        'enum',
        'list',
        'structured'
      )

    WHEN p_operator IN (
      'greater_than',
      'greater_than_or_equal',
      'less_than',
      'less_than_or_equal'
    )
      THEN p_value_type IN ('number', 'date')

    WHEN p_operator = 'contains'
      THEN p_value_type IN ('text', 'list')

    WHEN p_operator IN ('contains_any', 'contains_all')
      THEN p_value_type = 'list'

    WHEN p_operator = 'exists'
      THEN p_value_type IN (
        'boolean',
        'number',
        'text',
        'date',
        'enum',
        'list',
        'structured'
      )

    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.governance_operator_is_valid(text, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.governance_operator_is_valid(text, text)
FROM anon;

REVOKE ALL ON FUNCTION public.governance_operator_is_valid(text, text)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.governance_operator_is_valid(text, text)
TO service_role, postgres;


-- ============================================================================
-- 2A. HARDEN CLIENT POLICY-RULE VALIDATION
--
-- Platform invariants are AssetFlow-owned and cannot be assigned through
-- client policy sets. Client-configurable definitions must also declare a
-- deterministic operator compatible with their value type before they can
-- participate in an approved/active policy.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_governance_policy_rule(
  p_policy_set_id uuid,
  p_rule_definition_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_value jsonb,
  p_effective_from date DEFAULT NULL,
  p_effective_to date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id uuid;
  v_policy_domain text;

  v_rule_domain text;
  v_value_type text;
  v_governance_class text;
  v_evaluation_operator text;
  v_definition_active boolean;

  v_scope_entity_id uuid;
BEGIN
  IF p_policy_set_id IS NULL THEN
    RAISE EXCEPTION 'Policy set is required';
  END IF;

  IF p_rule_definition_id IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition is required';
  END IF;

  SELECT
    entity_id,
    domain
  INTO
    v_entity_id,
    v_policy_domain
  FROM public.governance_policy_sets
  WHERE id = p_policy_set_id;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  SELECT
    domain,
    value_type,
    governance_class,
    evaluation_operator,
    is_active
  INTO
    v_rule_domain,
    v_value_type,
    v_governance_class,
    v_evaluation_operator,
    v_definition_active
  FROM public.governance_rule_definitions
  WHERE id = p_rule_definition_id;

  IF v_value_type IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition not found';
  END IF;

  IF NOT v_definition_active THEN
    RAISE EXCEPTION 'Governance rule definition is inactive';
  END IF;

  IF v_rule_domain <> v_policy_domain THEN
    RAISE EXCEPTION
      'Governance rule definition domain (%) does not match policy-set domain (%)',
      v_rule_domain,
      v_policy_domain;
  END IF;

  IF v_governance_class = 'platform_invariant' THEN
    RAISE EXCEPTION
      'Platform invariant % cannot be assigned through a client policy set',
      p_rule_definition_id;
  END IF;

  IF v_evaluation_operator IS NULL THEN
    RAISE EXCEPTION
      'Governance rule definition % has no evaluation operator',
      p_rule_definition_id;
  END IF;

  IF NOT public.governance_operator_is_valid(
    v_value_type,
    v_evaluation_operator
  ) THEN
    RAISE EXCEPTION
      'Evaluation operator % is not valid for declared value type %',
      v_evaluation_operator,
      v_value_type;
  END IF;

  IF NOT public.governance_rule_value_is_valid(
    v_value_type,
    p_value
  ) THEN
    RAISE EXCEPTION
      'Policy rule value does not match declared value type %',
      v_value_type;
  END IF;

  IF p_scope_type IS NULL THEN
    RAISE EXCEPTION 'Policy scope type is required';
  END IF;

  IF p_scope_type NOT IN (
    'entity',
    'portfolio',
    'property_type',
    'property',
    'counterparty'
  ) THEN
    RAISE EXCEPTION 'Invalid policy scope type';
  END IF;

  IF p_scope_type = 'entity' THEN
    IF p_scope_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Entity-scoped policy rules must not provide scope_id';
    END IF;

  ELSE
    IF p_scope_id IS NULL THEN
      RAISE EXCEPTION 'Scoped policy rule requires scope_id';
    END IF;

    CASE p_scope_type
      WHEN 'portfolio' THEN
        SELECT entity_id
        INTO v_scope_entity_id
        FROM public.portfolios
        WHERE id = p_scope_id;

        IF v_scope_entity_id IS NULL THEN
          RAISE EXCEPTION 'Portfolio scope not found';
        END IF;

        IF v_scope_entity_id <> v_entity_id THEN
          RAISE EXCEPTION
            'Portfolio scope does not belong to policy-set entity';
        END IF;

      WHEN 'property_type' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.property_types
          WHERE id = p_scope_id
        ) THEN
          RAISE EXCEPTION 'Property type scope not found';
        END IF;

      WHEN 'property' THEN
        SELECT entity_id
        INTO v_scope_entity_id
        FROM public.properties
        WHERE id = p_scope_id;

        IF v_scope_entity_id IS NULL THEN
          RAISE EXCEPTION 'Property scope not found';
        END IF;

        IF v_scope_entity_id <> v_entity_id THEN
          RAISE EXCEPTION
            'Property scope does not belong to policy-set entity';
        END IF;

      WHEN 'counterparty' THEN
        SELECT entity_id
        INTO v_scope_entity_id
        FROM public.tenants
        WHERE id = p_scope_id;

        IF v_scope_entity_id IS NULL THEN
          RAISE EXCEPTION 'Counterparty scope not found';
        END IF;

        IF v_scope_entity_id <> v_entity_id THEN
          RAISE EXCEPTION
            'Counterparty scope does not belong to policy-set entity';
        END IF;
    END CASE;
  END IF;

  IF p_effective_to IS NOT NULL
     AND p_effective_from IS NOT NULL
     AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION
      'Policy rule effective_to cannot precede effective_from';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_governance_policy_rule(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  date,
  date
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.validate_governance_policy_rule(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  date,
  date
) FROM anon;

REVOKE ALL ON FUNCTION public.validate_governance_policy_rule(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  date,
  date
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.validate_governance_policy_rule(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  date,
  date
) TO service_role, postgres;


-- ============================================================================
-- 3. CANONICAL VALUE COMPARATOR
--
-- Returns:
--   true  -> actual value satisfies requirement
--   false -> actual value does not satisfy requirement
--
-- Missing actual values are handled explicitly. For all operators other than
-- exists they fail the requirement. For exists, required_value must be a
-- boolean describing whether a value must exist.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.evaluate_governance_value(
  p_value_type text,
  p_operator text,
  p_required_value jsonb,
  p_actual_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_required_text text;
  v_actual_text text;

  v_required_number numeric;
  v_actual_number numeric;

  v_required_date date;
  v_actual_date date;

  v_required_exists boolean;
  v_actual_exists boolean;
BEGIN
  IF NOT public.governance_operator_is_valid(
    p_value_type,
    p_operator
  ) THEN
    RAISE EXCEPTION
      'Invalid governance operator % for value type %',
      p_operator,
      p_value_type;
  END IF;

  v_actual_exists :=
    p_actual_value IS NOT NULL
    AND p_actual_value <> 'null'::jsonb;

  IF p_operator = 'exists' THEN
    IF jsonb_typeof(p_required_value) <> 'boolean' THEN
      RAISE EXCEPTION
        'exists operator requires boolean policy value';
    END IF;

    v_required_exists := (p_required_value #>> '{}')::boolean;

    RETURN v_actual_exists = v_required_exists;
  END IF;

  IF NOT v_actual_exists THEN
    RETURN false;
  END IF;

  IF NOT public.governance_rule_value_is_valid(
    p_value_type,
    p_required_value
  ) THEN
    RAISE EXCEPTION
      'Required governance value is invalid for type %',
      p_value_type;
  END IF;

  IF NOT public.governance_rule_value_is_valid(
    p_value_type,
    p_actual_value
  ) THEN
    RETURN false;
  END IF;

  CASE p_operator

    WHEN 'equals' THEN
      RETURN p_actual_value = p_required_value;

    WHEN 'not_equals' THEN
      RETURN p_actual_value <> p_required_value;

    WHEN 'greater_than',
         'greater_than_or_equal',
         'less_than',
         'less_than_or_equal' THEN

      IF p_value_type = 'number' THEN
        v_required_number := (p_required_value #>> '{}')::numeric;
        v_actual_number := (p_actual_value #>> '{}')::numeric;

        CASE p_operator
          WHEN 'greater_than' THEN
            RETURN v_actual_number > v_required_number;
          WHEN 'greater_than_or_equal' THEN
            RETURN v_actual_number >= v_required_number;
          WHEN 'less_than' THEN
            RETURN v_actual_number < v_required_number;
          WHEN 'less_than_or_equal' THEN
            RETURN v_actual_number <= v_required_number;
        END CASE;

      ELSIF p_value_type = 'date' THEN
        v_required_date := (p_required_value #>> '{}')::date;
        v_actual_date := (p_actual_value #>> '{}')::date;

        CASE p_operator
          WHEN 'greater_than' THEN
            RETURN v_actual_date > v_required_date;
          WHEN 'greater_than_or_equal' THEN
            RETURN v_actual_date >= v_required_date;
          WHEN 'less_than' THEN
            RETURN v_actual_date < v_required_date;
          WHEN 'less_than_or_equal' THEN
            RETURN v_actual_date <= v_required_date;
        END CASE;
      END IF;

    WHEN 'contains' THEN
      IF p_value_type = 'text' THEN
        v_required_text := p_required_value #>> '{}';
        v_actual_text := p_actual_value #>> '{}';

        RETURN position(v_required_text IN v_actual_text) > 0;

      ELSIF p_value_type = 'list' THEN
        RETURN p_actual_value @> p_required_value;
      END IF;

    WHEN 'contains_any' THEN
      RETURN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_required_value) AS required_item(value)
        WHERE p_actual_value @> jsonb_build_array(required_item.value)
      );

    WHEN 'contains_all' THEN
      RETURN p_actual_value @> p_required_value;

    ELSE
      RAISE EXCEPTION
        'Unsupported governance operator %',
        p_operator;
  END CASE;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_governance_value(
  text,
  text,
  jsonb,
  jsonb
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.evaluate_governance_value(
  text,
  text,
  jsonb,
  jsonb
)
FROM anon;

REVOKE ALL ON FUNCTION public.evaluate_governance_value(
  text,
  text,
  jsonb,
  jsonb
)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.evaluate_governance_value(
  text,
  text,
  jsonb,
  jsonb
)
TO service_role, postgres;


-- ============================================================================
-- 4. GOVERNANCE EVIDENCE IS APPEND-ONLY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_governance_evidence_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Governance evaluation evidence is immutable. Records cannot be modified or deleted.';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_governance_evidence_modification()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.prevent_governance_evidence_modification()
FROM anon;

REVOKE ALL ON FUNCTION public.prevent_governance_evidence_modification()
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.prevent_governance_evidence_modification()
TO service_role, postgres;


DROP TRIGGER IF EXISTS enforce_governance_evaluations_immutability_update
ON public.governance_evaluations;

CREATE TRIGGER enforce_governance_evaluations_immutability_update
BEFORE UPDATE
ON public.governance_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_governance_evidence_modification();


DROP TRIGGER IF EXISTS enforce_governance_evaluations_immutability_delete
ON public.governance_evaluations;

CREATE TRIGGER enforce_governance_evaluations_immutability_delete
BEFORE DELETE
ON public.governance_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_governance_evidence_modification();


DROP TRIGGER IF EXISTS enforce_governance_evaluation_results_immutability_update
ON public.governance_evaluation_results;

CREATE TRIGGER enforce_governance_evaluation_results_immutability_update
BEFORE UPDATE
ON public.governance_evaluation_results
FOR EACH ROW
EXECUTE FUNCTION public.prevent_governance_evidence_modification();


DROP TRIGGER IF EXISTS enforce_governance_evaluation_results_immutability_delete
ON public.governance_evaluation_results;

CREATE TRIGGER enforce_governance_evaluation_results_immutability_delete
BEFORE DELETE
ON public.governance_evaluation_results
FOR EACH ROW
EXECUTE FUNCTION public.prevent_governance_evidence_modification();


-- PART 2 CONTINUES BELOW.
-- Do not apply this migration until the resolver/evidence writer has been
-- appended and the complete migration has been reviewed.



-- ============================================================================
-- 5. GOVERNANCE CONTEXT VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_governance_evaluation_context(
  p_entity_id uuid,
  p_portfolio_id uuid,
  p_property_type_id uuid,
  p_property_id uuid,
  p_counterparty_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_property_entity_id uuid;
  v_property_portfolio_id uuid;
  v_property_property_type_id uuid;
BEGIN
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Governance evaluation requires an entity';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.entities e
    WHERE e.id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Governance evaluation entity % does not exist', p_entity_id;
  END IF;

  IF p_portfolio_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.portfolios p
       WHERE p.id = p_portfolio_id
         AND p.entity_id = p_entity_id
     ) THEN
    RAISE EXCEPTION
      'Portfolio % does not belong to entity %',
      p_portfolio_id,
      p_entity_id;
  END IF;

  IF p_property_type_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.property_types pt
       WHERE pt.id = p_property_type_id
     ) THEN
    RAISE EXCEPTION
      'Property type % does not exist',
      p_property_type_id;
  END IF;

  IF p_property_id IS NOT NULL THEN
    SELECT
      p.entity_id,
      p.portfolio_id,
      p.property_type_id
    INTO
      v_property_entity_id,
      v_property_portfolio_id,
      v_property_property_type_id
    FROM public.properties p
    WHERE p.id = p_property_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Property % does not exist', p_property_id;
    END IF;

    IF v_property_entity_id <> p_entity_id THEN
      RAISE EXCEPTION
        'Property % does not belong to entity %',
        p_property_id,
        p_entity_id;
    END IF;

    IF p_portfolio_id IS NOT NULL
       AND v_property_portfolio_id IS DISTINCT FROM p_portfolio_id THEN
      RAISE EXCEPTION
        'Property % does not belong to portfolio %',
        p_property_id,
        p_portfolio_id;
    END IF;

    IF p_property_type_id IS NOT NULL
       AND v_property_property_type_id IS DISTINCT FROM p_property_type_id THEN
      RAISE EXCEPTION
        'Property % does not have property type %',
        p_property_id,
        p_property_type_id;
    END IF;
  END IF;

  IF p_counterparty_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.tenants t
       WHERE t.id = p_counterparty_id
         AND t.entity_id = p_entity_id
     ) THEN
    RAISE EXCEPTION
      'Counterparty % does not belong to entity %',
      p_counterparty_id,
      p_entity_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_governance_evaluation_context(
  uuid, uuid, uuid, uuid, uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.validate_governance_evaluation_context(
  uuid, uuid, uuid, uuid, uuid
) FROM anon;

REVOKE ALL ON FUNCTION public.validate_governance_evaluation_context(
  uuid, uuid, uuid, uuid, uuid
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.validate_governance_evaluation_context(
  uuid, uuid, uuid, uuid, uuid
) TO service_role, postgres;


-- ============================================================================
-- 5A. APPLICABLE CLIENT POLICY ASSIGNMENTS
--
-- Internal primitive.
--
-- Returns the active client policy assignments applicable to one rule
-- definition and one transaction context.
--
-- Scope dimensions are intentionally independent. This helper does not invent
-- a universal entity/portfolio/property-type/property/counterparty hierarchy.
-- Explicit rule priority and inheritance semantics are resolved separately.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.applicable_governance_policy_rules_internal(
  p_rule_definition_id uuid,
  p_entity_id uuid,
  p_domain text,
  p_workflow_stage text DEFAULT NULL,
  p_portfolio_id uuid DEFAULT NULL,
  p_property_type_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_counterparty_id uuid DEFAULT NULL,
  p_effective_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  policy_rule_id uuid,
  policy_set_id uuid,
  configured_value jsonb,
  failure_outcome text,
  scope_type text,
  scope_id uuid,
  priority integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS policy_rule_id,
    r.policy_set_id,
    r.value AS configured_value,
    r.failure_outcome,
    r.scope_type,
    r.scope_id,
    r.priority
  FROM public.governance_policy_rules r
  JOIN public.governance_policy_sets ps
    ON ps.id = r.policy_set_id
  JOIN public.governance_rule_definitions d
    ON d.id = r.rule_definition_id
  WHERE r.rule_definition_id = p_rule_definition_id
    AND d.is_active = true
    AND d.governance_class <> 'platform_invariant'
    AND d.domain = p_domain
    AND ps.entity_id = p_entity_id
    AND ps.domain = p_domain
    AND ps.status = 'active'
    AND (
      ps.effective_from IS NULL
      OR ps.effective_from <= p_effective_date
    )
    AND (
      ps.effective_to IS NULL
      OR ps.effective_to >= p_effective_date
    )
    AND r.is_active = true
    AND (
      r.effective_from IS NULL
      OR r.effective_from <= p_effective_date
    )
    AND (
      r.effective_to IS NULL
      OR r.effective_to >= p_effective_date
    )
    AND (
      d.workflow_stage IS NULL
      OR d.workflow_stage = p_workflow_stage
    )
    AND (
      r.workflow_stage IS NULL
      OR r.workflow_stage = p_workflow_stage
    )
    AND (
      (r.scope_type = 'entity' AND r.scope_id IS NULL)
      OR (
        r.scope_type = 'portfolio'
        AND r.scope_id = p_portfolio_id
      )
      OR (
        r.scope_type = 'property_type'
        AND r.scope_id = p_property_type_id
      )
      OR (
        r.scope_type = 'property'
        AND r.scope_id = p_property_id
      )
      OR (
        r.scope_type = 'counterparty'
        AND r.scope_id = p_counterparty_id
      )
    )
  ORDER BY r.priority DESC, r.id;
$$;

REVOKE ALL ON FUNCTION public.applicable_governance_policy_rules_internal(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, date
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.applicable_governance_policy_rules_internal(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, date
) FROM anon;

REVOKE ALL ON FUNCTION public.applicable_governance_policy_rules_internal(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, date
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.applicable_governance_policy_rules_internal(
  uuid, uuid, text, text, uuid, uuid, uuid, uuid, date
) TO service_role, postgres;


-- ============================================================================
-- 6. EFFECTIVE GOVERNANCE POLICY RESOLVER
--
-- Internal primitive.
--
-- Important:
--   * Scope dimensions are NOT treated as a universal hierarchy.
--   * Explicit priority governs override conflicts.
--   * Equal-priority conflicting override values fail closed.
--   * Additive rules preserve every distinct applicable requirement.
--   * Restrictive rules collapse only where direction is deterministic.
--   * Non-overridable rules cannot be weakened by transaction exceptions.
--
-- Returns one row per effective requirement.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_governance_policy_internal(
  p_entity_id uuid,
  p_domain text,
  p_workflow_stage text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_portfolio_id uuid DEFAULT NULL,
  p_property_type_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_counterparty_id uuid DEFAULT NULL,
  p_effective_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  rule_definition_id uuid,
  rule_key text,
  value_type text,
  governance_class text,
  inheritance_mode text,
  evaluation_operator text,
  required_value jsonb,
  failure_outcome text,
  policy_rule_id uuid,
  policy_set_id uuid,
  source_scope_type text,
  source_scope_id uuid,
  applied_exception_id uuid,
  provenance jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_candidate record;
  v_selected record;
  v_exception record;

  v_evaluated_at timestamptz := now();

  v_top_priority integer;
  v_candidate_count integer;
  v_distinct_value_count integer;
  v_exception_count integer;

  v_required_value jsonb;
  v_effective_candidate_value jsonb;
  v_failure_outcome text;
  v_policy_rule_id uuid;
  v_policy_set_id uuid;
  v_source_scope_type text;
  v_source_scope_id uuid;
  v_exception_id uuid;
  v_provenance jsonb;

  v_restrictive_number numeric;
  v_candidate_number numeric;
  v_restrictive_date date;
  v_candidate_date date;

  v_failure_rank integer;
  v_candidate_failure_rank integer;
BEGIN
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Governance entity is required';
  END IF;

  IF p_domain IS NULL OR btrim(p_domain) = '' THEN
    RAISE EXCEPTION 'Governance domain is required';
  END IF;

  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'Governance effective date is required';
  END IF;

  IF (p_reference_type IS NULL) <> (p_reference_id IS NULL) THEN
    RAISE EXCEPTION
      'Governance reference_type and reference_id must either both be supplied or both be null';
  END IF;

  PERFORM public.validate_governance_evaluation_context(
    p_entity_id,
    p_portfolio_id,
    p_property_type_id,
    p_property_id,
    p_counterparty_id
  );

  /*
   * Rule discovery begins from the definition catalogue, not from client
   * policy assignments.
   *
   * This is essential for platform invariants: an AssetFlow-owned invariant
   * exists independently of whether a client has configured any policy set.
   */
  FOR v_rule IN
    SELECT
      d.id,
      d.rule_key,
      d.value_type,
      d.governance_class,
      d.inheritance_mode,
      d.evaluation_operator,
      d.override_allowed,
      d.platform_value,
      d.platform_failure_outcome
    FROM public.governance_rule_definitions d
    WHERE d.is_active = true
      AND d.domain = p_domain
      AND (
        d.workflow_stage IS NULL
        OR d.workflow_stage = p_workflow_stage
      )
    ORDER BY d.rule_key, d.id
  LOOP
    IF v_rule.evaluation_operator IS NULL THEN
      RAISE EXCEPTION
        'Governance rule % has no evaluation operator configured',
        v_rule.rule_key;
    END IF;

    IF NOT public.governance_operator_is_valid(
      v_rule.value_type,
      v_rule.evaluation_operator
    ) THEN
      RAISE EXCEPTION
        'Governance rule % has invalid operator % for value type %',
        v_rule.rule_key,
        v_rule.evaluation_operator,
        v_rule.value_type;
    END IF;

    v_required_value := NULL;
    v_effective_candidate_value := NULL;
    v_failure_outcome := NULL;
    v_policy_rule_id := NULL;
    v_policy_set_id := NULL;
    v_source_scope_type := NULL;
    v_source_scope_id := NULL;
    v_exception_id := NULL;
    v_provenance := '[]'::jsonb;

    /*
     * PLATFORM INVARIANT
     *
     * Platform invariants are definition-owned. They never depend on a client
     * policy assignment and cannot be weakened by transaction exceptions.
     */
    IF v_rule.governance_class = 'platform_invariant' THEN
      IF v_rule.inheritance_mode <> 'non_overridable' THEN
        RAISE EXCEPTION
          'Platform invariant % must use non_overridable inheritance',
          v_rule.rule_key;
      END IF;

      IF v_rule.override_allowed THEN
        RAISE EXCEPTION
          'Platform invariant % cannot allow overrides',
          v_rule.rule_key;
      END IF;

      IF v_rule.platform_value IS NULL THEN
        RAISE EXCEPTION
          'Platform invariant % has no platform value configured',
          v_rule.rule_key;
      END IF;

      IF v_rule.platform_failure_outcome IS NULL
         OR v_rule.platform_failure_outcome NOT IN (
           'WARNING',
           'REQUIRES_APPROVAL',
           'BLOCK'
         ) THEN
        RAISE EXCEPTION
          'Platform invariant % has invalid platform failure outcome',
          v_rule.rule_key;
      END IF;

      IF NOT public.governance_rule_value_is_valid(
        v_rule.value_type,
        v_rule.platform_value
      ) THEN
        RAISE EXCEPTION
          'Platform invariant % has an invalid platform value for type %',
          v_rule.rule_key,
          v_rule.value_type;
      END IF;

      rule_definition_id := v_rule.id;
      rule_key := v_rule.rule_key;
      value_type := v_rule.value_type;
      governance_class := v_rule.governance_class;
      inheritance_mode := v_rule.inheritance_mode;
      evaluation_operator := v_rule.evaluation_operator;
      required_value := v_rule.platform_value;
      failure_outcome := v_rule.platform_failure_outcome;
      policy_rule_id := NULL;
      policy_set_id := NULL;
      source_scope_type := 'platform';
      source_scope_id := NULL;
      applied_exception_id := NULL;
      provenance := jsonb_build_array(
        jsonb_build_object(
          'source', 'platform',
          'rule_definition_id', v_rule.id,
          'value', v_rule.platform_value,
          'failure_outcome', v_rule.platform_failure_outcome
        )
      );

      RETURN NEXT;
      CONTINUE;
    END IF;

    /*
     * A non-platform rule may not claim non-overridable semantics.
     * The table constraint also enforces this, but the resolver fails closed
     * if malformed data is ever introduced through privileged access.
     */
    IF v_rule.inheritance_mode = 'non_overridable' THEN
      RAISE EXCEPTION
        'Non-platform governance rule % cannot use non_overridable inheritance',
        v_rule.rule_key;
    END IF;

    /*
     * Rule-level exceptions are meaningful only for override rules.
     * Additive/restrictive requirements have multiple contributing
     * assignments and therefore require an exact policy_rule_id.
     */
    IF v_rule.inheritance_mode IN ('additive', 'restrictive')
       AND p_reference_type IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.governance_exceptions ge
         WHERE ge.entity_id = p_entity_id
           AND ge.rule_definition_id = v_rule.id
           AND ge.policy_rule_id IS NULL
           AND ge.reference_type = p_reference_type
           AND ge.reference_id = p_reference_id
           AND ge.status = 'approved'
           AND (
             ge.effective_from IS NULL
             OR ge.effective_from <= v_evaluated_at
           )
           AND (
             ge.expires_at IS NULL
             OR ge.expires_at > v_evaluated_at
           )
       ) THEN
      RAISE EXCEPTION
        'Governance rule % requires assignment-specific exceptions for % inheritance',
        v_rule.rule_key,
        v_rule.inheritance_mode;
    END IF;

    /*
     * OVERRIDE
     *
     * Explicit priority determines the winning assignment.
     * Scope type does not create an implicit precedence hierarchy.
     */
    IF v_rule.inheritance_mode = 'override' THEN
      SELECT max(a.priority)
      INTO v_top_priority
      FROM public.applicable_governance_policy_rules_internal(
        v_rule.id,
        p_entity_id,
        p_domain,
        p_workflow_stage,
        p_portfolio_id,
        p_property_type_id,
        p_property_id,
        p_counterparty_id,
        p_effective_date
      ) a;

      IF v_top_priority IS NULL THEN
        CONTINUE;
      END IF;

      SELECT
        count(*),
        count(DISTINCT a.configured_value)
      INTO
        v_candidate_count,
        v_distinct_value_count
      FROM public.applicable_governance_policy_rules_internal(
        v_rule.id,
        p_entity_id,
        p_domain,
        p_workflow_stage,
        p_portfolio_id,
        p_property_type_id,
        p_property_id,
        p_counterparty_id,
        p_effective_date
      ) a
      WHERE a.priority = v_top_priority;

      IF v_candidate_count = 0 THEN
        CONTINUE;
      END IF;

      IF v_distinct_value_count > 1 THEN
        RAISE EXCEPTION
          'Ambiguous governance policy for rule %. Conflicting assignments share the highest applicable priority.',
          v_rule.rule_key;
      END IF;

      SELECT a.*
      INTO v_selected
      FROM public.applicable_governance_policy_rules_internal(
        v_rule.id,
        p_entity_id,
        p_domain,
        p_workflow_stage,
        p_portfolio_id,
        p_property_type_id,
        p_property_id,
        p_counterparty_id,
        p_effective_date
      ) a
      WHERE a.priority = v_top_priority
      ORDER BY
        CASE a.failure_outcome
          WHEN 'BLOCK' THEN 3
          WHEN 'REQUIRES_APPROVAL' THEN 2
          WHEN 'WARNING' THEN 1
          ELSE 0
        END DESC,
        a.policy_rule_id
      LIMIT 1;

      v_required_value := v_selected.configured_value;
      v_failure_outcome := v_selected.failure_outcome;
      v_policy_rule_id := v_selected.policy_rule_id;
      v_policy_set_id := v_selected.policy_set_id;
      v_source_scope_type := v_selected.scope_type;
      v_source_scope_id := v_selected.scope_id;

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'policy_rule_id', a.policy_rule_id,
            'policy_set_id', a.policy_set_id,
            'scope_type', a.scope_type,
            'scope_id', a.scope_id,
            'priority', a.priority,
            'value', a.configured_value,
            'failure_outcome', a.failure_outcome
          )
          ORDER BY a.priority DESC, a.policy_rule_id
        ),
        '[]'::jsonb
      )
      INTO v_provenance
      FROM public.applicable_governance_policy_rules_internal(
        v_rule.id,
        p_entity_id,
        p_domain,
        p_workflow_stage,
        p_portfolio_id,
        p_property_type_id,
        p_property_id,
        p_counterparty_id,
        p_effective_date
      ) a;

      IF p_reference_type IS NOT NULL THEN
        SELECT count(*)
        INTO v_exception_count
        FROM public.governance_exceptions ge
        WHERE ge.entity_id = p_entity_id
          AND ge.rule_definition_id = v_rule.id
          AND (
            ge.policy_rule_id IS NULL
            OR ge.policy_rule_id = v_policy_rule_id
          )
          AND ge.reference_type = p_reference_type
          AND ge.reference_id = p_reference_id
          AND ge.status = 'approved'
          AND (
            ge.effective_from IS NULL
            OR ge.effective_from <= v_evaluated_at
          )
          AND (
            ge.expires_at IS NULL
            OR ge.expires_at > v_evaluated_at
          );

        IF v_exception_count > 1 THEN
          RAISE EXCEPTION
            'Ambiguous approved governance exceptions for rule % and reference %/%',
            v_rule.rule_key,
            p_reference_type,
            p_reference_id;
        END IF;

        IF v_exception_count = 1 THEN
          IF NOT v_rule.override_allowed THEN
            RAISE EXCEPTION
              'Governance rule % does not allow exceptions',
              v_rule.rule_key;
          END IF;

          SELECT
            ge.id,
            ge.policy_rule_id,
            ge.effective_value
          INTO v_exception
          FROM public.governance_exceptions ge
          WHERE ge.entity_id = p_entity_id
            AND ge.rule_definition_id = v_rule.id
            AND (
              ge.policy_rule_id IS NULL
              OR ge.policy_rule_id = v_policy_rule_id
            )
            AND ge.reference_type = p_reference_type
            AND ge.reference_id = p_reference_id
            AND ge.status = 'approved'
            AND (
              ge.effective_from IS NULL
              OR ge.effective_from <= v_evaluated_at
            )
            AND (
              ge.expires_at IS NULL
              OR ge.expires_at > v_evaluated_at
            )
          LIMIT 1;

          IF NOT public.governance_rule_value_is_valid(
            v_rule.value_type,
            v_exception.effective_value
          ) THEN
            RAISE EXCEPTION
              'Approved exception for rule % has invalid effective value',
              v_rule.rule_key;
          END IF;

          v_required_value := v_exception.effective_value;
          v_exception_id := v_exception.id;
          v_source_scope_type := 'transaction';
          v_source_scope_id := p_reference_id;

          v_provenance := v_provenance || jsonb_build_array(
            jsonb_build_object(
              'exception_id', v_exception.id,
              'policy_rule_id', v_exception.policy_rule_id,
              'reference_type', p_reference_type,
              'reference_id', p_reference_id,
              'effective_value', v_exception.effective_value
            )
          );
        END IF;
      END IF;

      rule_definition_id := v_rule.id;
      rule_key := v_rule.rule_key;
      value_type := v_rule.value_type;
      governance_class := v_rule.governance_class;
      inheritance_mode := v_rule.inheritance_mode;
      evaluation_operator := v_rule.evaluation_operator;
      required_value := v_required_value;
      failure_outcome := v_failure_outcome;
      policy_rule_id := v_policy_rule_id;
      policy_set_id := v_policy_set_id;
      source_scope_type := v_source_scope_type;
      source_scope_id := v_source_scope_id;
      applied_exception_id := v_exception_id;
      provenance := v_provenance;

      RETURN NEXT;

    /*
     * ADDITIVE
     *
     * Every applicable assignment remains independently effective.
     * An exception must target that exact contributing policy rule.
     */
    ELSIF v_rule.inheritance_mode = 'additive' THEN
      FOR v_candidate IN
        SELECT a.*
        FROM public.applicable_governance_policy_rules_internal(
          v_rule.id,
          p_entity_id,
          p_domain,
          p_workflow_stage,
          p_portfolio_id,
          p_property_type_id,
          p_property_id,
          p_counterparty_id,
          p_effective_date
        ) a
        ORDER BY a.priority DESC, a.policy_rule_id
      LOOP
        v_required_value := v_candidate.configured_value;
        v_exception_id := NULL;
        v_source_scope_type := v_candidate.scope_type;
        v_source_scope_id := v_candidate.scope_id;

        v_provenance := jsonb_build_array(
          jsonb_build_object(
            'policy_rule_id', v_candidate.policy_rule_id,
            'policy_set_id', v_candidate.policy_set_id,
            'scope_type', v_candidate.scope_type,
            'scope_id', v_candidate.scope_id,
            'priority', v_candidate.priority,
            'value', v_candidate.configured_value,
            'failure_outcome', v_candidate.failure_outcome
          )
        );

        IF p_reference_type IS NOT NULL THEN
          SELECT count(*)
          INTO v_exception_count
          FROM public.governance_exceptions ge
          WHERE ge.entity_id = p_entity_id
            AND ge.rule_definition_id = v_rule.id
            AND ge.policy_rule_id = v_candidate.policy_rule_id
            AND ge.reference_type = p_reference_type
            AND ge.reference_id = p_reference_id
            AND ge.status = 'approved'
            AND (
              ge.effective_from IS NULL
              OR ge.effective_from <= v_evaluated_at
            )
            AND (
              ge.expires_at IS NULL
              OR ge.expires_at > v_evaluated_at
            );

          IF v_exception_count > 1 THEN
            RAISE EXCEPTION
              'Ambiguous approved governance exceptions for rule % policy assignment %',
              v_rule.rule_key,
              v_candidate.policy_rule_id;
          END IF;

          IF v_exception_count = 1 THEN
            IF NOT v_rule.override_allowed THEN
              RAISE EXCEPTION
                'Governance rule % does not allow exceptions',
                v_rule.rule_key;
            END IF;

            SELECT
              ge.id,
              ge.effective_value
            INTO v_exception
            FROM public.governance_exceptions ge
            WHERE ge.entity_id = p_entity_id
              AND ge.rule_definition_id = v_rule.id
              AND ge.policy_rule_id = v_candidate.policy_rule_id
              AND ge.reference_type = p_reference_type
              AND ge.reference_id = p_reference_id
              AND ge.status = 'approved'
              AND (
                ge.effective_from IS NULL
                OR ge.effective_from <= v_evaluated_at
              )
              AND (
                ge.expires_at IS NULL
                OR ge.expires_at > v_evaluated_at
              )
            LIMIT 1;

            IF NOT public.governance_rule_value_is_valid(
              v_rule.value_type,
              v_exception.effective_value
            ) THEN
              RAISE EXCEPTION
                'Approved exception for rule % has invalid effective value',
                v_rule.rule_key;
            END IF;

            v_required_value := v_exception.effective_value;
            v_exception_id := v_exception.id;
            v_source_scope_type := 'transaction';
            v_source_scope_id := p_reference_id;

            v_provenance := v_provenance || jsonb_build_array(
              jsonb_build_object(
                'exception_id', v_exception.id,
                'policy_rule_id', v_candidate.policy_rule_id,
                'reference_type', p_reference_type,
                'reference_id', p_reference_id,
                'effective_value', v_exception.effective_value
              )
            );
          END IF;
        END IF;

        rule_definition_id := v_rule.id;
        rule_key := v_rule.rule_key;
        value_type := v_rule.value_type;
        governance_class := v_rule.governance_class;
        inheritance_mode := v_rule.inheritance_mode;
        evaluation_operator := v_rule.evaluation_operator;
        required_value := v_required_value;
        failure_outcome := v_candidate.failure_outcome;
        policy_rule_id := v_candidate.policy_rule_id;
        policy_set_id := v_candidate.policy_set_id;
        source_scope_type := v_source_scope_type;
        source_scope_id := v_source_scope_id;
        applied_exception_id := v_exception_id;
        provenance := v_provenance;

        RETURN NEXT;
      END LOOP;

    /*
     * RESTRICTIVE
     *
     * Each contributing assignment is first adjusted by any exact approved
     * assignment-specific exception. Only then is the deterministic
     * restrictive max/min calculated.
     */
    ELSIF v_rule.inheritance_mode = 'restrictive' THEN
      IF NOT (
        v_rule.value_type IN ('number', 'date')
        AND v_rule.evaluation_operator IN (
          'greater_than',
          'greater_than_or_equal',
          'less_than',
          'less_than_or_equal'
        )
      ) THEN
        RAISE EXCEPTION
          'Restrictive governance rule % uses unsupported value type/operator combination: %/%',
          v_rule.rule_key,
          v_rule.value_type,
          v_rule.evaluation_operator;
      END IF;

      v_restrictive_number := NULL;
      v_restrictive_date := NULL;
      v_failure_rank := 0;
      v_failure_outcome := NULL;
      v_policy_rule_id := NULL;
      v_policy_set_id := NULL;
      v_source_scope_type := NULL;
      v_source_scope_id := NULL;
      v_exception_id := NULL;
      v_provenance := '[]'::jsonb;
      v_candidate_count := 0;

      FOR v_candidate IN
        SELECT a.*
        FROM public.applicable_governance_policy_rules_internal(
          v_rule.id,
          p_entity_id,
          p_domain,
          p_workflow_stage,
          p_portfolio_id,
          p_property_type_id,
          p_property_id,
          p_counterparty_id,
          p_effective_date
        ) a
        ORDER BY a.priority DESC, a.policy_rule_id
      LOOP
        v_candidate_count := v_candidate_count + 1;
        v_effective_candidate_value := v_candidate.configured_value;
        v_exception_id := NULL;

        IF p_reference_type IS NOT NULL THEN
          SELECT count(*)
          INTO v_exception_count
          FROM public.governance_exceptions ge
          WHERE ge.entity_id = p_entity_id
            AND ge.rule_definition_id = v_rule.id
            AND ge.policy_rule_id = v_candidate.policy_rule_id
            AND ge.reference_type = p_reference_type
            AND ge.reference_id = p_reference_id
            AND ge.status = 'approved'
            AND (
              ge.effective_from IS NULL
              OR ge.effective_from <= v_evaluated_at
            )
            AND (
              ge.expires_at IS NULL
              OR ge.expires_at > v_evaluated_at
            );

          IF v_exception_count > 1 THEN
            RAISE EXCEPTION
              'Ambiguous approved governance exceptions for rule % policy assignment %',
              v_rule.rule_key,
              v_candidate.policy_rule_id;
          END IF;

          IF v_exception_count = 1 THEN
            IF NOT v_rule.override_allowed THEN
              RAISE EXCEPTION
                'Governance rule % does not allow exceptions',
                v_rule.rule_key;
            END IF;

            SELECT
              ge.id,
              ge.effective_value
            INTO v_exception
            FROM public.governance_exceptions ge
            WHERE ge.entity_id = p_entity_id
              AND ge.rule_definition_id = v_rule.id
              AND ge.policy_rule_id = v_candidate.policy_rule_id
              AND ge.reference_type = p_reference_type
              AND ge.reference_id = p_reference_id
              AND ge.status = 'approved'
              AND (
                ge.effective_from IS NULL
                OR ge.effective_from <= v_evaluated_at
              )
              AND (
                ge.expires_at IS NULL
                OR ge.expires_at > v_evaluated_at
              )
            LIMIT 1;

            IF NOT public.governance_rule_value_is_valid(
              v_rule.value_type,
              v_exception.effective_value
            ) THEN
              RAISE EXCEPTION
                'Approved exception for rule % has invalid effective value',
                v_rule.rule_key;
            END IF;

            v_effective_candidate_value := v_exception.effective_value;
            v_exception_id := v_exception.id;
          END IF;
        END IF;

        IF v_rule.value_type = 'number' THEN
          v_candidate_number :=
            (v_effective_candidate_value #>> '{}')::numeric;

          IF v_rule.evaluation_operator IN (
            'greater_than',
            'greater_than_or_equal'
          ) THEN
            IF v_restrictive_number IS NULL
               OR v_candidate_number > v_restrictive_number THEN
              v_restrictive_number := v_candidate_number;
            END IF;
          ELSE
            IF v_restrictive_number IS NULL
               OR v_candidate_number < v_restrictive_number THEN
              v_restrictive_number := v_candidate_number;
            END IF;
          END IF;
        ELSE
          v_candidate_date :=
            (v_effective_candidate_value #>> '{}')::date;

          IF v_rule.evaluation_operator IN (
            'greater_than',
            'greater_than_or_equal'
          ) THEN
            IF v_restrictive_date IS NULL
               OR v_candidate_date > v_restrictive_date THEN
              v_restrictive_date := v_candidate_date;
            END IF;
          ELSE
            IF v_restrictive_date IS NULL
               OR v_candidate_date < v_restrictive_date THEN
              v_restrictive_date := v_candidate_date;
            END IF;
          END IF;
        END IF;

        v_candidate_failure_rank :=
          CASE v_candidate.failure_outcome
            WHEN 'BLOCK' THEN 3
            WHEN 'REQUIRES_APPROVAL' THEN 2
            WHEN 'WARNING' THEN 1
            ELSE 0
          END;

        IF v_candidate_failure_rank > v_failure_rank THEN
          v_failure_rank := v_candidate_failure_rank;
          v_failure_outcome := v_candidate.failure_outcome;
          v_policy_rule_id := v_candidate.policy_rule_id;
          v_policy_set_id := v_candidate.policy_set_id;
          v_source_scope_type := v_candidate.scope_type;
          v_source_scope_id := v_candidate.scope_id;
        END IF;

        v_provenance := v_provenance || jsonb_build_array(
          jsonb_build_object(
            'policy_rule_id', v_candidate.policy_rule_id,
            'policy_set_id', v_candidate.policy_set_id,
            'scope_type', v_candidate.scope_type,
            'scope_id', v_candidate.scope_id,
            'priority', v_candidate.priority,
            'configured_value', v_candidate.configured_value,
            'effective_value', v_effective_candidate_value,
            'failure_outcome', v_candidate.failure_outcome,
            'exception_id', v_exception_id
          )
        );
      END LOOP;

      IF v_candidate_count = 0 THEN
        CONTINUE;
      END IF;

      IF v_rule.value_type = 'number' THEN
        v_required_value := to_jsonb(v_restrictive_number);
      ELSE
        v_required_value := to_jsonb(v_restrictive_date::text);
      END IF;

      rule_definition_id := v_rule.id;
      rule_key := v_rule.rule_key;
      value_type := v_rule.value_type;
      governance_class := v_rule.governance_class;
      inheritance_mode := v_rule.inheritance_mode;
      evaluation_operator := v_rule.evaluation_operator;
      required_value := v_required_value;
      failure_outcome := v_failure_outcome;
      policy_rule_id := v_policy_rule_id;
      policy_set_id := v_policy_set_id;
      source_scope_type := v_source_scope_type;
      source_scope_id := v_source_scope_id;
      applied_exception_id := NULL;
      provenance := v_provenance;

      RETURN NEXT;

    ELSE
      RAISE EXCEPTION
        'Unsupported governance inheritance mode % for rule %',
        v_rule.inheritance_mode,
        v_rule.rule_key;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_governance_policy_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, date
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.resolve_governance_policy_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, date
) FROM anon;

REVOKE ALL ON FUNCTION public.resolve_governance_policy_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, date
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_governance_policy_internal(
  uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, date
) TO service_role, postgres;


-- ============================================================================
-- 7. TRUSTED GOVERNANCE EVALUATOR
--
-- canonical_actual_values must be derived by trusted domain authority from
-- canonical records. This function is intentionally not executable by browser
-- roles.
-- ============================================================================

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.auth_entities() ae
    WHERE ae = p_entity_id
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


-- ============================================================================
-- 8. FINAL PRIVILEGE ASSERTIONS
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.governance_evaluations
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.governance_evaluation_results
FROM authenticated;

REVOKE ALL
ON public.governance_evaluations
FROM anon;

REVOKE ALL
ON public.governance_evaluation_results
FROM anon;


-- ============================================================================
-- 9. COMPLETE
-- ============================================================================

COMMIT;

