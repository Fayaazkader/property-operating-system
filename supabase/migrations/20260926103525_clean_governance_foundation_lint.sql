BEGIN;

-- ============================================================================
-- ASSETFLOW
-- Clean canonical governance foundation lint findings
--
-- Forward-only correction for:
--   1. governance_rule_value_is_valid volatility
--   2. unused variable in validate_governance_policy_set
--
-- No governance behaviour is changed.
-- ============================================================================


-- ============================================================================
-- 1. CORRECT RULE-VALUE VALIDATOR VOLATILITY
--
-- Date text -> date conversion is not IMMUTABLE in PostgreSQL because date
-- interpretation can depend on session configuration. The function therefore
-- correctly declares STABLE volatility.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.governance_rule_value_is_valid(
  p_value_type text,
  p_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN false;
  END IF;

  CASE p_value_type
    WHEN 'boolean' THEN
      RETURN jsonb_typeof(p_value) = 'boolean';

    WHEN 'number' THEN
      RETURN jsonb_typeof(p_value) = 'number';

    WHEN 'text' THEN
      RETURN jsonb_typeof(p_value) = 'string';

    WHEN 'date' THEN
      IF jsonb_typeof(p_value) <> 'string' THEN
        RETURN false;
      END IF;

      v_text := p_value #>> '{}';

      IF v_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN false;
      END IF;

      BEGIN
        PERFORM v_text::date;
        RETURN true;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN false;
      END;

    WHEN 'enum' THEN
      RETURN jsonb_typeof(p_value) = 'string';

    WHEN 'list' THEN
      RETURN jsonb_typeof(p_value) = 'array';

    WHEN 'structured' THEN
      RETURN jsonb_typeof(p_value) = 'object';

    ELSE
      RETURN false;
  END CASE;
END;
$$;


-- Reassert helper-function authority.

REVOKE ALL ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
FROM anon;

REVOKE ALL ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
TO service_role, postgres;


-- ============================================================================
-- 2. REMOVE UNUSED POLICY-DOMAIN VARIABLE
--
-- Full policy-set validation delegates rule/domain validation to
-- validate_governance_policy_rule(), so this function only needs the entity
-- existence check before iterating the active rules.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_governance_policy_set(
  p_policy_set_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy_entity_id uuid;

  v_rule record;
  v_rule_count integer := 0;
BEGIN
  SELECT entity_id
  INTO v_policy_entity_id
  FROM public.governance_policy_sets
  WHERE id = p_policy_set_id;

  IF v_policy_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  FOR v_rule IN
    SELECT
      id,
      rule_definition_id,
      scope_type,
      scope_id,
      value,
      effective_from,
      effective_to
    FROM public.governance_policy_rules
    WHERE policy_set_id = p_policy_set_id
      AND is_active = true
  LOOP
    v_rule_count := v_rule_count + 1;

    PERFORM public.validate_governance_policy_rule(
      p_policy_set_id,
      v_rule.rule_definition_id,
      v_rule.scope_type,
      v_rule.scope_id,
      v_rule.value,
      v_rule.effective_from,
      v_rule.effective_to
    );
  END LOOP;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION
      'Policy set must contain at least one active rule';
  END IF;
END;
$$;


-- Reassert helper-function authority.

REVOKE ALL ON FUNCTION public.validate_governance_policy_set(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.validate_governance_policy_set(uuid)
FROM anon;

REVOKE ALL ON FUNCTION public.validate_governance_policy_set(uuid)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.validate_governance_policy_set(uuid)
TO service_role, postgres;


COMMIT;
