-- AssetFlow
-- Canonical Governance Foundation
--
-- Establishes the cross-domain governance model used by AssetFlow.
--
-- Core principles:
--
--   1. Platform invariants are distinct from client governance policy.
--   2. Client policy is versioned and never silently rewritten.
--   3. Policy scope is resolved from transaction context.
--   4. Approved exceptions do not mutate the underlying policy.
--   5. Governed decisions preserve immutable evaluation evidence.
--   6. Browser clients do not directly mutate governance authority tables.
--
-- This migration establishes the persistence and authority foundation.
-- It does NOT yet implement the policy resolver or connect governance
-- evaluation to commercial submission.

BEGIN;


/* ========================================================================
 * 1. GOVERNANCE RULE DEFINITIONS
 *
 * Defines the meaning and behaviour of rules the platform knows how to
 * evaluate.
 * ====================================================================== */

CREATE TABLE public.governance_rule_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_key text NOT NULL UNIQUE,
  domain text NOT NULL,
  name text NOT NULL,
  description text,

  value_type text NOT NULL,
  governance_class text NOT NULL,
  workflow_stage text,

  inheritance_mode text NOT NULL DEFAULT 'override',

  override_allowed boolean NOT NULL DEFAULT true,
  approval_required_for_override boolean NOT NULL DEFAULT false,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT governance_rule_definitions_rule_key_nonblank
    CHECK (btrim(rule_key) <> ''),

  CONSTRAINT governance_rule_definitions_domain_nonblank
    CHECK (btrim(domain) <> ''),

  CONSTRAINT governance_rule_definitions_name_nonblank
    CHECK (btrim(name) <> ''),

  CONSTRAINT governance_rule_definitions_value_type_check
    CHECK (
      value_type IN (
        'boolean',
        'number',
        'text',
        'date',
        'enum',
        'list',
        'structured'
      )
    ),

  CONSTRAINT governance_rule_definitions_class_check
    CHECK (
      governance_class IN (
        'platform_invariant',
        'client_governance',
        'operational_preference'
      )
    ),

  CONSTRAINT governance_rule_definitions_inheritance_check
    CHECK (
      inheritance_mode IN (
        'override',
        'additive',
        'restrictive',
        'non_overridable'
      )
    ),

  CONSTRAINT governance_rule_definitions_platform_invariant_check
    CHECK (
      governance_class <> 'platform_invariant'
      OR (
        override_allowed = false
        AND inheritance_mode = 'non_overridable'
      )
    )
);

CREATE INDEX governance_rule_definitions_domain_idx
  ON public.governance_rule_definitions(domain);

CREATE INDEX governance_rule_definitions_stage_idx
  ON public.governance_rule_definitions(workflow_stage);

CREATE INDEX governance_rule_definitions_active_idx
  ON public.governance_rule_definitions(is_active);


/* ========================================================================
 * 2. GOVERNANCE POLICY SETS
 *
 * Versioned client-owned policy containers.
 *
 * Active policy versions are not intended to be edited in place.
 * ====================================================================== */

CREATE TABLE public.governance_policy_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL
    REFERENCES public.entities(id),

  domain text NOT NULL,
  policy_name text NOT NULL,
  description text,

  version integer NOT NULL DEFAULT 1,

  status text NOT NULL DEFAULT 'draft',

  effective_from date,
  effective_to date,

  supersedes_policy_set_id uuid
    REFERENCES public.governance_policy_sets(id),

  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  activated_at timestamptz,
  superseded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT governance_policy_sets_domain_nonblank
    CHECK (btrim(domain) <> ''),

  CONSTRAINT governance_policy_sets_name_nonblank
    CHECK (btrim(policy_name) <> ''),

  CONSTRAINT governance_policy_sets_version_positive
    CHECK (version > 0),

  CONSTRAINT governance_policy_sets_status_check
    CHECK (
      status IN (
        'draft',
        'approved',
        'active',
        'superseded'
      )
    ),

  CONSTRAINT governance_policy_sets_dates_check
    CHECK (
      effective_to IS NULL
      OR effective_from IS NULL
      OR effective_to >= effective_from
    ),

  CONSTRAINT governance_policy_sets_approval_metadata_check
    CHECK (
      status = 'draft'
      OR (
        approved_by IS NOT NULL
        AND approved_at IS NOT NULL
      )
    ),

  CONSTRAINT governance_policy_sets_activation_metadata_check
    CHECK (
      status <> 'active'
      OR activated_at IS NOT NULL
    ),

  CONSTRAINT governance_policy_sets_superseded_metadata_check
    CHECK (
      status <> 'superseded'
      OR superseded_at IS NOT NULL
    ),

  UNIQUE (entity_id, domain, policy_name, version)
);

