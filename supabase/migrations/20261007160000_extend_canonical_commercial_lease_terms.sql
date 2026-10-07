-- AssetFlow
-- Extend Canonical Commercial Lease Terms
--
-- Adds first-class contractual authority for:
--   leased area;
--   rental rate per square metre;
--   rental VAT treatment.
--
-- These values belong to the negotiated commercial transaction and are
-- frozen into immutable commercial versions before lease generation.
--
-- Unit/property values may be used by the application as proposed defaults,
-- but mutable operational master data is never lease-generation authority.
--
-- This migration deliberately preserves the existing canonical authorization,
-- lineage, lifecycle, locking, auditing and immutable-version boundaries.

BEGIN;

ALTER TABLE public.leasing_opportunities
  ADD COLUMN IF NOT EXISTS leased_area_sqm numeric(12,2),
  ADD COLUMN IF NOT EXISTS rental_rate_per_sqm numeric(14,2),
  ADD COLUMN IF NOT EXISTS rental_vat_treatment text;

ALTER TABLE public.leasing_opportunities
  DROP CONSTRAINT IF EXISTS leasing_opportunities_leased_area_sqm_check,
  DROP CONSTRAINT IF EXISTS leasing_opportunities_rental_rate_per_sqm_check,
  DROP CONSTRAINT IF EXISTS leasing_opportunities_rental_vat_treatment_check;

ALTER TABLE public.leasing_opportunities
  ADD CONSTRAINT leasing_opportunities_leased_area_sqm_check
    CHECK (leased_area_sqm IS NULL OR leased_area_sqm > 0),
  ADD CONSTRAINT leasing_opportunities_rental_rate_per_sqm_check
    CHECK (rental_rate_per_sqm IS NULL OR rental_rate_per_sqm >= 0),
  ADD CONSTRAINT leasing_opportunities_rental_vat_treatment_check
    CHECK (
      rental_vat_treatment IS NULL
      OR rental_vat_treatment IN (
        'exclusive',
        'inclusive',
        'not_applicable'
      )
    );

-- Retire the previous RPC signatures before introducing the extended
-- commercial-term contracts. PostgreSQL identifies functions by name and
-- input argument types, so CREATE OR REPLACE with additional arguments would
-- otherwise leave the old RPCs callable alongside the new ones.

DROP FUNCTION IF EXISTS public.create_leasing_opportunity(
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
);

DROP FUNCTION IF EXISTS public.update_leasing_opportunity(
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
);

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
  p_leased_area_sqm numeric DEFAULT NULL,
  p_rental_rate_per_sqm numeric DEFAULT NULL,
  p_rental_vat_treatment text DEFAULT NULL,

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

  IF p_leased_area_sqm IS NOT NULL
     AND p_leased_area_sqm <= 0 THEN
    RAISE EXCEPTION
      'Leased area must be greater than zero.';
  END IF;

  IF p_rental_rate_per_sqm IS NOT NULL
     AND p_rental_rate_per_sqm < 0 THEN
    RAISE EXCEPTION
      'Rental rate per square metre cannot be negative.';
  END IF;

  IF p_rental_vat_treatment IS NOT NULL
     AND p_rental_vat_treatment NOT IN (
       'exclusive',
       'inclusive',
       'not_applicable'
     ) THEN
    RAISE EXCEPTION
      'Invalid rental VAT treatment.';
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
    leased_area_sqm,
    rental_rate_per_sqm,
    rental_vat_treatment,

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
    p_leased_area_sqm,
    p_rental_rate_per_sqm,
    NULLIF(btrim(p_rental_vat_treatment), ''),

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
      'leased_area_sqm', p_leased_area_sqm,
      'rental_rate_per_sqm', p_rental_rate_per_sqm,
      'rental_vat_treatment',
        NULLIF(btrim(p_rental_vat_treatment), ''),
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
  p_leased_area_sqm numeric DEFAULT NULL,
  p_rental_rate_per_sqm numeric DEFAULT NULL,
  p_rental_vat_treatment text DEFAULT NULL,

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

  IF p_leased_area_sqm IS NOT NULL
     AND p_leased_area_sqm <= 0 THEN
    RAISE EXCEPTION
      'Leased area must be greater than zero.';
  END IF;

  IF p_rental_rate_per_sqm IS NOT NULL
     AND p_rental_rate_per_sqm < 0 THEN
    RAISE EXCEPTION
      'Rental rate per square metre cannot be negative.';
  END IF;

  IF p_rental_vat_treatment IS NOT NULL
     AND p_rental_vat_treatment NOT IN (
       'exclusive',
       'inclusive',
       'not_applicable'
     ) THEN
    RAISE EXCEPTION
      'Invalid rental VAT treatment.';
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
    leased_area_sqm = p_leased_area_sqm,
    rental_rate_per_sqm = p_rental_rate_per_sqm,
    rental_vat_treatment =
      NULLIF(btrim(p_rental_vat_treatment), ''),

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
    'leasedAreaSqm', v_opportunity.leased_area_sqm,
    'rentalRatePerSqm', v_opportunity.rental_rate_per_sqm,
    'rentalVatTreatment', v_opportunity.rental_vat_treatment,

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


-- Keep the governed leasing commands callable only through authenticated
-- application sessions. Function bodies continue to enforce entity-scoped
-- canonical authorization.

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
  numeric,
  numeric,
  text,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
) FROM PUBLIC, anon;

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
  numeric,
  numeric,
  text,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
) TO authenticated;

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
  numeric,
  numeric,
  text,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
) FROM PUBLIC, anon;

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
  numeric,
  numeric,
  text,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
) TO authenticated;

COMMIT;
