-- ============================================================================
-- AssetFlow
-- Harden governance policy and exception authority
--
-- Forward migration only.
--
-- Establishes:
--   1. explicit client-governed failure outcomes on policy rules;
--   2. removal of the legacy policy-rule command signature;
--   3. governed exception request / decision / revocation authority;
--   4. auditability for governance policy and exception lifecycle changes;
--   5. preservation of the existing client/entity permission boundary.
--
-- Platform rule-definition authority remains outside client administration.
-- ============================================================================


-- ============================================================================
-- 1. POLICY-RULE FAILURE OUTCOME AUTHORITY
-- ============================================================================

-- The previous command signature cannot express failure_outcome even though the
-- evaluator consumes it. Remove that callable contract before creating the
-- replacement so there is no legacy path that silently falls back to the
-- column default.

DROP FUNCTION IF EXISTS public.upsert_governance_policy_rule(
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
);


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
  p_policy_rule_id uuid DEFAULT NULL,
  p_failure_outcome text DEFAULT 'REQUIRES_APPROVAL'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;

  v_entity_id uuid;
  v_policy_status text;
  v_rule_id uuid;

  v_failure_outcome text;
  v_old_values jsonb;
  v_new_values jsonb;
  v_action text;
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

  v_failure_outcome := upper(NULLIF(btrim(p_failure_outcome), ''));

  IF v_failure_outcome IS NULL
     OR v_failure_outcome NOT IN (
       'WARNING',
       'REQUIRES_APPROVAL',
       'BLOCK'
     ) THEN
    RAISE EXCEPTION
      'Failure outcome must be WARNING, REQUIRES_APPROVAL, or BLOCK';
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

  IF NOT (v_entity_id = ANY(public.auth_entities())) THEN
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
    v_action := 'create';

    INSERT INTO public.governance_policy_rules (
      policy_set_id,
      rule_definition_id,
      scope_type,
      scope_id,
      workflow_stage,
      value,
      failure_outcome,
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
      v_failure_outcome,
      p_priority,
      p_effective_from,
      p_effective_to,
      v_user_id
    )
    RETURNING id INTO v_rule_id;

  ELSE
    v_action := 'update';

    SELECT to_jsonb(gpr)
    INTO v_old_values
    FROM public.governance_policy_rules gpr
    WHERE gpr.id = p_policy_rule_id
      AND gpr.policy_set_id = p_policy_set_id
    FOR UPDATE;

    IF v_old_values IS NULL THEN
      RAISE EXCEPTION 'Policy rule not found in policy set';
    END IF;

    UPDATE public.governance_policy_rules
    SET
      rule_definition_id = p_rule_definition_id,
      scope_type = p_scope_type,
      scope_id = p_scope_id,
      workflow_stage = NULLIF(btrim(p_workflow_stage), ''),
      value = p_value,
      failure_outcome = v_failure_outcome,
      priority = p_priority,
      effective_from = p_effective_from,
      effective_to = p_effective_to,
      updated_at = now()
    WHERE id = p_policy_rule_id
      AND policy_set_id = p_policy_set_id
    RETURNING id INTO v_rule_id;
  END IF;

  SELECT to_jsonb(gpr)
  INTO v_new_values
  FROM public.governance_policy_rules gpr
  WHERE gpr.id = v_rule_id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    resource_label,
    old_values,
    new_values,
    created_at
  )
  VALUES (
    v_user_id,
    v_user_email,
    v_action,
    'governance_policy_rule',
    v_rule_id,
    'Governance policy rule',
    v_old_values,
    v_new_values,
    now()
  );

  RETURN v_rule_id;
END;
$$;


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
  uuid,
  text
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
  uuid,
  text
) TO authenticated, service_role, postgres;


