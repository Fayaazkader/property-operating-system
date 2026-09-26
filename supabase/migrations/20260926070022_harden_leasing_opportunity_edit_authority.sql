-- AssetFlow
-- Harden Leasing Opportunity Edit Authority
--
-- Establishes the governed edit command for the canonical pre-lease
-- aggregate and removes direct browser mutation authority.
--
-- Authority model:
--   create  -> create_leasing_opportunity()
--   edit    -> update_leasing_opportunity()
--   submit  -> create_leasing_commercial_version()
--   approve -> approve_leasing_commercial_terms()
--
-- Direct INSERT / UPDATE / DELETE against leasing_opportunities is not
-- part of the authenticated application contract.

BEGIN;


/* ========================================================================
 * 1. GOVERNED WORKING-OPPORTUNITY EDIT COMMAND
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.update_leasing_opportunity(
  p_opportunity_id uuid,
  p_prospect_name text,

  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_vacancy_id uuid DEFAULT NULL,

  p_company_registration text DEFAULT NULL,
  p_vat_number text DEFAULT NULL,

  p_contact_person text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_industry text DEFAULT NULL,

  p_monthly_rental numeric DEFAULT NULL,
  p_deposit_amount numeric DEFAULT NULL,
  p_escalation_percent numeric DEFAULT NULL,
  p_lease_term_months integer DEFAULT NULL,

  p_commencement_date date DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_beneficial_occupation_date date DEFAULT NULL,

  p_parking_bays integer DEFAULT 0,
  p_storage_allocation text DEFAULT NULL,

  p_broker_id uuid DEFAULT NULL,

  p_negotiation_notes text DEFAULT NULL,
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

  v_entity_id uuid;
  v_opportunity_code text;
  v_status text;

  v_property_entity_id uuid;
  v_property_owner_entity_id uuid;
  v_property_managing_entity_id uuid;

  v_unit_property_id uuid;
  v_unit_number text;

  v_vacancy_property_id uuid;
  v_vacancy_unit_id uuid;

  v_broker_entity_id uuid;

  v_old_values jsonb;
  v_new_values jsonb;
BEGIN

  /* --------------------------------------------------------------------
   * Authentication
   * ------------------------------------------------------------------ */

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity is required.';
  END IF;

  SELECT u.email
  INTO v_user_email
  FROM auth.users AS u
  WHERE u.id = v_user_id;


  /* --------------------------------------------------------------------
   * Lock canonical aggregate and establish authority context
   * ------------------------------------------------------------------ */

  SELECT
    o.entity_id,
    o.opportunity_code,
    o.status,
    to_jsonb(o)
  INTO
    v_entity_id,
    v_opportunity_code,
    v_status,
    v_old_values
  FROM public.leasing_opportunities AS o
  WHERE o.id = p_opportunity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leasing opportunity not found.';
  END IF;

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Leasing opportunity has no entity.';
  END IF;


  /* --------------------------------------------------------------------
   * Tenant boundary
   * ------------------------------------------------------------------ */

  IF NOT (
    v_entity_id = ANY(public.auth_entities())
  ) THEN
    RAISE EXCEPTION
      'Not authorised for opportunity entity.';
  END IF;


  /* --------------------------------------------------------------------
   * Explicit edit authority
   * ------------------------------------------------------------------ */

  IF NOT public.has_entity_permission(
    v_user_id,
    v_entity_id,
    'leasing.opportunity.edit'
  ) THEN
    RAISE EXCEPTION
      'Permission denied: leasing.opportunity.edit';
  END IF;


  /* --------------------------------------------------------------------
   * Lifecycle boundary
   *
   * Ordinary working-state edits are deliberately limited to the
   * pre-submission commercial stages.
   *
   * Once terms enter internal approval, or once an approved deal moves
   * into drafting/execution/activation, commercial changes must not
   * mutate the authoritative deal underneath its governed version.
   * ------------------------------------------------------------------ */

  IF v_status NOT IN (
    'prospecting',
    'offer_received',
    'commercial_review',
    'negotiation'
  ) THEN
    RAISE EXCEPTION
      'Opportunity cannot be edited in status %.', v_status;
  END IF;


  /* --------------------------------------------------------------------
   * Required working identity
   * ------------------------------------------------------------------ */

  IF NULLIF(btrim(p_prospect_name), '') IS NULL THEN
    RAISE EXCEPTION
      'Prospect name is required.';
  END IF;


  /* --------------------------------------------------------------------
   * Basic data-integrity validation
   *
   * These are structural/data-integrity rules only.
   * AssetFlow does not decide the client's commercial mandate.
   * ------------------------------------------------------------------ */

  IF p_monthly_rental IS NOT NULL
     AND p_monthly_rental < 0 THEN
    RAISE EXCEPTION
      'Monthly rental cannot be negative.';
  END IF;

  IF p_deposit_amount IS NOT NULL
     AND p_deposit_amount < 0 THEN
    RAISE EXCEPTION
      'Deposit amount cannot be negative.';
  END IF;

  IF p_lease_term_months IS NOT NULL
     AND p_lease_term_months <= 0 THEN
    RAISE EXCEPTION
      'Lease term must be greater than zero.';
  END IF;

  IF p_parking_bays IS NOT NULL
     AND p_parking_bays < 0 THEN
    RAISE EXCEPTION
      'Parking bays cannot be negative.';
  END IF;

  IF p_commencement_date IS NOT NULL
     AND p_expiry_date IS NOT NULL
     AND p_expiry_date < p_commencement_date THEN
    RAISE EXCEPTION
      'Expiry date cannot be before commencement date.';
  END IF;


  /* --------------------------------------------------------------------
   * Property lineage
   * ------------------------------------------------------------------ */

  IF p_property_id IS NOT NULL THEN
    SELECT
      p.entity_id,
      p.owner_entity_id,
      p.managing_entity_id
    INTO
      v_property_entity_id,
      v_property_owner_entity_id,
      v_property_managing_entity_id
    FROM public.properties AS p
    WHERE p.id = p_property_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Property not found.';
    END IF;

    IF v_entity_id IS DISTINCT FROM v_property_entity_id
       AND v_entity_id IS DISTINCT FROM v_property_owner_entity_id
       AND v_entity_id IS DISTINCT FROM v_property_managing_entity_id THEN
      RAISE EXCEPTION
        'Property does not belong to or fall under management of opportunity entity.';
    END IF;
  END IF;


  /* --------------------------------------------------------------------
   * Unit lineage
   * ------------------------------------------------------------------ */

  IF p_unit_id IS NOT NULL THEN
    IF p_property_id IS NULL THEN
      RAISE EXCEPTION
        'A property is required when a unit is supplied.';
    END IF;

    SELECT
      u.property_id,
      u.unit_number
    INTO
      v_unit_property_id,
      v_unit_number
    FROM public.units AS u
    WHERE u.id = p_unit_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unit not found.';
    END IF;

    IF v_unit_property_id IS DISTINCT FROM p_property_id THEN
      RAISE EXCEPTION
        'Unit does not belong to selected property.';
    END IF;
  ELSE
    v_unit_number := NULL;
  END IF;


  /* --------------------------------------------------------------------
   * Vacancy lineage
   * ------------------------------------------------------------------ */

  IF p_vacancy_id IS NOT NULL THEN
    IF p_property_id IS NULL OR p_unit_id IS NULL THEN
      RAISE EXCEPTION
        'Property and unit are required when a vacancy is supplied.';
    END IF;

    SELECT
      v.property_id,
      v.unit_id
    INTO
      v_vacancy_property_id,
      v_vacancy_unit_id
    FROM public.vacancies AS v
    WHERE v.id = p_vacancy_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vacancy not found.';
    END IF;

    IF v_vacancy_property_id IS DISTINCT FROM p_property_id THEN
      RAISE EXCEPTION
        'Vacancy does not belong to selected property.';
    END IF;

    IF v_vacancy_unit_id IS DISTINCT FROM p_unit_id THEN
      RAISE EXCEPTION
        'Vacancy does not belong to selected unit.';
    END IF;
  END IF;


  /* --------------------------------------------------------------------
   * Broker lineage
   * ------------------------------------------------------------------ */

  IF p_broker_id IS NOT NULL THEN
    SELECT b.entity_id
    INTO v_broker_entity_id
    FROM public.brokers AS b
    WHERE b.id = p_broker_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Broker not found.';
    END IF;

    IF v_broker_entity_id IS DISTINCT FROM v_entity_id THEN
      RAISE EXCEPTION
        'Broker does not belong to opportunity entity.';
    END IF;
  END IF;


  /* --------------------------------------------------------------------
   * Canonical working-state update
   *
   * Deliberately excluded:
   *   id
   *   entity_id
   *   opportunity_code
   *   status
   *   current_version
   *   accepted_offer_id
   *   approved_terms_version_id
   *   activated_lease_id
   *   activated_tenant_id
   *   offer_document_url
   *   draft_lease_url
   *   signed_lease_url
   *   ai_review
   *   activation_checklist
   *   commission workflow fields
   *   created_at
   *
   * Those values belong to separate governed workflows.
   * ------------------------------------------------------------------ */

  UPDATE public.leasing_opportunities
  SET
    prospect_name = btrim(p_prospect_name),
    company_registration = NULLIF(btrim(p_company_registration), ''),
    vat_number = NULLIF(btrim(p_vat_number), ''),

    contact_person = NULLIF(btrim(p_contact_person), ''),
    contact_email = NULLIF(btrim(p_contact_email), ''),
    contact_phone = NULLIF(btrim(p_contact_phone), ''),
    industry = NULLIF(btrim(p_industry), ''),

    property_id = p_property_id,
    unit_id = p_unit_id,
    unit_number = v_unit_number,
    vacancy_id = p_vacancy_id,

    monthly_rental = p_monthly_rental,
    deposit_amount = p_deposit_amount,
    escalation_percent = p_escalation_percent,
    lease_term_months = p_lease_term_months,

    commencement_date = p_commencement_date,
    expiry_date = p_expiry_date,
    beneficial_occupation_date = p_beneficial_occupation_date,

    parking_bays = COALESCE(p_parking_bays, 0),
    storage_allocation = NULLIF(btrim(p_storage_allocation), ''),

    broker_id = p_broker_id,

    negotiation_notes = NULLIF(btrim(p_negotiation_notes), ''),

    updated_at = v_now
  WHERE id = p_opportunity_id;


  /* --------------------------------------------------------------------
   * Capture resulting state
   * ------------------------------------------------------------------ */

  SELECT to_jsonb(o)
  INTO v_new_values
  FROM public.leasing_opportunities AS o
  WHERE o.id = p_opportunity_id;


  /* --------------------------------------------------------------------
   * Audit
   * ------------------------------------------------------------------ */

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
    'leasing_opportunity',
    p_opportunity_id,
    v_opportunity_code,
    v_old_values,
    v_new_values,
    p_user_agent,
    v_now
  );


  /* --------------------------------------------------------------------
   * Result
   * ------------------------------------------------------------------ */

  RETURN jsonb_build_object(
    'success', true,
    'opportunity_id', p_opportunity_id,
    'opportunity_code', v_opportunity_code,
    'status', v_status,
    'entity_id', v_entity_id,
    'property_id', p_property_id,
    'unit_id', p_unit_id,
    'vacancy_id', p_vacancy_id,
    'updated_at', v_now
  );
END;
$$;


/* ========================================================================
 * 2. FUNCTION AUTHORITY
 * ====================================================================== */

REVOKE ALL ON FUNCTION public.update_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
TO authenticated;


/* ========================================================================
 * 3. REMOVE DIRECT MUTATION OF THE CANONICAL AGGREGATE
 *
 * RLS remains relevant to SELECT.
 *
 * Application mutations now occur only through governed commands.
 * SECURITY DEFINER workflow functions execute under their function owner
 * and are therefore not dependent on browser-role table mutation grants.
 * ====================================================================== */

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.leasing_opportunities
FROM anon;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.leasing_opportunities
FROM authenticated;


/* ========================================================================
 * 4. INTERNALISE THE PERMISSION HELPER
 *
 * has_entity_permission() is an internal workflow primitive. Browser roles
 * do not need to call it directly.
 * ====================================================================== */

REVOKE ALL ON FUNCTION public.has_entity_permission(uuid, uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.has_entity_permission(uuid, uuid, text)
FROM anon;

REVOKE ALL ON FUNCTION public.has_entity_permission(uuid, uuid, text)
FROM authenticated;


COMMIT;