CREATE INDEX governance_policy_sets_entity_idx
  ON public.governance_policy_sets(entity_id);

CREATE INDEX governance_policy_sets_entity_domain_idx
  ON public.governance_policy_sets(entity_id, domain);

CREATE INDEX governance_policy_sets_status_idx
  ON public.governance_policy_sets(status);

CREATE INDEX governance_policy_sets_effective_idx
  ON public.governance_policy_sets(effective_from, effective_to);


/* ========================================================================
 * 3. GOVERNANCE POLICY RULES
 *
 * Assigns a configured rule value to a policy set and optional scope.
 *
 * Scope is deliberately represented as a dimension rather than a rigid
 * parent/child hierarchy. The resolver will derive the applicable scope
 * from transaction context.
 * ====================================================================== */

CREATE TABLE public.governance_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  policy_set_id uuid NOT NULL
    REFERENCES public.governance_policy_sets(id)
    ON DELETE CASCADE,

  rule_definition_id uuid NOT NULL
    REFERENCES public.governance_rule_definitions(id),

  scope_type text NOT NULL DEFAULT 'entity',
  scope_id uuid,

  workflow_stage text,

  value jsonb NOT NULL,

  priority integer NOT NULL DEFAULT 0,

  effective_from date,
  effective_to date,

  is_active boolean NOT NULL DEFAULT true,

  created_by uuid REFERENCES auth.users(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT governance_policy_rules_scope_type_check
    CHECK (
      scope_type IN (
        'entity',
        'portfolio',
        'property_type',
        'property',
        'counterparty'
      )
    ),

  CONSTRAINT governance_policy_rules_scope_id_check
    CHECK (
      (scope_type = 'entity' AND scope_id IS NULL)
      OR
      (scope_type <> 'entity' AND scope_id IS NOT NULL)
    ),

  CONSTRAINT governance_policy_rules_dates_check
    CHECK (
      effective_to IS NULL
      OR effective_from IS NULL
      OR effective_to >= effective_from
    )
);

CREATE INDEX governance_policy_rules_policy_set_idx
  ON public.governance_policy_rules(policy_set_id);

CREATE INDEX governance_policy_rules_definition_idx
  ON public.governance_policy_rules(rule_definition_id);

CREATE INDEX governance_policy_rules_scope_idx
  ON public.governance_policy_rules(scope_type, scope_id);

CREATE INDEX governance_policy_rules_stage_idx
  ON public.governance_policy_rules(workflow_stage);

CREATE INDEX governance_policy_rules_effective_idx
  ON public.governance_policy_rules(effective_from, effective_to);


/* ========================================================================
 * 4. GOVERNANCE EXCEPTIONS
 *
 * Represents a requested or approved deviation from an effective policy.
 *
 * Exceptions are transaction/reference-specific. They do not alter the
 * underlying policy definition.
 * ====================================================================== */

CREATE TABLE public.governance_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL
    REFERENCES public.entities(id),

  rule_definition_id uuid NOT NULL
    REFERENCES public.governance_rule_definitions(id),

  policy_rule_id uuid
    REFERENCES public.governance_policy_rules(id),

  reference_type text NOT NULL,
  reference_id uuid NOT NULL,

  requested_value jsonb,
  effective_value jsonb,

  reason text NOT NULL,

  status text NOT NULL DEFAULT 'requested',

  requested_by uuid REFERENCES auth.users(id),
  decided_by uuid REFERENCES auth.users(id),

  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,

  effective_from timestamptz,
  expires_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT governance_exceptions_reference_type_nonblank
    CHECK (btrim(reference_type) <> ''),

  CONSTRAINT governance_exceptions_reason_nonblank
    CHECK (btrim(reason) <> ''),

  CONSTRAINT governance_exceptions_status_check
    CHECK (
      status IN (
        'requested',
        'approved',
        'rejected',
        'expired',
        'revoked'
      )
    ),

  CONSTRAINT governance_exceptions_decision_metadata_check
    CHECK (
      status = 'requested'
      OR status = 'expired'
      OR (
        decided_by IS NOT NULL
        AND decided_at IS NOT NULL
      )
    ),

  CONSTRAINT governance_exceptions_effective_dates_check
    CHECK (
      expires_at IS NULL
      OR effective_from IS NULL
      OR expires_at >= effective_from
    )
);

