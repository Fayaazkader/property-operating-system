-- AssetFlow
-- Harden Leasing Commercial Authority
--
-- Milestone 1A follow-up.
--
-- Establishes the distinction between:
--
--   entity membership
--     -> which client's records a user may access
--
--   explicit permission
--     -> which governed commercial action that user may perform
--
-- The client assigns permissions through user_entity_permissions.
-- AssetFlow does not infer commercial authority from a hard-coded role.

BEGIN;


/* ========================================================================
 * 1. DATABASE-LEVEL PERMISSION AUTHORITY
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.has_entity_permission(
  p_user_id uuid,
  p_entity_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_entity_id IS NOT NULL
    AND p_permission_key IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_entity_permissions AS uep
      WHERE uep.user_id = p_user_id
        AND uep.entity_id = p_entity_id
        AND uep.permission_key = p_permission_key
        AND uep.enabled = true
    );
$$;

REVOKE ALL ON FUNCTION public.has_entity_permission(
  uuid,
  uuid,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_entity_permission(
  uuid,
  uuid,
  text
) TO authenticated;


/* ========================================================================
 * 2. GOVERNED COMMERCIAL VERSION CREATION
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.create_leasing_commercial_version(
  p_opportunity_id uuid,
  p_source_offer_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_now timestamptz := now();

  v_opportunity public.leasing_opportunities%ROWTYPE;

  v_offer_entity_id uuid;
  v_offer_vacancy_id uuid;

  v_next_version integer;
  v_snapshot jsonb;
  v_version_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT u.email
  INTO v_user_email
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  SELECT *
  INTO v_opportunity
  FROM public.leasing_opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leasing opportunity not found.';
  END IF;

  IF v_opportunity.entity_id IS NULL
     OR NOT (
       v_opportunity.entity_id = ANY(public.auth_entities())
     ) THEN
    RAISE EXCEPTION
      'Not authorised for leasing opportunity entity.';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_opportunity.entity_id,
    'leasing.commercial.submit'
  ) THEN
    RAISE EXCEPTION
      'Permission denied: leasing.commercial.submit';
  END IF;

  IF p_source_offer_id IS NOT NULL THEN
    SELECT o.entity_id, o.vacancy_id
    INTO v_offer_entity_id, v_offer_vacancy_id
    FROM public.offers AS o
    WHERE o.id = p_source_offer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Source offer not found.';
    END IF;

    IF v_offer_entity_id IS DISTINCT FROM v_opportunity.entity_id THEN
      RAISE EXCEPTION
        'Source offer does not belong to leasing opportunity entity.';
    END IF;

    IF v_opportunity.vacancy_id IS NOT NULL
       AND v_offer_vacancy_id IS DISTINCT FROM v_opportunity.vacancy_id THEN
      RAISE EXCEPTION
        'Source offer does not belong to leasing opportunity vacancy.';
    END IF;
  END IF;

  SELECT COALESCE(MAX(v.version_number), 0) + 1
  INTO v_next_version
  FROM public.leasing_opportunity_versions AS v
  WHERE v.opportunity_id = p_opportunity_id;

  v_snapshot := jsonb_build_object(
    'opportunityId', v_opportunity.id,
    'opportunityCode', v_opportunity.opportunity_code,

    'prospectName', v_opportunity.prospect_name,
    'companyRegistration', v_opportunity.company_registration,
    'vatNumber', v_opportunity.vat_number,

    'contactPerson', v_opportunity.contact_person,
    'contactEmail', v_opportunity.contact_email,
    'contactPhone', v_opportunity.contact_phone,
    'industry', v_opportunity.industry,

    'propertyId', v_opportunity.property_id,
    'unitId', v_opportunity.unit_id,
    'unitNumber', v_opportunity.unit_number,
    'vacancyId', v_opportunity.vacancy_id,

    'monthlyRental', v_opportunity.monthly_rental,
    'depositAmount', v_opportunity.deposit_amount,
    'escalationPercent', v_opportunity.escalation_percent,
    'leaseTermMonths', v_opportunity.lease_term_months,

    'commencementDate', v_opportunity.commencement_date,
    'expiryDate', v_opportunity.expiry_date,
    'beneficialOccupationDate',
      v_opportunity.beneficial_occupation_date,

    'parkingBays', v_opportunity.parking_bays,
    'storageAllocation', v_opportunity.storage_allocation,

    'brokerId', v_opportunity.broker_id,
    'commissionPercent', v_opportunity.commission_percent,
    'commissionAmount', v_opportunity.commission_amount,
    'commissionStructure', v_opportunity.commission_structure,
    'commissionNotes', v_opportunity.commission_notes,

    'negotiationNotes', v_opportunity.negotiation_notes,

    'sourceOfferId', p_source_offer_id,
    'capturedAt', v_now
  );

  INSERT INTO public.leasing_opportunity_versions (
    opportunity_id,
    version_number,
    changes,
    changed_by,
    notes,
    created_at,
    entity_id,
    source_offer_id,
    snapshot,
    created_by
  )
  VALUES (
    p_opportunity_id,
    v_next_version,
    '{}'::jsonb,
    COALESCE(v_user_email, v_user_id::text),
    p_notes,
    v_now,
    v_opportunity.entity_id,
    p_source_offer_id,
    v_snapshot,
    v_user_id
  )
  RETURNING id
  INTO v_version_id;

  UPDATE public.leasing_opportunities
  SET
    current_version = v_next_version,
    accepted_offer_id = COALESCE(
      p_source_offer_id,
      accepted_offer_id
    ),
    status = 'internal_approval',
    updated_at = v_now
  WHERE id = p_opportunity_id;

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
    'leasing_opportunity_version',
    v_version_id,
    v_opportunity.opportunity_code,
    jsonb_build_object(
      'status', v_opportunity.status,
      'current_version', v_opportunity.current_version,
      'accepted_offer_id', v_opportunity.accepted_offer_id
    ),
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'version_number', v_next_version,
      'source_offer_id', p_source_offer_id,
      'status', 'internal_approval',
      'snapshot', v_snapshot
    ),
    p_user_agent,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'version_id', v_version_id,
    'version_number', v_next_version,
    'status', 'internal_approval',
    'snapshot', v_snapshot
  );
END;
$$;


/* ========================================================================
 * 3. GOVERNED COMMERCIAL APPROVAL
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.approve_leasing_commercial_terms(
  p_opportunity_id uuid,
  p_version_id uuid,
  p_channel text DEFAULT 'web',
  p_decision_context jsonb DEFAULT '{}'::jsonb,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_now timestamptz := now();

  v_opportunity public.leasing_opportunities%ROWTYPE;

  v_version_entity_id uuid;
  v_version_opportunity_id uuid;
  v_version_number integer;
  v_source_offer_id uuid;
  v_snapshot jsonb;

  v_approval_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_channel IS NULL
     OR p_channel NOT IN ('web', 'whatsapp', 'api', 'system') THEN
    RAISE EXCEPTION 'Unsupported commercial approval channel.';
  END IF;

  SELECT u.email
  INTO v_user_email
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  SELECT *
  INTO v_opportunity
  FROM public.leasing_opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leasing opportunity not found.';
  END IF;

  IF v_opportunity.entity_id IS NULL
     OR NOT (
       v_opportunity.entity_id = ANY(public.auth_entities())
     ) THEN
    RAISE EXCEPTION
      'Not authorised for leasing opportunity entity.';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_opportunity.entity_id,
    'leasing.commercial.approve'
  ) THEN
    RAISE EXCEPTION
      'Permission denied: leasing.commercial.approve';
  END IF;

  SELECT
    v.entity_id,
    v.opportunity_id,
    v.version_number,
    v.source_offer_id,
    v.snapshot
  INTO
    v_version_entity_id,
    v_version_opportunity_id,
    v_version_number,
    v_source_offer_id,
    v_snapshot
  FROM public.leasing_opportunity_versions AS v
  WHERE v.id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial version not found.';
  END IF;

  IF v_version_entity_id IS DISTINCT FROM v_opportunity.entity_id
     OR v_version_opportunity_id IS DISTINCT FROM p_opportunity_id THEN
    RAISE EXCEPTION
      'Commercial version does not belong to this leasing opportunity.';
  END IF;

  IF v_opportunity.status IS DISTINCT FROM 'internal_approval' THEN
    RAISE EXCEPTION
      'Leasing opportunity is not awaiting commercial approval.';
  END IF;

  IF v_opportunity.current_version IS DISTINCT FROM v_version_number THEN
    RAISE EXCEPTION
      'Only the current commercial version may be approved.';
  END IF;

  INSERT INTO public.leasing_commercial_approvals (
    entity_id,
    opportunity_id,
    opportunity_version_id,
    offer_id,
    decision,
    decided_by,
    decided_at,
    channel,
    decision_context,
    evidence,
    created_at
  )
  VALUES (
    v_opportunity.entity_id,
    p_opportunity_id,
    p_version_id,
    v_source_offer_id,
    'approved',
    v_user_id,
    v_now,
    p_channel,
    COALESCE(p_decision_context, '{}'::jsonb),
    COALESCE(p_evidence, '{}'::jsonb),
    v_now
  )
  RETURNING id
  INTO v_approval_id;

  UPDATE public.leasing_opportunities
  SET
    approved_terms_version_id = p_version_id,
    accepted_offer_id = COALESCE(
      v_source_offer_id,
      accepted_offer_id
    ),
    status = 'drafting',
    updated_at = v_now
  WHERE id = p_opportunity_id;

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
    'approve',
    'leasing_opportunity',
    p_opportunity_id,
    v_opportunity.opportunity_code,
    jsonb_build_object(
      'status', v_opportunity.status,
      'approved_terms_version_id',
        v_opportunity.approved_terms_version_id,
      'accepted_offer_id',
        v_opportunity.accepted_offer_id
    ),
    jsonb_build_object(
      'status', 'drafting',
      'approval_id', v_approval_id,
      'approved_terms_version_id', p_version_id,
      'approved_version_number', v_version_number,
      'accepted_offer_id',
        COALESCE(
          v_source_offer_id,
          v_opportunity.accepted_offer_id
        ),
      'decision', 'approved',
      'decided_by', v_user_id,
      'decided_at', v_now,
      'channel', p_channel,
      'decision_context',
        COALESCE(p_decision_context, '{}'::jsonb),
      'evidence',
        COALESCE(p_evidence, '{}'::jsonb),
      'approved_snapshot', v_snapshot
    ),
    p_user_agent,
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'approval_id', v_approval_id,
    'approved_version_id', p_version_id,
    'approved_version_number', v_version_number,
    'status', 'drafting'
  );
END;
$$;


/* ========================================================================
 * 4. FUNCTION PRIVILEGES
 * ====================================================================== */

REVOKE ALL ON FUNCTION public.create_leasing_commercial_version(
  uuid,
  uuid,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_leasing_commercial_terms(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_leasing_commercial_version(
  uuid,
  uuid,
  text,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.approve_leasing_commercial_terms(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text
) TO authenticated;


/* ========================================================================
 * 5. PROTECT GOVERNED OPPORTUNITY COLUMNS
 * ====================================================================== */

-- Authenticated application users may work with ordinary opportunity fields,
-- subject to RLS and application permission checks.
--
-- They may NOT directly manipulate workflow/governance state.
-- SECURITY DEFINER workflow functions remain able to perform governed changes.

REVOKE UPDATE (
  status,
  current_version,
  accepted_offer_id,
  approved_terms_version_id,
  activated_lease_id,
  activated_tenant_id
)
ON public.leasing_opportunities
FROM authenticated;


/* ========================================================================
 * 6. PREVENT DIRECT VERSION / APPROVAL MUTATION AT GRANT LEVEL
 * ====================================================================== */

REVOKE INSERT, UPDATE, DELETE
ON public.leasing_opportunity_versions
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE
ON public.leasing_commercial_approvals
FROM authenticated;


COMMIT;
