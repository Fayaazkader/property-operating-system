-- AssetFlow
-- Canonical Leasing Opportunity Creation
--
-- Creates the governed entry point for the commercial leasing transaction.
--
-- Important:
--   - leasing_opportunities is the canonical pre-lease aggregate.
--   - lease_intake is NOT written by this command.
--   - creation does NOT create an immutable commercial version.
--   - commercial versioning occurs only when terms are submitted for approval.
--   - authority is capability-based through user_entity_permissions.

BEGIN;


/* ========================================================================
 * 1. ENTITY-SCOPED OPPORTUNITY SEQUENCE
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.next_leasing_opportunity_code(
  p_entity_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence_name text;
  v_next_value bigint;
BEGIN
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required for opportunity numbering.';
  END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');

  /*
   * The internal sequence is entity/year scoped.
   *
   * The human-facing opportunity code remains:
   *   OPP-2026-000001
   *
   * Different entities may therefore legitimately have the same displayed
   * sequence number while retaining independent numbering domains.
   */
  v_sequence_name :=
    'LEASING-OPP-' || p_entity_id::text || '-' || v_year;

  /*
   * INSERT ... ON CONFLICT handles the first-call race safely.
   *
   * Existing row:
   *   atomically increments next_value and returns the previous value.
   *
   * New row:
   *   stores next_value = 2 and returns 1.
   */
  INSERT INTO public.business_sequences (
    sequence_name,
    next_value,
    updated_at
  )
  VALUES (
    v_sequence_name,
    2,
    now()
  )
  ON CONFLICT (sequence_name)
  DO UPDATE
  SET
    next_value = public.business_sequences.next_value + 1,
    updated_at = now()
  RETURNING next_value - 1
  INTO v_next_value;

  RETURN
    'OPP-' ||
    v_year ||
    '-' ||
    lpad(v_next_value::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_leasing_opportunity_code(uuid)
FROM PUBLIC;

-- Number generation is an internal workflow primitive.
-- Authenticated users create opportunities through create_leasing_opportunity().
REVOKE ALL ON FUNCTION public.next_leasing_opportunity_code(uuid)
FROM authenticated;


/* ========================================================================
 * 2. CANONICAL OPPORTUNITY CREATION COMMAND
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.create_leasing_opportunity(
  p_entity_id uuid,
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

  v_property_entity_id uuid;
  v_property_owner_entity_id uuid;
  v_property_managing_entity_id uuid;

  v_unit_property_id uuid;
  v_unit_number text;

  v_vacancy_property_id uuid;
  v_vacancy_unit_id uuid;

  v_broker_entity_id uuid;

  v_opportunity_id uuid;
  v_opportunity_code text;
BEGIN
  /* --------------------------------------------------------------------
   * Authentication
   * ------------------------------------------------------------------ */

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required.';
  END IF;

  SELECT u.email
  INTO v_user_email
  FROM auth.users AS u
  WHERE u.id = v_user_id;


  /* --------------------------------------------------------------------
   * Tenant boundary
   * ------------------------------------------------------------------ */

  IF NOT (
    p_entity_id = ANY(public.auth_entities())
  ) THEN
    RAISE EXCEPTION
      'Not authorised for requested entity.';
  END IF;


  /* --------------------------------------------------------------------
   * Explicit creation authority
   * ------------------------------------------------------------------ */

  IF NOT public.has_entity_permission(
    v_user_id,
    p_entity_id,
    'leasing.opportunity.create'
  ) THEN
    RAISE EXCEPTION
      'Permission denied: leasing.opportunity.create';
  END IF;


  /* --------------------------------------------------------------------
   * Required working identity
   * ------------------------------------------------------------------ */

  IF NULLIF(btrim(p_prospect_name), '') IS NULL THEN
    RAISE EXCEPTION
      'Prospect name is required.';
  END IF;


  /* --------------------------------------------------------------------
   * Basic commercial validation
   *
   * These are data-integrity checks, not commercial mandate decisions.
   * AssetFlow does not decide whether a rental/escalation/deposit is
   * commercially acceptable for the client.
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
   *
   * The canonical foundation established that an opportunity may operate
   * against a property where the opportunity entity is the property's:
   *   - entity_id
   *   - owner_entity_id
   *   - managing_entity_id
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

    IF p_entity_id IS DISTINCT FROM v_property_entity_id
       AND p_entity_id IS DISTINCT FROM v_property_owner_entity_id
       AND p_entity_id IS DISTINCT FROM v_property_managing_entity_id THEN
      RAISE EXCEPTION
        'Property does not belong to or fall under management of requested entity.';
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
   *
   * Broker is optional. Where supplied, it must belong to the same
   * client entity.
   * ------------------------------------------------------------------ */

  IF p_broker_id IS NOT NULL THEN
    SELECT b.entity_id
    INTO v_broker_entity_id
    FROM public.brokers AS b
    WHERE b.id = p_broker_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Broker not found.';
    END IF;

    IF v_broker_entity_id IS DISTINCT FROM p_entity_id THEN
      RAISE EXCEPTION
        'Broker does not belong to requested entity.';
    END IF;
  END IF;


  /* --------------------------------------------------------------------
   * Atomic business identifier
   * ------------------------------------------------------------------ */

  v_opportunity_code :=
    public.next_leasing_opportunity_code(p_entity_id);


  /* --------------------------------------------------------------------
   * Canonical aggregate
   * ------------------------------------------------------------------ */

  INSERT INTO public.leasing_opportunities (
    opportunity_code,
    status,

    prospect_name,
    company_registration,
    vat_number,

    contact_person,
    contact_email,
    contact_phone,
    industry,

    entity_id,
    property_id,
    unit_id,
    unit_number,
    vacancy_id,

    monthly_rental,
    deposit_amount,
    escalation_percent,
    lease_term_months,

    commencement_date,
    expiry_date,
    beneficial_occupation_date,

    parking_bays,
    storage_allocation,

    broker_id,

    negotiation_notes,

    current_version,
    ai_review,
    activation_checklist,

    created_at,
    updated_at
  )
  VALUES (
    v_opportunity_code,
    'prospecting',

    btrim(p_prospect_name),
    NULLIF(btrim(p_company_registration), ''),
    NULLIF(btrim(p_vat_number), ''),

    NULLIF(btrim(p_contact_person), ''),
    NULLIF(btrim(p_contact_email), ''),
    NULLIF(btrim(p_contact_phone), ''),
    NULLIF(btrim(p_industry), ''),

    p_entity_id,
    p_property_id,
    p_unit_id,
    v_unit_number,
    p_vacancy_id,

    p_monthly_rental,
    p_deposit_amount,
    p_escalation_percent,
    p_lease_term_months,

    p_commencement_date,
    p_expiry_date,
    p_beneficial_occupation_date,

    COALESCE(p_parking_bays, 0),
    NULLIF(btrim(p_storage_allocation), ''),

    p_broker_id,

    NULLIF(btrim(p_negotiation_notes), ''),

    1,
    '{}'::jsonb,
    '{}'::jsonb,

    v_now,
    v_now
  )
  RETURNING id
  INTO v_opportunity_id;


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
    'create',
    'leasing_opportunity',
    v_opportunity_id,
    v_opportunity_code,
    NULL,
    jsonb_build_object(
      'opportunity_id', v_opportunity_id,
      'opportunity_code', v_opportunity_code,
      'entity_id', p_entity_id,
      'property_id', p_property_id,
      'unit_id', p_unit_id,
      'unit_number', v_unit_number,
      'vacancy_id', p_vacancy_id,
      'prospect_name', btrim(p_prospect_name),
      'status', 'prospecting'
    ),
    p_user_agent,
    v_now
  );


  /* --------------------------------------------------------------------
   * Result
   * ------------------------------------------------------------------ */

  RETURN jsonb_build_object(
    'success', true,
    'opportunity_id', v_opportunity_id,
    'opportunity_code', v_opportunity_code,
    'status', 'prospecting',
    'entity_id', p_entity_id,
    'property_id', p_property_id,
    'unit_id', p_unit_id,
    'vacancy_id', p_vacancy_id
  );
END;
$$;


/* ========================================================================
 * 3. FUNCTION PRIVILEGES
 * ====================================================================== */

REVOKE ALL ON FUNCTION public.create_leasing_opportunity(
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

GRANT EXECUTE ON FUNCTION public.create_leasing_opportunity(
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


COMMIT;