CREATE INDEX governance_exceptions_entity_idx
  ON public.governance_exceptions(entity_id);

CREATE INDEX governance_exceptions_reference_idx
  ON public.governance_exceptions(reference_type, reference_id);

CREATE INDEX governance_exceptions_rule_idx
  ON public.governance_exceptions(rule_definition_id);

CREATE INDEX governance_exceptions_status_idx
  ON public.governance_exceptions(status);


/* ========================================================================
 * 5. GOVERNANCE EVALUATIONS
 *
 * Immutable snapshot of a governance evaluation performed against a
 * specific business object/version.
 * ====================================================================== */

CREATE TABLE public.governance_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL
    REFERENCES public.entities(id),

  domain text NOT NULL,
  workflow_stage text NOT NULL,

  reference_type text NOT NULL,
  reference_id uuid NOT NULL,

  reference_version_id uuid,

  portfolio_id uuid
    REFERENCES public.portfolios(id),

  property_type_id uuid
    REFERENCES public.property_types(id),

  property_id uuid
    REFERENCES public.properties(id),

  counterparty_id uuid
    REFERENCES public.tenants(id),

  effective_date date NOT NULL,

  overall_outcome text NOT NULL,

  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  evaluated_by uuid REFERENCES auth.users(id),
  evaluated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT governance_evaluations_domain_nonblank
    CHECK (btrim(domain) <> ''),

  CONSTRAINT governance_evaluations_stage_nonblank
    CHECK (btrim(workflow_stage) <> ''),

  CONSTRAINT governance_evaluations_reference_type_nonblank
    CHECK (btrim(reference_type) <> ''),

  CONSTRAINT governance_evaluations_outcome_check
    CHECK (
      overall_outcome IN (
        'PASS',
        'WARNING',
        'REQUIRES_APPROVAL',
        'BLOCK'
      )
    )
);

CREATE INDEX governance_evaluations_entity_idx
  ON public.governance_evaluations(entity_id);

CREATE INDEX governance_evaluations_reference_idx
  ON public.governance_evaluations(reference_type, reference_id);

CREATE INDEX governance_evaluations_reference_version_idx
  ON public.governance_evaluations(reference_version_id);

CREATE INDEX governance_evaluations_stage_idx
  ON public.governance_evaluations(domain, workflow_stage);

CREATE INDEX governance_evaluations_evaluated_at_idx
  ON public.governance_evaluations(evaluated_at);


/* ========================================================================
 * 6. GOVERNANCE EVALUATION RESULTS
 *
 * Immutable per-rule evidence belonging to a governance evaluation.
 * ====================================================================== */

CREATE TABLE public.governance_evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  evaluation_id uuid NOT NULL
    REFERENCES public.governance_evaluations(id)
    ON DELETE CASCADE,

  rule_definition_id uuid NOT NULL
    REFERENCES public.governance_rule_definitions(id),

  policy_rule_id uuid
    REFERENCES public.governance_policy_rules(id),

  exception_id uuid
    REFERENCES public.governance_exceptions(id),

  outcome text NOT NULL,

  required_value jsonb,
  actual_value jsonb,

  source_scope_type text,
  source_scope_id uuid,

  explanation text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT governance_evaluation_results_outcome_check
    CHECK (
      outcome IN (
        'PASS',
        'WARNING',
        'REQUIRES_APPROVAL',
        'BLOCK'
      )
    ),

  CONSTRAINT governance_evaluation_results_scope_type_check
    CHECK (
      source_scope_type IS NULL
      OR source_scope_type IN (
        'platform',
        'entity',
        'portfolio',
        'property_type',
        'property',
        'counterparty',
        'transaction'
      )
    )
);