-- ============================================================================
-- 2. AUDITED POLICY LIFECYCLE AUTHORITY
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 2.1 Policy-set creation
-- ----------------------------------------------------------------------------

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
  v_user_email text;

  v_policy_set_id uuid;
  v_version integer;
  v_domain text;
  v_policy_name text;
  v_new_values jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required';
  END IF;

  IF NOT (p_entity_id = ANY(public.auth_entities())) THEN
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

  SELECT to_jsonb(gps)
  INTO v_new_values
  FROM public.governance_policy_sets gps
  WHERE gps.id = v_policy_set_id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    resource_label,
    old_values,
    new_values,
    created_at
  )
  VALUES (
    v_user_id,
    v_user_email,
    'create',
    'governance_policy_set',
    v_policy_set_id,
    v_policy_name || ' v' || v_version::text,
    NULL,
    v_new_values,
    now()
  );

  RETURN v_policy_set_id;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.2 Policy-set approval
-- ----------------------------------------------------------------------------

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
  v_user_email text;

  v_entity_id uuid;
  v_status text;
  v_policy_name text;
  v_version integer;

  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    entity_id,
    status,
    policy_name,
    version,
    to_jsonb(gps)
  INTO
    v_entity_id,
    v_status,
    v_policy_name,
    v_version,
    v_old_values
  FROM public.governance_policy_sets gps
  WHERE id = p_policy_set_id
  FOR UPDATE;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  IF NOT (v_entity_id = ANY(public.auth_entities())) THEN
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

  SELECT to_jsonb(gps)
  INTO v_new_values
  FROM public.governance_policy_sets gps
  WHERE gps.id = p_policy_set_id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    resource_label,
    old_values,
    new_values,
    created_at
  )
  VALUES (
    v_user_id,
    v_user_email,
    'approve',
    'governance_policy_set',
    p_policy_set_id,
    v_policy_name || ' v' || v_version::text,
    v_old_values,
    v_new_values,
    now()
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.3 Policy-set activation
--
-- Preserve the existing advisory-lock and supersession contract.
-- ----------------------------------------------------------------------------

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
  v_user_email text;

  v_entity_id uuid;
  v_domain text;
  v_policy_name text;
  v_version integer;
  v_status text;

  v_previous_policy_set_id uuid;

  v_old_values jsonb;
  v_new_values jsonb;
  v_previous_old_values jsonb;
  v_previous_new_values jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    entity_id,
    domain,
    policy_name,
    version,
    status,
    to_jsonb(gps)
  INTO
    v_entity_id,
    v_domain,
    v_policy_name,
    v_version,
    v_status,
    v_old_values
  FROM public.governance_policy_sets gps
  WHERE id = p_policy_set_id
  FOR UPDATE;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Policy set not found';
  END IF;

  IF NOT (v_entity_id = ANY(public.auth_entities())) THEN
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

  SELECT
    id,
    to_jsonb(gps)
  INTO
    v_previous_policy_set_id,
    v_previous_old_values
  FROM public.governance_policy_sets gps
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

  IF v_previous_policy_set_id IS NOT NULL THEN
    SELECT to_jsonb(gps)
    INTO v_previous_new_values
    FROM public.governance_policy_sets gps
    WHERE gps.id = v_previous_policy_set_id;
  END IF;

  UPDATE public.governance_policy_sets
  SET
    status = 'active',
    supersedes_policy_set_id = v_previous_policy_set_id,
    activated_at = now(),
    updated_at = now()
  WHERE id = p_policy_set_id;

  SELECT to_jsonb(gps)
  INTO v_new_values
  FROM public.governance_policy_sets gps
  WHERE gps.id = p_policy_set_id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

  -- Audit the policy becoming active.
  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    resource_label,
    old_values,
    new_values,
    created_at
  )
  VALUES (
    v_user_id,
    v_user_email,
    'update',
    'governance_policy_set',
    p_policy_set_id,
    v_policy_name || ' v' || v_version::text,
    v_old_values,
    v_new_values,
    now()
  );

  -- Preserve explicit audit evidence for the policy version that was
  -- superseded by this activation.
  IF v_previous_policy_set_id IS NOT NULL THEN
    INSERT INTO public.audit_log (
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      resource_label,
      old_values,
      new_values,
      created_at
    )
    VALUES (
      v_user_id,
      v_user_email,
      'update',
      'governance_policy_set',
      v_previous_policy_set_id,
      v_policy_name || ' superseded',
      v_previous_old_values,
      v_previous_new_values,
      now()
    );
  END IF;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2.4 Reassert policy command authority
-- ----------------------------------------------------------------------------

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


