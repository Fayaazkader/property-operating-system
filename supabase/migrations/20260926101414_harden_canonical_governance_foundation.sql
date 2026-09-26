BEGIN;

-- ============================================================================
-- ASSETFLOW
-- Harden canonical governance foundation
--
-- This migration hardens the canonical governance authority introduced by
-- 20260926094709_establish_canonical_governance_foundation.sql.
--
-- It does not implement policy resolution, exception workflow, or evaluation.
-- Those remain separate governed capabilities.
-- ============================================================================


-- ============================================================================
-- 1. ONE ACTIVE VERSION PER NAMED ENTITY POLICY
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS governance_policy_sets_one_active_idx
  ON public.governance_policy_sets(entity_id, domain, policy_name)
  WHERE status = 'active';


-- ============================================================================
-- 2. CANONICAL RULE-VALUE VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.governance_rule_value_is_valid(
  p_value_type text,
  p_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
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


REVOKE ALL ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
FROM anon;

REVOKE ALL ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.governance_rule_value_is_valid(text, jsonb)
TO service_role, postgres;


-- ============================================================================
-- 3. POLICY-RULE INTEGRITY VALIDATOR
--
-- Validates:
--   - policy set exists
--   - rule definition exists and is active
--   - rule definition domain matches policy-set domain
--   - configured value matches declared value_type
--   - scope shape is valid
--   - scoped object exists
--   - portfolio/property/counterparty belongs to policy entity
--   - property type exists as canonical shared classification metadata
--   - rule dates are coherent
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
    is_active
  INTO
    v_rule_domain,
    v_value_type,
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
-- 4. COMPLETE POLICY-SET VALIDATION
--
-- Approval and activation both call this function. This prevents malformed
-- policy rows from becoming authoritative even if they were inserted by a
-- privileged backend or existed before this hardening migration.
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
  v_policy_domain text;

  v_rule record;
  v_rule_count integer := 0;
BEGIN
  SELECT
    entity_id,
    domain
  INTO
    v_policy_entity_id,
    v_policy_domain
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


REVOKE ALL ON FUNCTION public.validate_governance_policy_set(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.validate_governance_policy_set(uuid)
FROM anon;

REVOKE ALL ON FUNCTION public.validate_governance_policy_set(uuid)
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.validate_governance_policy_set(uuid)
TO service_role, postgres;


-- ============================================================================
-- 5. HARDEN POLICY-SET CREATION
--
-- Serialise version allocation for one entity/domain/policy name.
-- This removes the MAX(version)+1 concurrency race.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_governance_policy_set(
  p_entity_id uuid,
  p_domain text,
  p_policy_name text,
  p_description text DEFAULT NULL,
  p_effective_from date DEFAULT NULL,
  p_effective_to date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_policy_set_id uuid;
  v_version integer;
  v_domain text;
  v_policy_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required';
  END IF;

  IF NOT (p_entity_id = ANY (public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    p_entity_id,
    'governance.policy.create'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_domain := NULLIF(btrim(p_domain), '');
  v_policy_name := NULLIF(btrim(p_policy_name), '');

  IF v_domain IS NULL THEN
    RAISE EXCEPTION 'Policy domain is required';
  END IF;

  IF v_policy_name IS NULL THEN
    RAISE EXCEPTION 'Policy name is required';
  END IF;

  IF p_effective_to IS NOT NULL
     AND p_effective_from IS NOT NULL
     AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION
      'Policy effective_to cannot precede effective_from';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_entity_id::text || ':' || v_domain || ':' || v_policy_name,
      0
    )
  );

  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_version
  FROM public.governance_policy_sets
  WHERE entity_id = p_entity_id
    AND domain = v_domain
    AND policy_name = v_policy_name;

  INSERT INTO public.governance_policy_sets (
    entity_id,
    domain,
    policy_name,
    description,
    version,
    status,
    effective_from,
    effective_to,
    created_by
  )
  VALUES (
    p_entity_id,
    v_domain,
    v_policy_name,
    NULLIF(btrim(p_description), ''),
    v_version,
    'draft',
    p_effective_from,
    p_effective_to,
    v_user_id
  )
  RETURNING id INTO v_policy_set_id;

  RETURN v_policy_set_id;
END;
$$;


-- ============================================================================
-- 6. HARDEN POLICY-RULE UPSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_governance_policy_rule(
  p_policy_set_id uuid,
  p_rule_definition_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_value jsonb,
  p_workflow_stage text DEFAULT NULL,
  p_priority integer DEFAULT 0,
  p_effective_from date DEFAULT NULL,
  p_effective_to date DEFAULT NULL,
  p_policy_rule_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
  v_policy_status text;
  v_rule_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_policy_set_id IS NULL THEN
    RAISE EXCEPTION 'Policy set is required';
  END IF;

  IF p_rule_definition_id IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition is required';
  END IF;

  SELECT
    entity_id,
    status
  INTO
    v_entity_id,
    v_policy_status
  FROM public.governance_policy_sets
  WHERE id = p_policy_set_id
  FOR UPDATE;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  IF NOT (v_entity_id = ANY (public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_entity_id,
    'governance.policy.edit'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_policy_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft policy sets may be edited';
  END IF;

  PERFORM public.validate_governance_policy_rule(
    p_policy_set_id,
    p_rule_definition_id,
    p_scope_type,
    p_scope_id,
    p_value,
    p_effective_from,
    p_effective_to
  );

  IF p_policy_rule_id IS NULL THEN
    INSERT INTO public.governance_policy_rules (
      policy_set_id,
      rule_definition_id,
      scope_type,
      scope_id,
      workflow_stage,
      value,
      priority,
      effective_from,
      effective_to,
      created_by
    )
    VALUES (
      p_policy_set_id,
      p_rule_definition_id,
      p_scope_type,
      p_scope_id,
      NULLIF(btrim(p_workflow_stage), ''),
      p_value,
      p_priority,
      p_effective_from,
      p_effective_to,
      v_user_id
    )
    RETURNING id INTO v_rule_id;

  ELSE
    UPDATE public.governance_policy_rules
    SET
      rule_definition_id = p_rule_definition_id,
      scope_type = p_scope_type,
      scope_id = p_scope_id,
      workflow_stage = NULLIF(btrim(p_workflow_stage), ''),
      value = p_value,
      priority = p_priority,
      effective_from = p_effective_from,
      effective_to = p_effective_to,
      updated_at = now()
    WHERE id = p_policy_rule_id
      AND policy_set_id = p_policy_set_id
    RETURNING id INTO v_rule_id;

    IF v_rule_id IS NULL THEN
      RAISE EXCEPTION 'Policy rule not found in policy set';
    END IF;
  END IF;

  RETURN v_rule_id;
END;
$$;


-- ============================================================================
-- 7. HARDEN POLICY APPROVAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_governance_policy_set(
  p_policy_set_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    entity_id,
    status
  INTO
    v_entity_id,
    v_status
  FROM public.governance_policy_sets
  WHERE id = p_policy_set_id
  FOR UPDATE;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  IF NOT (v_entity_id = ANY (public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_entity_id,
    'governance.policy.approve'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft policy sets may be approved';
  END IF;

  PERFORM public.validate_governance_policy_set(
    p_policy_set_id
  );

  UPDATE public.governance_policy_sets
  SET
    status = 'approved',
    approved_by = v_user_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_policy_set_id;
END;
$$;


-- ============================================================================
-- 8. HARDEN POLICY ACTIVATION
--
-- Serialises activation for the named policy and preserves explicit
-- supersession lineage.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_governance_policy_set(
  p_policy_set_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
  v_domain text;
  v_policy_name text;
  v_status text;

  v_previous_policy_set_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    entity_id,
    domain,
    policy_name,
    status
  INTO
    v_entity_id,
    v_domain,
    v_policy_name,
    v_status
  FROM public.governance_policy_sets
  WHERE id = p_policy_set_id
  FOR UPDATE;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  IF NOT (v_entity_id = ANY (public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_entity_id,
    'governance.policy.activate'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved policy sets may be activated';
  END IF;

  PERFORM public.validate_governance_policy_set(
    p_policy_set_id
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_entity_id::text || ':' || v_domain || ':' || v_policy_name,
      0
    )
  );

  SELECT id
  INTO v_previous_policy_set_id
  FROM public.governance_policy_sets
  WHERE entity_id = v_entity_id
    AND domain = v_domain
    AND policy_name = v_policy_name
    AND status = 'active'
    AND id <> p_policy_set_id
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  UPDATE public.governance_policy_sets
  SET
    status = 'superseded',
    superseded_at = now(),
    updated_at = now()
  WHERE entity_id = v_entity_id
    AND domain = v_domain
    AND policy_name = v_policy_name
    AND status = 'active'
    AND id <> p_policy_set_id;

  UPDATE public.governance_policy_sets
  SET
    status = 'active',
    supersedes_policy_set_id = v_previous_policy_set_id,
    activated_at = now(),
    updated_at = now()
  WHERE id = p_policy_set_id;
END;
$$;


-- ============================================================================
-- 9. FUNCTION EXECUTION AUTHORITY
--
-- Reassert command authority after CREATE OR REPLACE.
-- ============================================================================

REVOKE ALL ON FUNCTION public.create_governance_policy_set(
  uuid,
  text,
  text,
  text,
  date,
  date
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_governance_policy_set(
  uuid,
  text,
  text,
  text,
  date,
  date
) TO authenticated, service_role, postgres;


REVOKE ALL ON FUNCTION public.upsert_governance_policy_rule(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  text,
  integer,
  date,
  date,
  uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_governance_policy_rule(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  text,
  integer,
  date,
  date,
  uuid
) TO authenticated, service_role, postgres;


REVOKE ALL ON FUNCTION public.approve_governance_policy_set(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_governance_policy_set(uuid)
TO authenticated, service_role, postgres;


REVOKE ALL ON FUNCTION public.activate_governance_policy_set(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.activate_governance_policy_set(uuid)
TO authenticated, service_role, postgres;


COMMIT;