CREATE INDEX governance_evaluation_results_evaluation_idx
  ON public.governance_evaluation_results(evaluation_id);

CREATE INDEX governance_evaluation_results_rule_idx
  ON public.governance_evaluation_results(rule_definition_id);

CREATE INDEX governance_evaluation_results_exception_idx
  ON public.governance_evaluation_results(exception_id);


/* ========================================================================
 * 7. CANONICAL GOVERNANCE CAPABILITIES
 *
 * user_entity_permissions is assignment data. We therefore do not seed
 * permissions into it. These keys are consumed by governed commands.
 * ====================================================================== */

-- governance.policy.create
-- governance.policy.edit
-- governance.policy.approve
-- governance.policy.activate
-- governance.policy.supersede
-- governance.exception.request
-- governance.exception.decide
-- governance.evaluate


/* ========================================================================
 * 8. ROW LEVEL SECURITY
 *
 * Authenticated users may read governance configuration/evidence only for
 * entities to which they belong.
 *
 * Direct browser writes are deliberately prohibited.
 * ====================================================================== */

ALTER TABLE public.governance_rule_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_policy_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_evaluation_results ENABLE ROW LEVEL SECURITY;


/* Rule definitions are platform metadata. */

CREATE POLICY governance_rule_definitions_authenticated_select
ON public.governance_rule_definitions
FOR SELECT
TO authenticated
USING (true);


/* Policy sets are entity scoped. */

CREATE POLICY governance_policy_sets_authenticated_select
ON public.governance_policy_sets
FOR SELECT
TO authenticated
USING (
  entity_id = ANY (public.auth_entities())
);


/* Policy rules inherit entity authority from their policy set. */

CREATE POLICY governance_policy_rules_authenticated_select
ON public.governance_policy_rules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.governance_policy_sets AS gps
    WHERE gps.id = governance_policy_rules.policy_set_id
      AND gps.entity_id = ANY (public.auth_entities())
  )
);


/* Exceptions are entity scoped. */

CREATE POLICY governance_exceptions_authenticated_select
ON public.governance_exceptions
FOR SELECT
TO authenticated
USING (
  entity_id = ANY (public.auth_entities())
);


/* Evaluations are entity scoped. */

CREATE POLICY governance_evaluations_authenticated_select
ON public.governance_evaluations
FOR SELECT
TO authenticated
USING (
  entity_id = ANY (public.auth_entities())
);


/* Evaluation results inherit authority from their parent evaluation. */

CREATE POLICY governance_evaluation_results_authenticated_select
ON public.governance_evaluation_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.governance_evaluations AS ge
    WHERE ge.id = governance_evaluation_results.evaluation_id
      AND ge.entity_id = ANY (public.auth_entities())
  )
);


/* ========================================================================
 * 9. TABLE PRIVILEGES
 *
 * Browser sessions receive read access only.
 * All mutations will occur through governed SECURITY DEFINER commands.
 * ====================================================================== */

REVOKE ALL
ON TABLE
  public.governance_rule_definitions,
  public.governance_policy_sets,
  public.governance_policy_rules,
  public.governance_exceptions,
  public.governance_evaluations,
  public.governance_evaluation_results
FROM PUBLIC;

REVOKE ALL
ON TABLE
  public.governance_rule_definitions,
  public.governance_policy_sets,
  public.governance_policy_rules,
  public.governance_exceptions,
  public.governance_evaluations,
  public.governance_evaluation_results
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public.governance_rule_definitions,
  public.governance_policy_sets,
  public.governance_policy_rules,
  public.governance_exceptions,
  public.governance_evaluations,
  public.governance_evaluation_results
FROM authenticated;

GRANT SELECT
ON TABLE
  public.governance_rule_definitions,
  public.governance_policy_sets,
  public.governance_policy_rules,
  public.governance_exceptions,
  public.governance_evaluations,
  public.governance_evaluation_results
TO authenticated;

GRANT ALL
ON TABLE
  public.governance_rule_definitions,
  public.governance_policy_sets,
  public.governance_policy_rules,
  public.governance_exceptions,
  public.governance_evaluations,
  public.governance_evaluation_results
TO service_role;