REVOKE ALL ON FUNCTION public.approve_governance_policy_set(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_governance_policy_set(uuid)
TO authenticated, service_role, postgres;


REVOKE ALL ON FUNCTION public.activate_governance_policy_set(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.activate_governance_policy_set(uuid)
TO authenticated, service_role, postgres;


-- ============================================================================
-- 3. GOVERNED EXCEPTION AUTHORITY
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 3.1 Exception request
--
-- The generic governance layer validates governance identity and authority.
-- The calling domain command remains responsible for establishing that the
-- referenced business object exists and belongs to the supplied entity.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_governance_exception(
  p_entity_id uuid,
  p_rule_definition_id uuid,
  p_reference_type text,
  p_reference_id uuid,
  p_requested_value jsonb,
  p_reason text,
  p_policy_rule_id uuid DEFAULT NULL,
  p_effective_from timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;

  v_rule_key text;
  v_value_type text;
  v_governance_class text;
  v_inheritance_mode text;
  v_override_allowed boolean;
  v_rule_active boolean;

  v_policy_rule_definition_id uuid;
  v_policy_entity_id uuid;

  v_reference_type text;
  v_reason text;

  v_exception_id uuid;
  v_new_values jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required';
  END IF;

  IF p_rule_definition_id IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition is required';
  END IF;

  IF p_reference_id IS NULL THEN
    RAISE EXCEPTION 'Reference id is required';
  END IF;

  v_reference_type := NULLIF(btrim(p_reference_type), '');
  v_reason := NULLIF(btrim(p_reason), '');

  IF v_reference_type IS NULL THEN
    RAISE EXCEPTION 'Reference type is required';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Exception reason is required';
  END IF;

  IF p_effective_from IS NOT NULL
     AND p_expires_at IS NOT NULL
     AND p_expires_at <= p_effective_from THEN
    RAISE EXCEPTION
      'Exception expiry must be later than effective_from';
  END IF;

  IF NOT (p_entity_id = ANY(public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    p_entity_id,
    'governance.exception.request'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT
    grd.rule_key,
    grd.value_type,
    grd.governance_class,
    grd.inheritance_mode,
    grd.override_allowed,
    grd.is_active
  INTO
    v_rule_key,
    v_value_type,
    v_governance_class,
    v_inheritance_mode,
    v_override_allowed,
    v_rule_active
  FROM public.governance_rule_definitions grd
  WHERE grd.id = p_rule_definition_id;

  IF v_rule_key IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition not found';
  END IF;

  IF NOT v_rule_active THEN
    RAISE EXCEPTION 'Governance rule definition is inactive';
  END IF;

  IF v_governance_class = 'platform_invariant'
     OR v_inheritance_mode = 'non_overridable' THEN
    RAISE EXCEPTION 'Platform invariants cannot receive exceptions';
  END IF;

  IF NOT v_override_allowed THEN
    RAISE EXCEPTION 'Governance rule does not permit exceptions';
  END IF;

  IF NOT public.governance_rule_value_is_valid(
    v_value_type,
    p_requested_value
  ) THEN
    RAISE EXCEPTION
      'Requested exception value is invalid for rule value type %',
      v_value_type;
  END IF;

  -- Additive and restrictive rules resolve from contributing assignments.
  -- Their exception must therefore identify the exact contributing rule.
  IF v_inheritance_mode IN ('additive', 'restrictive')
     AND p_policy_rule_id IS NULL THEN
    RAISE EXCEPTION
      'Policy rule is required for additive or restrictive exceptions';
  END IF;

  IF p_policy_rule_id IS NOT NULL THEN
    SELECT
      gpr.rule_definition_id,
      gps.entity_id
    INTO
      v_policy_rule_definition_id,
      v_policy_entity_id
    FROM public.governance_policy_rules gpr
    JOIN public.governance_policy_sets gps
      ON gps.id = gpr.policy_set_id
    WHERE gpr.id = p_policy_rule_id;

    IF v_policy_rule_definition_id IS NULL THEN
      RAISE EXCEPTION 'Policy rule not found';
    END IF;

    IF v_policy_rule_definition_id <> p_rule_definition_id THEN
      RAISE EXCEPTION
        'Policy rule does not belong to the requested governance rule';
    END IF;

    IF v_policy_entity_id <> p_entity_id THEN
      RAISE EXCEPTION
        'Policy rule does not belong to the requested entity';
    END IF;
  END IF;

  INSERT INTO public.governance_exceptions (
    entity_id,
    rule_definition_id,
    policy_rule_id,
    reference_type,
    reference_id,
    requested_value,
    reason,
    status,
    requested_by,
    requested_at,
    effective_from,
    expires_at
  )
  VALUES (
    p_entity_id,
    p_rule_definition_id,
    p_policy_rule_id,
    v_reference_type,
    p_reference_id,
    p_requested_value,
    v_reason,
    'requested',
    v_user_id,
    now(),
    p_effective_from,
    p_expires_at
  )
  RETURNING id INTO v_exception_id;

  SELECT to_jsonb(ge)
  INTO v_new_values
  FROM public.governance_exceptions ge
  WHERE ge.id = v_exception_id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

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
    v_user_id,
    v_user_email,
    'create',
    'governance_exception',
    v_exception_id,
    v_rule_key || ' exception',
    NULL,
    v_new_values,
    p_user_agent,
    now()
  );

  RETURN v_exception_id;
END;
$$;


REVOKE ALL ON FUNCTION public.request_governance_exception(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  text,
  uuid,
  timestamptz,
  timestamptz,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_governance_exception(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  text,
  uuid,
  timestamptz,
  timestamptz,
  text
) TO authenticated, service_role, postgres;

-- ----------------------------------------------------------------------------
-- 3.2 Exception decision
--
-- Approval/rejection is a governed transition from requested state.
-- Approval revalidates the rule and any assignment-specific authority and
-- prevents overlapping approved exceptions that would make the resolver
-- ambiguous now or in the future.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decide_governance_exception(
  p_exception_id uuid,
  p_decision text,
  p_effective_value jsonb DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;

  v_exception public.governance_exceptions%ROWTYPE;

  v_decision text;
  v_effective_value jsonb;

  v_rule_key text;
  v_value_type text;
  v_governance_class text;
  v_inheritance_mode text;
  v_override_allowed boolean;
  v_rule_active boolean;

  v_policy_rule_definition_id uuid;
  v_policy_rule_active boolean;
  v_policy_entity_id uuid;
  v_policy_set_status text;

  v_conflict_count integer;

  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_exception_id IS NULL THEN
    RAISE EXCEPTION 'Governance exception is required';
  END IF;

  v_decision := lower(NULLIF(btrim(p_decision), ''));

  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION
      'Decision must be approved or rejected';
  END IF;

  SELECT *
  INTO v_exception
  FROM public.governance_exceptions
  WHERE id = p_exception_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Governance exception not found';
  END IF;

  IF NOT (v_exception.entity_id = ANY(public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_exception.entity_id,
    'governance.exception.decide'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_exception.status <> 'requested' THEN
    RAISE EXCEPTION
      'Only requested governance exceptions can be decided';
  END IF;

  SELECT to_jsonb(ge)
  INTO v_old_values
  FROM public.governance_exceptions ge
  WHERE ge.id = p_exception_id;

  SELECT
    grd.rule_key,
    grd.value_type,
    grd.governance_class,
    grd.inheritance_mode,
    grd.override_allowed,
    grd.is_active
  INTO
    v_rule_key,
    v_value_type,
    v_governance_class,
    v_inheritance_mode,
    v_override_allowed,
    v_rule_active
  FROM public.governance_rule_definitions grd
  WHERE grd.id = v_exception.rule_definition_id;

  IF v_rule_key IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition not found';
  END IF;

  IF v_decision = 'approved' THEN
    IF NOT v_rule_active THEN
      RAISE EXCEPTION
        'Inactive governance rules cannot receive approved exceptions';
    END IF;

    IF v_governance_class = 'platform_invariant'
       OR v_inheritance_mode = 'non_overridable' THEN
      RAISE EXCEPTION
        'Platform invariants cannot receive exceptions';
    END IF;

    IF NOT v_override_allowed THEN
      RAISE EXCEPTION
        'Governance rule does not permit exceptions';
    END IF;

    v_effective_value :=
      COALESCE(p_effective_value, v_exception.requested_value);

    IF NOT public.governance_rule_value_is_valid(
      v_value_type,
      v_effective_value
    ) THEN
      RAISE EXCEPTION
        'Effective exception value is invalid for rule value type %',
        v_value_type;
    END IF;

    IF v_inheritance_mode IN ('additive', 'restrictive')
       AND v_exception.policy_rule_id IS NULL THEN
      RAISE EXCEPTION
        'Policy rule is required for additive or restrictive exceptions';
    END IF;

    IF v_exception.policy_rule_id IS NOT NULL THEN
      SELECT
        gpr.rule_definition_id,
        gpr.is_active,
        gps.entity_id,
        gps.status
      INTO
        v_policy_rule_definition_id,
        v_policy_rule_active,
        v_policy_entity_id,
        v_policy_set_status
      FROM public.governance_policy_rules gpr
      JOIN public.governance_policy_sets gps
        ON gps.id = gpr.policy_set_id
      WHERE gpr.id = v_exception.policy_rule_id;

      IF v_policy_rule_definition_id IS NULL THEN
        RAISE EXCEPTION
          'Referenced policy rule no longer exists';
      END IF;

      IF v_policy_rule_definition_id <> v_exception.rule_definition_id THEN
        RAISE EXCEPTION
          'Referenced policy rule no longer belongs to the governance rule';
      END IF;

      IF v_policy_entity_id <> v_exception.entity_id THEN
        RAISE EXCEPTION
          'Referenced policy rule no longer belongs to the exception entity';
      END IF;

      IF NOT v_policy_rule_active THEN
        RAISE EXCEPTION
          'Referenced policy rule is inactive';
      END IF;

      IF v_policy_set_status <> 'active' THEN
        RAISE EXCEPTION
          'Referenced policy rule does not belong to an active policy set';
      END IF;
    END IF;

    /*
     * Serialize decisions for this transaction/rule identity.
     *
     * The lock intentionally does not include policy_rule_id because an
     * override rule may have both rule-level and assignment-specific
     * exceptions, and those can conflict in the resolver.
     */
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        v_exception.entity_id::text
        || '|'
        || v_exception.reference_type
        || '|'
        || v_exception.reference_id::text
        || '|'
        || v_exception.rule_definition_id::text,
        0
      )
    );

    /*
     * Prevent overlapping approved windows.
     *
     * Override:
     *   rule-level exceptions and exceptions targeting the selected assignment
     *   can both be applicable, so they share one conflict domain.
     *
     * Additive/restrictive:
     *   only the exact contributing policy assignment can be overridden.
     *
     * Windows are half-open:
     *   [effective_from, expires_at)
     * NULL start/end means unbounded.
     */
    SELECT count(*)
    INTO v_conflict_count
    FROM public.governance_exceptions ge
    WHERE ge.id <> v_exception.id
      AND ge.entity_id = v_exception.entity_id
      AND ge.rule_definition_id = v_exception.rule_definition_id
      AND ge.reference_type = v_exception.reference_type
      AND ge.reference_id = v_exception.reference_id
      AND ge.status = 'approved'
      AND (
        (
          v_inheritance_mode = 'override'
          AND (
            ge.policy_rule_id IS NULL
            OR v_exception.policy_rule_id IS NULL
            OR ge.policy_rule_id = v_exception.policy_rule_id
          )
        )
        OR
        (
          v_inheritance_mode IN ('additive', 'restrictive')
          AND ge.policy_rule_id = v_exception.policy_rule_id
        )
      )
      AND (
        ge.expires_at IS NULL
        OR v_exception.effective_from IS NULL
        OR ge.expires_at > v_exception.effective_from
      )
      AND (
        v_exception.expires_at IS NULL
        OR ge.effective_from IS NULL
        OR v_exception.expires_at > ge.effective_from
      );

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION
        'An overlapping approved governance exception already exists for this reference and rule';
    END IF;

    UPDATE public.governance_exceptions
    SET
      status = 'approved',
      effective_value = v_effective_value,
      decided_by = v_user_id,
      decided_at = now()
    WHERE id = v_exception.id;

  ELSE
    UPDATE public.governance_exceptions
    SET
      status = 'rejected',
      effective_value = NULL,
      decided_by = v_user_id,
      decided_at = now()
    WHERE id = v_exception.id;
  END IF;

  SELECT to_jsonb(ge)
  INTO v_new_values
  FROM public.governance_exceptions ge
  WHERE ge.id = v_exception.id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

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
    v_user_id,
    v_user_email,
    CASE
      WHEN v_decision = 'approved' THEN 'approve'
      ELSE 'reject'
    END,
    'governance_exception',
    v_exception.id,
    v_rule_key || ' exception',
    v_old_values,
    v_new_values,
    p_user_agent,
    now()
  );

  RETURN v_exception.id;
END;
$$;


REVOKE ALL ON FUNCTION public.decide_governance_exception(
  uuid,
  text,
  jsonb,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.decide_governance_exception(
  uuid,
  text,
  jsonb,
  text
) TO authenticated, service_role, postgres;



-- ----------------------------------------------------------------------------
-- 3.3 Exception revocation provenance and authority
--
-- Revocation is distinct from the original approval decision. Preserve
-- decided_by/decided_at as approval provenance and record revocation
-- independently.
-- ----------------------------------------------------------------------------

ALTER TABLE public.governance_exceptions
  ADD COLUMN IF NOT EXISTS revoked_by uuid
    REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revocation_reason text;


ALTER TABLE public.governance_exceptions
  DROP CONSTRAINT IF EXISTS governance_exceptions_revocation_metadata_check;

ALTER TABLE public.governance_exceptions
  ADD CONSTRAINT governance_exceptions_revocation_metadata_check
  CHECK (
    (
      status = 'revoked'
      AND revoked_by IS NOT NULL
      AND revoked_at IS NOT NULL
      AND revocation_reason IS NOT NULL
      AND btrim(revocation_reason) <> ''
    )
    OR
    (
      status <> 'revoked'
      AND revoked_by IS NULL
      AND revoked_at IS NULL
      AND revocation_reason IS NULL
    )
  );


CREATE OR REPLACE FUNCTION public.revoke_governance_exception(
  p_exception_id uuid,
  p_reason text,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;

  v_exception public.governance_exceptions%ROWTYPE;

  v_reason text;
  v_rule_key text;

  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_exception_id IS NULL THEN
    RAISE EXCEPTION 'Governance exception is required';
  END IF;

  v_reason := NULLIF(btrim(p_reason), '');

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Revocation reason is required';
  END IF;

  SELECT *
  INTO v_exception
  FROM public.governance_exceptions
  WHERE id = p_exception_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Governance exception not found';
  END IF;

  IF NOT (v_exception.entity_id = ANY(public.auth_entities())) THEN
    RAISE EXCEPTION 'Entity access denied';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_exception.entity_id,
    'governance.exception.decide'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_exception.status <> 'approved' THEN
    RAISE EXCEPTION
      'Only approved governance exceptions can be revoked';
  END IF;

  SELECT grd.rule_key
  INTO v_rule_key
  FROM public.governance_rule_definitions grd
  WHERE grd.id = v_exception.rule_definition_id;

  IF v_rule_key IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition not found';
  END IF;

  SELECT to_jsonb(ge)
  INTO v_old_values
  FROM public.governance_exceptions ge
  WHERE ge.id = v_exception.id;

  UPDATE public.governance_exceptions
  SET
    status = 'revoked',
    revoked_by = v_user_id,
    revoked_at = now(),
    revocation_reason = v_reason
  WHERE id = v_exception.id;

  SELECT to_jsonb(ge)
  INTO v_new_values
  FROM public.governance_exceptions ge
  WHERE ge.id = v_exception.id;

  SELECT email
  INTO v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

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
    v_user_id,
    v_user_email,
    'update',
    'governance_exception',
    v_exception.id,
    v_rule_key || ' exception revoked',
    v_old_values,
    v_new_values,
    p_user_agent,
    now()
  );

  RETURN v_exception.id;
END;
$$;


REVOKE ALL ON FUNCTION public.revoke_governance_exception(
  uuid,
  text,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.revoke_governance_exception(
  uuid,
  text,
  text
) TO authenticated, service_role, postgres;