/* ========================================================================
 * 10. GOVERNED POLICY-SET CREATION
 * ====================================================================== */

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

  IF NULLIF(btrim(p_domain), '') IS NULL THEN
    RAISE EXCEPTION 'Policy domain is required';
  END IF;

  IF NULLIF(btrim(p_policy_name), '') IS NULL THEN
    RAISE EXCEPTION 'Policy name is required';
  END IF;

  IF p_effective_to IS NOT NULL
     AND p_effective_from IS NOT NULL
     AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION 'Policy effective_to cannot precede effective_from';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_version
  FROM public.governance_policy_sets
  WHERE entity_id = p_entity_id
    AND domain = btrim(p_domain)
    AND policy_name = btrim(p_policy_name);

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
    btrim(p_domain),
    btrim(p_policy_name),
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


/* ========================================================================
 * 11. GOVERNED POLICY RULE UPSERT
 *
 * Only draft policy sets may be changed.
 * ====================================================================== */

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
  v_definition_active boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT entity_id, status
  INTO v_entity_id, v_policy_status
  FROM public.governance_policy_sets
  WHERE id = p_policy_set_id;

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

  SELECT is_active
  INTO v_definition_active
  FROM public.governance_rule_definitions
  WHERE id = p_rule_definition_id;

  IF v_definition_active IS NULL THEN
    RAISE EXCEPTION 'Governance rule definition not found';
  END IF;

  IF NOT v_definition_active THEN
    RAISE EXCEPTION 'Governance rule definition is inactive';
  END IF;

  IF p_value IS NULL THEN
    RAISE EXCEPTION 'Policy rule value is required';
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

  IF p_scope_type = 'entity' AND p_scope_id IS NOT NULL THEN
    RAISE EXCEPTION 'Entity-scoped policy rules must not provide scope_id';
  END IF;

  IF p_scope_type <> 'entity' AND p_scope_id IS NULL THEN
    RAISE EXCEPTION 'Scoped policy rule requires scope_id';
  END IF;

  IF p_effective_to IS NOT NULL
     AND p_effective_from IS NOT NULL
     AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION 'Policy rule effective_to cannot precede effective_from';
  END IF;

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


/* ========================================================================
 * 12. POLICY APPROVAL
 * ====================================================================== */

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

  SELECT entity_id, status
  INTO v_entity_id, v_status
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_policy_rules
    WHERE policy_set_id = p_policy_set_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Policy set must contain at least one active rule';
  END IF;

  UPDATE public.governance_policy_sets
  SET
    status = 'approved',
    approved_by = v_user_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_policy_set_id;
END;
$$;


/* ========================================================================
 * 13. POLICY ACTIVATION
 *
 * Activation supersedes other active versions of the same named policy.
 * ====================================================================== */

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
    activated_at = now(),
    updated_at = now()
  WHERE id = p_policy_set_id;
END;
$$;


/* ========================================================================
 * 14. FUNCTION EXECUTION AUTHORITY
 * ====================================================================== */

REVOKE ALL ON FUNCTION public.create_governance_policy_set(
  uuid,
  text,
  text,
  text,
  date,
  date
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_governance_policy_set(
  uuid,
  text,
  text,
  text,
  date,
  date
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_governance_policy_set(
  uuid,
  text,
  text,
  text,
  date,
  date
) TO authenticated, service_role;


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
) FROM PUBLIC;

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
) FROM anon;

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
) TO authenticated, service_role;


REVOKE ALL ON FUNCTION public.approve_governance_policy_set(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_governance_policy_set(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION public.approve_governance_policy_set(uuid)
TO authenticated, service_role;


REVOKE ALL ON FUNCTION public.activate_governance_policy_set(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.activate_governance_policy_set(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION public.activate_governance_policy_set(uuid)
TO authenticated, service_role;


/* ========================================================================
 * 15. SERVICE ROLE / POSTGRES EXECUTION
 * ====================================================================== */

GRANT EXECUTE ON FUNCTION public.create_governance_policy_set(
  uuid,
  text,
  text,
  text,
  date,
  date
) TO postgres;

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
) TO postgres;

GRANT EXECUTE ON FUNCTION public.approve_governance_policy_set(uuid)
TO postgres;

GRANT EXECUTE ON FUNCTION public.activate_governance_policy_set(uuid)
TO postgres;


COMMIT;