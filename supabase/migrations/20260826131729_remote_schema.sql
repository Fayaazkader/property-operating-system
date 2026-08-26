--
-- PostgreSQL database dump
--

\restrict ZxmbTOTu0l2xMkoUO0WPEuKCmS9JHGvwpFuG6LRX4pGTHFRyW1TbsZy1SqKsagC

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: broker_company_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."broker_company_status" AS ENUM (
    'active',
    'inactive'
);


--
-- Name: broker_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."broker_status" AS ENUM (
    'active',
    'inactive',
    'suspended'
);


--
-- Name: checklist_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."checklist_source_type" AS ENUM (
    'manual',
    'system_validation',
    'document_upload',
    'integration'
);


--
-- Name: commission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."commission_status" AS ENUM (
    'pending_calculation',
    'pending_approval',
    'approved',
    'payment_requested',
    'declined'
);


--
-- Name: commission_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."commission_type" AS ENUM (
    'percentage',
    'fixed',
    'tiered'
);


--
-- Name: enquiry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."enquiry_status" AS ENUM (
    'new',
    'contacted',
    'viewing_scheduled',
    'declined',
    'converted'
);


--
-- Name: execution_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."execution_event_type" AS ENUM (
    'draft_generated',
    'review_started',
    'review_completed',
    'ready',
    'sent',
    'viewed',
    'declined',
    'reminder_sent',
    'reminder_opened',
    'signed',
    'executed',
    'effective',
    'activated',
    'cancelled',
    'expired',
    'escalated',
    'returned_for_changes',
    'locked',
    'unlocked'
);


--
-- Name: execution_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."execution_provider" AS ENUM (
    'native',
    'docusign',
    'adobe',
    'uploaded'
);


--
-- Name: execution_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."execution_source_type" AS ENUM (
    'lease',
    'lease_renewal',
    'lease_addendum',
    'supplier_contract',
    'management_agreement',
    'service_contract',
    'mandate'
);


--
-- Name: execution_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."execution_status" AS ENUM (
    'draft',
    'under_review',
    'ready',
    'sent',
    'viewed',
    'declined',
    'partially_signed',
    'executed',
    'effective',
    'activated',
    'cancelled',
    'expired'
);


--
-- Name: mandate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."mandate_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired',
    'completed'
);


--
-- Name: marketing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."marketing_status" AS ENUM (
    'not_started',
    'in_progress',
    'active',
    'paused',
    'completed'
);


--
-- Name: offer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."offer_status" AS ENUM (
    'received',
    'under_review',
    'negotiating',
    'accepted',
    'declined',
    'withdrawn'
);


--
-- Name: participant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."participant_status" AS ENUM (
    'pending',
    'sent',
    'viewed',
    'declined',
    'signed',
    'completed'
);


--
-- Name: participant_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."participant_type" AS ENUM (
    'tenant',
    'landlord',
    'witness',
    'surety',
    'director',
    'attorney',
    'property_manager',
    'supplier',
    'approver'
);


--
-- Name: signing_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."signing_method" AS ENUM (
    'standard',
    'verified_otp',
    'qualified_digital',
    'external_provider',
    'uploaded_copy'
);


--
-- Name: signing_order; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."signing_order" AS ENUM (
    'sequential',
    'parallel'
);


--
-- Name: vacancy_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."vacancy_status" AS ENUM (
    'active',
    'marketing',
    'under_offer',
    'leased',
    'on_hold',
    'cancelled'
);


--
-- Name: viewing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."viewing_status" AS ENUM (
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
);


--
-- Name: activate_lease("uuid", "text", "uuid", "uuid", numeric, "date", "date", "text", "text", "text", "text", numeric, numeric, integer, numeric, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."activate_lease"("p_entity_id" "uuid", "p_tenant_name" "text", "p_property_id" "uuid", "p_unit_id" "uuid", "p_monthly_rental" numeric, "p_lease_start_date" "date", "p_lease_end_date" "date", "p_company_registration" "text" DEFAULT NULL::"text", "p_vat_number" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_escalation_percent" numeric DEFAULT 8, "p_deposit_amount" numeric DEFAULT NULL::numeric, "p_parking_bays" integer DEFAULT 0, "p_parking_rate" numeric DEFAULT 850, "p_document_name" "text" DEFAULT NULL::"text", "p_document_url" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tenant_id UUID; v_lease_id UUID; v_lease_ref TEXT;
  v_property_code TEXT; v_started_at TIMESTAMPTZ;
BEGIN
  v_started_at := clock_timestamp();
  SELECT COALESCE(property_code, 'PROP') INTO v_property_code FROM properties WHERE id = p_property_id;

  INSERT INTO tenants (tenant_name, company_registration, vat_number, email, phone, entity_id, tenant_type, status, kyc_status, code)
  VALUES (p_tenant_name, p_company_registration, p_vat_number, p_email, p_phone, p_entity_id, 'Company', 'Active', 'Approved', UPPER(SUBSTRING(p_tenant_name, 1, 4)))
  RETURNING id INTO v_tenant_id;

  IF p_email IS NOT NULL OR p_phone IS NOT NULL THEN
    INSERT INTO tenant_contacts (tenant_id, full_name, email, mobile, is_primary)
    VALUES (v_tenant_id, p_tenant_name, p_email, p_phone, true);
  END IF;

  v_lease_ref := generate_lease_number(v_property_code);

  INSERT INTO leases (client_id, tenant_id, property_id, unit_id, owner_entity_id, lease_id, lease_status, monthly_rental, lease_start_date, lease_end_date, escalation_percent, deposit_amount, parking_bays, parking_rate, lease_type)
  VALUES (v_tenant_id, v_tenant_id, p_property_id, p_unit_id, p_entity_id, v_lease_ref, 'Active', p_monthly_rental, p_lease_start_date, p_lease_end_date, p_escalation_percent, COALESCE(p_deposit_amount, p_monthly_rental), p_parking_bays, p_parking_rate, 'commercial')
  RETURNING id INTO v_lease_id;

  IF p_document_name IS NOT NULL THEN
    INSERT INTO documents (entity_id, file_name, file_url, mime_type, document_type, status, tenant_id, property_id, related_entity_type, related_entity_id)
    VALUES (p_entity_id, p_document_name, p_document_url, 'application/pdf', 'signed_lease', 'stored', v_tenant_id, p_property_id, 'lease', v_lease_id);
  END IF;

  UPDATE units SET occupancy_status = 'Occupied' WHERE id = p_unit_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id, 'lease_id', v_lease_id,
    'tenant_code', UPPER(SUBSTRING(p_tenant_name, 1, 4)), 'lease_ref', v_lease_ref,
    'documents_attached', CASE WHEN p_document_name IS NOT NULL THEN 1 ELSE 0 END,
    'contacts_created', CASE WHEN p_email IS NOT NULL OR p_phone IS NOT NULL THEN 1 ELSE 0 END,
    'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::INTEGER
  );
END;
$$;


--
-- Name: activate_lease_rpc("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."activate_lease_rpc"("p_intake_id" "uuid", "p_initiated_by" "text" DEFAULT 'system'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_intake RECORD;
  v_tenant RECORD;
  v_lease_id UUID;
  v_lease_code TEXT;
  v_billing_rule_id UUID;
  v_deposit_id UUID;
BEGIN
  -- Fetch intake
  SELECT * INTO v_intake FROM lease_intake WHERE id = p_intake_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Intake not found');
  END IF;

  -- Validate critical fields
  IF v_intake.monthly_rental IS NULL OR v_intake.monthly_rental <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Monthly rental missing or invalid');
  END IF;
  IF v_intake.tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tenant not selected');
  END IF;
  IF v_intake.property_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Property not selected');
  END IF;
  IF v_intake.unit_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unit not selected');
  END IF;

  -- Fetch tenant
  SELECT * INTO v_tenant FROM tenants WHERE id = v_intake.tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tenant not found');
  END IF;

  -- Generate lease code using shared sequence
  v_lease_code := next_business_code('LSE');

  -- Create lease
  INSERT INTO leases (
    lease_id, tenant_id, property_id, unit_id, monthly_rental, deposit_amount,
    commencement_date, expiry_date, escalation_percent, parking_bays,
    lease_status, owner_entity_id, managing_entity_id, tenant_name,
    company_registration, lease_start_date, lease_end_date,
    created_at, updated_at
  ) VALUES (
    v_lease_code, v_intake.tenant_id, v_intake.property_id, v_intake.unit_id,
    v_intake.monthly_rental, v_intake.deposit_amount,
    v_intake.commencement_date, v_intake.expiry_date,
    COALESCE(v_intake.escalation_percent, 0), COALESCE(v_intake.parking_bays, 0),
    'Executed', v_tenant.entity_id, v_tenant.entity_id,
    v_intake.applicant_name, v_intake.company_registration,
    v_intake.commencement_date, v_intake.expiry_date,
    now(), now()
  )
  RETURNING id INTO v_lease_id;

  -- Update intake
  UPDATE lease_intake SET lease_id = v_lease_id, status = 'activated', activated_at = now(), updated_at = now()
  WHERE id = p_intake_id;

  -- Create billing rule
  INSERT INTO billing_rules (
    lease_id, rule_type, description, base_amount, frequency,
    escalation_percent, effective_from, status, created_at, updated_at
  ) VALUES (
    v_lease_id, 'monthly_rental', 'Monthly rental for ' || v_intake.applicant_name,
    v_intake.monthly_rental, 'monthly', COALESCE(v_intake.escalation_percent, 0),
    v_intake.commencement_date, 'active', now(), now()
  )
  RETURNING id INTO v_billing_rule_id;

  -- Create deposit ledger
  INSERT INTO deposit_register (
    entity_id, tenant_id, lease_id, property_id, original_amount,
    current_balance, status, held_since, created_at, updated_at
  ) VALUES (
    v_tenant.entity_id, v_intake.tenant_id, v_lease_id, v_intake.property_id,
    v_intake.deposit_amount, v_intake.deposit_amount, 'held',
    v_intake.commencement_date, now(), now()
  )
  RETURNING id INTO v_deposit_id;

  -- Update unit
  UPDATE units SET
    occupancy_status = 'Occupied',
    current_tenant_name = v_intake.applicant_name,
    current_lease_id = v_lease_id,
    current_rental_rate = v_intake.monthly_rental,
    updated_at = now()
  WHERE id = v_intake.unit_id;

  -- Timeline
  INSERT INTO lease_timeline (lease_id, event_type, description, created_at)
  VALUES (v_lease_id, 'lease_activated', 'Lease activated from intake ' || p_intake_id, now());

  RETURN jsonb_build_object(
    'success', true,
    'lease_id', v_lease_id,
    'lease_code', v_lease_code,
    'billing_rule_id', v_billing_rule_id,
    'deposit_id', v_deposit_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


--
-- Name: auth_entities(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."auth_entities"() RETURNS "uuid"[]
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(ARRAY_AGG(entity_id), ARRAY[]::uuid[])
  FROM user_entity_access
  WHERE user_id = auth.uid();
$$;


--
-- Name: auto_add_entity_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."auto_add_entity_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  default_role_id uuid;
BEGIN
  -- Get the entity_admin role for this entity
  SELECT id INTO default_role_id FROM public.roles WHERE entity_id = NEW.id AND name = 'entity_admin';
  
  -- Insert access with role
  INSERT INTO public.user_entity_access (user_id, entity_id, role_id, org_role)
  VALUES (auth.uid(), NEW.id, default_role_id, 'entity_admin')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: capture_execution_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."capture_execution_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
        NEW.snapshot = (
            SELECT row_to_json(source)
            FROM (
                SELECT * FROM leases WHERE id = NEW.source_id
            ) source
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: check_execution_sla(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."check_execution_sla"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
        NEW.expired_at = NEW.sent_at + (NEW.sla_days || ' days')::INTERVAL;
    END IF;
    
    IF NOW() > NEW.expired_at AND NEW.status NOT IN ('executed', 'activated', 'cancelled') THEN
        NEW.status = 'expired';
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: check_single_open_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."check_single_open_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'open' THEN
    IF EXISTS (
      SELECT 1 FROM financial_periods
      WHERE entity_id = NEW.entity_id
      AND period_type = NEW.period_type
      AND status = 'open'
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one open % period allowed per entity', NEW.period_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: communications_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communications_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "last_error" "text",
    "scheduled_for" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "provider_message_id" "text",
    "next_retry_at" timestamp with time zone,
    "processing_started_at" timestamp with time zone,
    "last_attempt_at" timestamp with time zone
);


--
-- Name: claim_next_messages(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."claim_next_messages"("p_limit" integer DEFAULT 50) RETURNS SETOF "public"."communications_queue"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM communications_queue
    WHERE status = 'queued' 
      AND COALESCE(next_retry_at, scheduled_for) <= now()
    ORDER BY COALESCE(next_retry_at, scheduled_for) ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE communications_queue q
  SET status = 'processing',
      processing_started_at = now()
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;


--
-- Name: close_financial_period_atomic("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."close_financial_period_atomic"("p_entity_id" "uuid", "p_period_name" "text", "p_expected_phase" "text" DEFAULT 'open'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_phase TEXT;
  v_next_period TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_current_month TEXT;
  v_current_year INT;
  v_next_month_idx INT;
  v_next_year INT;
  v_last_day INT;
BEGIN
  -- STEP 1: Lock row and verify phase
  SELECT workflow_phase INTO v_current_phase
  FROM financial_periods
  WHERE entity_id = p_entity_id 
    AND period_type = 'financial' 
    AND period_name = p_period_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Period not found');
  END IF;

  IF v_current_phase != p_expected_phase THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phase conflict: expected ' || p_expected_phase || ', got ' || v_current_phase, 'concurrencyConflict', true);
  END IF;

  -- STEP 2: Verify status is open
  IF NOT EXISTS (SELECT 1 FROM financial_periods WHERE entity_id = p_entity_id AND period_type = 'financial' AND period_name = p_period_name AND status = 'open' FOR UPDATE) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Period is not open');
  END IF;

  -- STEP 3: Calculate next period
  v_current_month := split_part(p_period_name, ' ', 1);
  v_current_year := split_part(p_period_name, ' ', 2)::INT;
  
  SELECT CASE v_current_month
    WHEN 'January' THEN 1 WHEN 'February' THEN 2 WHEN 'March' THEN 3
    WHEN 'April' THEN 4 WHEN 'May' THEN 5 WHEN 'June' THEN 6
    WHEN 'July' THEN 7 WHEN 'August' THEN 8 WHEN 'September' THEN 9
    WHEN 'October' THEN 10 WHEN 'November' THEN 11 WHEN 'December' THEN 12
  END INTO v_next_month_idx;
  
  IF v_next_month_idx = 12 THEN
    v_next_month_idx := 0;
    v_next_year := v_current_year + 1;
  ELSE
    v_next_year := v_current_year;
  END IF;
  
  v_next_period := CASE v_next_month_idx
    WHEN 0 THEN 'January' WHEN 1 THEN 'February' WHEN 2 THEN 'March'
    WHEN 3 THEN 'April' WHEN 4 THEN 'May' WHEN 5 THEN 'June'
    WHEN 6 THEN 'July' WHEN 7 THEN 'August' WHEN 8 THEN 'September'
    WHEN 9 THEN 'October' WHEN 10 THEN 'November' WHEN 11 THEN 'December'
  END || ' ' || v_next_year::TEXT;
  
  v_start_date := (v_next_year::TEXT || '-' || LPAD((v_next_month_idx + 1)::TEXT, 2, '0') || '-01')::DATE;
  v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_end_date := (v_next_year::TEXT || '-' || LPAD((v_next_month_idx + 1)::TEXT, 2, '0') || '-' || v_last_day::TEXT)::DATE;

  -- STEP 4: All checks passed — close and create next atomically
  UPDATE financial_periods 
  SET status = 'closed', workflow_phase = 'closed', closed_at = NOW()
  WHERE entity_id = p_entity_id AND period_type = 'financial' AND period_name = p_period_name;

  INSERT INTO financial_periods (entity_id, period_type, period_name, period_start, period_end, status, workflow_phase)
  VALUES (p_entity_id, 'financial', v_next_period, v_start_date, v_end_date, 'open', 'open');

  RETURN jsonb_build_object('success', true, 'nextPeriod', v_next_period, 'message', 'Financial period closed');
END;
$$;


--
-- Name: close_statement_period_atomic("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."close_statement_period_atomic"("p_entity_id" "uuid", "p_period_name" "text", "p_expected_phase" "text" DEFAULT 'billing_complete'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_phase TEXT;
  v_next_period TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_current_month TEXT;
  v_current_year INT;
  v_next_month_idx INT;
  v_next_year INT;
  v_last_day INT;
BEGIN
  -- STEP 1: Lock the row and verify current phase — atomic
  SELECT workflow_phase INTO v_current_phase
  FROM financial_periods
  WHERE entity_id = p_entity_id 
    AND period_type = 'statement' 
    AND period_name = p_period_name
  FOR UPDATE; -- Lock the row

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Period not found');
  END IF;

  IF v_current_phase != p_expected_phase THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phase conflict: expected ' || p_expected_phase || ', got ' || v_current_phase, 'concurrencyConflict', true);
  END IF;

  -- STEP 2: Verify status is open
  IF NOT EXISTS (SELECT 1 FROM financial_periods WHERE entity_id = p_entity_id AND period_type = 'statement' AND period_name = p_period_name AND status = 'open' FOR UPDATE) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Period is not open');
  END IF;

  -- STEP 3: Calculate next period
  v_current_month := split_part(p_period_name, ' ', 1);
  v_current_year := split_part(p_period_name, ' ', 2)::INT;
  
  SELECT CASE v_current_month
    WHEN 'January' THEN 1 WHEN 'February' THEN 2 WHEN 'March' THEN 3
    WHEN 'April' THEN 4 WHEN 'May' THEN 5 WHEN 'June' THEN 6
    WHEN 'July' THEN 7 WHEN 'August' THEN 8 WHEN 'September' THEN 9
    WHEN 'October' THEN 10 WHEN 'November' THEN 11 WHEN 'December' THEN 12
  END INTO v_next_month_idx;
  
  IF v_next_month_idx = 12 THEN
    v_next_month_idx := 0;
    v_next_year := v_current_year + 1;
  ELSE
    v_next_year := v_current_year;
  END IF;
  
  v_next_period := CASE v_next_month_idx
    WHEN 0 THEN 'January' WHEN 1 THEN 'February' WHEN 2 THEN 'March'
    WHEN 3 THEN 'April' WHEN 4 THEN 'May' WHEN 5 THEN 'June'
    WHEN 6 THEN 'July' WHEN 7 THEN 'August' WHEN 8 THEN 'September'
    WHEN 9 THEN 'October' WHEN 10 THEN 'November' WHEN 11 THEN 'December'
  END || ' ' || v_next_year::TEXT;
  
  v_start_date := (v_next_year::TEXT || '-' || LPAD((v_next_month_idx + 1)::TEXT, 2, '0') || '-01')::DATE;
  v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_end_date := (v_next_year::TEXT || '-' || LPAD((v_next_month_idx + 1)::TEXT, 2, '0') || '-' || v_last_day::TEXT)::DATE;

  -- STEP 4: All checks passed — close period and create next in one atomic operation
  UPDATE financial_periods 
  SET status = 'closed', workflow_phase = 'closed', closed_at = NOW()
  WHERE entity_id = p_entity_id AND period_type = 'statement' AND period_name = p_period_name;

  INSERT INTO financial_periods (entity_id, period_type, period_name, period_start, period_end, status, workflow_phase)
  VALUES (p_entity_id, 'statement', v_next_period, v_start_date, v_end_date, 'open', 'open');

  RETURN jsonb_build_object('success', true, 'nextPeriod', v_next_period, 'message', 'Statement period closed');
END;
$$;


--
-- Name: create_credit_note("uuid", "uuid", "uuid", "text", numeric, "text", "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_credit_note"("p_entity_id" "uuid", "p_tenant_id" "uuid", "p_invoice_id" "uuid", "p_invoice_number" "text", "p_total_amount" numeric, "p_reason" "text", "p_created_by" "text", "p_line_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cn_id UUID;
  v_line RECORD;
BEGIN
  INSERT INTO credit_notes (entity_id, tenant_id, invoice_id, invoice_number, total_amount, reason, status, created_by)
  VALUES (p_entity_id, p_tenant_id, p_invoice_id, p_invoice_number, p_total_amount, p_reason, 'pending_posting', p_created_by)
  RETURNING id INTO v_cn_id;

  IF p_line_items IS NOT NULL AND jsonb_array_length(p_line_items) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_line_items) AS x(invoice_line_id UUID, description TEXT, credited_amount DECIMAL, reason TEXT)
    LOOP
      INSERT INTO credit_note_lines (credit_note_id, invoice_line_id, description, credited_amount, reason)
      VALUES (v_cn_id, v_line.invoice_line_id, v_line.description, v_line.credited_amount, COALESCE(v_line.reason, p_reason));
    END LOOP;
  END IF;

  RETURN v_cn_id;
END;
$$;


--
-- Name: generate_intake_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."generate_intake_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.intake_code := 'INT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(CAST(NEW.id AS TEXT), 6, '0');
    RETURN NEW;
END;
$$;


--
-- Name: generate_lease_number("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."generate_lease_number"("property_code" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  seq_num INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lease_number_' || property_code));
  SELECT COALESCE(MAX(CAST(SUBSTRING(lease_id FROM '\d+$') AS INTEGER)), 0) + 1
  INTO seq_num FROM leases WHERE lease_id LIKE property_code || '-%';
  RETURN property_code || '-' || LPAD(seq_num::TEXT, 3, '0');
END;
$_$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, platform_role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: lock_execution(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."lock_execution"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
        NEW.is_locked = TRUE;
        NEW.locked_at = NOW();
        NEW.locked_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: next_business_code("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."next_business_code"("seq_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT next_value INTO next_val FROM business_sequences WHERE sequence_name = seq_name FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO business_sequences (sequence_name, next_value) VALUES (seq_name, 1);
    next_val := 1;
  END IF;
  UPDATE business_sequences SET next_value = next_value + 1, updated_at = now() WHERE sequence_name = seq_name;
  RETURN seq_name || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$;


--
-- Name: prevent_audit_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_audit_modification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is immutable. Records cannot be modified or deleted.';
END;
$$;


--
-- Name: prevent_charge_into_closed_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_charge_into_closed_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM statement_periods 
    WHERE status = 'closed' 
    AND NEW.billing_period = period_name
  ) THEN
    RAISE EXCEPTION 'Cannot add charges to a closed statement period. Use the current open period.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_closed_period_edit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_closed_period_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'Closed statement periods cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_invoice_edit_closed_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_invoice_edit_closed_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.statement_period_locked = true THEN
    RAISE EXCEPTION 'Invoices in locked statement periods cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_posted_transaction_edit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_posted_transaction_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.allocation_status = 'posted' OR OLD.queue = 'posted' THEN
    RAISE EXCEPTION 'Posted transactions cannot be modified. Create a reversal or adjustment instead.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_source_updates_during_execution(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_source_updates_during_execution"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM executions 
        WHERE source_id = NEW.id 
        AND source_type = 'lease'
        AND is_locked = TRUE 
        AND status IN ('sent', 'viewed', 'partially_signed')
    ) THEN
        RAISE EXCEPTION 'Cannot update lease while execution is in progress';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: prevent_statement_into_closed_period(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."prevent_statement_into_closed_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  period_status text;
  check_period text;
BEGIN
  -- Extract period from source_id (INV-July 2026 → July 2026)
  IF NEW.source_id LIKE 'INV-%' THEN
    check_period := substring(NEW.source_id from 5);
  ELSE
    RETURN NEW;
  END IF;

  SELECT status INTO period_status 
  FROM public.statement_periods 
  WHERE period_name = check_period;
  
  IF period_status = 'closed' THEN
    RAISE EXCEPTION 'Cannot generate statements for a closed period (%). Use the current open period.', check_period;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_maintenance_budget_spent("uuid", "uuid", integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."update_maintenance_budget_spent"("p_entity_id" "uuid", "p_property_id" "uuid", "p_year" integer, "p_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE maintenance_budgets
  SET spent_amount = spent_amount + p_amount, updated_at = now()
  WHERE entity_id = p_entity_id AND property_id = p_property_id AND year = p_year;
END;
$$;


--
-- Name: accounting_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."accounting_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "business_role" "text" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "is_required" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "configured_by" "uuid",
    "configured_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "text",
    "activity_type" "text",
    "activity_note" "text",
    "created_by" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


--
-- Name: activity_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."activity_feed" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "signal_category" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: adjustment_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."adjustment_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adjustment_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "charge_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "account_id" "uuid",
    "gl_code" "text",
    "tax_code" "text",
    "vat_rate" numeric(5,2),
    "amount_excl_vat" numeric(15,2) NOT NULL,
    "vat_amount" numeric(15,2) DEFAULT 0,
    "amount_incl_vat" numeric(15,2) NOT NULL,
    "billing_period" "text" NOT NULL,
    "source_type" "text" DEFAULT 'billing_adjustment'::"text",
    "source_id" "uuid",
    "status" "text" DEFAULT 'posted'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "posted_at" timestamp with time zone
);


--
-- Name: allocation_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."allocation_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid",
    "invoice_id" "uuid",
    "tenant_id" "uuid",
    "lease_id" "uuid",
    "posted_by" "text",
    "confidence" numeric(5,2),
    "rule_used" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: ap_payment_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ap_payment_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "allocation_method" "text" DEFAULT 'oldest_due'::"text",
    "auto_allocate" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: asset_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."asset_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "event" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: asset_warranties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."asset_warranties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "installer_supplier_id" "uuid",
    "warranty_type" "text",
    "start_date" "date" NOT NULL,
    "expiry_date" "date" NOT NULL,
    "terms" "text",
    "is_active" boolean DEFAULT true
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "serial_number" "text",
    "model" "text",
    "manufacturer" "text",
    "installation_date" "date",
    "warranty_expiry" "date",
    "expected_life_years" integer,
    "replacement_value" numeric,
    "service_interval_days" integer,
    "last_service_date" "date",
    "service_notes" "text",
    "preferred_supplier_id" "uuid",
    "manual_url" "text",
    "photos" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "floor" "text",
    "area" "text",
    "location_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "resource_label" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_log_action_check" CHECK (("action" = ANY (ARRAY['view'::"text", 'create'::"text", 'update'::"text", 'delete'::"text", 'login'::"text", 'logout'::"text", 'export'::"text", 'approve'::"text", 'reject'::"text", 'escalate'::"text"])))
);


--
-- Name: automation_execution_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."automation_execution_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "correlation_id" "text" NOT NULL,
    "status" "text" DEFAULT 'started'::"text" NOT NULL,
    "conditions_result" "jsonb",
    "actions_result" "jsonb",
    "error" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "duration_ms" integer
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."automation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "trigger" "text" DEFAULT 'event'::"text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "conditions" "jsonb" DEFAULT '[]'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "priority" integer DEFAULT 0,
    "cooldown_seconds" integer,
    "failure_policy" "text" DEFAULT 'ignore'::"text",
    "last_triggered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "bank_name" "text" NOT NULL,
    "account_name" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "branch_code" "text",
    "account_type" "text",
    "is_trust_account" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "opening_balance" numeric(14,2) DEFAULT 0,
    "current_balance" numeric(14,2) DEFAULT 0,
    "statement_balance" numeric(14,2) DEFAULT 0,
    "last_reconciled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid",
    CONSTRAINT "bank_accounts_account_type_check" CHECK (("account_type" = ANY (ARRAY['trust'::"text", 'operating'::"text", 'deposit'::"text", 'call'::"text", 'investment'::"text"])))
);


--
-- Name: bank_import_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_import_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "preset_name" "text" NOT NULL,
    "bank_name" "text",
    "is_default" boolean DEFAULT false,
    "column_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "amount_type" "text" DEFAULT 'single'::"text",
    "date_format" "text" DEFAULT 'DD/MM/YYYY'::"text",
    "skip_rows" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bank_import_presets_amount_type_check" CHECK (("amount_type" = ANY (ARRAY['single'::"text", 'dual'::"text"])))
);


--
-- Name: bank_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "statement_date" "date" NOT NULL,
    "opening_balance" numeric(15,2) DEFAULT 0,
    "closing_balance" numeric(15,2) DEFAULT 0,
    "status" "text" DEFAULT 'imported'::"text",
    "imported_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_date" "date",
    "value_date" "date",
    "bank_account_name" "text",
    "bank_account_number" "text",
    "transaction_reference" "text",
    "external_reference" "text",
    "transaction_description" "text",
    "debit_amount" numeric(14,2),
    "credit_amount" numeric(14,2),
    "transaction_amount" numeric(14,2),
    "transaction_type" "text",
    "currency" "text" DEFAULT 'ZAR'::"text",
    "allocation_status" "text" DEFAULT 'unallocated'::"text",
    "matched_invoice_id" "uuid",
    "matched_tenant_id" "uuid",
    "reconciliation_notes" "text",
    "imported_batch_reference" "text",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "split_allocations" "jsonb" DEFAULT '[]'::"jsonb",
    "queue" "text" DEFAULT 'ready'::"text",
    "property_id" "uuid",
    "bank_account_id" "uuid",
    "confidence" integer DEFAULT 0,
    "statement_running_balance" numeric(15,2),
    "statement_id" "uuid",
    "matched_tenant_name" "text"
);


--
-- Name: beta_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."beta_waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "company_name" "text",
    "email" "text" NOT NULL,
    "role" "text",
    "portfolio_size" "text",
    "portfolio_type" "text",
    "pain_point" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "contacted_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "activated_at" timestamp with time zone
);


--
-- Name: billing_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."billing_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "original_charge_id" "uuid" NOT NULL,
    "billing_rule_id" "uuid",
    "lease_id" "uuid" NOT NULL,
    "billing_period" "text" NOT NULL,
    "adjustment_type" "text" NOT NULL,
    "original_amount" numeric(15,2) NOT NULL,
    "new_amount" numeric(15,2) NOT NULL,
    "amount_delta" numeric(15,2) NOT NULL,
    "reason" "text",
    "effective_from" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "reviewed_by" "uuid",
    "approved_by" "uuid",
    "posted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "posted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tax_code" "text" DEFAULT 'NO_VAT'::"text" NOT NULL,
    CONSTRAINT "billing_adjustments_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['increase'::"text", 'decrease'::"text"]))),
    CONSTRAINT "billing_adjustments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text", 'posted'::"text"])))
);


--
-- Name: billing_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."billing_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "vat_rate" numeric(5,2) DEFAULT 15,
    "gl_code" "text",
    "is_recoverable" boolean DEFAULT false,
    "recovery_type" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: billing_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."billing_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "policy_name" "text" NOT NULL,
    "policy_type" "text" DEFAULT 'commercial'::"text",
    "lease_fee_amount" numeric(10,2) DEFAULT 1500.00,
    "lease_fee_description" "text" DEFAULT 'Standard Commercial Lease Fee'::"text",
    "late_payment_type" "text" DEFAULT 'percentage'::"text",
    "late_payment_value" numeric(10,2) DEFAULT 10.00,
    "late_payment_description" "text" DEFAULT 'Late Payment Fee'::"text",
    "deposit_months" integer DEFAULT 1,
    "billing_day" integer DEFAULT 25,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "billing_policies_late_payment_type_check" CHECK (("late_payment_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"])))
);


--
-- Name: billing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."billing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "rule_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "base_amount" numeric(14,2) DEFAULT 0,
    "vat_rate" numeric(5,2) DEFAULT 15,
    "gl_code" "text",
    "recovery_method" "text",
    "frequency" "text" DEFAULT 'monthly'::"text",
    "escalation_percent" numeric(5,2),
    "escalation_month" integer,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "status" "text" DEFAULT 'active'::"text",
    "superseded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_recoverable" boolean DEFAULT false,
    "charge_code" "text",
    CONSTRAINT "billing_rules_recovery_method_check" CHECK (("recovery_method" = ANY (ARRAY['fixed'::"text", 'metered'::"text", 'prorata'::"text", 'percentage'::"text", 'actual'::"text"]))),
    CONSTRAINT "billing_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['rent'::"text", 'parking'::"text", 'storage'::"text", 'security_levy'::"text", 'marketing_levy'::"text", 'cid_levy'::"text", 'insurance_recovery'::"text", 'rates_recovery'::"text", 'utility_recovery'::"text", 'generator_recovery'::"text", 'aircon_recovery'::"text", 'fixed_service'::"text", 'turnover_rental'::"text", 'percentage_rental'::"text", 'once_off'::"text", 'deposit'::"text"]))),
    CONSTRAINT "billing_rules_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'expired'::"text", 'superseded'::"text", 'pending'::"text"])))
);


--
-- Name: billing_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."billing_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "property_id" "uuid",
    "property_name" "text",
    "tenant_count" integer DEFAULT 0,
    "invoices_generated" integer DEFAULT 0,
    "statements_generated" integer DEFAULT 0,
    "emails_delivered" integer DEFAULT 0,
    "whatsapp_delivered" integer DEFAULT 0,
    "failed" integer DEFAULT 0,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "invoice_ids" "text"[]
);


--
-- Name: billing_worksheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."billing_worksheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid",
    "lease_id" "uuid",
    "tenant_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "subtotal_excl_vat" numeric(14,2) DEFAULT 0,
    "total_vat" numeric(14,2) DEFAULT 0,
    "total_incl_vat" numeric(14,2) DEFAULT 0,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "invoice_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "billing_worksheets_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'validated'::"text", 'ready_for_approval'::"text", 'approved'::"text", 'invoiced'::"text"])))
);


--
-- Name: broker_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."broker_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "broker_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "mandate_id" "uuid",
    "vacancy_id" "uuid",
    "commission_type" "public"."commission_type" NOT NULL,
    "commission_rate" numeric,
    "commission_amount" numeric,
    "calculation_details" "jsonb" DEFAULT '{}'::"jsonb",
    "annual_rent" numeric,
    "lease_term_months" integer,
    "total_commission" numeric NOT NULL,
    "split_percentage" numeric DEFAULT 100,
    "status" "public"."commission_status" DEFAULT 'pending_calculation'::"public"."commission_status",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "payment_request_id" "uuid",
    "payment_requested_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: broker_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."broker_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "name" "text" NOT NULL,
    "registration_number" "text",
    "vat_number" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "default_commission_rate" numeric DEFAULT 5.0,
    "default_commission_type" "public"."commission_type" DEFAULT 'percentage'::"public"."commission_type",
    "status" "public"."broker_company_status" DEFAULT 'active'::"public"."broker_company_status",
    "fica_verified" boolean DEFAULT false,
    "fica_verified_at" timestamp with time zone,
    "mandate_template_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: broker_mandates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."broker_mandates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "broker_id" "uuid" NOT NULL,
    "vacancy_id" "uuid" NOT NULL,
    "mandate_date" "date" NOT NULL,
    "expiry_date" "date",
    "commission_rate" numeric NOT NULL,
    "commission_type" "public"."commission_type" NOT NULL,
    "terms" "text",
    "exclusive" boolean DEFAULT false,
    "status" "public"."mandate_status" DEFAULT 'pending'::"public"."mandate_status",
    "mandate_url" "text",
    "signed_mandate_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: brokers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."brokers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "employee_number" "text",
    "commission_rate" numeric,
    "commission_type" "public"."commission_type",
    "status" "public"."broker_status" DEFAULT 'active'::"public"."broker_status",
    "fica_verified" boolean DEFAULT false,
    "fica_verified_at" timestamp with time zone,
    "profile_photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid",
    "account_id" "uuid",
    "budgeted_amount" numeric(15,2) NOT NULL,
    "budget_type" "text" DEFAULT 'monthly'::"text",
    "property_id" "uuid",
    "cost_centre" "text",
    "department_id" "uuid",
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "budgets_budget_type_check" CHECK (("budget_type" = ANY (ARRAY['annual'::"text", 'monthly'::"text"])))
);


--
-- Name: business_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."business_sequences" (
    "sequence_name" "text" NOT NULL,
    "next_value" bigint DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: cash_book_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."cash_book_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "transaction_date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "type" "text" NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "category" "text",
    "bank_reference" "text",
    "reconciled" boolean DEFAULT false,
    "reconciled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid",
    "tenant_id" "uuid",
    "property_id" "uuid",
    "entity_id" "uuid",
    "charge_type" "text" NOT NULL,
    "description" "text",
    "amount_excl_vat" numeric(14,2) DEFAULT 0,
    "vat_rate" numeric(5,2) DEFAULT 15,
    "vat_amount" numeric(14,2) DEFAULT 0,
    "amount_incl_vat" numeric(14,2) DEFAULT 0,
    "recurrence_rule" "jsonb" DEFAULT '{}'::"jsonb",
    "escalation_rule" "jsonb" DEFAULT '{}'::"jsonb",
    "recovery_method" "text",
    "gl_code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'posted'::"text",
    "billing_period" "text",
    "financial_period" "text",
    "created_by" "text",
    "reviewed_by" "text",
    "approved_by" "text",
    "posted_at" timestamp with time zone,
    "supporting_document" "text",
    "owner_entity_id" "uuid",
    "managing_entity_id" "uuid",
    "billing_rule_id" "uuid",
    "source_type" "text",
    "source_id" "uuid",
    "account_id" "uuid",
    CONSTRAINT "charges_charge_type_check" CHECK (("charge_type" = ANY (ARRAY['rent'::"text", 'rates'::"text", 'electricity'::"text", 'water'::"text", 'gas'::"text", 'solar'::"text", 'generator'::"text", 'parking'::"text", 'signage'::"text", 'aircon'::"text", 'security'::"text", 'cleaning'::"text", 'insurance'::"text", 'cid_levy'::"text", 'operating_cost'::"text", 'service_charge'::"text", 'penalty'::"text", 'interest'::"text", 'deposit'::"text", 'promotion'::"text", 'credit'::"text", 'adhoc'::"text", 'utility_recovery'::"text", 'lease_fee'::"text"]))),
    CONSTRAINT "charges_recovery_method_check" CHECK (("recovery_method" = ANY (ARRAY['fixed'::"text", 'variable'::"text", 'percentage'::"text", 'prorata'::"text", 'actual'::"text", 'meter'::"text"])))
);


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."chart_of_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "gl_code" "text" NOT NULL,
    "account_name" "text" NOT NULL,
    "account_type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "sub_category" "text",
    "is_vatable" boolean DEFAULT true,
    "vat_rate" numeric(5,2) DEFAULT 15.00,
    "is_active" boolean DEFAULT true,
    "description" "text",
    "parent_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vat_category" "text" DEFAULT 'standard'::"text",
    "account_range" "text",
    "account_code_prefix" "text",
    "cash_flow_category" "text" DEFAULT 'operating'::"text",
    "reporting_category" "text",
    CONSTRAINT "cash_flow_category_check" CHECK (("cash_flow_category" = ANY (ARRAY['operating'::"text", 'investing'::"text", 'financing'::"text", 'none'::"text"]))),
    CONSTRAINT "chart_of_accounts_account_type_check" CHECK (("account_type" = ANY (ARRAY['asset'::"text", 'liability'::"text", 'equity'::"text", 'income'::"text", 'expense'::"text"]))),
    CONSTRAINT "chk_reporting_category" CHECK (("reporting_category" = ANY (ARRAY['operating_revenue'::"text", 'operating_expense'::"text", 'non_operating_revenue'::"text", 'non_operating_expense'::"text", 'financing_expense'::"text", 'tax_expense'::"text", 'extraordinary'::"text", 'non_operating'::"text"])))
);


--
-- Name: commercial_behaviour_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."commercial_behaviour_profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "industry" "text",
    "tenant_type" "text",
    "years_as_tenant" numeric(3,1),
    "avg_payment_day" integer,
    "avg_delay_days" numeric(4,1),
    "collection_confidence" numeric(3,2),
    "seasonal_pattern" "jsonb" DEFAULT '{}'::"jsonb",
    "payment_trend" "text" DEFAULT 'stable'::"text",
    "preferred_channel" "text" DEFAULT 'email'::"text",
    "avg_response_time_minutes" integer,
    "reminder_effectiveness" numeric(3,2),
    "contact_reliability" numeric(3,2),
    "disputes_raised" integer DEFAULT 0,
    "promise_keeping_rate" numeric(3,2),
    "deposit_usage_count" integer DEFAULT 0,
    "payment_trend_direction" "text" DEFAULT 'stable'::"text",
    "maintenance_trend" "text",
    "lease_amendments_count" integer DEFAULT 0,
    "utility_trend" "text",
    "insurance_compliant" boolean DEFAULT true,
    "assigned_playbook" "text" DEFAULT 'standard'::"text",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid",
    "lease_behaviour" "jsonb" DEFAULT '{}'::"jsonb",
    "property_behaviour" "jsonb" DEFAULT '{}'::"jsonb"
);


--
-- Name: communication_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communication_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'INFO'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "communication_events_severity_check" CHECK (("severity" = ANY (ARRAY['INFO'::"text", 'ACTION_REQUIRED'::"text", 'CRITICAL'::"text"])))
);


--
-- Name: communication_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communication_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lease_id" "uuid",
    "channel" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "template" "text",
    "subject" "text",
    "message_preview" "text" NOT NULL,
    "document_url" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "sent_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: communication_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communication_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "text" NOT NULL,
    "log_id" "text" NOT NULL,
    "lease_id" "text",
    "tenant_name" "text",
    "property_name" "text",
    "event_type" "text",
    "message_subject" "text",
    "message_body" "text",
    "escalation_level" integer,
    "renewal_stage" "text",
    "status" "text",
    "triggered_by" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


--
-- Name: communication_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communication_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "preferred_channels" "text"[] DEFAULT ARRAY['email'::"text"],
    "email_enabled" boolean DEFAULT true,
    "whatsapp_enabled" boolean DEFAULT false,
    "sms_enabled" boolean DEFAULT false,
    "quiet_hours" "jsonb",
    "language" "text" DEFAULT 'en'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: communication_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communication_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "template_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "communication_rules_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'sms'::"text", 'portal'::"text", 'push'::"text"])))
);


--
-- Name: communication_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communication_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "channel" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_template_name" "text",
    "provider_template_id" "text",
    "language" "text" DEFAULT 'en'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "version" integer DEFAULT 1,
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "communication_templates_category_check" CHECK (("category" = ANY (ARRAY['revenue'::"text", 'lease'::"text", 'operations'::"text", 'documents'::"text"]))),
    CONSTRAINT "communication_templates_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'sms'::"text"]))),
    CONSTRAINT "communication_templates_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'active'::"text"])))
);


--
-- Name: communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."communications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "event_type" "text",
    "channel" "text" NOT NULL,
    "severity" "text" DEFAULT 'INFO'::"text",
    "template_name" "text",
    "message_body" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "external_message_id" "text",
    "source_type" "text",
    "source_id" "text",
    "triggered_by" "text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "reply_text" "text",
    "replied_at" timestamp with time zone,
    "normalized_reply" "text",
    "ai_intent" "text",
    "ai_confidence" numeric(5,2),
    "ai_summary" "text",
    "internal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message_sid" "text",
    CONSTRAINT "communications_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'sms'::"text", 'portal'::"text", 'push'::"text"]))),
    CONSTRAINT "communications_severity_check" CHECK (("severity" = ANY (ARRAY['INFO'::"text", 'ACTION_REQUIRED'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "communications_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text"])))
);


--
-- Name: compliance_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."compliance_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid",
    "asset_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "reference_number" "text",
    "issuing_authority" "text",
    "issue_date" "date",
    "expiry_date" "date" NOT NULL,
    "reminder_days" integer DEFAULT 30,
    "document_url" "text",
    "status" "text" DEFAULT 'active'::"text",
    "task_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: conversation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."conversation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "session_data" "jsonb" DEFAULT '{}'::"jsonb",
    "last_intent" "text",
    "last_query" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: credit_note_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."credit_note_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "credit_note_id" "uuid" NOT NULL,
    "invoice_line_id" "uuid",
    "description" "text" NOT NULL,
    "credited_amount" numeric(15,2) NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "invoice_number" "text",
    "total_amount" numeric(15,2) NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_notes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_posting'::"text", 'issued'::"text", 'cancelled'::"text", 'posting_failed'::"text", 'reversed'::"text"])))
);


--
-- Name: dead_letter_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."dead_letter_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_name" "text" NOT NULL,
    "payload" "jsonb",
    "error" "text",
    "retries_exhausted" integer,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: decision_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."decision_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "decision_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "confidence" numeric(3,2),
    "signals_used" "jsonb" DEFAULT '[]'::"jsonb",
    "policy_applied" "text",
    "playbook_selected" "text",
    "action_taken" "text" NOT NULL,
    "outcome" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: deposit_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."deposit_register" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "original_amount" numeric(15,2) NOT NULL,
    "interest_accrued" numeric(15,2) DEFAULT 0,
    "amount_applied" numeric(15,2) DEFAULT 0,
    "amount_refunded" numeric(15,2) DEFAULT 0,
    "current_balance" numeric(15,2) NOT NULL,
    "status" "text" DEFAULT 'held'::"text",
    "held_since" "date" NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deposit_type" "text" DEFAULT 'cash'::"text",
    "interest_rate" numeric(5,2),
    "interest_enabled" boolean DEFAULT false,
    "amount_claimed" numeric(15,2) DEFAULT 0,
    "last_interest_calc" timestamp with time zone,
    "held_at_bank" "text",
    "guarantee_provider" "text",
    "guarantee_number" "text",
    "refunded_date" timestamp with time zone,
    "closed_date" timestamp with time zone
);


--
-- Name: deposit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."deposit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deposit_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "journal_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: document_classification_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."document_classification_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "pattern" "text" NOT NULL,
    "pattern_type" "text" DEFAULT 'filename_contains'::"text",
    "document_type" "text" NOT NULL,
    "confidence" numeric(3,2) DEFAULT 0.85,
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: document_extraction_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."document_extraction_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "field_name" "text" NOT NULL,
    "field_label" "text" NOT NULL,
    "extraction_pattern" "text",
    "required" boolean DEFAULT false,
    "validation_rule" "text",
    "target_entity_type" "text",
    "target_field" "text",
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: document_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."document_import_jobs" (
    "id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "status" "text" DEFAULT 'uploaded'::"text",
    "document_class" "text",
    "ocr_confidence" numeric(3,2),
    "extraction_confidence" numeric(3,2),
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: document_lifecycle_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."document_lifecycle_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: document_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."document_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "related_entity_type" "text" NOT NULL,
    "related_entity_id" "uuid" NOT NULL,
    "relationship_type" "text" DEFAULT 'attached_to'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: document_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."document_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "reviewed_by" "uuid",
    "review_reason" "text",
    "extracted_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "document_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size_bytes" integer,
    "storage_provider" "text" DEFAULT 'supabase'::"text",
    "storage_bucket" "text" DEFAULT 'documents'::"text",
    "storage_key" "text" NOT NULL,
    "storage_version" "text" DEFAULT 'v1'::"text",
    "checksum" "text",
    "document_type" "text" DEFAULT 'unknown'::"text",
    "classification_confidence" numeric(3,2),
    "classified_by" "text" DEFAULT 'rules'::"text",
    "status" "text" DEFAULT 'received'::"text",
    "ocr_provider" "text",
    "ocr_text" "text",
    "ocr_confidence" numeric(3,2),
    "extracted_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "extraction_confidence" numeric(3,2),
    "requires_review" boolean DEFAULT true,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "parent_document_id" "uuid",
    "version_number" integer DEFAULT 1,
    "is_latest_version" boolean DEFAULT true,
    "source" "text" DEFAULT 'upload'::"text",
    "tags" "text"[],
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: enquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."enquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "vacancy_id" "uuid" NOT NULL,
    "broker_id" "uuid",
    "applicant_name" "text" NOT NULL,
    "applicant_company" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "enquiry_date" timestamp with time zone DEFAULT "now"(),
    "status" "public"."enquiry_status" DEFAULT 'new'::"public"."enquiry_status",
    "notes" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_code" "text" NOT NULL,
    "entity_name" "text" NOT NULL,
    "alert_email" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "trading_name" "text",
    "registration_number" "text",
    "vat_number" "text",
    "physical_address" "text",
    "postal_address" "text",
    "telephone" "text",
    "email" "text",
    "website" "text",
    "country" "text" DEFAULT 'South Africa'::"text",
    "financial_year_start" integer DEFAULT 3,
    "accounting_mode" "text" DEFAULT 'accrual'::"text",
    "base_currency" "text" DEFAULT 'ZAR'::"text",
    "is_active" boolean DEFAULT true,
    "is_archived" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "bank_details" "text",
    "address" "text"
);


--
-- Name: COLUMN "entities"."entity_name"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."entities"."entity_name" IS 'Deprecated — use name instead';


--
-- Name: execution_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "artifact_type" "text" NOT NULL,
    "artifact_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "execution_artifacts_artifact_type_check" CHECK (("artifact_type" = ANY (ARRAY['execution_package'::"text", 'execution_certificate'::"text", 'audit_trail'::"text", 'signature_payload'::"text"])))
);


--
-- Name: execution_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "pdf_url" "text",
    "hash" "text",
    "signed_by_name" "text",
    "signed_by_email" "text",
    "fields_signed" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: execution_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "item_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "required" boolean DEFAULT true,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "source_type" "text",
    "source_data" "jsonb" DEFAULT '{}'::"jsonb",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: execution_document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_document_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "document_url" "text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: execution_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: execution_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "participant_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "signing_order" integer DEFAULT 1,
    "status" "text" DEFAULT 'pending'::"text",
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text",
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "location" "text",
    "otp_code" "text",
    "otp_sent_at" timestamp with time zone,
    "otp_verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "signature_data" "jsonb" DEFAULT '{}'::"jsonb"
);


--
-- Name: execution_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."execution_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "portfolio_id" "uuid",
    "policy_name" "text" NOT NULL,
    "requires_review" boolean DEFAULT true,
    "requires_otp" boolean DEFAULT false,
    "signing_order" "text" DEFAULT 'sequential'::"text",
    "reminder_frequency_days" integer DEFAULT 3,
    "expiry_days" integer DEFAULT 14,
    "required_documents" "jsonb" DEFAULT '[]'::"jsonb",
    "required_participants" "jsonb" DEFAULT '[]'::"jsonb",
    "default_signing_method" "text" DEFAULT 'standard'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1,
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "provider" "text" DEFAULT 'native'::"text",
    "signing_method" "text" DEFAULT 'standard'::"text",
    "signing_order" "text" DEFAULT 'sequential'::"text",
    "is_locked" boolean DEFAULT false,
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "ready_score" integer DEFAULT 0,
    "validation_checks" "jsonb" DEFAULT '[]'::"jsonb",
    "sla_days" integer DEFAULT 7,
    "sent_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "escalated_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "executed_at" timestamp with time zone,
    "effective_date" "date",
    "activated_at" timestamp with time zone,
    "document_package_url" "text",
    "execution_certificate_url" "text",
    "sha_hash" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "deleted_at" timestamp with time zone
);


--
-- Name: expected_supplier_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."expected_supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "expected_amount" numeric(12,2),
    "expected_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "matched_invoice_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "flag_key" "text" NOT NULL,
    "flag_name" "text" NOT NULL,
    "description" "text",
    "enabled" boolean DEFAULT false,
    "rollout_percentage" integer DEFAULT 100,
    "target_roles" "text"[],
    "target_user_ids" "uuid"[],
    "scope" "text" DEFAULT 'entity'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: feedback_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."feedback_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text",
    "module" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_items_category_check" CHECK (("category" = ANY (ARRAY['love'::"text", 'frustration'::"text", 'missing_feature'::"text"]))),
    CONSTRAINT "feedback_items_severity_check" CHECK (("severity" = ANY (ARRAY['minor'::"text", 'medium'::"text", 'critical'::"text"]))),
    CONSTRAINT "feedback_items_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'planned'::"text", 'building'::"text", 'released'::"text", 'declined'::"text"])))
);


--
-- Name: financial_close_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_close_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "checklist_item" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "acknowledgement_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: financial_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_controls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "approval_limit_amount" numeric(15,2) DEFAULT 50000,
    "auto_allocation_enabled" boolean DEFAULT false,
    "tolerance_percentage" numeric(5,2) DEFAULT 1.00,
    "rounding_method" "text" DEFAULT 'nearest'::"text",
    "invoice_number_prefix" "text" DEFAULT 'INV'::"text",
    "credit_note_number_prefix" "text" DEFAULT 'CN'::"text",
    "journal_number_prefix" "text" DEFAULT 'JNL'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: financial_expectations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_expectations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "expectation_type" "text" NOT NULL,
    "reference_type" "text",
    "reference_id" "text",
    "expected_amount" numeric(15,2),
    "expected_date" "date",
    "actual_amount" numeric(15,2),
    "actual_date" "date",
    "variance_pct" numeric(5,2),
    "status" "text" DEFAULT 'pending'::"text",
    "period_id" "uuid",
    "seasonality_month" integer,
    "confidence_score" numeric(3,2) DEFAULT 0.50,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: financial_integrity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_integrity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid",
    "check_type" "text" NOT NULL,
    "level" "text" NOT NULL,
    "message" "text" NOT NULL,
    "acknowledged" boolean DEFAULT false,
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "financial_integrity_log_level_check" CHECK (("level" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"])))
);


--
-- Name: financial_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "period_name" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "period_type" "text" DEFAULT 'financial'::"text",
    "workflow_phase" "text" DEFAULT 'open'::"text",
    CONSTRAINT "chk_valid_phase_combination" CHECK (((("status" = 'open'::"text") AND ("workflow_phase" = ANY (ARRAY['open'::"text", 'receipting'::"text", 'allocation'::"text", 'billing_requested'::"text", 'billing_running'::"text", 'billing_complete'::"text", 'exception_review'::"text", 'ready_to_close'::"text"]))) OR (("status" = 'closed'::"text") AND ("workflow_phase" = 'closed'::"text")))),
    CONSTRAINT "financial_periods_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closing'::"text", 'closed'::"text"])))
);


--
-- Name: financial_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "statement_type" "text" NOT NULL,
    "statement_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_locked" boolean DEFAULT false,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "financial_statements_statement_type_check" CHECK (("statement_type" = ANY (ARRAY['income_statement'::"text", 'balance_sheet'::"text", 'cash_flow'::"text", 'trial_balance'::"text"])))
);


--
-- Name: financial_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financial_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text",
    "actor_id" "uuid",
    "correlation_id" "text",
    "event_id" "text",
    "source_engine" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: financials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."financials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "text",
    "tenant_name" "text",
    "monthly_rental" numeric,
    "outstanding_balance" numeric DEFAULT 0,
    "payment_status" "text" DEFAULT 'Current'::"text",
    "last_payment_date" "date",
    "escalation_percentage" numeric,
    "next_escalation_date" "date",
    "created_at" timestamp without time zone DEFAULT "now"()
);


--
-- Name: forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid",
    "account_id" "uuid",
    "actual_to_date" numeric(15,2) DEFAULT 0,
    "expected_remaining" numeric(15,2) DEFAULT 0,
    "forecast_total" numeric(15,2) DEFAULT 0,
    "forecast_type" "text" DEFAULT 'rolling'::"text",
    "property_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: general_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."general_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "period_id" "uuid",
    "journal_line_id" "uuid",
    "debit_amount" numeric(15,2) DEFAULT 0,
    "credit_amount" numeric(15,2) DEFAULT 0,
    "posted_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: gl_allocation_learning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gl_allocation_learning" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "supplier_account_id" "uuid",
    "property_id" "uuid",
    "description_pattern" "text" NOT NULL,
    "gl_code" "text" NOT NULL,
    "tax_code" "text" DEFAULT 'VAT 15%'::"text",
    "confidence" integer DEFAULT 50,
    "times_used" integer DEFAULT 1,
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: gl_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."gl_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid",
    "asset_id" "uuid",
    "unit_id" "uuid",
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "completed_date" "date",
    "inspector" "text",
    "inspector_company" "text",
    "checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "findings" "text",
    "severity" "text",
    "report_url" "text",
    "photos" "text"[],
    "work_order_ids" "uuid"[],
    "status" "text" DEFAULT 'scheduled'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: intelligence_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."intelligence_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "domain" "text" NOT NULL,
    "category" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "score" integer DEFAULT 0,
    "title" "text" NOT NULL,
    "explanation" "text",
    "recommendation" "text",
    "action" "text",
    "affected_entity_id" "uuid",
    "affected_entity_type" "text",
    "source_event" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "acknowledged_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "intelligence_signals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'acknowledged'::"text", 'resolved'::"text", 'suppressed'::"text", 'archived'::"text"])))
);


--
-- Name: interest_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."interest_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lease_id" "uuid",
    "amount" numeric(15,2) NOT NULL,
    "description" "text",
    "days_late" integer,
    "status" "text" DEFAULT 'draft'::"text",
    "period" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "team_ids" "uuid"[],
    "invited_by" "uuid",
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: invoice_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invoice_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "show_balance_brought_forward" boolean DEFAULT true,
    "show_deposit_guarantee" boolean DEFAULT true,
    "header_message" "text" DEFAULT ''::"text",
    "footer_message" "text" DEFAULT 'Payment due within 7 days.'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "company_name" "text",
    "company_address" "text",
    "company_contact" "text",
    "company_vat_number" "text",
    "company_reg_number" "text",
    "default_deposit_gl" "text" DEFAULT '2100'::"text"
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "charge_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(14,2) DEFAULT 1,
    "unit_price" numeric(14,2) DEFAULT 0,
    "amount_excl_vat" numeric(14,2) DEFAULT 0,
    "vat_rate" numeric(5,2) DEFAULT 15,
    "vat_amount" numeric(14,2) DEFAULT 0,
    "amount_incl_vat" numeric(14,2) DEFAULT 0,
    "gl_code" "text",
    "is_recoverable" boolean DEFAULT true
);


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invoice_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "lease_id" "uuid",
    "line_item_type" "text",
    "description" "text",
    "quantity" numeric(12,2) DEFAULT 1,
    "unit_rate" numeric(14,2),
    "amount" numeric(14,2),
    "vat_applicable" boolean DEFAULT true,
    "vat_amount" numeric(14,2),
    "total_amount" numeric(14,2),
    "billing_category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: invoice_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invoice_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "version" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "changed_by" "uuid",
    "change_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text",
    "lease_id" "uuid",
    "tenant_id" "uuid",
    "property_id" "uuid",
    "invoice_status" "text" DEFAULT 'draft'::"text",
    "billing_period_start" "date",
    "billing_period_end" "date",
    "invoice_date" "date",
    "due_date" "date",
    "subtotal_amount" numeric(14,2),
    "vat_amount" numeric(14,2),
    "total_amount" numeric(14,2),
    "outstanding_amount" numeric(14,2),
    "currency" "text" DEFAULT 'ZAR'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "escalation_applied" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entity_id" "uuid",
    "version" integer DEFAULT 1,
    "statement_period_locked" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "owner_entity_id" "uuid",
    "managing_entity_id" "uuid",
    "supplier_id" "uuid"
);


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."journal_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "description" "text",
    "debit_amount" numeric(15,2) DEFAULT 0,
    "credit_amount" numeric(15,2) DEFAULT 0,
    "vat_amount" numeric(15,2) DEFAULT 0,
    "vat_rate" numeric(5,2),
    "cost_centre" "text",
    "property_id" "uuid",
    "lease_id" "uuid",
    "tenant_id" "uuid",
    "supplier_id" "uuid",
    "broker_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "entity_id" "uuid"
);


--
-- Name: journals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."journals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "journal_number" "text" NOT NULL,
    "journal_type" "text" NOT NULL,
    "description" "text",
    "period_id" "uuid",
    "source_event" "text" NOT NULL,
    "source_id" "text",
    "reference" "text",
    "is_posted" boolean DEFAULT false,
    "posted_at" timestamp with time zone,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "explanation" "text",
    "template_id" "uuid",
    "template_version" integer
);


--
-- Name: kpi_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."kpi_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_date" timestamp with time zone,
    "total_leases" integer,
    "high_risk_leases" integer,
    "critical_risk_leases" integer,
    "urgent_renewals" integer,
    "average_escalation_level" numeric
);


--
-- Name: late_fee_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."late_fee_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lease_id" "uuid",
    "amount" numeric(15,2) NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "period" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: lease_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lease_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "text" NOT NULL,
    "document_name" "text",
    "document_url" "text",
    "document_type" "text",
    "uploaded_by" "text",
    "created_at" timestamp without time zone
);


--
-- Name: lease_intake; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lease_intake" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "property_id" "uuid",
    "unit_id" "uuid",
    "lease_id" "uuid",
    "applicant_name" "text",
    "company_registration" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "monthly_rental" numeric,
    "deposit_amount" numeric,
    "escalation_percent" numeric DEFAULT 0,
    "lease_term_months" integer,
    "commencement_date" "date",
    "expiry_date" "date",
    "parking_bays" integer DEFAULT 0,
    "negotiation_notes" "text",
    "status" "text" DEFAULT 'awaiting_review'::"text",
    "activated_at" timestamp with time zone,
    "intake_code" "text",
    "entity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "broker_id" "uuid",
    "broker_company" "text"
);


--
-- Name: lease_intake_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lease_intake_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intake_id" "uuid",
    "version_number" integer NOT NULL,
    "changes" "jsonb" DEFAULT '{}'::"jsonb",
    "changed_by" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: lease_template_families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lease_template_families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lease_template_families_category_check" CHECK (("category" = ANY (ARRAY['industrial'::"text", 'retail'::"text", 'office'::"text", 'residential'::"text", 'commercial'::"text", 'informal'::"text", 'other'::"text"])))
);


--
-- Name: lease_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lease_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "template_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "source_document_id" "uuid",
    "source_document_url" "text",
    "fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "property_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "applies_to_property_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ai_enabled" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "family_id" "uuid",
    "source_document_checksum" "text",
    "source_file_name" "text",
    "source_mime_type" "text",
    "field_mapping" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ai_suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "clause_suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    CONSTRAINT "lease_templates_category_check" CHECK (("category" = ANY (ARRAY['industrial'::"text", 'retail'::"text", 'office'::"text", 'residential'::"text", 'commercial'::"text", 'informal'::"text", 'other'::"text"]))),
    CONSTRAINT "lease_templates_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'in_review'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "lease_templates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "lease_templates_status_valid" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "lease_templates_version_check" CHECK (("version" > 0)),
    CONSTRAINT "lease_templates_version_positive" CHECK (("version" > 0))
);


--
-- Name: lease_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lease_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "intake_id" "uuid" NOT NULL,
    "event" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."leases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "text" NOT NULL,
    "lease_id" "text" NOT NULL,
    "property_name" "text",
    "unit_number" "text",
    "tenant_name" "text",
    "tenant_email" "text",
    "tenant_phone" "text",
    "lease_start_date" "date",
    "lease_end_date" "date",
    "monthly_rental" numeric,
    "lease_status" "text",
    "renewal_stage" "text",
    "days_to_expiry" integer,
    "escalation_level" integer,
    "vacancy_risk" "text",
    "assigned_leasing_manager" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "company_registration" "text",
    "vat_number" "text",
    "commencement_date" "date",
    "expiry_date" "date",
    "escalation_percent" numeric,
    "deposit_amount" numeric,
    "gla_sqm" numeric(12,2),
    "rental_rate_per_sqm" numeric(14,2),
    "billing_frequency" "text" DEFAULT 'monthly'::"text",
    "currency" "text" DEFAULT 'ZAR'::"text",
    "notice_period_days" integer DEFAULT 90,
    "parking_bays" integer DEFAULT 0,
    "lease_category" "text" DEFAULT 'office'::"text",
    "beneficial_occupation_date" "date",
    "signed_date" "date",
    "property_id" "uuid",
    "unit_id" "uuid",
    "tenant_id" "uuid",
    "owner_entity_id" "uuid",
    "managing_entity_id" "uuid",
    "lease_type" "text" DEFAULT 'Retail'::"text",
    "parking_rate" numeric(14,2) DEFAULT 0,
    "security_levy" numeric(14,2) DEFAULT 0,
    "marketing_levy" numeric(14,2) DEFAULT 0,
    "active_execution_id" "uuid",
    "current_execution_version" integer DEFAULT 0
);


--
-- Name: leasing_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."leasing_opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_code" "text" NOT NULL,
    "status" "text" DEFAULT 'prospecting'::"text" NOT NULL,
    "prospect_name" "text",
    "company_registration" "text",
    "vat_number" "text",
    "contact_person" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "industry" "text",
    "property_id" "uuid",
    "unit_number" "text",
    "monthly_rental" numeric,
    "deposit_amount" numeric,
    "escalation_percent" numeric,
    "lease_term_months" integer,
    "commencement_date" "date",
    "expiry_date" "date",
    "beneficial_occupation_date" "date",
    "parking_bays" integer DEFAULT 0,
    "storage_allocation" "text",
    "broker_id" "uuid",
    "commission_percent" numeric,
    "commission_amount" numeric,
    "commission_structure" "text",
    "commission_notes" "text",
    "commission_status" "text" DEFAULT 'pending'::"text",
    "offer_document_url" "text",
    "draft_lease_url" "text",
    "signed_lease_url" "text",
    "current_version" integer DEFAULT 1,
    "negotiation_notes" "text",
    "ai_review" "jsonb" DEFAULT '{}'::"jsonb",
    "activation_checklist" "jsonb" DEFAULT '{}'::"jsonb",
    "activated_lease_id" "uuid",
    "activated_tenant_id" "uuid",
    "assigned_to" "text",
    "entity_id" "uuid",
    "expected_revenue_annual" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "leasing_opportunities_commission_status_check" CHECK (("commission_status" = ANY (ARRAY['pending'::"text", 'due'::"text", 'invoiced'::"text", 'paid'::"text"]))),
    CONSTRAINT "leasing_opportunities_status_check" CHECK (("status" = ANY (ARRAY['prospecting'::"text", 'offer_received'::"text", 'commercial_review'::"text", 'negotiation'::"text", 'drafting'::"text", 'internal_approval'::"text", 'sent_for_signature'::"text", 'tenant_signed'::"text", 'landlord_signed'::"text", 'executed'::"text", 'ready_for_activation'::"text", 'activated'::"text", 'trading'::"text", 'declined'::"text", 'withdrawn'::"text", 'expired'::"text"])))
);


--
-- Name: leasing_opportunity_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."leasing_opportunity_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid",
    "version_number" integer NOT NULL,
    "changes" "jsonb" DEFAULT '{}'::"jsonb",
    "changed_by" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: lod_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lod_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "generated_by" "text",
    "sent_via" "text",
    CONSTRAINT "lod_queue_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'queued'::"text", 'rendered'::"text", 'emailed'::"text", 'whatsapp'::"text", 'downloaded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


--
-- Name: lod_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."lod_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" DEFAULT 'Letter of Demand — {{tenant_name}}'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "trigger_days" integer DEFAULT 30,
    "min_amount" numeric(15,2) DEFAULT 500,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: maintenance_approval_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_approval_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "condition_field" "text" NOT NULL,
    "condition_operator" "text" NOT NULL,
    "condition_value" "text" NOT NULL,
    "approval_level" "text" NOT NULL,
    "is_active" boolean DEFAULT true
);


--
-- Name: maintenance_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "month" integer,
    "budgeted_amount" numeric(12,2) NOT NULL,
    "spent_amount" numeric(12,2) DEFAULT 0,
    "category" "text"
);


--
-- Name: maintenance_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "decision_type" "text" NOT NULL,
    "decision_by" "uuid",
    "reason" "text",
    "override_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workflow_instance_id" "uuid",
    "approval_request_id" "uuid"
);


--
-- Name: maintenance_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "tenant_id" "uuid",
    "lease_id" "uuid",
    "reported_by" "text",
    "reported_via" "text" DEFAULT 'manual'::"text",
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "priority" "text" DEFAULT 'routine'::"text",
    "status" "text" DEFAULT 'reported'::"text",
    "duplicate_of" "uuid",
    "landlord_responsibility" boolean DEFAULT true,
    "tenant_approval_required" boolean DEFAULT false,
    "tenant_approved" boolean DEFAULT false,
    "tenant_approval_message" "text",
    "photo_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "asset_id" "uuid"
);


--
-- Name: maintenance_journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_journal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "snapshot_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: maintenance_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: maintenance_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "converted_to_wo" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "round" integer DEFAULT 1,
    "negotiated_amount" numeric(12,2),
    "notes" "text",
    CONSTRAINT "maintenance_quotes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'under_review'::"text", 'negotiating'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text", 'withdrawn'::"text", 'converted'::"text"])))
);


--
-- Name: maintenance_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "frequency_months" integer NOT NULL,
    "last_completed" "date",
    "next_due" "date",
    "supplier_id" "uuid",
    "auto_generate" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: maintenance_slas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."maintenance_slas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "priority" "text" NOT NULL,
    "response_hours" integer NOT NULL,
    "arrival_hours" integer NOT NULL,
    "resolution_hours" integer NOT NULL,
    "is_active" boolean DEFAULT true
);


--
-- Name: manual_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."manual_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "description" "text",
    "amount" numeric(15,2) NOT NULL,
    "vat_rate" numeric(5,2) DEFAULT 15.00,
    "gl_code" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "period" "text",
    "supporting_docs" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: notification_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "error" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "link" "text",
    "source_type" "text" NOT NULL,
    "source_id" "text",
    "read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: notifications_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."notifications_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "recipient_type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "template" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "error" "text",
    "retry_count" integer DEFAULT 0,
    "correlation_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "vacancy_id" "uuid" NOT NULL,
    "enquiry_id" "uuid",
    "broker_id" "uuid",
    "offer_date" "date" NOT NULL,
    "proposed_rental" numeric NOT NULL,
    "proposed_deposit" numeric,
    "proposed_term" integer,
    "proposed_commencement" "date",
    "special_conditions" "text",
    "status" "public"."offer_status" DEFAULT 'received'::"public"."offer_status",
    "counter_offers" "jsonb" DEFAULT '[]'::"jsonb",
    "final_rental" numeric,
    "final_terms" "text",
    "converted_to_lease_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: operational_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."operational_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb",
    "effect" "text" DEFAULT 'require_approval'::"text" NOT NULL,
    "effect_config" "jsonb" DEFAULT '{}'::"jsonb",
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."organisations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "company_name" "text",
    "registration_number" "text",
    "vat_number" "text",
    "tax_number" "text",
    "physical_address" "text",
    "postal_address" "text",
    "telephone" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#000000'::"text",
    "accent_color" "text" DEFAULT '#D4AF37'::"text",
    "font_family" "text" DEFAULT 'Inter'::"text",
    "legal_disclaimer" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: password_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."password_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "min_length" integer DEFAULT 8,
    "require_uppercase" boolean DEFAULT true,
    "require_lowercase" boolean DEFAULT true,
    "require_numbers" boolean DEFAULT true,
    "require_special" boolean DEFAULT false,
    "max_age_days" integer DEFAULT 90,
    "max_failed_attempts" integer DEFAULT 5,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: payment_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payment_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "batch_number" "text" NOT NULL,
    "description" "text",
    "total_amount" numeric(12,2) DEFAULT 0,
    "payment_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "bank_file_format" "text" DEFAULT 'standard'::"text",
    "bank_adapter" "text" DEFAULT 'standard_eft'::"text",
    "bank_file_content" "text",
    "bank_file_generated_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "approved_by" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: payment_commitments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payment_commitments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "committed_amount" numeric(12,2),
    "committed_date" "date",
    "actual_payment_date" "date",
    "actual_amount" numeric(12,2),
    "status" "text" DEFAULT 'pending'::"text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fulfilled_at" timestamp with time zone
);


--
-- Name: payment_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payment_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "pay_days_before_due" integer DEFAULT 0,
    "pay_on_due" boolean DEFAULT true,
    "auto_approve" boolean DEFAULT false,
    "requires_manual_approval" boolean DEFAULT false,
    "max_auto_amount" numeric(12,2),
    "preferred_payment_method" "text" DEFAULT 'eft'::"text",
    "schedule_type" "text" DEFAULT 'on_due'::"text",
    "schedule_day" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "supplier_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'ZAR'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "due_date" "date" NOT NULL,
    "payment_method" "text" DEFAULT 'eft'::"text",
    "bank_account" "jsonb",
    "payment_policy" "text",
    "approval_id" "uuid",
    "batch_id" "uuid",
    "sent_to_bank_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failure_reason" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: payment_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."payment_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term_name" "text" NOT NULL,
    "days" integer NOT NULL,
    "is_system" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: permission_catalogue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."permission_catalogue" (
    "key" "text" NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "permission_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: platform_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."platform_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "policy_type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "rules" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: portfolio_aggregation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."portfolio_aggregation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'processed'::"text"
);


--
-- Name: portfolio_read_model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."portfolio_read_model" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "model_type" "text" NOT NULL,
    "model_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval)
);


--
-- Name: portfolio_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."portfolio_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: posting_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."posting_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "business_event" "text" NOT NULL,
    "description" "text",
    "debit_account_id" "uuid",
    "credit_account_id" "uuid",
    "vat_treatment" "text" DEFAULT 'standard'::"text",
    "requires_approval" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "posting_rules_vat_treatment_check" CHECK (("vat_treatment" = ANY (ARRAY['standard'::"text", 'zero_rated'::"text", 'exempt'::"text", 'non_vatable'::"text"])))
);


--
-- Name: posting_template_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."posting_template_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "sequence" integer NOT NULL,
    "direction" "text" NOT NULL,
    "account_resolver" "text" NOT NULL,
    "amount_formula" "text" NOT NULL,
    "vat_treatment" "text" DEFAULT 'non_vatable'::"text",
    "vat_account_resolver" "text",
    "condition_formula" "text",
    "dimension_mapping" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "posting_template_lines_direction_check" CHECK (("direction" = ANY (ARRAY['debit'::"text", 'credit'::"text"])))
);


--
-- Name: posting_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."posting_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "business_event" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: processed_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."processed_commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "correlation_id" "text" NOT NULL,
    "command" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: procurement_goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."procurement_goods_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "received_by" "text",
    "quantity" integer DEFAULT 1,
    "notes" "text",
    "received_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: procurement_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."procurement_purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "spend_request_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "amount" numeric(12,2),
    "status" "text" DEFAULT 'draft'::"text",
    "issued_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: procurement_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."procurement_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rfq_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "amount" numeric(12,2),
    "description" "text",
    "status" "text" DEFAULT 'submitted'::"text",
    "submitted_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: procurement_rfqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."procurement_rfqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "spend_request_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "supplier_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "issued_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: procurement_spend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."procurement_spend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "estimated_amount" numeric(12,2),
    "category" "text",
    "priority" "text" DEFAULT 'routine'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "requested_by" "text",
    "approved_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: procurement_supplier_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."procurement_supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "amount" numeric(12,2),
    "match_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: product_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."product_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "entity_id" "uuid",
    "event_name" "text" NOT NULL,
    "module" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "platform_role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "display_name" "text",
    "first_login" boolean DEFAULT true,
    CONSTRAINT "profiles_platform_role_check" CHECK (("platform_role" = ANY (ARRAY['platform_admin'::"text", 'user'::"text"])))
);


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_code" "text",
    "property_name" "text" NOT NULL,
    "property_type" "text" DEFAULT 'office'::"text",
    "property_status" "text" DEFAULT 'active'::"text",
    "address_line_1" "text",
    "address_line_2" "text",
    "suburb" "text",
    "city" "text",
    "province" "text",
    "country" "text" DEFAULT 'South Africa'::"text",
    "postal_code" "text",
    "total_gla_sqm" numeric(14,2),
    "rentable_area_sqm" numeric(14,2),
    "occupied_area_sqm" numeric(14,2),
    "vacancy_area_sqm" numeric(14,2),
    "number_of_units" integer DEFAULT 0,
    "acquisition_date" "date",
    "asset_manager" "text",
    "facilities_manager" "text",
    "valuation_amount" numeric(16,2),
    "operational_region" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entity_id" "uuid",
    "owner_entity_id" "uuid",
    "managing_entity_id" "uuid"
);


--
-- Name: property_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."property_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "make" "text",
    "model" "text",
    "serial_number" "text",
    "install_date" "date",
    "warranty_expiry" "date",
    "last_serviced" "date",
    "status" "text" DEFAULT 'operational'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_asset_id" "uuid",
    "area" "text",
    "floor" "text"
);


--
-- Name: property_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."property_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "reference_id" "uuid",
    "reference_type" "text",
    "source" "text" DEFAULT 'system'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: property_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."property_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "type_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_system" boolean DEFAULT false
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "work_order_id" "uuid",
    "supplier_id" "uuid",
    "po_number" "text" NOT NULL,
    "description" "text",
    "amount" numeric,
    "status" "text" DEFAULT 'draft'::"text",
    "issued_date" "date",
    "approved_date" "date",
    "completed_date" "date",
    "approved_by" "uuid",
    "approval_notes" "text",
    "po_document_url" "text",
    "invoice_url" "text",
    "payment_request_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: rates_recovery_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rates_recovery_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "shop_number" "text",
    "gla_sqm" numeric(10,2) NOT NULL,
    "gla_percentage" numeric(6,4) NOT NULL,
    "previous_monthly_charge" numeric(12,2) NOT NULL,
    "monthly_increase" numeric(12,2) NOT NULL,
    "new_monthly_charge" numeric(12,2) NOT NULL,
    "back_charge_amount" numeric(12,2) DEFAULT 0,
    "billing_rule_updated" boolean DEFAULT false,
    "invoice_generated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: rates_recovery_document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rates_recovery_document_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "allocation_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL
);


--
-- Name: rates_recovery_document_snippets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rates_recovery_document_snippets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "snippet_url" "text" NOT NULL,
    "bounds" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: rates_recovery_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rates_recovery_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size_bytes" integer,
    "snippet_url" "text",
    "snippet_bounds" "jsonb",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "tenant_visible" boolean DEFAULT false,
    "include_in_proof" boolean DEFAULT false,
    "snippets" "jsonb" DEFAULT '[]'::"jsonb"
);


--
-- Name: rates_recovery_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rates_recovery_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "effective_date" "date" NOT NULL,
    "previous_monthly_rates" numeric(12,2) NOT NULL,
    "new_monthly_rates" numeric(12,2) NOT NULL,
    "monthly_increase" numeric(12,2) NOT NULL,
    "recovery_basis" "text" DEFAULT 'gla'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "generated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reason" "text",
    "municipality_name" "text",
    CONSTRAINT "rates_recovery_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'preview'::"text", 'approved'::"text", 'processing'::"text", 'applied'::"text"])))
);


--
-- Name: recoveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."recoveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recovery_reference" "text",
    "property_id" "uuid",
    "lease_id" "uuid",
    "tenant_id" "uuid",
    "recovery_category" "text",
    "recovery_period_start" "date",
    "recovery_period_end" "date",
    "budgeted_amount" numeric(14,2),
    "actual_amount" numeric(14,2),
    "recovered_amount" numeric(14,2),
    "under_recovery_amount" numeric(14,2),
    "over_recovery_amount" numeric(14,2),
    "recovery_status" "text" DEFAULT 'pending'::"text",
    "calculation_method" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: recurring_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."recurring_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "property_id" "uuid",
    "description" "text" NOT NULL,
    "gl_code" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "tolerance_pct" numeric(5,2) DEFAULT 10,
    "vat_treatment" "text" DEFAULT 'standard'::"text",
    "frequency" "text" DEFAULT 'monthly'::"text",
    "expected_day" integer,
    "next_due_date" "date",
    "status" "text" DEFAULT 'active'::"text",
    "last_matched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: report_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."report_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "report_id" "text" NOT NULL,
    "report_title" "text" NOT NULL,
    "scope" "jsonb" DEFAULT '{}'::"jsonb",
    "format" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_assurance_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_assurance_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "overall_score" numeric(3,1),
    "payment_reliability" numeric(3,1),
    "behaviour_stability" numeric(3,1),
    "communication_score" numeric(3,1),
    "financial_health" numeric(3,1),
    "compliance_score" numeric(3,1),
    "confidence_level" numeric(3,2),
    "trend" "text" DEFAULT 'stable'::"text",
    "explanation" "jsonb" DEFAULT '{}'::"jsonb",
    "recommended_action" "text",
    "action_urgency" "text" DEFAULT 'none'::"text",
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "collection_confidence" numeric(3,2),
    "revenue_protected" numeric(12,2)
);


--
-- Name: revenue_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "decision_type" "text" NOT NULL,
    "confidence" numeric(3,2),
    "signals_considered" "jsonb" DEFAULT '[]'::"jsonb",
    "chosen_action" "text",
    "alternative_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "executed" boolean DEFAULT false,
    "executed_at" timestamp with time zone,
    "outcome" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_digital_twins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_digital_twins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "expected_collection" numeric(12,2),
    "collection_confidence" numeric(3,2),
    "revenue_risk" "text" DEFAULT 'low'::"text",
    "behaviour_trend" "text" DEFAULT 'stable'::"text",
    "recommended_action" "text",
    "next_expected_event" "text",
    "next_expected_date" "date",
    "legal_monthly_rent" numeric(12,2),
    "legal_deposit" numeric(12,2),
    "billing_day" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_interventions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_interventions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "intervention_type" "text" NOT NULL,
    "channel" "text",
    "amount_at_risk" numeric(12,2),
    "outcome" "text" DEFAULT 'pending'::"text",
    "recovered_amount" numeric(12,2),
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "trigger_source" "text" DEFAULT 'automation'::"text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "duration_minutes" integer,
    "owner" "text",
    "automated" boolean DEFAULT true,
    "successful" boolean
);


--
-- Name: revenue_outlooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_outlooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "expected_today" numeric(12,2),
    "collected_today" numeric(12,2),
    "still_expected" numeric(12,2),
    "at_risk" numeric(12,2),
    "collection_confidence" numeric(3,2),
    "top_priorities" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_playbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_playbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false,
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "auto_assign_conditions" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "policy_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "rules" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_signal_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_signal_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "state" "text" NOT NULL,
    "reason" "text",
    "triggered_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: revenue_strategies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revenue_strategies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "goal_name" "text" NOT NULL,
    "target_value" numeric(5,1),
    "current_value" numeric(5,1) DEFAULT 0,
    "unit" "text" DEFAULT '%'::"text",
    "owner" "text",
    "status" "text" DEFAULT 'active'::"text",
    "review_frequency" "text" DEFAULT 'monthly'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "role_permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: search_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."search_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "query" "text" NOT NULL,
    "result_count" integer DEFAULT 0,
    "result_clicked" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: service_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."service_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid",
    "asset_id" "uuid",
    "supplier_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "service_type" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "frequency_days" integer,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "sla_response_hours" integer DEFAULT 24,
    "sla_completion_days" integer DEFAULT 7,
    "contract_value" numeric,
    "billing_cycle" "text" DEFAULT 'monthly'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: signature_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."signature_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "request_type" "text" DEFAULT 'lease'::"text" NOT NULL,
    "lease_id" "uuid",
    "document_name" "text" NOT NULL,
    "document_url" "text" NOT NULL,
    "fields" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "uuid",
    "template_id" "uuid",
    "template_version" integer DEFAULT 1,
    "certificate" "jsonb",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "completed_by" "uuid",
    "workflow_id" "uuid",
    "execution_package_hash" "text",
    "signing_provider" "text" DEFAULT 'native'::"text",
    "provider_request_id" "text",
    "certificate_id" "uuid",
    CONSTRAINT "signature_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['lease'::"text", 'document'::"text"]))),
    CONSTRAINT "signature_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'viewed'::"text", 'signed'::"text", 'completed'::"text", 'expired'::"text"])))
);


--
-- Name: signature_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."signature_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "signer_id" "uuid",
    "signer_role" "text",
    "device" "text",
    "browser" "text",
    "ip_address" "text",
    "status" "text" DEFAULT 'started'::"text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "viewed_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "expired_at" timestamp with time zone
);


--
-- Name: signing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."signing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: signing_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."signing_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "template_name" "text" DEFAULT 'Standard Commercial Lease'::"text" NOT NULL,
    "landlord_signature" "jsonb",
    "tenant_signature" "jsonb",
    "witness_signature" "jsonb",
    "landlord_initials" "jsonb",
    "tenant_initials" "jsonb",
    "date_fields" "jsonb",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1,
    "property_id" "uuid",
    "parent_template_id" "uuid",
    "is_active" boolean DEFAULT true,
    "expiry_days" integer DEFAULT 14
);


--
-- Name: statement_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."statement_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "show_next_period_charges" boolean DEFAULT true,
    "header_message" "text" DEFAULT ''::"text",
    "footer_message" "text" DEFAULT 'This is a statement of account.'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "company_name" "text",
    "company_address" "text",
    "company_contact" "text"
);


--
-- Name: statement_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."statement_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: statement_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."statement_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "period_name" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "text" DEFAULT 'open'::"text",
    "invoices_count" integer DEFAULT 0,
    "total_invoiced" numeric(14,2) DEFAULT 0,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    CONSTRAINT "statement_periods_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'locked'::"text"])))
);


--
-- Name: statements_generated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."statements_generated" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "statement_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1,
    "status" "text" DEFAULT 'draft'::"text",
    "generated_by" "uuid",
    "change_reason" "text",
    "supersedes_version" integer,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "statements_generated_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'preview'::"text", 'issued'::"text", 'cancelled'::"text", 'superseded'::"text"])))
);


--
-- Name: sub_ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."sub_ledger_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "ledger_type" "text" NOT NULL,
    "journal_line_id" "uuid",
    "account_id" "uuid",
    "reference_type" "text",
    "reference_id" "text",
    "description" "text",
    "debit_amount" numeric(15,2) DEFAULT 0,
    "credit_amount" numeric(15,2) DEFAULT 0,
    "running_balance" numeric(15,2) DEFAULT 0,
    "tenant_id" "uuid",
    "supplier_id" "uuid",
    "broker_id" "uuid",
    "bank_account_id" "uuid",
    "property_id" "uuid",
    "lease_id" "uuid",
    "posted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sub_ledger_entries_ledger_type_check" CHECK (("ledger_type" = ANY (ARRAY['ar'::"text", 'ap'::"text", 'bank'::"text", 'tenant'::"text", 'supplier'::"text", 'broker'::"text", 'deposit'::"text"])))
);


--
-- Name: supplier_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "account_number" "text" NOT NULL,
    "account_name" "text",
    "meter_number" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_conflicts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "conflict_type" "text" NOT NULL,
    "reason" "text",
    "effective_from" "date" DEFAULT CURRENT_DATE,
    "effective_to" "date",
    "is_active" boolean DEFAULT true
);


--
-- Name: supplier_credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "original_invoice_id" "uuid",
    "credit_note_number" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'posted'::"text",
    "journal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "available_amount" numeric(15,2),
    "applied_amount" numeric(15,2) DEFAULT 0,
    "refunded_amount" numeric(15,2) DEFAULT 0,
    "credit_status" "text" DEFAULT 'available'::"text"
);


--
-- Name: supplier_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_invoice_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "gl_code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "vat_code" "text" DEFAULT 'standard'::"text",
    "vat_rate" numeric(5,2) DEFAULT 15.00,
    "vat_amount" numeric(15,2) DEFAULT 0,
    "total" numeric(15,2) NOT NULL,
    "cost_centre" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "description" "text",
    "amount" numeric(12,2) NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'ZAR'::"text",
    "invoice_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment_terms" "text",
    "po_reference" "text",
    "work_order_id" "uuid",
    "property_id" "uuid",
    "source" "text" DEFAULT 'manual'::"text",
    "ocr_data" "jsonb",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_invoices_new; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_invoices_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "due_date" "date",
    "description" "text",
    "total_amount" numeric(15,2) NOT NULL,
    "vat_amount" numeric(15,2) DEFAULT 0,
    "currency" "text" DEFAULT 'ZAR'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "source" "text" DEFAULT 'manual'::"text",
    "ocr_data" "jsonb",
    "ocr_confidence" numeric(3,2),
    "requires_review" boolean DEFAULT false,
    "duplicate_checked" boolean DEFAULT false,
    "duplicate_of" "uuid",
    "journal_id" "uuid",
    "payment_terms" integer DEFAULT 30,
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "posted_by" "uuid",
    "posted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lifecycle_status" "text" DEFAULT 'captured'::"text",
    "subtotal" numeric(12,2),
    "document_id" "uuid",
    "extracted_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "override_duplicate" boolean DEFAULT false,
    "override_calculation" boolean DEFAULT false,
    "supplier_account_id" "uuid",
    "credit_status" "text",
    "credit_note_id" "uuid"
);


--
-- Name: supplier_matching_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_matching_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "priority" "text" NOT NULL,
    "response_weight" numeric(3,2) DEFAULT 0,
    "distance_weight" numeric(3,2) DEFAULT 0,
    "availability_weight" numeric(3,2) DEFAULT 0,
    "rating_weight" numeric(3,2) DEFAULT 0,
    "price_weight" numeric(3,2) DEFAULT 0,
    "max_active_jobs" integer,
    "require_insurance" boolean DEFAULT true,
    "require_trade_certification" boolean DEFAULT true,
    "preferred_supplier_only" boolean DEFAULT false,
    "allow_after_hours" boolean DEFAULT false,
    "max_travel_radius_km" integer
);


--
-- Name: supplier_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "trade_match" numeric(3,2) DEFAULT 0,
    "property_coverage" numeric(3,2) DEFAULT 0,
    "emergency_capability" numeric(3,2) DEFAULT 0,
    "avg_response_time_hours" numeric(5,1),
    "completion_rate" numeric(3,2) DEFAULT 0,
    "quality_rating" numeric(3,2) DEFAULT 0,
    "current_workload" integer DEFAULT 0,
    "overall_score" numeric(3,2) DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_statement_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_statement_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "statement_id" "uuid" NOT NULL,
    "transaction_date" "date" NOT NULL,
    "description" "text",
    "reference" "text",
    "debit" numeric(15,2) DEFAULT 0,
    "credit" numeric(15,2) DEFAULT 0,
    "matched_invoice_id" "uuid",
    "matched_payment_id" "uuid",
    "match_status" "text" DEFAULT 'unmatched'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "statement_date" "date" NOT NULL,
    "opening_balance" numeric(15,2) DEFAULT 0,
    "closing_balance" numeric(15,2) DEFAULT 0,
    "source_file" "text",
    "status" "text" DEFAULT 'imported'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: supplier_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."supplier_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "arrived_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text",
    "notes" "text",
    "photo_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "tenant_confirmed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_name" "text" NOT NULL,
    "supplier_code" "text",
    "entity_id" "uuid",
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "vat_number" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "trading_name" "text",
    "registered_name" "text",
    "registration_number" "text",
    "tax_number" "text",
    "accounts_contact" "text",
    "bank_name" "text",
    "bank_account" "text",
    "bank_branch" "text",
    "payment_method" "text" DEFAULT 'eft'::"text",
    "default_gl_code" "text",
    "default_vat_code" "text",
    "default_payment_terms" integer DEFAULT 30,
    "currency" "text" DEFAULT 'ZAR'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "blacklisted" boolean DEFAULT false,
    "last_invoice_at" timestamp with time zone,
    "last_payment_at" timestamp with time zone,
    "insurance_valid" boolean DEFAULT false,
    "insurance_expiry" "date",
    "trade_certified" boolean DEFAULT false,
    "trade_certificate_expiry" "date",
    "after_hours" boolean DEFAULT false,
    "max_travel_radius_km" integer,
    "preferred_supplier" boolean DEFAULT false,
    "address" "text",
    "whatsapp_number" "text"
);


--
-- Name: task_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."task_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "previous_value" "text",
    "new_value" "text",
    "action_timestamp" timestamp without time zone DEFAULT "now"(),
    "action_by" "text"
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "text" NOT NULL,
    "task_id" "text" NOT NULL,
    "lease_id" "text",
    "tenant_name" "text",
    "property_name" "text",
    "task_type" "text",
    "priority" "text",
    "assigned_to" "text",
    "task_status" "text",
    "escalation_level" integer,
    "renewal_stage" "text",
    "created_date" timestamp without time zone,
    "due_date" timestamp without time zone,
    "property_id" "uuid",
    "tenant_id" "uuid",
    "unit_id" "uuid",
    "invoice_id" "uuid"
);


--
-- Name: tax_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tax_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "tax_code" "text" NOT NULL,
    "tax_name" "text" NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 0,
    "is_recoverable" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "purpose" "text",
    "lead_id" "uuid",
    "is_assignable" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: tenant_communication_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tenant_communication_prefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tenant_communication_prefs_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'sms'::"text", 'portal'::"text", 'push'::"text"])))
);


--
-- Name: tenant_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tenant_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "position" "text",
    "department" "text",
    "email" "text",
    "mobile" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "preferred_channel" "text" DEFAULT 'email'::"text",
    "receives_statements" boolean DEFAULT true,
    "receives_invoices" boolean DEFAULT true,
    "receives_arrears" boolean DEFAULT true,
    "receives_maintenance" boolean DEFAULT false
);


--
-- Name: tenant_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tenant_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


--
-- Name: tenant_revenue_dna; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tenant_revenue_dna" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "industry" "text",
    "tenant_type" "text",
    "years_as_tenant" numeric(3,1),
    "avg_payment_day" integer,
    "avg_delay_days" numeric(4,1),
    "collection_confidence" numeric(3,2),
    "seasonal_pattern" "jsonb" DEFAULT '{}'::"jsonb",
    "payment_trend" "text" DEFAULT 'stable'::"text",
    "preferred_channel" "text" DEFAULT 'email'::"text",
    "avg_response_time_minutes" integer,
    "reminder_effectiveness" numeric(3,2),
    "contact_reliability" numeric(3,2),
    "disputes_raised" integer DEFAULT 0,
    "promise_keeping_rate" numeric(3,2),
    "deposit_usage_count" integer DEFAULT 0,
    "payment_trend_direction" "text" DEFAULT 'stable'::"text",
    "maintenance_trend" "text",
    "lease_amendments_count" integer DEFAULT 0,
    "utility_trend" "text",
    "insurance_compliant" boolean DEFAULT true,
    "assigned_playbook" "text" DEFAULT 'standard'::"text",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_name" "text",
    "company_registration" "text",
    "vat_number" "text",
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "industry" "text",
    "risk_rating" "text" DEFAULT 'Medium'::"text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "whatsapp_number" "text",
    "whatsapp_enabled" boolean DEFAULT false,
    "email_enabled" boolean DEFAULT false,
    "sms_enabled" boolean DEFAULT false,
    "entity_id" "uuid",
    "company_type" "text",
    "code" "text",
    "tenant_type" "text" DEFAULT 'Company'::"text",
    "trading_name" "text",
    "billing_email" "text",
    "statement_email" "text",
    "credit_limit" numeric(12,2),
    "payment_terms" "text" DEFAULT '30 days'::"text",
    "kyc_status" "text" DEFAULT 'pending'::"text",
    "insurance_expiry" "date",
    "is_archived" boolean DEFAULT false,
    "status" "text" DEFAULT 'Active'::"text",
    "payment_term_id" "uuid",
    CONSTRAINT "tenants_kyc_status_check" CHECK (("kyc_status" = ANY (ARRAY['Pending'::"text", 'In Review'::"text", 'Approved'::"text", 'Rejected'::"text", 'Expired'::"text"]))),
    CONSTRAINT "tenants_status_check" CHECK (("status" = ANY (ARRAY['Active'::"text", 'Inactive'::"text", 'Blacklisted'::"text", 'Absconded'::"text", 'Archived'::"text"]))),
    CONSTRAINT "tenants_tenant_type_check" CHECK (("tenant_type" = ANY (ARRAY['Company'::"text", 'Individual'::"text", 'Government'::"text", 'NPO'::"text", 'Trust'::"text"])))
);


--
-- Name: transaction_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."transaction_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "tenant_id" "uuid",
    "supplier_id" "uuid",
    "property_id" "uuid",
    "invoice_id" "uuid",
    "gl_code" "text",
    "amount" numeric(14,2) NOT NULL,
    "is_payment" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


--
-- Name: treasury_obligations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."treasury_obligations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "expected_amount" numeric(15,2) NOT NULL,
    "expected_date" "date" NOT NULL,
    "priority" "text" DEFAULT 'important'::"text",
    "recurrence" "text" DEFAULT 'monthly'::"text",
    "avg_12m" numeric(15,2),
    "highest_12m" numeric(15,2),
    "lowest_12m" numeric(15,2),
    "last_amount" numeric(15,2),
    "last_date" "date",
    "property_id" "uuid",
    "bank_account_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: trial_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."trial_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "total_debits" numeric(15,2) DEFAULT 0,
    "total_credits" numeric(15,2) DEFAULT 0,
    "net_balance" numeric(15,2) DEFAULT 0,
    "is_balanced" boolean DEFAULT false,
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_code" "text",
    "property_id" "uuid",
    "unit_number" "text" NOT NULL,
    "unit_name" "text",
    "unit_type" "text" DEFAULT 'office'::"text",
    "floor_level" "text",
    "gla_sqm" numeric(12,2),
    "rentable_area_sqm" numeric(12,2),
    "occupancy_status" "text" DEFAULT 'vacant'::"text",
    "operational_status" "text" DEFAULT 'active'::"text",
    "current_rental_rate" numeric(14,2),
    "current_rate_per_sqm" numeric(14,2),
    "current_tenant_name" "text",
    "current_lease_id" "uuid",
    "parking_bays" integer DEFAULT 0,
    "utility_meter_reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "units_occupancy_status_check" CHECK (("occupancy_status" = ANY (ARRAY['Vacant'::"text", 'Reserved'::"text", 'Occupied'::"text", 'Under Maintenance'::"text"]))),
    CONSTRAINT "units_operational_status_check" CHECK (("operational_status" = ANY (ARRAY['Active'::"text", 'Under Renovation'::"text", 'Decommissioned'::"text", 'Held'::"text"])))
);


--
-- Name: user_entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text"
);


--
-- Name: user_entity_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_entity_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "org_role" "text" DEFAULT 'entity_admin'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_entity_access_org_role_check" CHECK (("org_role" = ANY (ARRAY['entity_admin'::"text", 'finance'::"text", 'property_manager'::"text", 'read_only'::"text", 'executive'::"text"])))
);


--
-- Name: user_entity_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_entity_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "favorites" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text",
    "role" "text" DEFAULT 'Asset Manager'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


--
-- Name: vacancies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vacancies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "lease_id" "uuid",
    "vacancy_date" "date" NOT NULL,
    "expected_release_date" "date",
    "reason" "text",
    "status" "public"."vacancy_status" DEFAULT 'active'::"public"."vacancy_status",
    "listing_url" "text",
    "brochure_url" "text",
    "marketing_status" "public"."marketing_status" DEFAULT 'not_started'::"public"."marketing_status",
    "enquiry_count" integer DEFAULT 0,
    "viewing_count" integer DEFAULT 0,
    "offer_count" integer DEFAULT 0,
    "days_vacant" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: vat_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vat_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "output_vat" numeric(15,2) DEFAULT 0,
    "input_vat" numeric(15,2) DEFAULT 0,
    "net_vat" numeric(15,2) DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "filed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: viewings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."viewings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "enquiry_id" "uuid" NOT NULL,
    "vacancy_id" "uuid" NOT NULL,
    "broker_id" "uuid",
    "viewing_date" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 30,
    "status" "public"."viewing_status" DEFAULT 'scheduled'::"public"."viewing_status",
    "attendee_names" "text"[],
    "attendee_count" integer DEFAULT 0,
    "outcome" "text",
    "feedback" "text",
    "follow_up_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


--
-- Name: work_order_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."work_order_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text",
    "note" "text",
    "changed_by" "uuid",
    "changed_by_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: work_order_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."work_order_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text",
    "note" "text",
    "changed_by" "uuid",
    "changed_by_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid",
    "property_id" "uuid",
    "unit_id" "uuid",
    "tenant_id" "uuid",
    "asset_id" "uuid",
    "inspection_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'reported'::"text",
    "assigned_to" "uuid",
    "assigned_at" timestamp with time zone,
    "scheduled_date" "date",
    "completed_at" timestamp with time zone,
    "estimated_cost" numeric,
    "actual_cost" numeric,
    "quoted_amount" numeric,
    "quotation_url" "text",
    "purchase_order_id" "uuid",
    "tenant_notes" "text",
    "supplier_notes" "text",
    "internal_notes" "text",
    "source" "text" DEFAULT 'tenant'::"text",
    "source_id" "uuid",
    "sla_response_at" timestamp with time zone,
    "sla_completed_at" timestamp with time zone,
    "sla_breached" boolean DEFAULT false,
    "tenant_rating" integer,
    "tenant_feedback" "text",
    "photos" "text"[],
    "attachments" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "issue_id" "uuid",
    "supplier_id" "uuid",
    "tenant_chargeable" boolean DEFAULT false,
    "tenant_charge_amount" numeric(12,2)
);


--
-- Name: workflow_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."workflow_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "workflow_type" "text" NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: worksheet_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."worksheet_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worksheet_id" "uuid",
    "charge_id" "uuid",
    "charge_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(14,2) DEFAULT 1,
    "unit_price" numeric(14,2) DEFAULT 0,
    "amount_excl_vat" numeric(14,2) DEFAULT 0,
    "vat_rate" numeric(5,2) DEFAULT 15,
    "vat_amount" numeric(14,2) DEFAULT 0,
    "amount_incl_vat" numeric(14,2) DEFAULT 0,
    "meter_number" "text",
    "consumption" numeric(14,2),
    "tariff_applied" "text",
    "import_source" "text",
    "captured_by" "text",
    "approval_required" boolean DEFAULT false,
    "approved" boolean DEFAULT false,
    "notes" "text",
    "gl_code" "text",
    "is_recoverable" boolean DEFAULT true
);


--
-- Name: accounting_config accounting_config_entity_id_business_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."accounting_config"
    ADD CONSTRAINT "accounting_config_entity_id_business_role_key" UNIQUE ("entity_id", "business_role");


--
-- Name: accounting_config accounting_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."accounting_config"
    ADD CONSTRAINT "accounting_config_pkey" PRIMARY KEY ("id");


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");


--
-- Name: adjustment_charges adjustment_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."adjustment_charges"
    ADD CONSTRAINT "adjustment_charges_pkey" PRIMARY KEY ("id");


--
-- Name: allocation_audit allocation_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."allocation_audit"
    ADD CONSTRAINT "allocation_audit_pkey" PRIMARY KEY ("id");


--
-- Name: ap_payment_preferences ap_payment_preferences_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ap_payment_preferences"
    ADD CONSTRAINT "ap_payment_preferences_entity_id_key" UNIQUE ("entity_id");


--
-- Name: ap_payment_preferences ap_payment_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ap_payment_preferences"
    ADD CONSTRAINT "ap_payment_preferences_pkey" PRIMARY KEY ("id");


--
-- Name: asset_timeline asset_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."asset_timeline"
    ADD CONSTRAINT "asset_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: asset_warranties asset_warranties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."asset_warranties"
    ADD CONSTRAINT "asset_warranties_pkey" PRIMARY KEY ("id");


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: automation_execution_log automation_execution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."automation_execution_log"
    ADD CONSTRAINT "automation_execution_log_pkey" PRIMARY KEY ("id");


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id");


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: bank_import_presets bank_import_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_import_presets"
    ADD CONSTRAINT "bank_import_presets_pkey" PRIMARY KEY ("id");


--
-- Name: bank_statements bank_statements_bank_account_id_statement_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_statements"
    ADD CONSTRAINT "bank_statements_bank_account_id_statement_date_key" UNIQUE ("bank_account_id", "statement_date");


--
-- Name: bank_statements bank_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_statements"
    ADD CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id");


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: beta_waitlist beta_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."beta_waitlist"
    ADD CONSTRAINT "beta_waitlist_pkey" PRIMARY KEY ("id");


--
-- Name: billing_adjustments billing_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_adjustments"
    ADD CONSTRAINT "billing_adjustments_pkey" PRIMARY KEY ("id");


--
-- Name: billing_codes billing_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_codes"
    ADD CONSTRAINT "billing_codes_code_key" UNIQUE ("code");


--
-- Name: billing_codes billing_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_codes"
    ADD CONSTRAINT "billing_codes_pkey" PRIMARY KEY ("id");


--
-- Name: billing_policies billing_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_policies"
    ADD CONSTRAINT "billing_policies_pkey" PRIMARY KEY ("id");


--
-- Name: billing_rules billing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_rules"
    ADD CONSTRAINT "billing_rules_pkey" PRIMARY KEY ("id");


--
-- Name: billing_snapshots billing_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_snapshots"
    ADD CONSTRAINT "billing_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: billing_worksheets billing_worksheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_worksheets"
    ADD CONSTRAINT "billing_worksheets_pkey" PRIMARY KEY ("id");


--
-- Name: broker_commissions broker_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_pkey" PRIMARY KEY ("id");


--
-- Name: broker_companies broker_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_companies"
    ADD CONSTRAINT "broker_companies_pkey" PRIMARY KEY ("id");


--
-- Name: broker_mandates broker_mandates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_mandates"
    ADD CONSTRAINT "broker_mandates_pkey" PRIMARY KEY ("id");


--
-- Name: brokers brokers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brokers"
    ADD CONSTRAINT "brokers_pkey" PRIMARY KEY ("id");


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");


--
-- Name: business_sequences business_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."business_sequences"
    ADD CONSTRAINT "business_sequences_pkey" PRIMARY KEY ("sequence_name");


--
-- Name: cash_book_entries cash_book_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cash_book_entries"
    ADD CONSTRAINT "cash_book_entries_pkey" PRIMARY KEY ("id");


--
-- Name: charges charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_pkey" PRIMARY KEY ("id");


--
-- Name: chart_of_accounts chart_of_accounts_entity_id_gl_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_entity_id_gl_code_key" UNIQUE ("entity_id", "gl_code");


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: entities clients_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "clients_client_id_key" UNIQUE ("entity_code");


--
-- Name: entities clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");


--
-- Name: communication_events communication_events_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_events"
    ADD CONSTRAINT "communication_events_event_type_key" UNIQUE ("event_type");


--
-- Name: communication_events communication_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_events"
    ADD CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id");


--
-- Name: communication_log communication_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_log"
    ADD CONSTRAINT "communication_log_pkey" PRIMARY KEY ("id");


--
-- Name: communication_logs communication_logs_log_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_log_id_key" UNIQUE ("log_id");


--
-- Name: communication_logs communication_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id");


--
-- Name: communication_preferences communication_preferences_entity_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_entity_id_tenant_id_key" UNIQUE ("entity_id", "tenant_id");


--
-- Name: communication_preferences communication_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_pkey" PRIMARY KEY ("id");


--
-- Name: communication_rules communication_rules_event_type_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_rules"
    ADD CONSTRAINT "communication_rules_event_type_channel_key" UNIQUE ("event_type", "channel");


--
-- Name: communication_rules communication_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_rules"
    ADD CONSTRAINT "communication_rules_pkey" PRIMARY KEY ("id");


--
-- Name: communication_templates communication_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_templates"
    ADD CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id");


--
-- Name: communication_templates communication_templates_template_key_channel_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_templates"
    ADD CONSTRAINT "communication_templates_template_key_channel_version_key" UNIQUE ("template_key", "channel", "version");


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communications"
    ADD CONSTRAINT "communications_pkey" PRIMARY KEY ("id");


--
-- Name: communications_queue communications_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communications_queue"
    ADD CONSTRAINT "communications_queue_pkey" PRIMARY KEY ("id");


--
-- Name: compliance_items compliance_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id");


--
-- Name: conversation_sessions conversation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: credit_note_lines credit_note_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."credit_note_lines"
    ADD CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id");


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");


--
-- Name: dead_letter_events dead_letter_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."dead_letter_events"
    ADD CONSTRAINT "dead_letter_events_pkey" PRIMARY KEY ("id");


--
-- Name: decision_registry decision_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."decision_registry"
    ADD CONSTRAINT "decision_registry_pkey" PRIMARY KEY ("id");


--
-- Name: deposit_register deposit_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."deposit_register"
    ADD CONSTRAINT "deposit_register_pkey" PRIMARY KEY ("id");


--
-- Name: deposit_transactions deposit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."deposit_transactions"
    ADD CONSTRAINT "deposit_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: document_classification_rules document_classification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_classification_rules"
    ADD CONSTRAINT "document_classification_rules_pkey" PRIMARY KEY ("id");


--
-- Name: document_extraction_rules document_extraction_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_extraction_rules"
    ADD CONSTRAINT "document_extraction_rules_pkey" PRIMARY KEY ("id");


--
-- Name: document_import_jobs document_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_import_jobs"
    ADD CONSTRAINT "document_import_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: document_lifecycle_events document_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_lifecycle_events"
    ADD CONSTRAINT "document_lifecycle_events_pkey" PRIMARY KEY ("id");


--
-- Name: document_relationships document_relationships_document_id_related_entity_type_rela_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_relationships"
    ADD CONSTRAINT "document_relationships_document_id_related_entity_type_rela_key" UNIQUE ("document_id", "related_entity_type", "related_entity_id");


--
-- Name: document_relationships document_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_relationships"
    ADD CONSTRAINT "document_relationships_pkey" PRIMARY KEY ("id");


--
-- Name: document_reviews document_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_reviews"
    ADD CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");


--
-- Name: enquiries enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id");


--
-- Name: entities entities_entity_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."entities"
    ADD CONSTRAINT "entities_entity_code_key" UNIQUE ("entity_code");


--
-- Name: execution_artifacts execution_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_artifacts"
    ADD CONSTRAINT "execution_artifacts_pkey" PRIMARY KEY ("id");


--
-- Name: execution_certificates execution_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_certificates"
    ADD CONSTRAINT "execution_certificates_pkey" PRIMARY KEY ("id");


--
-- Name: execution_checklists execution_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_checklists"
    ADD CONSTRAINT "execution_checklists_pkey" PRIMARY KEY ("id");


--
-- Name: execution_document_versions execution_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_document_versions"
    ADD CONSTRAINT "execution_document_versions_pkey" PRIMARY KEY ("id");


--
-- Name: execution_events execution_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_events"
    ADD CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id");


--
-- Name: execution_participants execution_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_participants"
    ADD CONSTRAINT "execution_participants_pkey" PRIMARY KEY ("id");


--
-- Name: execution_policies execution_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_policies"
    ADD CONSTRAINT "execution_policies_pkey" PRIMARY KEY ("id");


--
-- Name: executions executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."executions"
    ADD CONSTRAINT "executions_pkey" PRIMARY KEY ("id");


--
-- Name: expected_supplier_invoices expected_supplier_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expected_supplier_invoices"
    ADD CONSTRAINT "expected_supplier_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");


--
-- Name: feedback_items feedback_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."feedback_items"
    ADD CONSTRAINT "feedback_items_pkey" PRIMARY KEY ("id");


--
-- Name: financial_close_checklist financial_close_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_close_checklist"
    ADD CONSTRAINT "financial_close_checklist_pkey" PRIMARY KEY ("id");


--
-- Name: financial_controls financial_controls_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_controls"
    ADD CONSTRAINT "financial_controls_entity_id_key" UNIQUE ("entity_id");


--
-- Name: financial_controls financial_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_controls"
    ADD CONSTRAINT "financial_controls_pkey" PRIMARY KEY ("id");


--
-- Name: financial_expectations financial_expectations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_expectations"
    ADD CONSTRAINT "financial_expectations_pkey" PRIMARY KEY ("id");


--
-- Name: financial_integrity_log financial_integrity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_integrity_log"
    ADD CONSTRAINT "financial_integrity_log_pkey" PRIMARY KEY ("id");


--
-- Name: financial_periods financial_periods_period_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_periods"
    ADD CONSTRAINT "financial_periods_period_name_key" UNIQUE ("period_name");


--
-- Name: financial_periods financial_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_periods"
    ADD CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id");


--
-- Name: financial_statements financial_statements_entity_id_period_id_statement_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_statements"
    ADD CONSTRAINT "financial_statements_entity_id_period_id_statement_type_key" UNIQUE ("entity_id", "period_id", "statement_type");


--
-- Name: financial_statements financial_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_statements"
    ADD CONSTRAINT "financial_statements_pkey" PRIMARY KEY ("id");


--
-- Name: financial_timeline financial_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_timeline"
    ADD CONSTRAINT "financial_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: financials financials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financials"
    ADD CONSTRAINT "financials_pkey" PRIMARY KEY ("id");


--
-- Name: forecasts forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."forecasts"
    ADD CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id");


--
-- Name: general_ledger general_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_pkey" PRIMARY KEY ("id");


--
-- Name: gl_allocation_learning gl_allocation_learning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gl_allocation_learning"
    ADD CONSTRAINT "gl_allocation_learning_pkey" PRIMARY KEY ("id");


--
-- Name: gl_codes gl_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gl_codes"
    ADD CONSTRAINT "gl_codes_code_key" UNIQUE ("code");


--
-- Name: gl_codes gl_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."gl_codes"
    ADD CONSTRAINT "gl_codes_pkey" PRIMARY KEY ("id");


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_pkey" PRIMARY KEY ("id");


--
-- Name: intelligence_signals intelligence_signals_fingerprint; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."intelligence_signals"
    ADD CONSTRAINT "intelligence_signals_fingerprint" UNIQUE ("domain", "source_event", "affected_entity_id", "category");


--
-- Name: intelligence_signals intelligence_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."intelligence_signals"
    ADD CONSTRAINT "intelligence_signals_pkey" PRIMARY KEY ("id");


--
-- Name: interest_charges interest_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."interest_charges"
    ADD CONSTRAINT "interest_charges_pkey" PRIMARY KEY ("id");


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");


--
-- Name: invoice_configs invoice_configs_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_configs"
    ADD CONSTRAINT "invoice_configs_entity_id_key" UNIQUE ("entity_id");


--
-- Name: invoice_configs invoice_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_configs"
    ADD CONSTRAINT "invoice_configs_pkey" PRIMARY KEY ("id");


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id");


--
-- Name: invoice_versions invoice_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_versions"
    ADD CONSTRAINT "invoice_versions_pkey" PRIMARY KEY ("id");


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id");


--
-- Name: journals journals_journal_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."journals"
    ADD CONSTRAINT "journals_journal_number_key" UNIQUE ("journal_number");


--
-- Name: journals journals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."journals"
    ADD CONSTRAINT "journals_pkey" PRIMARY KEY ("id");


--
-- Name: kpi_snapshots kpi_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."kpi_snapshots"
    ADD CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: late_fee_charges late_fee_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."late_fee_charges"
    ADD CONSTRAINT "late_fee_charges_pkey" PRIMARY KEY ("id");


--
-- Name: lease_documents lease_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_documents"
    ADD CONSTRAINT "lease_documents_pkey" PRIMARY KEY ("id");


--
-- Name: lease_intake lease_intake_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_pkey" PRIMARY KEY ("id");


--
-- Name: lease_intake_versions lease_intake_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake_versions"
    ADD CONSTRAINT "lease_intake_versions_pkey" PRIMARY KEY ("id");


--
-- Name: lease_template_families lease_template_families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_template_families"
    ADD CONSTRAINT "lease_template_families_pkey" PRIMARY KEY ("id");


--
-- Name: lease_templates lease_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_templates"
    ADD CONSTRAINT "lease_templates_pkey" PRIMARY KEY ("id");


--
-- Name: lease_timeline lease_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_timeline"
    ADD CONSTRAINT "lease_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: leases leases_lease_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_lease_id_key" UNIQUE ("lease_id");


--
-- Name: leases leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_pkey" PRIMARY KEY ("id");


--
-- Name: leasing_opportunities leasing_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leasing_opportunities"
    ADD CONSTRAINT "leasing_opportunities_pkey" PRIMARY KEY ("id");


--
-- Name: leasing_opportunity_versions leasing_opportunity_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leasing_opportunity_versions"
    ADD CONSTRAINT "leasing_opportunity_versions_pkey" PRIMARY KEY ("id");


--
-- Name: lod_queue lod_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lod_queue"
    ADD CONSTRAINT "lod_queue_pkey" PRIMARY KEY ("id");


--
-- Name: lod_templates lod_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lod_templates"
    ADD CONSTRAINT "lod_templates_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_approval_rules maintenance_approval_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_approval_rules"
    ADD CONSTRAINT "maintenance_approval_rules_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_budgets maintenance_budgets_entity_id_property_id_year_month_catego_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_budgets"
    ADD CONSTRAINT "maintenance_budgets_entity_id_property_id_year_month_catego_key" UNIQUE ("entity_id", "property_id", "year", "month", "category");


--
-- Name: maintenance_budgets maintenance_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_budgets"
    ADD CONSTRAINT "maintenance_budgets_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_decisions maintenance_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_decisions"
    ADD CONSTRAINT "maintenance_decisions_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_issues maintenance_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_issues"
    ADD CONSTRAINT "maintenance_issues_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_journal maintenance_journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_journal"
    ADD CONSTRAINT "maintenance_journal_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_purchase_orders maintenance_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_purchase_orders"
    ADD CONSTRAINT "maintenance_purchase_orders_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_quotes maintenance_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_quotes"
    ADD CONSTRAINT "maintenance_quotes_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_schedules maintenance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_schedules"
    ADD CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_slas maintenance_slas_entity_id_priority_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_slas"
    ADD CONSTRAINT "maintenance_slas_entity_id_priority_key" UNIQUE ("entity_id", "priority");


--
-- Name: maintenance_slas maintenance_slas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_slas"
    ADD CONSTRAINT "maintenance_slas_pkey" PRIMARY KEY ("id");


--
-- Name: manual_charges manual_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."manual_charges"
    ADD CONSTRAINT "manual_charges_pkey" PRIMARY KEY ("id");


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id");


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");


--
-- Name: notification_preferences notification_preferences_user_id_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_entity_id_key" UNIQUE ("user_id", "entity_id");


--
-- Name: notifications_log notifications_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications_log"
    ADD CONSTRAINT "notifications_log_pkey" PRIMARY KEY ("id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");


--
-- Name: operational_policies operational_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."operational_policies"
    ADD CONSTRAINT "operational_policies_pkey" PRIMARY KEY ("id");


--
-- Name: organisations organisations_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organisations"
    ADD CONSTRAINT "organisations_entity_id_key" UNIQUE ("entity_id");


--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."organisations"
    ADD CONSTRAINT "organisations_pkey" PRIMARY KEY ("id");


--
-- Name: password_policies password_policies_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."password_policies"
    ADD CONSTRAINT "password_policies_entity_id_key" UNIQUE ("entity_id");


--
-- Name: password_policies password_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."password_policies"
    ADD CONSTRAINT "password_policies_pkey" PRIMARY KEY ("id");


--
-- Name: payment_batches payment_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_batches"
    ADD CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id");


--
-- Name: payment_commitments payment_commitments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_commitments"
    ADD CONSTRAINT "payment_commitments_pkey" PRIMARY KEY ("id");


--
-- Name: payment_policies payment_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_policies"
    ADD CONSTRAINT "payment_policies_pkey" PRIMARY KEY ("id");


--
-- Name: payment_requests payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id");


--
-- Name: payment_terms payment_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_terms"
    ADD CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id");


--
-- Name: payment_terms payment_terms_term_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_terms"
    ADD CONSTRAINT "payment_terms_term_name_key" UNIQUE ("term_name");


--
-- Name: permission_catalogue permission_catalogue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."permission_catalogue"
    ADD CONSTRAINT "permission_catalogue_pkey" PRIMARY KEY ("key");


--
-- Name: permissions permissions_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_permission_key_key" UNIQUE ("permission_key");


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");


--
-- Name: platform_policies platform_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_policies"
    ADD CONSTRAINT "platform_policies_pkey" PRIMARY KEY ("id");


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");


--
-- Name: portfolio_aggregation_log portfolio_aggregation_log_event_type_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_aggregation_log"
    ADD CONSTRAINT "portfolio_aggregation_log_event_type_event_id_key" UNIQUE ("event_type", "event_id");


--
-- Name: portfolio_aggregation_log portfolio_aggregation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_aggregation_log"
    ADD CONSTRAINT "portfolio_aggregation_log_pkey" PRIMARY KEY ("id");


--
-- Name: portfolio_read_model portfolio_read_model_entity_id_model_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_read_model"
    ADD CONSTRAINT "portfolio_read_model_entity_id_model_type_key" UNIQUE ("entity_id", "model_type");


--
-- Name: portfolio_read_model portfolio_read_model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_read_model"
    ADD CONSTRAINT "portfolio_read_model_pkey" PRIMARY KEY ("id");


--
-- Name: portfolio_snapshots portfolio_snapshots_entity_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_snapshots"
    ADD CONSTRAINT "portfolio_snapshots_entity_id_snapshot_date_key" UNIQUE ("entity_id", "snapshot_date");


--
-- Name: portfolio_snapshots portfolio_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."portfolio_snapshots"
    ADD CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: posting_rules posting_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."posting_rules"
    ADD CONSTRAINT "posting_rules_pkey" PRIMARY KEY ("id");


--
-- Name: posting_template_lines posting_template_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."posting_template_lines"
    ADD CONSTRAINT "posting_template_lines_pkey" PRIMARY KEY ("id");


--
-- Name: posting_templates posting_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."posting_templates"
    ADD CONSTRAINT "posting_templates_pkey" PRIMARY KEY ("id");


--
-- Name: processed_commands processed_commands_correlation_id_command_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."processed_commands"
    ADD CONSTRAINT "processed_commands_correlation_id_command_key" UNIQUE ("correlation_id", "command");


--
-- Name: processed_commands processed_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."processed_commands"
    ADD CONSTRAINT "processed_commands_pkey" PRIMARY KEY ("id");


--
-- Name: procurement_goods_receipts procurement_goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_goods_receipts"
    ADD CONSTRAINT "procurement_goods_receipts_pkey" PRIMARY KEY ("id");


--
-- Name: procurement_purchase_orders procurement_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_purchase_orders"
    ADD CONSTRAINT "procurement_purchase_orders_pkey" PRIMARY KEY ("id");


--
-- Name: procurement_quotes procurement_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_quotes"
    ADD CONSTRAINT "procurement_quotes_pkey" PRIMARY KEY ("id");


--
-- Name: procurement_rfqs procurement_rfqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_rfqs"
    ADD CONSTRAINT "procurement_rfqs_pkey" PRIMARY KEY ("id");


--
-- Name: procurement_spend_requests procurement_spend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_spend_requests"
    ADD CONSTRAINT "procurement_spend_requests_pkey" PRIMARY KEY ("id");


--
-- Name: procurement_supplier_invoices procurement_supplier_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_supplier_invoices"
    ADD CONSTRAINT "procurement_supplier_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: product_events product_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_events"
    ADD CONSTRAINT "product_events_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");


--
-- Name: properties properties_property_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_property_code_key" UNIQUE ("property_code");


--
-- Name: property_assets property_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_assets"
    ADD CONSTRAINT "property_assets_pkey" PRIMARY KEY ("id");


--
-- Name: property_timeline property_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_timeline"
    ADD CONSTRAINT "property_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: property_types property_types_entity_id_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_types"
    ADD CONSTRAINT "property_types_entity_id_type_name_key" UNIQUE ("entity_id", "type_name");


--
-- Name: property_types property_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_types"
    ADD CONSTRAINT "property_types_pkey" PRIMARY KEY ("id");


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");


--
-- Name: rates_recovery_allocations rates_recovery_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_allocations"
    ADD CONSTRAINT "rates_recovery_allocations_pkey" PRIMARY KEY ("id");


--
-- Name: rates_recovery_document_links rates_recovery_document_links_allocation_id_document_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_document_links"
    ADD CONSTRAINT "rates_recovery_document_links_allocation_id_document_id_key" UNIQUE ("allocation_id", "document_id");


--
-- Name: rates_recovery_document_links rates_recovery_document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_document_links"
    ADD CONSTRAINT "rates_recovery_document_links_pkey" PRIMARY KEY ("id");


--
-- Name: rates_recovery_document_snippets rates_recovery_document_snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_document_snippets"
    ADD CONSTRAINT "rates_recovery_document_snippets_pkey" PRIMARY KEY ("id");


--
-- Name: rates_recovery_documents rates_recovery_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_documents"
    ADD CONSTRAINT "rates_recovery_documents_pkey" PRIMARY KEY ("id");


--
-- Name: rates_recovery_runs rates_recovery_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_runs"
    ADD CONSTRAINT "rates_recovery_runs_pkey" PRIMARY KEY ("id");


--
-- Name: recoveries recoveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recoveries"
    ADD CONSTRAINT "recoveries_pkey" PRIMARY KEY ("id");


--
-- Name: recoveries recoveries_recovery_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recoveries"
    ADD CONSTRAINT "recoveries_recovery_reference_key" UNIQUE ("recovery_reference");


--
-- Name: recurring_expenses recurring_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id");


--
-- Name: report_audit_log report_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."report_audit_log"
    ADD CONSTRAINT "report_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: activity_feed revenue_activity_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "revenue_activity_feed_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_assurance_scores revenue_assurance_scores_lease_id_calculated_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_assurance_scores"
    ADD CONSTRAINT "revenue_assurance_scores_lease_id_calculated_at_key" UNIQUE ("lease_id", "calculated_at");


--
-- Name: revenue_assurance_scores revenue_assurance_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_assurance_scores"
    ADD CONSTRAINT "revenue_assurance_scores_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_decisions revenue_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_decisions"
    ADD CONSTRAINT "revenue_decisions_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_digital_twins revenue_digital_twins_lease_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_digital_twins"
    ADD CONSTRAINT "revenue_digital_twins_lease_id_key" UNIQUE ("lease_id");


--
-- Name: revenue_digital_twins revenue_digital_twins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_digital_twins"
    ADD CONSTRAINT "revenue_digital_twins_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_interventions revenue_interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_interventions"
    ADD CONSTRAINT "revenue_interventions_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_outlooks revenue_outlooks_entity_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_outlooks"
    ADD CONSTRAINT "revenue_outlooks_entity_id_snapshot_date_key" UNIQUE ("entity_id", "snapshot_date");


--
-- Name: revenue_outlooks revenue_outlooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_outlooks"
    ADD CONSTRAINT "revenue_outlooks_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_playbooks revenue_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_playbooks"
    ADD CONSTRAINT "revenue_playbooks_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_policies revenue_policies_entity_id_policy_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_policies"
    ADD CONSTRAINT "revenue_policies_entity_id_policy_type_key" UNIQUE ("entity_id", "policy_type");


--
-- Name: revenue_policies revenue_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_policies"
    ADD CONSTRAINT "revenue_policies_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_signal_categories revenue_signal_categories_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_signal_categories"
    ADD CONSTRAINT "revenue_signal_categories_category_key" UNIQUE ("category");


--
-- Name: revenue_signal_categories revenue_signal_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_signal_categories"
    ADD CONSTRAINT "revenue_signal_categories_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_states revenue_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_states"
    ADD CONSTRAINT "revenue_states_pkey" PRIMARY KEY ("id");


--
-- Name: revenue_strategies revenue_strategies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_strategies"
    ADD CONSTRAINT "revenue_strategies_pkey" PRIMARY KEY ("id");


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");


--
-- Name: search_activity search_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_activity"
    ADD CONSTRAINT "search_activity_pkey" PRIMARY KEY ("id");


--
-- Name: service_contracts service_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_contracts"
    ADD CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id");


--
-- Name: signature_requests signature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signature_requests"
    ADD CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id");


--
-- Name: signature_sessions signature_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signature_sessions"
    ADD CONSTRAINT "signature_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: signing_events signing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signing_events"
    ADD CONSTRAINT "signing_events_pkey" PRIMARY KEY ("id");


--
-- Name: signing_templates signing_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signing_templates"
    ADD CONSTRAINT "signing_templates_pkey" PRIMARY KEY ("id");


--
-- Name: statement_configs statement_configs_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statement_configs"
    ADD CONSTRAINT "statement_configs_entity_id_key" UNIQUE ("entity_id");


--
-- Name: statement_configs statement_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statement_configs"
    ADD CONSTRAINT "statement_configs_pkey" PRIMARY KEY ("id");


--
-- Name: statement_overrides statement_overrides_entity_id_tenant_id_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statement_overrides"
    ADD CONSTRAINT "statement_overrides_entity_id_tenant_id_setting_key_key" UNIQUE ("entity_id", "tenant_id", "setting_key");


--
-- Name: statement_overrides statement_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statement_overrides"
    ADD CONSTRAINT "statement_overrides_pkey" PRIMARY KEY ("id");


--
-- Name: statement_periods statement_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statement_periods"
    ADD CONSTRAINT "statement_periods_pkey" PRIMARY KEY ("id");


--
-- Name: statements_generated statements_generated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statements_generated"
    ADD CONSTRAINT "statements_generated_pkey" PRIMARY KEY ("id");


--
-- Name: sub_ledger_entries sub_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sub_ledger_entries"
    ADD CONSTRAINT "sub_ledger_entries_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_accounts supplier_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_accounts supplier_accounts_supplier_id_property_id_account_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_supplier_id_property_id_account_number_key" UNIQUE ("supplier_id", "property_id", "account_number");


--
-- Name: supplier_conflicts supplier_conflicts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_conflicts"
    ADD CONSTRAINT "supplier_conflicts_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_credit_notes supplier_credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_credit_notes"
    ADD CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_invoice_lines supplier_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_invoice_lines"
    ADD CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_invoices_new supplier_invoices_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_invoices_new"
    ADD CONSTRAINT "supplier_invoices_new_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_invoices supplier_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_matching_profiles supplier_matching_profiles_entity_id_priority_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_matching_profiles"
    ADD CONSTRAINT "supplier_matching_profiles_entity_id_priority_key" UNIQUE ("entity_id", "priority");


--
-- Name: supplier_matching_profiles supplier_matching_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_matching_profiles"
    ADD CONSTRAINT "supplier_matching_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_scores supplier_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_scores"
    ADD CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_statement_lines supplier_statement_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_statement_lines"
    ADD CONSTRAINT "supplier_statement_lines_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_statements supplier_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_statements"
    ADD CONSTRAINT "supplier_statements_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_visits supplier_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_visits"
    ADD CONSTRAINT "supplier_visits_pkey" PRIMARY KEY ("id");


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");


--
-- Name: task_audit_log task_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."task_audit_log"
    ADD CONSTRAINT "task_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");


--
-- Name: tasks tasks_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_task_id_key" UNIQUE ("task_id");


--
-- Name: tax_config tax_config_entity_id_tax_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tax_config"
    ADD CONSTRAINT "tax_config_entity_id_tax_code_key" UNIQUE ("entity_id", "tax_code");


--
-- Name: tax_config tax_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tax_config"
    ADD CONSTRAINT "tax_config_pkey" PRIMARY KEY ("id");


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_communication_prefs tenant_communication_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_communication_prefs"
    ADD CONSTRAINT "tenant_communication_prefs_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_communication_prefs tenant_communication_prefs_tenant_id_event_type_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_communication_prefs"
    ADD CONSTRAINT "tenant_communication_prefs_tenant_id_event_type_channel_key" UNIQUE ("tenant_id", "event_type", "channel");


--
-- Name: tenant_contacts tenant_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_contacts"
    ADD CONSTRAINT "tenant_contacts_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_notes tenant_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_notes"
    ADD CONSTRAINT "tenant_notes_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_notes tenant_notes_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_notes"
    ADD CONSTRAINT "tenant_notes_tenant_id_key" UNIQUE ("tenant_id");


--
-- Name: tenant_revenue_dna tenant_revenue_dna_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_revenue_dna"
    ADD CONSTRAINT "tenant_revenue_dna_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_revenue_dna tenant_revenue_dna_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_revenue_dna"
    ADD CONSTRAINT "tenant_revenue_dna_tenant_id_key" UNIQUE ("tenant_id");


--
-- Name: commercial_behaviour_profile tenant_revenue_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."commercial_behaviour_profile"
    ADD CONSTRAINT "tenant_revenue_profile_pkey" PRIMARY KEY ("id");


--
-- Name: commercial_behaviour_profile tenant_revenue_profile_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."commercial_behaviour_profile"
    ADD CONSTRAINT "tenant_revenue_profile_tenant_id_key" UNIQUE ("tenant_id");


--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_code_key" UNIQUE ("code");


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");


--
-- Name: transaction_allocations transaction_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transaction_allocations"
    ADD CONSTRAINT "transaction_allocations_pkey" PRIMARY KEY ("id");


--
-- Name: treasury_obligations treasury_obligations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."treasury_obligations"
    ADD CONSTRAINT "treasury_obligations_pkey" PRIMARY KEY ("id");


--
-- Name: trial_balances trial_balances_entity_id_period_id_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."trial_balances"
    ADD CONSTRAINT "trial_balances_entity_id_period_id_account_id_key" UNIQUE ("entity_id", "period_id", "account_id");


--
-- Name: trial_balances trial_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."trial_balances"
    ADD CONSTRAINT "trial_balances_pkey" PRIMARY KEY ("id");


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");


--
-- Name: units units_unit_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_unit_code_key" UNIQUE ("unit_code");


--
-- Name: user_entities user_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entities"
    ADD CONSTRAINT "user_entities_pkey" PRIMARY KEY ("id");


--
-- Name: user_entities user_entities_user_id_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entities"
    ADD CONSTRAINT "user_entities_user_id_entity_id_key" UNIQUE ("user_id", "entity_id");


--
-- Name: user_entity_access user_entity_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entity_access"
    ADD CONSTRAINT "user_entity_access_pkey" PRIMARY KEY ("id");


--
-- Name: user_entity_access user_entity_access_user_id_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entity_access"
    ADD CONSTRAINT "user_entity_access_user_id_entity_id_key" UNIQUE ("user_id", "entity_id");


--
-- Name: user_entity_permissions user_entity_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entity_permissions"
    ADD CONSTRAINT "user_entity_permissions_pkey" PRIMARY KEY ("id");


--
-- Name: user_entity_permissions user_entity_permissions_user_id_entity_id_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entity_permissions"
    ADD CONSTRAINT "user_entity_permissions_user_id_entity_id_permission_key_key" UNIQUE ("user_id", "entity_id", "permission_key");


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_email_key" UNIQUE ("user_email");


--
-- Name: vacancies vacancies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id");


--
-- Name: vat_returns vat_returns_entity_id_period_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vat_returns"
    ADD CONSTRAINT "vat_returns_entity_id_period_id_key" UNIQUE ("entity_id", "period_id");


--
-- Name: vat_returns vat_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vat_returns"
    ADD CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id");


--
-- Name: viewings viewings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."viewings"
    ADD CONSTRAINT "viewings_pkey" PRIMARY KEY ("id");


--
-- Name: work_order_events work_order_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_order_events"
    ADD CONSTRAINT "work_order_events_pkey" PRIMARY KEY ("id");


--
-- Name: work_order_timeline work_order_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_order_timeline"
    ADD CONSTRAINT "work_order_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");


--
-- Name: workflow_states workflow_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."workflow_states"
    ADD CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id");


--
-- Name: worksheet_items worksheet_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worksheet_items"
    ADD CONSTRAINT "worksheet_items_pkey" PRIMARY KEY ("id");


--
-- Name: idx_accounting_config_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_accounting_config_account" ON "public"."accounting_config" USING "btree" ("account_id");


--
-- Name: idx_accounting_config_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_accounting_config_entity" ON "public"."accounting_config" USING "btree" ("entity_id");


--
-- Name: idx_accounting_config_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_accounting_config_role" ON "public"."accounting_config" USING "btree" ("entity_id", "business_role");


--
-- Name: idx_adjustment_charges_adjustment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_adjustment_charges_adjustment" ON "public"."adjustment_charges" USING "btree" ("adjustment_id");


--
-- Name: idx_adjustment_charges_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_adjustment_charges_entity" ON "public"."adjustment_charges" USING "btree" ("entity_id");


--
-- Name: idx_asset_timeline_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_asset_timeline_asset_id" ON "public"."asset_timeline" USING "btree" ("asset_id");


--
-- Name: idx_asset_timeline_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_asset_timeline_created_at" ON "public"."asset_timeline" USING "btree" ("created_at");


--
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assets_category" ON "public"."property_assets" USING "btree" ("category");


--
-- Name: idx_assets_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assets_property" ON "public"."property_assets" USING "btree" ("property_id");


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_action" ON "public"."audit_log" USING "btree" ("action");


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_created" ON "public"."audit_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_audit_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_resource" ON "public"."audit_log" USING "btree" ("resource_type", "resource_id");


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_audit_user" ON "public"."audit_log" USING "btree" ("user_id");


--
-- Name: idx_automation_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_log_entity" ON "public"."automation_execution_log" USING "btree" ("entity_id");


--
-- Name: idx_automation_log_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_log_rule" ON "public"."automation_execution_log" USING "btree" ("rule_id");


--
-- Name: idx_automation_log_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_log_started" ON "public"."automation_execution_log" USING "btree" ("started_at" DESC);


--
-- Name: idx_automation_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_log_status" ON "public"."automation_execution_log" USING "btree" ("status");


--
-- Name: idx_automation_rules_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_rules_entity" ON "public"."automation_rules" USING "btree" ("entity_id");


--
-- Name: idx_automation_rules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_rules_status" ON "public"."automation_rules" USING "btree" ("status");


--
-- Name: idx_automation_rules_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_automation_rules_trigger" ON "public"."automation_rules" USING "btree" ("trigger");


--
-- Name: idx_bank_statements_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_bank_statements_account" ON "public"."bank_statements" USING "btree" ("bank_account_id");


--
-- Name: idx_billing_adjustments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_billing_adjustments_entity" ON "public"."billing_adjustments" USING "btree" ("entity_id");


--
-- Name: idx_billing_adjustments_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_billing_adjustments_idempotency" ON "public"."billing_adjustments" USING "btree" ("original_charge_id", "billing_rule_id", "effective_from", "new_amount") WHERE ("billing_rule_id" IS NOT NULL);


--
-- Name: idx_billing_adjustments_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_billing_adjustments_lease" ON "public"."billing_adjustments" USING "btree" ("lease_id");


--
-- Name: idx_billing_adjustments_original; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_billing_adjustments_original" ON "public"."billing_adjustments" USING "btree" ("original_charge_id");


--
-- Name: idx_billing_adjustments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_billing_adjustments_status" ON "public"."billing_adjustments" USING "btree" ("status");


--
-- Name: idx_billing_adjustments_tax_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_billing_adjustments_tax_code" ON "public"."billing_adjustments" USING "btree" ("entity_id", "tax_code");


--
-- Name: idx_broker_commissions_broker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_broker_commissions_broker_id" ON "public"."broker_commissions" USING "btree" ("broker_id");


--
-- Name: idx_broker_commissions_lease_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_broker_commissions_lease_id" ON "public"."broker_commissions" USING "btree" ("lease_id");


--
-- Name: idx_broker_companies_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_broker_companies_entity_id" ON "public"."broker_companies" USING "btree" ("entity_id");


--
-- Name: idx_broker_mandates_broker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_broker_mandates_broker_id" ON "public"."broker_mandates" USING "btree" ("broker_id");


--
-- Name: idx_broker_mandates_vacancy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_broker_mandates_vacancy_id" ON "public"."broker_mandates" USING "btree" ("vacancy_id");


--
-- Name: idx_brokers_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_brokers_company_id" ON "public"."brokers" USING "btree" ("company_id");


--
-- Name: idx_brokers_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_brokers_entity_id" ON "public"."brokers" USING "btree" ("entity_id");


--
-- Name: idx_budgets_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_budgets_entity" ON "public"."budgets" USING "btree" ("entity_id");


--
-- Name: idx_budgets_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_budgets_period" ON "public"."budgets" USING "btree" ("period_id");


--
-- Name: idx_cash_book_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_book_date" ON "public"."cash_book_entries" USING "btree" ("transaction_date");


--
-- Name: idx_cash_book_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_book_entity" ON "public"."cash_book_entries" USING "btree" ("entity_id");


--
-- Name: idx_cash_book_reconciled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_book_reconciled" ON "public"."cash_book_entries" USING "btree" ("reconciled");


--
-- Name: idx_cash_book_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_book_type" ON "public"."cash_book_entries" USING "btree" ("type");


--
-- Name: idx_charges_billing_rule_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_charges_billing_rule_period" ON "public"."charges" USING "btree" ("billing_rule_id", "billing_period");


--
-- Name: idx_charges_no_duplicate; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_charges_no_duplicate" ON "public"."charges" USING "btree" ("lease_id", "billing_period", "charge_type", "amount_excl_vat", "description") WHERE ("is_active" = true);


--
-- Name: idx_class_rules_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_class_rules_entity" ON "public"."document_classification_rules" USING "btree" ("entity_id");


--
-- Name: idx_close_checklist_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_close_checklist_entity" ON "public"."financial_close_checklist" USING "btree" ("entity_id");


--
-- Name: idx_close_checklist_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_close_checklist_period" ON "public"."financial_close_checklist" USING "btree" ("period_id");


--
-- Name: idx_cn_lines_cn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cn_lines_cn" ON "public"."credit_note_lines" USING "btree" ("credit_note_id");


--
-- Name: idx_coa_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coa_entity" ON "public"."chart_of_accounts" USING "btree" ("entity_id");


--
-- Name: idx_coa_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_coa_type" ON "public"."chart_of_accounts" USING "btree" ("account_type");


--
-- Name: idx_comm_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_log_created" ON "public"."communication_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_comm_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_log_entity" ON "public"."communication_log" USING "btree" ("entity_id");


--
-- Name: idx_comm_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_log_tenant" ON "public"."communication_log" USING "btree" ("tenant_id");


--
-- Name: idx_comm_queue_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_queue_scheduled" ON "public"."communications_queue" USING "btree" ("scheduled_for");


--
-- Name: idx_comm_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_queue_status" ON "public"."communications_queue" USING "btree" ("status");


--
-- Name: idx_comm_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_templates_active" ON "public"."communication_templates" USING "btree" ("is_active");


--
-- Name: idx_comm_templates_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_templates_channel" ON "public"."communication_templates" USING "btree" ("channel");


--
-- Name: idx_comm_templates_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_comm_templates_key" ON "public"."communication_templates" USING "btree" ("template_key");


--
-- Name: idx_communications_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_communications_channel" ON "public"."communications" USING "btree" ("channel");


--
-- Name: idx_communications_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_communications_event" ON "public"."communications" USING "btree" ("event_type");


--
-- Name: idx_communications_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_communications_sent" ON "public"."communications" USING "btree" ("sent_at" DESC);


--
-- Name: idx_communications_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_communications_source" ON "public"."communications" USING "btree" ("source_type", "source_id");


--
-- Name: idx_communications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_communications_status" ON "public"."communications" USING "btree" ("status");


--
-- Name: idx_communications_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_communications_tenant" ON "public"."communications" USING "btree" ("tenant_id");


--
-- Name: idx_credit_notes_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_credit_notes_entity" ON "public"."credit_notes" USING "btree" ("entity_id");


--
-- Name: idx_credit_notes_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_credit_notes_invoice" ON "public"."credit_notes" USING "btree" ("invoice_id");


--
-- Name: idx_credit_notes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_credit_notes_tenant" ON "public"."credit_notes" USING "btree" ("tenant_id");


--
-- Name: idx_decision_registry_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_decision_registry_lease" ON "public"."decision_registry" USING "btree" ("lease_id");


--
-- Name: idx_deposit_txn_deposit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_deposit_txn_deposit" ON "public"."deposit_transactions" USING "btree" ("deposit_id");


--
-- Name: idx_deposits_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_deposits_entity" ON "public"."deposit_register" USING "btree" ("entity_id");


--
-- Name: idx_deposits_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_deposits_lease" ON "public"."deposit_register" USING "btree" ("lease_id");


--
-- Name: idx_deposits_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_deposits_tenant" ON "public"."deposit_register" USING "btree" ("tenant_id");


--
-- Name: idx_doc_lifecycle_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_lifecycle_document" ON "public"."document_lifecycle_events" USING "btree" ("document_id");


--
-- Name: idx_doc_lifecycle_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_lifecycle_entity" ON "public"."document_lifecycle_events" USING "btree" ("entity_id");


--
-- Name: idx_doc_lifecycle_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_lifecycle_stage" ON "public"."document_lifecycle_events" USING "btree" ("stage");


--
-- Name: idx_doc_rel_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_rel_document" ON "public"."document_relationships" USING "btree" ("document_id");


--
-- Name: idx_doc_rel_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_rel_entity" ON "public"."document_relationships" USING "btree" ("related_entity_type", "related_entity_id");


--
-- Name: idx_doc_rules_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_rules_entity" ON "public"."document_extraction_rules" USING "btree" ("entity_id");


--
-- Name: idx_doc_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_doc_rules_type" ON "public"."document_extraction_rules" USING "btree" ("document_type");


--
-- Name: idx_document_reviews_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_document_reviews_document" ON "public"."document_reviews" USING "btree" ("document_id");


--
-- Name: idx_document_reviews_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_document_reviews_document_unique" ON "public"."document_reviews" USING "btree" ("document_id");


--
-- Name: idx_document_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_document_reviews_status" ON "public"."document_reviews" USING "btree" ("status");


--
-- Name: idx_documents_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_documents_created" ON "public"."documents" USING "btree" ("created_at" DESC);


--
-- Name: idx_documents_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_documents_entity" ON "public"."documents" USING "btree" ("entity_id");


--
-- Name: idx_documents_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_documents_parent" ON "public"."documents" USING "btree" ("parent_document_id");


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_documents_status" ON "public"."documents" USING "btree" ("status");


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_documents_type" ON "public"."documents" USING "btree" ("document_type");


--
-- Name: idx_documents_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_documents_version" ON "public"."documents" USING "btree" ("parent_document_id", "version_number");


--
-- Name: idx_enquiries_broker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_enquiries_broker_id" ON "public"."enquiries" USING "btree" ("broker_id");


--
-- Name: idx_enquiries_vacancy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_enquiries_vacancy_id" ON "public"."enquiries" USING "btree" ("vacancy_id");


--
-- Name: idx_execution_artifacts_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_artifacts_entity" ON "public"."execution_artifacts" USING "btree" ("entity_id");


--
-- Name: idx_execution_checklists_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_checklists_execution_id" ON "public"."execution_checklists" USING "btree" ("execution_id");


--
-- Name: idx_execution_document_versions_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_document_versions_execution_id" ON "public"."execution_document_versions" USING "btree" ("execution_id");


--
-- Name: idx_execution_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_events_created_at" ON "public"."execution_events" USING "btree" ("created_at");


--
-- Name: idx_execution_events_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_events_execution_id" ON "public"."execution_events" USING "btree" ("execution_id");


--
-- Name: idx_execution_participants_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_participants_execution_id" ON "public"."execution_participants" USING "btree" ("execution_id");


--
-- Name: idx_execution_participants_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_participants_status" ON "public"."execution_participants" USING "btree" ("status");


--
-- Name: idx_execution_policies_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_policies_entity" ON "public"."execution_policies" USING "btree" ("entity_id");


--
-- Name: idx_execution_policies_portfolio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_execution_policies_portfolio" ON "public"."execution_policies" USING "btree" ("portfolio_id");


--
-- Name: idx_executions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_executions_created_at" ON "public"."executions" USING "btree" ("created_at");


--
-- Name: idx_executions_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_executions_deleted_at" ON "public"."executions" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);


--
-- Name: idx_executions_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_executions_sla" ON "public"."executions" USING "btree" ("sent_at", "sla_days") WHERE ("status" <> ALL (ARRAY['executed'::"text", 'activated'::"text", 'cancelled'::"text"]));


--
-- Name: idx_executions_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_executions_source" ON "public"."executions" USING "btree" ("source_type", "source_id");


--
-- Name: idx_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_executions_status" ON "public"."executions" USING "btree" ("status");


--
-- Name: idx_expectations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_expectations_entity" ON "public"."financial_expectations" USING "btree" ("entity_id");


--
-- Name: idx_expectations_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_expectations_period" ON "public"."financial_expectations" USING "btree" ("period_id");


--
-- Name: idx_feature_flags_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_feature_flags_entity" ON "public"."feature_flags" USING "btree" ("entity_id", "flag_key") WHERE ("entity_id" IS NOT NULL);


--
-- Name: idx_feature_flags_global; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_feature_flags_global" ON "public"."feature_flags" USING "btree" ("flag_key") WHERE ("entity_id" IS NULL);


--
-- Name: idx_fin_periods_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_fin_periods_entity" ON "public"."financial_periods" USING "btree" ("entity_id");


--
-- Name: idx_fin_periods_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_fin_periods_status" ON "public"."financial_periods" USING "btree" ("status");


--
-- Name: idx_fin_timeline_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_fin_timeline_created" ON "public"."financial_timeline" USING "btree" ("created_at" DESC);


--
-- Name: idx_fin_timeline_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_fin_timeline_entity" ON "public"."financial_timeline" USING "btree" ("entity_id");


--
-- Name: idx_fin_timeline_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_fin_timeline_ref" ON "public"."financial_timeline" USING "btree" ("reference_type", "reference_id");


--
-- Name: idx_gl_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gl_account" ON "public"."general_ledger" USING "btree" ("account_id");


--
-- Name: idx_gl_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gl_entity" ON "public"."general_ledger" USING "btree" ("entity_id");


--
-- Name: idx_gl_learning_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gl_learning_desc" ON "public"."gl_allocation_learning" USING "btree" ("entity_id", "supplier_id", "description_pattern");


--
-- Name: idx_gl_learning_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gl_learning_property" ON "public"."gl_allocation_learning" USING "btree" ("entity_id", "supplier_id", "property_id");


--
-- Name: idx_gl_learning_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gl_learning_supplier" ON "public"."gl_allocation_learning" USING "btree" ("entity_id", "supplier_id");


--
-- Name: idx_gl_learning_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_gl_learning_unique" ON "public"."gl_allocation_learning" USING "btree" ("entity_id", "supplier_id", "property_id", "description_pattern") WHERE ("property_id" IS NOT NULL);


--
-- Name: idx_gl_learning_unique_no_property; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_gl_learning_unique_no_property" ON "public"."gl_allocation_learning" USING "btree" ("entity_id", "supplier_id", "description_pattern") WHERE ("property_id" IS NULL);


--
-- Name: idx_gl_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_gl_period" ON "public"."general_ledger" USING "btree" ("period_id");


--
-- Name: idx_integrity_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_integrity_log_entity" ON "public"."financial_integrity_log" USING "btree" ("entity_id");


--
-- Name: idx_integrity_log_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_integrity_log_period" ON "public"."financial_integrity_log" USING "btree" ("period_id");


--
-- Name: idx_intel_signals_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_intel_signals_domain" ON "public"."intelligence_signals" USING "btree" ("domain");


--
-- Name: idx_intel_signals_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_intel_signals_severity" ON "public"."intelligence_signals" USING "btree" ("severity");


--
-- Name: idx_intel_signals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_intel_signals_status" ON "public"."intelligence_signals" USING "btree" ("status");


--
-- Name: idx_invoices_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_invoices_supplier_id" ON "public"."invoices" USING "btree" ("supplier_id");


--
-- Name: idx_issues_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_issues_entity" ON "public"."maintenance_issues" USING "btree" ("entity_id");


--
-- Name: idx_issues_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_issues_property" ON "public"."maintenance_issues" USING "btree" ("property_id");


--
-- Name: idx_issues_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_issues_status" ON "public"."maintenance_issues" USING "btree" ("status");


--
-- Name: idx_journal_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_journal_lines_account" ON "public"."journal_lines" USING "btree" ("account_id");


--
-- Name: idx_journal_lines_journal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_journal_lines_journal" ON "public"."journal_lines" USING "btree" ("journal_id");


--
-- Name: idx_journals_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_journals_entity" ON "public"."journals" USING "btree" ("entity_id");


--
-- Name: idx_journals_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_journals_period" ON "public"."journals" USING "btree" ("period_id");


--
-- Name: idx_journals_posted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_journals_posted" ON "public"."journals" USING "btree" ("is_posted");


--
-- Name: idx_journals_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_journals_source" ON "public"."journals" USING "btree" ("source_event", "source_id");


--
-- Name: idx_lease_intake_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_intake_created_at" ON "public"."lease_intake" USING "btree" ("created_at");


--
-- Name: idx_lease_intake_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_intake_entity_id" ON "public"."lease_intake" USING "btree" ("entity_id");


--
-- Name: idx_lease_intake_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_intake_property_id" ON "public"."lease_intake" USING "btree" ("property_id");


--
-- Name: idx_lease_intake_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_intake_status" ON "public"."lease_intake" USING "btree" ("status");


--
-- Name: idx_lease_intake_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_intake_tenant_id" ON "public"."lease_intake" USING "btree" ("tenant_id");


--
-- Name: idx_lease_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_templates_active" ON "public"."lease_templates" USING "btree" ("entity_id", "category", "status") WHERE ("status" = 'active'::"text");


--
-- Name: idx_lease_templates_entity_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_templates_entity_category" ON "public"."lease_templates" USING "btree" ("entity_id", "category");


--
-- Name: idx_lease_templates_family_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_templates_family_version" ON "public"."lease_templates" USING "btree" ("family_id", "version");


--
-- Name: idx_lease_templates_source_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_templates_source_document" ON "public"."lease_templates" USING "btree" ("source_document_id");


--
-- Name: idx_lease_timeline_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_timeline_created_at" ON "public"."lease_timeline" USING "btree" ("created_at");


--
-- Name: idx_lease_timeline_intake_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_lease_timeline_intake_id" ON "public"."lease_timeline" USING "btree" ("intake_id");


--
-- Name: idx_maint_decisions_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_maint_decisions_approval" ON "public"."maintenance_decisions" USING "btree" ("approval_request_id");


--
-- Name: idx_maint_decisions_issue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_maint_decisions_issue" ON "public"."maintenance_decisions" USING "btree" ("issue_id");


--
-- Name: idx_maint_decisions_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_maint_decisions_workflow" ON "public"."maintenance_decisions" USING "btree" ("workflow_instance_id");


--
-- Name: idx_maint_journal_issue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_maint_journal_issue" ON "public"."maintenance_journal" USING "btree" ("issue_id");


--
-- Name: idx_notification_deliveries_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notification_deliveries_channel" ON "public"."notification_deliveries" USING "btree" ("channel");


--
-- Name: idx_notification_deliveries_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notification_deliveries_notification_id" ON "public"."notification_deliveries" USING "btree" ("notification_id");


--
-- Name: idx_notification_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notification_deliveries_status" ON "public"."notification_deliveries" USING "btree" ("status");


--
-- Name: idx_notification_prefs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notification_prefs_entity" ON "public"."notification_preferences" USING "btree" ("user_id", "entity_id");


--
-- Name: idx_notification_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notification_prefs_user" ON "public"."notification_preferences" USING "btree" ("user_id");


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_notifications_log_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_log_correlation" ON "public"."notifications_log" USING "btree" ("correlation_id");


--
-- Name: idx_notifications_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_log_created" ON "public"."notifications_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_notifications_log_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_log_event" ON "public"."notifications_log" USING "btree" ("event");


--
-- Name: idx_notifications_log_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_log_recipient" ON "public"."notifications_log" USING "btree" ("recipient");


--
-- Name: idx_notifications_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_log_status" ON "public"."notifications_log" USING "btree" ("status");


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("user_id", "read");


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");


--
-- Name: idx_offers_vacancy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_offers_vacancy_id" ON "public"."offers" USING "btree" ("vacancy_id");


--
-- Name: idx_payment_batches_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_batches_created" ON "public"."payment_batches" USING "btree" ("created_at" DESC);


--
-- Name: idx_payment_batches_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_batches_entity" ON "public"."payment_batches" USING "btree" ("entity_id");


--
-- Name: idx_payment_batches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_batches_status" ON "public"."payment_batches" USING "btree" ("status");


--
-- Name: idx_payment_policies_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_policies_category" ON "public"."payment_policies" USING "btree" ("category");


--
-- Name: idx_payment_policies_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_policies_entity" ON "public"."payment_policies" USING "btree" ("entity_id");


--
-- Name: idx_payment_requests_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_requests_batch" ON "public"."payment_requests" USING "btree" ("batch_id");


--
-- Name: idx_payment_requests_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_requests_due" ON "public"."payment_requests" USING "btree" ("due_date");


--
-- Name: idx_payment_requests_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_requests_entity" ON "public"."payment_requests" USING "btree" ("entity_id");


--
-- Name: idx_payment_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_payment_requests_status" ON "public"."payment_requests" USING "btree" ("status");


--
-- Name: idx_permissions_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_permissions_category" ON "public"."permissions" USING "btree" ("category");


--
-- Name: idx_platform_policies_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_platform_policies_entity" ON "public"."platform_policies" USING "btree" ("entity_id");


--
-- Name: idx_platform_policies_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_platform_policies_type" ON "public"."platform_policies" USING "btree" ("policy_type", "category");


--
-- Name: idx_platform_settings_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_platform_settings_entity_id" ON "public"."platform_settings" USING "btree" ("entity_id");


--
-- Name: idx_portfolio_agg_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_agg_log_entity" ON "public"."portfolio_aggregation_log" USING "btree" ("entity_id");


--
-- Name: idx_portfolio_agg_log_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_agg_log_processed" ON "public"."portfolio_aggregation_log" USING "btree" ("processed_at" DESC);


--
-- Name: idx_portfolio_read_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_read_entity" ON "public"."portfolio_read_model" USING "btree" ("entity_id");


--
-- Name: idx_portfolio_read_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_read_expires" ON "public"."portfolio_read_model" USING "btree" ("expires_at");


--
-- Name: idx_portfolio_read_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_read_type" ON "public"."portfolio_read_model" USING "btree" ("model_type");


--
-- Name: idx_portfolio_snapshots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_snapshots_date" ON "public"."portfolio_snapshots" USING "btree" ("snapshot_date");


--
-- Name: idx_portfolio_snapshots_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_portfolio_snapshots_entity" ON "public"."portfolio_snapshots" USING "btree" ("entity_id");


--
-- Name: idx_posting_rules_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_posting_rules_entity" ON "public"."posting_rules" USING "btree" ("entity_id");


--
-- Name: idx_posting_rules_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_posting_rules_event" ON "public"."posting_rules" USING "btree" ("business_event");


--
-- Name: idx_posting_templates_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_posting_templates_entity" ON "public"."posting_templates" USING "btree" ("entity_id");


--
-- Name: idx_posting_templates_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_posting_templates_event" ON "public"."posting_templates" USING "btree" ("business_event");


--
-- Name: idx_property_timeline_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_property_timeline_created_at" ON "public"."property_timeline" USING "btree" ("created_at");


--
-- Name: idx_property_timeline_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_property_timeline_property_id" ON "public"."property_timeline" USING "btree" ("property_id");


--
-- Name: idx_rates_allocations_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rates_allocations_run" ON "public"."rates_recovery_allocations" USING "btree" ("run_id");


--
-- Name: idx_rates_allocations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rates_allocations_tenant" ON "public"."rates_recovery_allocations" USING "btree" ("tenant_id");


--
-- Name: idx_rates_doc_links_alloc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rates_doc_links_alloc" ON "public"."rates_recovery_document_links" USING "btree" ("allocation_id");


--
-- Name: idx_rates_docs_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rates_docs_run" ON "public"."rates_recovery_documents" USING "btree" ("run_id");


--
-- Name: idx_rates_runs_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rates_runs_property" ON "public"."rates_recovery_runs" USING "btree" ("property_id");


--
-- Name: idx_recurring_exp_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_recurring_exp_entity" ON "public"."recurring_expenses" USING "btree" ("entity_id");


--
-- Name: idx_recurring_exp_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_recurring_exp_supplier" ON "public"."recurring_expenses" USING "btree" ("supplier_id");


--
-- Name: idx_rev_activity_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_activity_entity" ON "public"."activity_feed" USING "btree" ("entity_id");


--
-- Name: idx_rev_activity_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_activity_occurred" ON "public"."activity_feed" USING "btree" ("occurred_at" DESC);


--
-- Name: idx_rev_activity_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_activity_ref" ON "public"."activity_feed" USING "btree" ("reference_type", "reference_id");


--
-- Name: idx_rev_decisions_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_decisions_entity" ON "public"."revenue_decisions" USING "btree" ("entity_id");


--
-- Name: idx_rev_decisions_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_decisions_lease" ON "public"."revenue_decisions" USING "btree" ("lease_id");


--
-- Name: idx_rev_interventions_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_interventions_entity" ON "public"."revenue_interventions" USING "btree" ("entity_id");


--
-- Name: idx_rev_interventions_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_interventions_lease" ON "public"."revenue_interventions" USING "btree" ("lease_id");


--
-- Name: idx_rev_interventions_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_interventions_outcome" ON "public"."revenue_interventions" USING "btree" ("outcome");


--
-- Name: idx_rev_states_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_rev_states_lease" ON "public"."revenue_states" USING "btree" ("lease_id");


--
-- Name: idx_signature_requests_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_signature_requests_entity" ON "public"."signature_requests" USING "btree" ("entity_id");


--
-- Name: idx_signature_requests_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_signature_requests_lease" ON "public"."signature_requests" USING "btree" ("lease_id");


--
-- Name: idx_signature_sessions_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_signature_sessions_request" ON "public"."signature_sessions" USING "btree" ("request_id");


--
-- Name: idx_signing_events_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_signing_events_request" ON "public"."signing_events" USING "btree" ("request_id");


--
-- Name: idx_signing_events_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_signing_events_session" ON "public"."signing_events" USING "btree" ("session_id");


--
-- Name: idx_snippets_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_snippets_document" ON "public"."rates_recovery_document_snippets" USING "btree" ("document_id");


--
-- Name: idx_statement_lines_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_statement_lines_match" ON "public"."supplier_statement_lines" USING "btree" ("match_status");


--
-- Name: idx_statement_lines_statement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_statement_lines_statement" ON "public"."supplier_statement_lines" USING "btree" ("statement_id");


--
-- Name: idx_statements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_statements_tenant" ON "public"."statements_generated" USING "btree" ("tenant_id");


--
-- Name: idx_sub_ledger_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_sub_ledger_entity" ON "public"."sub_ledger_entries" USING "btree" ("entity_id");


--
-- Name: idx_sub_ledger_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_sub_ledger_supplier" ON "public"."sub_ledger_entries" USING "btree" ("supplier_id");


--
-- Name: idx_sub_ledger_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_sub_ledger_tenant" ON "public"."sub_ledger_entries" USING "btree" ("tenant_id");


--
-- Name: idx_sub_ledger_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_sub_ledger_type" ON "public"."sub_ledger_entries" USING "btree" ("ledger_type");


--
-- Name: idx_supplier_accounts_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_accounts_account" ON "public"."supplier_accounts" USING "btree" ("account_number");


--
-- Name: idx_supplier_accounts_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_accounts_entity" ON "public"."supplier_accounts" USING "btree" ("entity_id");


--
-- Name: idx_supplier_accounts_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_accounts_property" ON "public"."supplier_accounts" USING "btree" ("property_id");


--
-- Name: idx_supplier_accounts_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_accounts_supplier" ON "public"."supplier_accounts" USING "btree" ("supplier_id");


--
-- Name: idx_supplier_cn_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_cn_invoice" ON "public"."supplier_credit_notes" USING "btree" ("original_invoice_id");


--
-- Name: idx_supplier_cn_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_cn_supplier" ON "public"."supplier_credit_notes" USING "btree" ("supplier_id");


--
-- Name: idx_supplier_conflicts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_conflicts" ON "public"."supplier_conflicts" USING "btree" ("supplier_id", "entity_id");


--
-- Name: idx_supplier_inv_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_inv_due" ON "public"."supplier_invoices_new" USING "btree" ("due_date");


--
-- Name: idx_supplier_inv_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_inv_entity" ON "public"."supplier_invoices_new" USING "btree" ("entity_id");


--
-- Name: idx_supplier_inv_lines_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_inv_lines_invoice" ON "public"."supplier_invoice_lines" USING "btree" ("invoice_id");


--
-- Name: idx_supplier_inv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_inv_status" ON "public"."supplier_invoices_new" USING "btree" ("status");


--
-- Name: idx_supplier_inv_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_inv_supplier" ON "public"."supplier_invoices_new" USING "btree" ("supplier_id");


--
-- Name: idx_supplier_invoices_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_invoices_due" ON "public"."supplier_invoices" USING "btree" ("due_date");


--
-- Name: idx_supplier_invoices_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_invoices_entity" ON "public"."supplier_invoices" USING "btree" ("entity_id");


--
-- Name: idx_supplier_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_invoices_status" ON "public"."supplier_invoices" USING "btree" ("status");


--
-- Name: idx_supplier_invoices_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_supplier_invoices_supplier" ON "public"."supplier_invoices" USING "btree" ("supplier_id");


--
-- Name: idx_supplier_invoices_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_supplier_invoices_unique" ON "public"."supplier_invoices_new" USING "btree" ("entity_id", "invoice_number") WHERE (("invoice_number" IS NOT NULL) AND ("invoice_number" <> ''::"text"));


--
-- Name: idx_suppliers_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_suppliers_entity_id" ON "public"."suppliers" USING "btree" ("entity_id");


--
-- Name: idx_suppliers_supplier_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_suppliers_supplier_code" ON "public"."suppliers" USING "btree" ("supplier_code");


--
-- Name: idx_tax_config_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tax_config_entity" ON "public"."tax_config" USING "btree" ("entity_id");


--
-- Name: idx_tb_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tb_entity" ON "public"."trial_balances" USING "btree" ("entity_id");


--
-- Name: idx_tb_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tb_period" ON "public"."trial_balances" USING "btree" ("period_id");


--
-- Name: idx_template_lines_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_template_lines_template" ON "public"."posting_template_lines" USING "btree" ("template_id");


--
-- Name: idx_tenant_contacts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tenant_contacts_tenant" ON "public"."tenant_contacts" USING "btree" ("tenant_id");


--
-- Name: idx_transaction_allocations_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_transaction_allocations_invoice_id" ON "public"."transaction_allocations" USING "btree" ("invoice_id");


--
-- Name: idx_transaction_allocations_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_transaction_allocations_transaction_id" ON "public"."transaction_allocations" USING "btree" ("transaction_id");


--
-- Name: idx_transaction_allocations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_transaction_allocations_type" ON "public"."transaction_allocations" USING "btree" ("type");


--
-- Name: idx_user_entity_permissions_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_entity_permissions_entity" ON "public"."user_entity_permissions" USING "btree" ("entity_id");


--
-- Name: idx_user_entity_permissions_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_entity_permissions_key" ON "public"."user_entity_permissions" USING "btree" ("permission_key");


--
-- Name: idx_user_entity_permissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_user_entity_permissions_user" ON "public"."user_entity_permissions" USING "btree" ("user_id");


--
-- Name: idx_vacancies_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vacancies_property_id" ON "public"."vacancies" USING "btree" ("property_id");


--
-- Name: idx_vacancies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vacancies_status" ON "public"."vacancies" USING "btree" ("status");


--
-- Name: idx_vacancies_unit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_vacancies_unit_id" ON "public"."vacancies" USING "btree" ("unit_id");


--
-- Name: idx_viewings_enquiry_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_viewings_enquiry_id" ON "public"."viewings" USING "btree" ("enquiry_id");


--
-- Name: idx_viewings_vacancy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_viewings_vacancy_id" ON "public"."viewings" USING "btree" ("vacancy_id");


--
-- Name: idx_work_order_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_work_order_events_created_at" ON "public"."work_order_events" USING "btree" ("created_at");


--
-- Name: idx_work_order_events_work_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_work_order_events_work_order_id" ON "public"."work_order_events" USING "btree" ("work_order_id");


--
-- Name: idx_workflow_states_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_workflow_states_entity" ON "public"."workflow_states" USING "btree" ("entity_id");


--
-- Name: idx_workflow_states_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_workflow_states_status" ON "public"."workflow_states" USING "btree" ("status");


--
-- Name: idx_workflow_states_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_workflow_states_type" ON "public"."workflow_states" USING "btree" ("workflow_type");


--
-- Name: lease_template_families_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_template_families_category_idx" ON "public"."lease_template_families" USING "btree" ("entity_id", "category");


--
-- Name: lease_template_families_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_template_families_entity_idx" ON "public"."lease_template_families" USING "btree" ("entity_id");


--
-- Name: lease_templates_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_templates_active_idx" ON "public"."lease_templates" USING "btree" ("entity_id", "status");


--
-- Name: lease_templates_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_templates_category_idx" ON "public"."lease_templates" USING "btree" ("entity_id", "category");


--
-- Name: lease_templates_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_templates_entity_idx" ON "public"."lease_templates" USING "btree" ("entity_id");


--
-- Name: lease_templates_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_templates_family_idx" ON "public"."lease_templates" USING "btree" ("family_id");


--
-- Name: lease_templates_family_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "lease_templates_family_version_unique" ON "public"."lease_templates" USING "btree" ("family_id", "version");


--
-- Name: lease_templates_property_ids_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_templates_property_ids_idx" ON "public"."lease_templates" USING "gin" ("property_ids");


--
-- Name: lease_templates_property_types_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "lease_templates_property_types_idx" ON "public"."lease_templates" USING "gin" ("applies_to_property_types");


--
-- Name: audit_log enforce_audit_immutability_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_audit_immutability_delete" BEFORE DELETE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_modification"();


--
-- Name: audit_log enforce_audit_immutability_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_audit_immutability_update" BEFORE UPDATE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_modification"();


--
-- Name: charges enforce_charge_period; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_charge_period" BEFORE INSERT ON "public"."charges" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_charge_into_closed_period"();


--
-- Name: statement_periods enforce_closed_period_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_closed_period_immutability" BEFORE UPDATE ON "public"."statement_periods" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_closed_period_edit"();


--
-- Name: invoices enforce_invoice_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_invoice_immutability" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_invoice_edit_closed_period"();


--
-- Name: communications enforce_period_closed_on_communications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_period_closed_on_communications" BEFORE INSERT ON "public"."communications" FOR EACH ROW WHEN (("new"."event_type" = 'statement_available'::"text")) EXECUTE FUNCTION "public"."prevent_statement_into_closed_period"();


--
-- Name: bank_transactions enforce_posted_transaction_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_posted_transaction_immutability" BEFORE UPDATE ON "public"."bank_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_posted_transaction_edit"();


--
-- Name: financial_periods enforce_single_open_period; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "enforce_single_open_period" BEFORE INSERT OR UPDATE ON "public"."financial_periods" FOR EACH ROW EXECUTE FUNCTION "public"."check_single_open_period"();


--
-- Name: executions execution_lock_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "execution_lock_trigger" BEFORE UPDATE ON "public"."executions" FOR EACH ROW EXECUTE FUNCTION "public"."lock_execution"();


--
-- Name: executions execution_sla_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "execution_sla_trigger" BEFORE UPDATE ON "public"."executions" FOR EACH ROW EXECUTE FUNCTION "public"."check_execution_sla"();


--
-- Name: executions execution_snapshot_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "execution_snapshot_trigger" BEFORE UPDATE ON "public"."executions" FOR EACH ROW EXECUTE FUNCTION "public"."capture_execution_snapshot"();


--
-- Name: leases lease_execution_lock_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "lease_execution_lock_trigger" BEFORE UPDATE ON "public"."leases" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_source_updates_during_execution"();


--
-- Name: entities on_entity_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "on_entity_created" AFTER INSERT ON "public"."entities" FOR EACH ROW EXECUTE FUNCTION "public"."auto_add_entity_membership"();


--
-- Name: lease_intake set_intake_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "set_intake_code" BEFORE INSERT ON "public"."lease_intake" FOR EACH ROW EXECUTE FUNCTION "public"."generate_intake_code"();


--
-- Name: accounting_config accounting_config_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."accounting_config"
    ADD CONSTRAINT "accounting_config_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: adjustment_charges adjustment_charges_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."adjustment_charges"
    ADD CONSTRAINT "adjustment_charges_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: adjustment_charges adjustment_charges_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."adjustment_charges"
    ADD CONSTRAINT "adjustment_charges_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "public"."billing_adjustments"("id");


--
-- Name: allocation_audit allocation_audit_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."allocation_audit"
    ADD CONSTRAINT "allocation_audit_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: allocation_audit allocation_audit_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."allocation_audit"
    ADD CONSTRAINT "allocation_audit_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: allocation_audit allocation_audit_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."allocation_audit"
    ADD CONSTRAINT "allocation_audit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: allocation_audit allocation_audit_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."allocation_audit"
    ADD CONSTRAINT "allocation_audit_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id");


--
-- Name: asset_timeline asset_timeline_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."asset_timeline"
    ADD CONSTRAINT "asset_timeline_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;


--
-- Name: asset_timeline asset_timeline_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."asset_timeline"
    ADD CONSTRAINT "asset_timeline_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: asset_warranties asset_warranties_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."asset_warranties"
    ADD CONSTRAINT "asset_warranties_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."property_assets"("id");


--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: assets assets_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: assets assets_preferred_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: assets assets_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: automation_execution_log automation_execution_log_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."automation_execution_log"
    ADD CONSTRAINT "automation_execution_log_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE CASCADE;


--
-- Name: bank_accounts bank_accounts_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: bank_statements bank_statements_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_statements"
    ADD CONSTRAINT "bank_statements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id");


--
-- Name: bank_transactions bank_transactions_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id");


--
-- Name: bank_transactions bank_transactions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: bank_transactions bank_transactions_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id");


--
-- Name: billing_adjustments billing_adjustments_original_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_adjustments"
    ADD CONSTRAINT "billing_adjustments_original_charge_id_fkey" FOREIGN KEY ("original_charge_id") REFERENCES "public"."charges"("id");


--
-- Name: billing_rules billing_rules_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_rules"
    ADD CONSTRAINT "billing_rules_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: billing_rules billing_rules_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_rules"
    ADD CONSTRAINT "billing_rules_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."billing_rules"("id");


--
-- Name: billing_worksheets billing_worksheets_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_worksheets"
    ADD CONSTRAINT "billing_worksheets_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: billing_worksheets billing_worksheets_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_worksheets"
    ADD CONSTRAINT "billing_worksheets_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: billing_worksheets billing_worksheets_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_worksheets"
    ADD CONSTRAINT "billing_worksheets_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: billing_worksheets billing_worksheets_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_worksheets"
    ADD CONSTRAINT "billing_worksheets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: billing_worksheets billing_worksheets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."billing_worksheets"
    ADD CONSTRAINT "billing_worksheets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: broker_commissions broker_commissions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");


--
-- Name: broker_commissions broker_commissions_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id");


--
-- Name: broker_commissions broker_commissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: broker_commissions broker_commissions_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: broker_commissions broker_commissions_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: broker_commissions broker_commissions_vacancy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_commissions"
    ADD CONSTRAINT "broker_commissions_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id");


--
-- Name: broker_companies broker_companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_companies"
    ADD CONSTRAINT "broker_companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: broker_companies broker_companies_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_companies"
    ADD CONSTRAINT "broker_companies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: broker_mandates broker_mandates_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_mandates"
    ADD CONSTRAINT "broker_mandates_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id");


--
-- Name: broker_mandates broker_mandates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_mandates"
    ADD CONSTRAINT "broker_mandates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: broker_mandates broker_mandates_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_mandates"
    ADD CONSTRAINT "broker_mandates_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: broker_mandates broker_mandates_vacancy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."broker_mandates"
    ADD CONSTRAINT "broker_mandates_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id");


--
-- Name: brokers brokers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brokers"
    ADD CONSTRAINT "brokers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."broker_companies"("id");


--
-- Name: brokers brokers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brokers"
    ADD CONSTRAINT "brokers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: brokers brokers_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."brokers"
    ADD CONSTRAINT "brokers_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: budgets budgets_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: budgets budgets_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: charges charges_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: charges charges_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: charges charges_managing_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_managing_entity_id_fkey" FOREIGN KEY ("managing_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: charges charges_owner_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_owner_entity_id_fkey" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: charges charges_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: charges charges_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."charges"
    ADD CONSTRAINT "charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: chart_of_accounts chart_of_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: communication_rules communication_rules_event_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_rules"
    ADD CONSTRAINT "communication_rules_event_type_fkey" FOREIGN KEY ("event_type") REFERENCES "public"."communication_events"("event_type");


--
-- Name: communications communications_event_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communications"
    ADD CONSTRAINT "communications_event_type_fkey" FOREIGN KEY ("event_type") REFERENCES "public"."communication_events"("event_type");


--
-- Name: communications communications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communications"
    ADD CONSTRAINT "communications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: compliance_items compliance_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id");


--
-- Name: compliance_items compliance_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: compliance_items compliance_items_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: compliance_items compliance_items_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."compliance_items"
    ADD CONSTRAINT "compliance_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: conversation_sessions conversation_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: credit_note_lines credit_note_lines_credit_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."credit_note_lines"
    ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE CASCADE;


--
-- Name: deposit_transactions deposit_transactions_deposit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."deposit_transactions"
    ADD CONSTRAINT "deposit_transactions_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposit_register"("id") ON DELETE CASCADE;


--
-- Name: deposit_transactions deposit_transactions_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."deposit_transactions"
    ADD CONSTRAINT "deposit_transactions_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id");


--
-- Name: document_lifecycle_events document_lifecycle_events_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_lifecycle_events"
    ADD CONSTRAINT "document_lifecycle_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;


--
-- Name: document_relationships document_relationships_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."document_relationships"
    ADD CONSTRAINT "document_relationships_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;


--
-- Name: documents documents_parent_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "public"."documents"("id");


--
-- Name: enquiries enquiries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: enquiries enquiries_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: enquiries enquiries_vacancy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id");


--
-- Name: execution_certificates execution_certificates_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_certificates"
    ADD CONSTRAINT "execution_certificates_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id");


--
-- Name: execution_checklists execution_checklists_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_checklists"
    ADD CONSTRAINT "execution_checklists_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id");


--
-- Name: execution_checklists execution_checklists_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_checklists"
    ADD CONSTRAINT "execution_checklists_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE CASCADE;


--
-- Name: execution_document_versions execution_document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_document_versions"
    ADD CONSTRAINT "execution_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: execution_document_versions execution_document_versions_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_document_versions"
    ADD CONSTRAINT "execution_document_versions_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE CASCADE;


--
-- Name: execution_events execution_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_events"
    ADD CONSTRAINT "execution_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: execution_events execution_events_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_events"
    ADD CONSTRAINT "execution_events_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE CASCADE;


--
-- Name: execution_participants execution_participants_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_participants"
    ADD CONSTRAINT "execution_participants_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE CASCADE;


--
-- Name: execution_policies execution_policies_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."execution_policies"
    ADD CONSTRAINT "execution_policies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: executions executions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."executions"
    ADD CONSTRAINT "executions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: executions executions_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."executions"
    ADD CONSTRAINT "executions_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id");


--
-- Name: expected_supplier_invoices expected_supplier_invoices_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."expected_supplier_invoices"
    ADD CONSTRAINT "expected_supplier_invoices_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");


--
-- Name: feedback_items feedback_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."feedback_items"
    ADD CONSTRAINT "feedback_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: financial_close_checklist financial_close_checklist_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_close_checklist"
    ADD CONSTRAINT "financial_close_checklist_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: financial_expectations financial_expectations_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_expectations"
    ADD CONSTRAINT "financial_expectations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: financial_integrity_log financial_integrity_log_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_integrity_log"
    ADD CONSTRAINT "financial_integrity_log_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: financial_periods financial_periods_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_periods"
    ADD CONSTRAINT "financial_periods_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: financial_statements financial_statements_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."financial_statements"
    ADD CONSTRAINT "financial_statements_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: bank_transactions fk_bank_transactions_invoice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "fk_bank_transactions_invoice" FOREIGN KEY ("matched_invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: bank_transactions fk_bank_transactions_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "fk_bank_transactions_tenant" FOREIGN KEY ("matched_tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: communication_logs fk_comms_lease; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "fk_comms_lease" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("lease_id");


--
-- Name: invoice_line_items fk_invoice_line_items_invoice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "fk_invoice_line_items_invoice" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: invoices fk_invoices_lease; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "fk_invoices_lease" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: invoices fk_invoices_property; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "fk_invoices_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: invoices fk_invoices_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "fk_invoices_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: leases fk_leases_property; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "fk_leases_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: leases fk_leases_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "fk_leases_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: leases fk_leases_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "fk_leases_unit" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");


--
-- Name: recoveries fk_recoveries_lease; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recoveries"
    ADD CONSTRAINT "fk_recoveries_lease" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: recoveries fk_recoveries_property; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recoveries"
    ADD CONSTRAINT "fk_recoveries_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: recoveries fk_recoveries_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recoveries"
    ADD CONSTRAINT "fk_recoveries_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: supplier_invoices_new fk_supplier_invoices_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_invoices_new"
    ADD CONSTRAINT "fk_supplier_invoices_supplier" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: tasks fk_tasks_invoice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "fk_tasks_invoice" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: tasks fk_tasks_lease; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "fk_tasks_lease" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("lease_id");


--
-- Name: tasks fk_tasks_property; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "fk_tasks_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: tasks fk_tasks_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "fk_tasks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: tasks fk_tasks_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "fk_tasks_unit" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");


--
-- Name: units fk_units_property; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "fk_units_property" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: forecasts forecasts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."forecasts"
    ADD CONSTRAINT "forecasts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: forecasts forecasts_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."forecasts"
    ADD CONSTRAINT "forecasts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: general_ledger general_ledger_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: general_ledger general_ledger_journal_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_lines"("id");


--
-- Name: general_ledger general_ledger_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."general_ledger"
    ADD CONSTRAINT "general_ledger_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: inspections inspections_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id");


--
-- Name: inspections inspections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: inspections inspections_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: inspections inspections_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: inspections inspections_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."inspections"
    ADD CONSTRAINT "inspections_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");


--
-- Name: invoice_items invoice_items_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id");


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;


--
-- Name: invoice_versions invoice_versions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoice_versions"
    ADD CONSTRAINT "invoice_versions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: invoices invoices_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: invoices invoices_managing_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_managing_entity_id_fkey" FOREIGN KEY ("managing_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: invoices invoices_owner_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_owner_entity_id_fkey" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: journal_lines journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: journal_lines journal_lines_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE CASCADE;


--
-- Name: journals journals_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."journals"
    ADD CONSTRAINT "journals_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: lease_intake lease_intake_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: lease_intake lease_intake_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: lease_intake lease_intake_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: lease_intake lease_intake_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: lease_intake lease_intake_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: lease_intake lease_intake_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");


--
-- Name: lease_intake lease_intake_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_intake"
    ADD CONSTRAINT "lease_intake_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");


--
-- Name: lease_template_families lease_template_families_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_template_families"
    ADD CONSTRAINT "lease_template_families_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: lease_templates lease_templates_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_templates"
    ADD CONSTRAINT "lease_templates_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: lease_templates lease_templates_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_templates"
    ADD CONSTRAINT "lease_templates_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public"."lease_template_families"("id");


--
-- Name: lease_timeline lease_timeline_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_timeline"
    ADD CONSTRAINT "lease_timeline_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: lease_timeline lease_timeline_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lease_timeline"
    ADD CONSTRAINT "lease_timeline_intake_id_fkey" FOREIGN KEY ("intake_id") REFERENCES "public"."lease_intake"("id") ON DELETE CASCADE;


--
-- Name: leases leases_active_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_active_execution_id_fkey" FOREIGN KEY ("active_execution_id") REFERENCES "public"."executions"("id");


--
-- Name: leases leases_managing_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_managing_entity_id_fkey" FOREIGN KEY ("managing_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: leases leases_owner_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_owner_entity_id_fkey" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: leasing_opportunities leasing_opportunities_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leasing_opportunities"
    ADD CONSTRAINT "leasing_opportunities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: leasing_opportunities leasing_opportunities_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leasing_opportunities"
    ADD CONSTRAINT "leasing_opportunities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: leasing_opportunity_versions leasing_opportunity_versions_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."leasing_opportunity_versions"
    ADD CONSTRAINT "leasing_opportunity_versions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."leasing_opportunities"("id") ON DELETE CASCADE;


--
-- Name: lod_queue lod_queue_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."lod_queue"
    ADD CONSTRAINT "lod_queue_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."lod_templates"("id");


--
-- Name: maintenance_decisions maintenance_decisions_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_decisions"
    ADD CONSTRAINT "maintenance_decisions_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."maintenance_issues"("id");


--
-- Name: maintenance_issues maintenance_issues_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_issues"
    ADD CONSTRAINT "maintenance_issues_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."property_assets"("id");


--
-- Name: maintenance_issues maintenance_issues_duplicate_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_issues"
    ADD CONSTRAINT "maintenance_issues_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "public"."maintenance_issues"("id");


--
-- Name: maintenance_journal maintenance_journal_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_journal"
    ADD CONSTRAINT "maintenance_journal_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."maintenance_issues"("id");


--
-- Name: maintenance_purchase_orders maintenance_purchase_orders_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_purchase_orders"
    ADD CONSTRAINT "maintenance_purchase_orders_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");


--
-- Name: maintenance_quotes maintenance_quotes_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."maintenance_quotes"
    ADD CONSTRAINT "maintenance_quotes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."maintenance_issues"("id");


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: offers offers_converted_to_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_converted_to_lease_id_fkey" FOREIGN KEY ("converted_to_lease_id") REFERENCES "public"."leases"("id");


--
-- Name: offers offers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: offers offers_enquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id");


--
-- Name: offers offers_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: offers offers_vacancy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id");


--
-- Name: payment_commitments payment_commitments_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_commitments"
    ADD CONSTRAINT "payment_commitments_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: payment_commitments payment_commitments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_commitments"
    ADD CONSTRAINT "payment_commitments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: payment_requests payment_requests_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id");


--
-- Name: platform_settings platform_settings_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: posting_rules posting_rules_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."posting_rules"
    ADD CONSTRAINT "posting_rules_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: posting_rules posting_rules_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."posting_rules"
    ADD CONSTRAINT "posting_rules_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: posting_template_lines posting_template_lines_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."posting_template_lines"
    ADD CONSTRAINT "posting_template_lines_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."posting_templates"("id") ON DELETE CASCADE;


--
-- Name: procurement_goods_receipts procurement_goods_receipts_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_goods_receipts"
    ADD CONSTRAINT "procurement_goods_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_purchase_orders"("id");


--
-- Name: procurement_purchase_orders procurement_purchase_orders_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_purchase_orders"
    ADD CONSTRAINT "procurement_purchase_orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."procurement_quotes"("id");


--
-- Name: procurement_purchase_orders procurement_purchase_orders_spend_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_purchase_orders"
    ADD CONSTRAINT "procurement_purchase_orders_spend_request_id_fkey" FOREIGN KEY ("spend_request_id") REFERENCES "public"."procurement_spend_requests"("id");


--
-- Name: procurement_quotes procurement_quotes_rfq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_quotes"
    ADD CONSTRAINT "procurement_quotes_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "public"."procurement_rfqs"("id");


--
-- Name: procurement_rfqs procurement_rfqs_spend_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_rfqs"
    ADD CONSTRAINT "procurement_rfqs_spend_request_id_fkey" FOREIGN KEY ("spend_request_id") REFERENCES "public"."procurement_spend_requests"("id");


--
-- Name: procurement_supplier_invoices procurement_supplier_invoices_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."procurement_supplier_invoices"
    ADD CONSTRAINT "procurement_supplier_invoices_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."procurement_purchase_orders"("id");


--
-- Name: product_events product_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."product_events"
    ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: properties properties_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: properties properties_managing_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_managing_entity_id_fkey" FOREIGN KEY ("managing_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: properties properties_owner_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_owner_entity_id_fkey" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."entities"("id");


--
-- Name: property_assets property_assets_parent_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_assets"
    ADD CONSTRAINT "property_assets_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "public"."property_assets"("id");


--
-- Name: property_timeline property_timeline_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_timeline"
    ADD CONSTRAINT "property_timeline_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: property_timeline property_timeline_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_timeline"
    ADD CONSTRAINT "property_timeline_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: property_timeline property_timeline_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."property_timeline"
    ADD CONSTRAINT "property_timeline_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: purchase_orders purchase_orders_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: purchase_orders purchase_orders_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");


--
-- Name: rates_recovery_allocations rates_recovery_allocations_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_allocations"
    ADD CONSTRAINT "rates_recovery_allocations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."rates_recovery_runs"("id") ON DELETE CASCADE;


--
-- Name: rates_recovery_document_links rates_recovery_document_links_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_document_links"
    ADD CONSTRAINT "rates_recovery_document_links_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."rates_recovery_allocations"("id") ON DELETE CASCADE;


--
-- Name: rates_recovery_document_links rates_recovery_document_links_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_document_links"
    ADD CONSTRAINT "rates_recovery_document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."rates_recovery_documents"("id") ON DELETE CASCADE;


--
-- Name: rates_recovery_document_snippets rates_recovery_document_snippets_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_document_snippets"
    ADD CONSTRAINT "rates_recovery_document_snippets_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."rates_recovery_documents"("id") ON DELETE CASCADE;


--
-- Name: rates_recovery_documents rates_recovery_documents_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rates_recovery_documents"
    ADD CONSTRAINT "rates_recovery_documents_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."rates_recovery_runs"("id") ON DELETE CASCADE;


--
-- Name: revenue_assurance_scores revenue_assurance_scores_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_assurance_scores"
    ADD CONSTRAINT "revenue_assurance_scores_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: revenue_digital_twins revenue_digital_twins_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revenue_digital_twins"
    ADD CONSTRAINT "revenue_digital_twins_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: search_activity search_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."search_activity"
    ADD CONSTRAINT "search_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: service_contracts service_contracts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_contracts"
    ADD CONSTRAINT "service_contracts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id");


--
-- Name: service_contracts service_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_contracts"
    ADD CONSTRAINT "service_contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: service_contracts service_contracts_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_contracts"
    ADD CONSTRAINT "service_contracts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: service_contracts service_contracts_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_contracts"
    ADD CONSTRAINT "service_contracts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: service_contracts service_contracts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."service_contracts"
    ADD CONSTRAINT "service_contracts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: signature_sessions signature_sessions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signature_sessions"
    ADD CONSTRAINT "signature_sessions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id");


--
-- Name: signing_events signing_events_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signing_events"
    ADD CONSTRAINT "signing_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id");


--
-- Name: signing_events signing_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signing_events"
    ADD CONSTRAINT "signing_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."signature_sessions"("id");


--
-- Name: signing_templates signing_templates_parent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signing_templates"
    ADD CONSTRAINT "signing_templates_parent_template_id_fkey" FOREIGN KEY ("parent_template_id") REFERENCES "public"."signing_templates"("id");


--
-- Name: statement_periods statement_periods_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."statement_periods"
    ADD CONSTRAINT "statement_periods_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: sub_ledger_entries sub_ledger_entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sub_ledger_entries"
    ADD CONSTRAINT "sub_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: sub_ledger_entries sub_ledger_entries_journal_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sub_ledger_entries"
    ADD CONSTRAINT "sub_ledger_entries_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_lines"("id");


--
-- Name: supplier_accounts supplier_accounts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_accounts"
    ADD CONSTRAINT "supplier_accounts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: supplier_conflicts supplier_conflicts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_conflicts"
    ADD CONSTRAINT "supplier_conflicts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: supplier_credit_notes supplier_credit_notes_original_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_credit_notes"
    ADD CONSTRAINT "supplier_credit_notes_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "public"."supplier_invoices_new"("id");


--
-- Name: supplier_invoice_lines supplier_invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_invoice_lines"
    ADD CONSTRAINT "supplier_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices_new"("id") ON DELETE CASCADE;


--
-- Name: supplier_invoices_new supplier_invoices_new_supplier_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_invoices_new"
    ADD CONSTRAINT "supplier_invoices_new_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."supplier_accounts"("id");


--
-- Name: supplier_statement_lines supplier_statement_lines_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_statement_lines"
    ADD CONSTRAINT "supplier_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "public"."supplier_statements"("id") ON DELETE CASCADE;


--
-- Name: supplier_visits supplier_visits_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."supplier_visits"
    ADD CONSTRAINT "supplier_visits_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");


--
-- Name: suppliers suppliers_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: tenant_communication_prefs tenant_communication_prefs_event_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_communication_prefs"
    ADD CONSTRAINT "tenant_communication_prefs_event_type_fkey" FOREIGN KEY ("event_type") REFERENCES "public"."communication_events"("event_type");


--
-- Name: tenant_communication_prefs tenant_communication_prefs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_communication_prefs"
    ADD CONSTRAINT "tenant_communication_prefs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: tenant_contacts tenant_contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_contacts"
    ADD CONSTRAINT "tenant_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: tenant_revenue_dna tenant_revenue_dna_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenant_revenue_dna"
    ADD CONSTRAINT "tenant_revenue_dna_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: commercial_behaviour_profile tenant_revenue_profile_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."commercial_behaviour_profile"
    ADD CONSTRAINT "tenant_revenue_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: tenants tenants_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: tenants tenants_payment_term_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_payment_term_id_fkey" FOREIGN KEY ("payment_term_id") REFERENCES "public"."payment_terms"("id");


--
-- Name: transaction_allocations transaction_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transaction_allocations"
    ADD CONSTRAINT "transaction_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");


--
-- Name: transaction_allocations transaction_allocations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transaction_allocations"
    ADD CONSTRAINT "transaction_allocations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: transaction_allocations transaction_allocations_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transaction_allocations"
    ADD CONSTRAINT "transaction_allocations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");


--
-- Name: transaction_allocations transaction_allocations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transaction_allocations"
    ADD CONSTRAINT "transaction_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: transaction_allocations transaction_allocations_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."transaction_allocations"
    ADD CONSTRAINT "transaction_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE CASCADE;


--
-- Name: trial_balances trial_balances_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."trial_balances"
    ADD CONSTRAINT "trial_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id");


--
-- Name: trial_balances trial_balances_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."trial_balances"
    ADD CONSTRAINT "trial_balances_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: user_entities user_entities_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entities"
    ADD CONSTRAINT "user_entities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: user_entities user_entities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entities"
    ADD CONSTRAINT "user_entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: user_entity_access user_entity_access_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entity_access"
    ADD CONSTRAINT "user_entity_access_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE CASCADE;


--
-- Name: user_entity_access user_entity_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_entity_access"
    ADD CONSTRAINT "user_entity_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: vacancies vacancies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: vacancies vacancies_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id");


--
-- Name: vacancies vacancies_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: vacancies vacancies_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");


--
-- Name: vat_returns vat_returns_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vat_returns"
    ADD CONSTRAINT "vat_returns_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."financial_periods"("id");


--
-- Name: viewings viewings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."viewings"
    ADD CONSTRAINT "viewings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: viewings viewings_enquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."viewings"
    ADD CONSTRAINT "viewings_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id");


--
-- Name: viewings viewings_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."viewings"
    ADD CONSTRAINT "viewings_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: viewings viewings_vacancy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."viewings"
    ADD CONSTRAINT "viewings_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id");


--
-- Name: work_order_events work_order_events_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_order_events"
    ADD CONSTRAINT "work_order_events_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");


--
-- Name: work_order_events work_order_events_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_order_events"
    ADD CONSTRAINT "work_order_events_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;


--
-- Name: work_order_timeline work_order_timeline_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_order_timeline"
    ADD CONSTRAINT "work_order_timeline_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");


--
-- Name: work_order_timeline work_order_timeline_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_order_timeline"
    ADD CONSTRAINT "work_order_timeline_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;


--
-- Name: work_orders work_orders_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id");


--
-- Name: work_orders work_orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."suppliers"("id");


--
-- Name: work_orders work_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: work_orders work_orders_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id");


--
-- Name: work_orders work_orders_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id");


--
-- Name: work_orders work_orders_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");


--
-- Name: work_orders work_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: work_orders work_orders_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");


--
-- Name: worksheet_items worksheet_items_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worksheet_items"
    ADD CONSTRAINT "worksheet_items_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id");


--
-- Name: worksheet_items worksheet_items_worksheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."worksheet_items"
    ADD CONSTRAINT "worksheet_items_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "public"."billing_worksheets"("id") ON DELETE CASCADE;


--
-- Name: beta_waitlist Public beta signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public beta signup" ON "public"."beta_waitlist" FOR INSERT TO "anon" WITH CHECK (true);


--
-- Name: accounting_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."accounting_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_config accounting_config_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "accounting_config_select" ON "public"."accounting_config" FOR SELECT USING (true);


--
-- Name: activity_feed; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."activity_feed" ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_feed activity_feed_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "activity_feed_select" ON "public"."activity_feed" FOR SELECT USING (true);


--
-- Name: adjustment_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."adjustment_charges" ENABLE ROW LEVEL SECURITY;

--
-- Name: adjustment_charges adjustment_charges_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "adjustment_charges_insert" ON "public"."adjustment_charges" FOR INSERT WITH CHECK (true);


--
-- Name: adjustment_charges adjustment_charges_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "adjustment_charges_select" ON "public"."adjustment_charges" FOR SELECT USING (true);


--
-- Name: adjustment_charges adjustment_charges_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "adjustment_charges_update" ON "public"."adjustment_charges" FOR UPDATE USING (true);


--
-- Name: ap_payment_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ap_payment_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: ap_payment_preferences ap_payment_prefs_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ap_payment_prefs_all" ON "public"."ap_payment_preferences" USING (true);


--
-- Name: asset_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."asset_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_timeline asset_timeline_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "asset_timeline_insert" ON "public"."asset_timeline" FOR INSERT WITH CHECK (true);


--
-- Name: asset_timeline asset_timeline_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "asset_timeline_select" ON "public"."asset_timeline" FOR SELECT USING (true);


--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;

--
-- Name: assets assets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assets_insert" ON "public"."assets" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: property_assets assets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assets_insert" ON "public"."property_assets" FOR INSERT WITH CHECK (true);


--
-- Name: assets assets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assets_select" ON "public"."assets" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: property_assets assets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assets_select" ON "public"."property_assets" FOR SELECT USING (true);


--
-- Name: assets assets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assets_update" ON "public"."assets" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: property_assets assets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assets_update" ON "public"."property_assets" FOR UPDATE USING (true);


--
-- Name: automation_execution_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."automation_execution_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_execution_log automation_execution_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_execution_log_insert" ON "public"."automation_execution_log" FOR INSERT WITH CHECK (true);


--
-- Name: automation_execution_log automation_execution_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_execution_log_select" ON "public"."automation_execution_log" FOR SELECT USING (true);


--
-- Name: automation_execution_log automation_execution_log_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_execution_log_update" ON "public"."automation_execution_log" FOR UPDATE USING (true);


--
-- Name: automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."automation_rules" ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules automation_rules_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_rules_delete" ON "public"."automation_rules" FOR DELETE USING (true);


--
-- Name: automation_rules automation_rules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_rules_insert" ON "public"."automation_rules" FOR INSERT WITH CHECK (true);


--
-- Name: automation_rules automation_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_rules_select" ON "public"."automation_rules" FOR SELECT USING (true);


--
-- Name: automation_rules automation_rules_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation_rules_update" ON "public"."automation_rules" FOR UPDATE USING (true);


--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts bank_accounts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_delete" ON "public"."bank_accounts" FOR DELETE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: bank_accounts bank_accounts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_insert" ON "public"."bank_accounts" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: bank_accounts bank_accounts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_select" ON "public"."bank_accounts" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: bank_accounts bank_accounts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_update" ON "public"."bank_accounts" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: bank_statements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."bank_statements" ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_statements bank_statements_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_statements_insert" ON "public"."bank_statements" FOR INSERT WITH CHECK (true);


--
-- Name: bank_statements bank_statements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_statements_select" ON "public"."bank_statements" FOR SELECT USING (true);


--
-- Name: bank_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."bank_transactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_transactions bank_tx_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_tx_all" ON "public"."bank_transactions" USING (true);


--
-- Name: beta_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."beta_waitlist" ENABLE ROW LEVEL SECURITY;

--
-- Name: beta_waitlist beta_waitlist_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "beta_waitlist_select" ON "public"."beta_waitlist" FOR SELECT USING (true);


--
-- Name: billing_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."billing_adjustments" ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_adjustments billing_adjustments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_adjustments_insert" ON "public"."billing_adjustments" FOR INSERT WITH CHECK (true);


--
-- Name: billing_adjustments billing_adjustments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_adjustments_select" ON "public"."billing_adjustments" FOR SELECT USING (true);


--
-- Name: billing_adjustments billing_adjustments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_adjustments_update" ON "public"."billing_adjustments" FOR UPDATE USING (true);


--
-- Name: billing_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."billing_policies" ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_policies billing_policies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_policies_insert" ON "public"."billing_policies" FOR INSERT WITH CHECK (true);


--
-- Name: billing_policies billing_policies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_policies_select" ON "public"."billing_policies" FOR SELECT USING (true);


--
-- Name: billing_policies billing_policies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_policies_update" ON "public"."billing_policies" FOR UPDATE USING (true);


--
-- Name: billing_rules billing_rules_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_rules_all" ON "public"."billing_rules" USING (true);


--
-- Name: billing_rules billing_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_rules_select" ON "public"."billing_rules" FOR SELECT USING (("lease_id" IN ( SELECT "leases"."id"
   FROM "public"."leases"
  WHERE ("leases"."owner_entity_id" = ANY ("public"."auth_entities"())))));


--
-- Name: billing_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."billing_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_snapshots billing_snapshots_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_snapshots_all" ON "public"."billing_snapshots" USING (true);


--
-- Name: billing_snapshots billing_snapshots_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_snapshots_insert" ON "public"."billing_snapshots" FOR INSERT WITH CHECK (true);


--
-- Name: billing_snapshots billing_snapshots_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "billing_snapshots_select" ON "public"."billing_snapshots" FOR SELECT USING (true);


--
-- Name: billing_worksheets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."billing_worksheets" ENABLE ROW LEVEL SECURITY;

--
-- Name: broker_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."broker_commissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: broker_commissions broker_commissions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_commissions_insert" ON "public"."broker_commissions" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_commissions broker_commissions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_commissions_select" ON "public"."broker_commissions" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_commissions broker_commissions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_commissions_update" ON "public"."broker_commissions" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."broker_companies" ENABLE ROW LEVEL SECURITY;

--
-- Name: broker_companies broker_companies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_companies_insert" ON "public"."broker_companies" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_companies broker_companies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_companies_select" ON "public"."broker_companies" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_companies broker_companies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_companies_update" ON "public"."broker_companies" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_mandates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."broker_mandates" ENABLE ROW LEVEL SECURITY;

--
-- Name: broker_mandates broker_mandates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_mandates_insert" ON "public"."broker_mandates" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_mandates broker_mandates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_mandates_select" ON "public"."broker_mandates" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: broker_mandates broker_mandates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "broker_mandates_update" ON "public"."broker_mandates" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: brokers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."brokers" ENABLE ROW LEVEL SECURITY;

--
-- Name: brokers brokers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "brokers_insert" ON "public"."brokers" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: brokers brokers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "brokers_select" ON "public"."brokers" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: brokers brokers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "brokers_update" ON "public"."brokers" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;

--
-- Name: budgets budgets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "budgets_insert" ON "public"."budgets" FOR INSERT WITH CHECK (true);


--
-- Name: budgets budgets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "budgets_select" ON "public"."budgets" FOR SELECT USING (true);


--
-- Name: budgets budgets_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "budgets_update" ON "public"."budgets" FOR UPDATE USING (true);


--
-- Name: cash_book_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."cash_book_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_book_entries cash_book_entries_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cash_book_entries_insert" ON "public"."cash_book_entries" FOR INSERT WITH CHECK (true);


--
-- Name: cash_book_entries cash_book_entries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cash_book_entries_select" ON "public"."cash_book_entries" FOR SELECT USING (true);


--
-- Name: cash_book_entries cash_book_entries_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cash_book_entries_update" ON "public"."cash_book_entries" FOR UPDATE USING (true);


--
-- Name: charges charges_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "charges_all" ON "public"."charges" USING (true);


--
-- Name: charges charges_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "charges_select" ON "public"."charges" FOR SELECT USING ((("entity_id" = ANY ("public"."auth_entities"())) OR ("owner_entity_id" = ANY ("public"."auth_entities"()))));


--
-- Name: chart_of_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."chart_of_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: document_classification_rules class_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "class_rules_select" ON "public"."document_classification_rules" FOR SELECT USING (true);


--
-- Name: financial_close_checklist close_checklist_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "close_checklist_insert" ON "public"."financial_close_checklist" FOR INSERT WITH CHECK (true);


--
-- Name: financial_close_checklist close_checklist_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "close_checklist_select" ON "public"."financial_close_checklist" FOR SELECT USING (true);


--
-- Name: financial_close_checklist close_checklist_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "close_checklist_update" ON "public"."financial_close_checklist" FOR UPDATE USING (true);


--
-- Name: credit_note_lines cn_lines_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cn_lines_insert" ON "public"."credit_note_lines" FOR INSERT WITH CHECK (true);


--
-- Name: credit_note_lines cn_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cn_lines_select" ON "public"."credit_note_lines" FOR SELECT USING (true);


--
-- Name: chart_of_accounts coa_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coa_insert" ON "public"."chart_of_accounts" FOR INSERT WITH CHECK (true);


--
-- Name: chart_of_accounts coa_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "coa_select" ON "public"."chart_of_accounts" FOR SELECT USING (true);


--
-- Name: communication_preferences comm_prefs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comm_prefs_select" ON "public"."communication_preferences" FOR SELECT USING (true);


--
-- Name: communications_queue comm_queue_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comm_queue_insert" ON "public"."communications_queue" FOR INSERT WITH CHECK (true);


--
-- Name: communications_queue comm_queue_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comm_queue_select" ON "public"."communications_queue" FOR SELECT USING (true);


--
-- Name: communications_queue comm_queue_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comm_queue_update" ON "public"."communications_queue" FOR UPDATE USING (true);


--
-- Name: communication_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."communication_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: communication_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."communication_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: communication_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."communication_rules" ENABLE ROW LEVEL SECURITY;

--
-- Name: communication_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."communication_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."communications" ENABLE ROW LEVEL SECURITY;

--
-- Name: communications communications_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "communications_all" ON "public"."communications" USING (true);


--
-- Name: communications_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."communications_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."compliance_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_items compliance_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "compliance_items_insert" ON "public"."compliance_items" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: compliance_items compliance_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "compliance_items_select" ON "public"."compliance_items" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: compliance_items compliance_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "compliance_items_update" ON "public"."compliance_items" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: conversation_sessions conv_sessions_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "conv_sessions_all" ON "public"."conversation_sessions" USING (true);


--
-- Name: conversation_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."conversation_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_note_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."credit_note_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_notes credit_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "credit_notes_insert" ON "public"."credit_notes" FOR INSERT WITH CHECK (true);


--
-- Name: credit_notes credit_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "credit_notes_select" ON "public"."credit_notes" FOR SELECT USING (true);


--
-- Name: credit_notes credit_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "credit_notes_update" ON "public"."credit_notes" FOR UPDATE USING (true);


--
-- Name: dead_letter_events dead_letter_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "dead_letter_all" ON "public"."dead_letter_events" USING (true);


--
-- Name: dead_letter_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."dead_letter_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_register; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."deposit_register" ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."deposit_transactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_transactions deposit_txn_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deposit_txn_insert" ON "public"."deposit_transactions" FOR INSERT WITH CHECK (true);


--
-- Name: deposit_transactions deposit_txn_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deposit_txn_select" ON "public"."deposit_transactions" FOR SELECT USING (true);


--
-- Name: deposit_register deposits_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deposits_insert" ON "public"."deposit_register" FOR INSERT WITH CHECK (true);


--
-- Name: deposit_register deposits_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deposits_select" ON "public"."deposit_register" FOR SELECT USING (true);


--
-- Name: deposit_register deposits_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deposits_update" ON "public"."deposit_register" FOR UPDATE USING (true);


--
-- Name: document_lifecycle_events doc_lifecycle_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_lifecycle_insert" ON "public"."document_lifecycle_events" FOR INSERT WITH CHECK (true);


--
-- Name: document_lifecycle_events doc_lifecycle_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_lifecycle_select" ON "public"."document_lifecycle_events" FOR SELECT USING (true);


--
-- Name: document_relationships doc_relationships_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_relationships_delete" ON "public"."document_relationships" FOR DELETE USING (true);


--
-- Name: document_relationships doc_relationships_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_relationships_insert" ON "public"."document_relationships" FOR INSERT WITH CHECK (true);


--
-- Name: document_relationships doc_relationships_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_relationships_select" ON "public"."document_relationships" FOR SELECT USING (true);


--
-- Name: document_extraction_rules doc_rules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_rules_insert" ON "public"."document_extraction_rules" FOR INSERT WITH CHECK (true);


--
-- Name: document_extraction_rules doc_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "doc_rules_select" ON "public"."document_extraction_rules" FOR SELECT USING (true);


--
-- Name: document_classification_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."document_classification_rules" ENABLE ROW LEVEL SECURITY;

--
-- Name: document_extraction_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."document_extraction_rules" ENABLE ROW LEVEL SECURITY;

--
-- Name: document_import_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."document_import_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: document_import_jobs document_import_jobs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "document_import_jobs_insert" ON "public"."document_import_jobs" FOR INSERT WITH CHECK (true);


--
-- Name: document_import_jobs document_import_jobs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "document_import_jobs_select" ON "public"."document_import_jobs" FOR SELECT USING (true);


--
-- Name: document_import_jobs document_import_jobs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "document_import_jobs_update" ON "public"."document_import_jobs" FOR UPDATE USING (true);


--
-- Name: document_lifecycle_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."document_lifecycle_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: document_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."document_relationships" ENABLE ROW LEVEL SECURITY;

--
-- Name: document_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."document_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "documents_insert" ON "public"."documents" FOR INSERT WITH CHECK (true);


--
-- Name: documents documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT USING (true);


--
-- Name: documents documents_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "documents_update" ON "public"."documents" FOR UPDATE USING (true);


--
-- Name: enquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."enquiries" ENABLE ROW LEVEL SECURITY;

--
-- Name: enquiries enquiries_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enquiries_insert" ON "public"."enquiries" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: enquiries enquiries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enquiries_select" ON "public"."enquiries" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: enquiries enquiries_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "enquiries_update" ON "public"."enquiries" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: entities entities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "entities_select" ON "public"."entities" FOR SELECT USING (("id" = ANY ("public"."auth_entities"())));


--
-- Name: communication_events entity_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "entity_isolation" ON "public"."communication_events" USING (true);


--
-- Name: communication_rules entity_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "entity_isolation" ON "public"."communication_rules" USING (true);


--
-- Name: statement_periods entity_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "entity_isolation" ON "public"."statement_periods" USING (true);


--
-- Name: tenant_communication_prefs entity_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "entity_isolation" ON "public"."tenant_communication_prefs" USING (true);


--
-- Name: execution_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."execution_artifacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_artifacts execution_artifacts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_artifacts_insert" ON "public"."execution_artifacts" FOR INSERT WITH CHECK (true);


--
-- Name: execution_artifacts execution_artifacts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_artifacts_select" ON "public"."execution_artifacts" FOR SELECT USING (true);


--
-- Name: execution_checklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."execution_checklists" ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_checklists execution_checklists_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_checklists_insert" ON "public"."execution_checklists" FOR INSERT WITH CHECK (true);


--
-- Name: execution_checklists execution_checklists_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_checklists_select" ON "public"."execution_checklists" FOR SELECT USING (true);


--
-- Name: execution_checklists execution_checklists_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_checklists_update" ON "public"."execution_checklists" FOR UPDATE USING (true);


--
-- Name: execution_document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."execution_document_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_document_versions execution_document_versions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_document_versions_insert" ON "public"."execution_document_versions" FOR INSERT WITH CHECK (true);


--
-- Name: execution_document_versions execution_document_versions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_document_versions_select" ON "public"."execution_document_versions" FOR SELECT USING (true);


--
-- Name: execution_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."execution_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_events execution_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_events_insert" ON "public"."execution_events" FOR INSERT WITH CHECK (true);


--
-- Name: execution_events execution_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_events_select" ON "public"."execution_events" FOR SELECT USING (true);


--
-- Name: execution_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."execution_participants" ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_participants execution_participants_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_participants_insert" ON "public"."execution_participants" FOR INSERT WITH CHECK (true);


--
-- Name: execution_participants execution_participants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_participants_select" ON "public"."execution_participants" FOR SELECT USING (true);


--
-- Name: execution_participants execution_participants_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_participants_update" ON "public"."execution_participants" FOR UPDATE USING (true);


--
-- Name: execution_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."execution_policies" ENABLE ROW LEVEL SECURITY;

--
-- Name: execution_policies execution_policies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_policies_insert" ON "public"."execution_policies" FOR INSERT WITH CHECK (true);


--
-- Name: execution_policies execution_policies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_policies_select" ON "public"."execution_policies" FOR SELECT USING (true);


--
-- Name: execution_policies execution_policies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "execution_policies_update" ON "public"."execution_policies" FOR UPDATE USING (true);


--
-- Name: executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."executions" ENABLE ROW LEVEL SECURITY;

--
-- Name: executions executions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "executions_insert" ON "public"."executions" FOR INSERT WITH CHECK (true);


--
-- Name: executions executions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "executions_select" ON "public"."executions" FOR SELECT USING (true);


--
-- Name: executions executions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "executions_update" ON "public"."executions" FOR UPDATE USING (true);


--
-- Name: expected_supplier_invoices exp_inv_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exp_inv_insert" ON "public"."expected_supplier_invoices" FOR INSERT WITH CHECK (true);


--
-- Name: expected_supplier_invoices exp_inv_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exp_inv_select" ON "public"."expected_supplier_invoices" FOR SELECT USING (true);


--
-- Name: expected_supplier_invoices exp_inv_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "exp_inv_update" ON "public"."expected_supplier_invoices" FOR UPDATE USING (true);


--
-- Name: financial_expectations expectations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "expectations_insert" ON "public"."financial_expectations" FOR INSERT WITH CHECK (true);


--
-- Name: financial_expectations expectations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "expectations_select" ON "public"."financial_expectations" FOR SELECT USING (true);


--
-- Name: financial_expectations expectations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "expectations_update" ON "public"."financial_expectations" FOR UPDATE USING (true);


--
-- Name: expected_supplier_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."expected_supplier_invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags feature_flags_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "feature_flags_insert" ON "public"."feature_flags" FOR INSERT WITH CHECK (true);


--
-- Name: feature_flags feature_flags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "feature_flags_select" ON "public"."feature_flags" FOR SELECT USING (true);


--
-- Name: feature_flags feature_flags_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "feature_flags_update" ON "public"."feature_flags" FOR UPDATE USING (true);


--
-- Name: feedback_items feedback_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "feedback_insert" ON "public"."feedback_items" FOR INSERT WITH CHECK (true);


--
-- Name: feedback_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."feedback_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback_items feedback_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "feedback_select" ON "public"."feedback_items" FOR SELECT USING (true);


--
-- Name: financial_timeline fin_timeline_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "fin_timeline_insert" ON "public"."financial_timeline" FOR INSERT WITH CHECK (true);


--
-- Name: financial_timeline fin_timeline_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "fin_timeline_select" ON "public"."financial_timeline" FOR SELECT USING (true);


--
-- Name: financial_close_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_close_checklist" ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_controls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_controls" ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_controls financial_controls_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "financial_controls_all" ON "public"."financial_controls" USING (true);


--
-- Name: financial_expectations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_expectations" ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_integrity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_integrity_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_periods" ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_periods financial_periods_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "financial_periods_insert" ON "public"."financial_periods" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: financial_periods financial_periods_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "financial_periods_select" ON "public"."financial_periods" FOR SELECT USING (true);


--
-- Name: financial_periods financial_periods_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "financial_periods_update" ON "public"."financial_periods" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: financial_statements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_statements" ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."financial_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."forecasts" ENABLE ROW LEVEL SECURITY;

--
-- Name: general_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."general_ledger" ENABLE ROW LEVEL SECURITY;

--
-- Name: general_ledger general_ledger_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "general_ledger_all" ON "public"."general_ledger" USING (true);


--
-- Name: general_ledger general_ledger_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "general_ledger_insert" ON "public"."general_ledger" FOR INSERT WITH CHECK (true);


--
-- Name: gl_allocation_learning; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."gl_allocation_learning" ENABLE ROW LEVEL SECURITY;

--
-- Name: general_ledger gl_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gl_insert" ON "public"."general_ledger" FOR INSERT WITH CHECK (true);


--
-- Name: general_ledger gl_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "gl_select" ON "public"."general_ledger" FOR SELECT USING (true);


--
-- Name: inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."inspections" ENABLE ROW LEVEL SECURITY;

--
-- Name: inspections inspections_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inspections_insert" ON "public"."inspections" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: inspections inspections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inspections_select" ON "public"."inspections" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: inspections inspections_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inspections_update" ON "public"."inspections" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: financial_integrity_log integrity_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "integrity_log_insert" ON "public"."financial_integrity_log" FOR INSERT WITH CHECK (true);


--
-- Name: financial_integrity_log integrity_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "integrity_log_select" ON "public"."financial_integrity_log" FOR SELECT USING (true);


--
-- Name: financial_integrity_log integrity_log_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "integrity_log_update" ON "public"."financial_integrity_log" FOR UPDATE USING (true);


--
-- Name: interest_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."interest_charges" ENABLE ROW LEVEL SECURITY;

--
-- Name: interest_charges interest_charges_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "interest_charges_select" ON "public"."interest_charges" FOR SELECT USING (true);


--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations invitations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invitations_insert" ON "public"."invitations" FOR INSERT WITH CHECK (true);


--
-- Name: invitations invitations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invitations_select" ON "public"."invitations" FOR SELECT USING (true);


--
-- Name: invitations invitations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invitations_update" ON "public"."invitations" FOR UPDATE USING (true);


--
-- Name: invoice_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."invoice_configs" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices invoices_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invoices_all" ON "public"."invoices" USING (true);


--
-- Name: maintenance_issues issues_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "issues_insert" ON "public"."maintenance_issues" FOR INSERT WITH CHECK (true);


--
-- Name: maintenance_issues issues_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "issues_select" ON "public"."maintenance_issues" FOR SELECT USING (true);


--
-- Name: maintenance_issues issues_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "issues_update" ON "public"."maintenance_issues" FOR UPDATE USING (true);


--
-- Name: journal_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."journal_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_lines journal_lines_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "journal_lines_all" ON "public"."journal_lines" USING (true);


--
-- Name: journal_lines journal_lines_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "journal_lines_insert" ON "public"."journal_lines" FOR INSERT WITH CHECK (true);


--
-- Name: journal_lines journal_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "journal_lines_select" ON "public"."journal_lines" FOR SELECT USING (true);


--
-- Name: journals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."journals" ENABLE ROW LEVEL SECURITY;

--
-- Name: journals journals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "journals_insert" ON "public"."journals" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: journals journals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "journals_select" ON "public"."journals" FOR SELECT USING (true);


--
-- Name: journals journals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "journals_update" ON "public"."journals" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: late_fee_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."late_fee_charges" ENABLE ROW LEVEL SECURITY;

--
-- Name: late_fee_charges late_fee_charges_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "late_fee_charges_select" ON "public"."late_fee_charges" FOR SELECT USING (true);


--
-- Name: lease_intake; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lease_intake" ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_intake lease_intake_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_intake_delete" ON "public"."lease_intake" FOR DELETE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_intake lease_intake_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_intake_insert" ON "public"."lease_intake" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_intake lease_intake_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_intake_select" ON "public"."lease_intake" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_intake lease_intake_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_intake_update" ON "public"."lease_intake" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_intake_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lease_intake_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_intake_versions lease_intake_versions_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_intake_versions_all" ON "public"."lease_intake_versions" USING (true);


--
-- Name: lease_template_families; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lease_template_families" ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_template_families lease_template_families_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_template_families_delete" ON "public"."lease_template_families" FOR DELETE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_template_families lease_template_families_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_template_families_insert" ON "public"."lease_template_families" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_template_families lease_template_families_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_template_families_select" ON "public"."lease_template_families" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_template_families lease_template_families_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_template_families_update" ON "public"."lease_template_families" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"()))) WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lease_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_templates lease_templates_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_templates_delete" ON "public"."lease_templates" FOR DELETE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_templates lease_templates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_templates_insert" ON "public"."lease_templates" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_templates lease_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_templates_select" ON "public"."lease_templates" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_templates lease_templates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_templates_update" ON "public"."lease_templates" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"()))) WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: lease_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lease_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_timeline lease_timeline_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_timeline_insert" ON "public"."lease_timeline" FOR INSERT WITH CHECK (true);


--
-- Name: lease_timeline lease_timeline_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lease_timeline_select" ON "public"."lease_timeline" FOR SELECT USING (true);


--
-- Name: leases leases_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leases_delete" ON "public"."leases" FOR DELETE USING ((("managing_entity_id" = ANY ("public"."auth_entities"())) OR ("owner_entity_id" = ANY ("public"."auth_entities"()))));


--
-- Name: leases leases_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leases_insert" ON "public"."leases" FOR INSERT WITH CHECK ((("managing_entity_id" = ANY ("public"."auth_entities"())) OR ("owner_entity_id" = ANY ("public"."auth_entities"()))));


--
-- Name: leases leases_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leases_select" ON "public"."leases" FOR SELECT USING ((("managing_entity_id" = ANY ("public"."auth_entities"())) OR ("owner_entity_id" = ANY ("public"."auth_entities"()))));


--
-- Name: leases leases_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leases_update" ON "public"."leases" FOR UPDATE USING ((("managing_entity_id" = ANY ("public"."auth_entities"())) OR ("owner_entity_id" = ANY ("public"."auth_entities"()))));


--
-- Name: leasing_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leasing_opportunities" ENABLE ROW LEVEL SECURITY;

--
-- Name: leasing_opportunities leasing_opportunities_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leasing_opportunities_all" ON "public"."leasing_opportunities" USING (true);


--
-- Name: leasing_opportunity_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."leasing_opportunity_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: leasing_opportunity_versions leasing_opportunity_versions_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "leasing_opportunity_versions_all" ON "public"."leasing_opportunity_versions" USING (true);


--
-- Name: lod_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lod_queue" ENABLE ROW LEVEL SECURITY;

--
-- Name: lod_queue lod_queue_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lod_queue_insert" ON "public"."lod_queue" FOR INSERT WITH CHECK (true);


--
-- Name: lod_queue lod_queue_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lod_queue_select" ON "public"."lod_queue" FOR SELECT USING (true);


--
-- Name: lod_queue lod_queue_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lod_queue_update" ON "public"."lod_queue" FOR UPDATE USING (true);


--
-- Name: lod_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lod_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: lod_templates lod_templates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lod_templates_insert" ON "public"."lod_templates" FOR INSERT WITH CHECK (true);


--
-- Name: lod_templates lod_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lod_templates_select" ON "public"."lod_templates" FOR SELECT USING (true);


--
-- Name: lod_templates lod_templates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lod_templates_update" ON "public"."lod_templates" FOR UPDATE USING (true);


--
-- Name: maintenance_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."maintenance_issues" ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."maintenance_schedules" ENABLE ROW LEVEL SECURITY;

--
-- Name: manual_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."manual_charges" ENABLE ROW LEVEL SECURITY;

--
-- Name: manual_charges manual_charges_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manual_charges_insert" ON "public"."manual_charges" FOR INSERT WITH CHECK (true);


--
-- Name: manual_charges manual_charges_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manual_charges_select" ON "public"."manual_charges" FOR SELECT USING (true);


--
-- Name: manual_charges manual_charges_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "manual_charges_update" ON "public"."manual_charges" FOR UPDATE USING (true);


--
-- Name: notification_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notification_deliveries" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_deliveries notification_deliveries_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_deliveries_insert" ON "public"."notification_deliveries" FOR INSERT WITH CHECK (true);


--
-- Name: notification_deliveries notification_deliveries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_deliveries_select" ON "public"."notification_deliveries" FOR SELECT USING (true);


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences notification_preferences_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_preferences_insert" ON "public"."notification_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: notification_preferences notification_preferences_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_preferences_select" ON "public"."notification_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: notification_preferences notification_preferences_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notification_preferences_update" ON "public"."notification_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: notifications_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications_log notifications_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_log_insert" ON "public"."notifications_log" FOR INSERT WITH CHECK (true);


--
-- Name: notifications_log notifications_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_log_select" ON "public"."notifications_log" FOR SELECT USING (true);


--
-- Name: notifications_log notifications_log_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_log_update" ON "public"."notifications_log" FOR UPDATE USING (true);


--
-- Name: notifications notifications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: notifications notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;

--
-- Name: offers offers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "offers_insert" ON "public"."offers" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: offers offers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "offers_select" ON "public"."offers" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: offers offers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "offers_update" ON "public"."offers" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: operational_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."operational_policies" ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_policies operational_policies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operational_policies_insert" ON "public"."operational_policies" FOR INSERT WITH CHECK (true);


--
-- Name: operational_policies operational_policies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operational_policies_select" ON "public"."operational_policies" FOR SELECT USING (true);


--
-- Name: operational_policies operational_policies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operational_policies_update" ON "public"."operational_policies" FOR UPDATE USING (true);


--
-- Name: organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."organisations" ENABLE ROW LEVEL SECURITY;

--
-- Name: organisations organisations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organisations_insert" ON "public"."organisations" FOR INSERT WITH CHECK (true);


--
-- Name: organisations organisations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organisations_select" ON "public"."organisations" FOR SELECT USING (true);


--
-- Name: organisations organisations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "organisations_update" ON "public"."organisations" FOR UPDATE USING (true);


--
-- Name: password_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."password_policies" ENABLE ROW LEVEL SECURITY;

--
-- Name: password_policies password_policies_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "password_policies_all" ON "public"."password_policies" USING (true);


--
-- Name: payment_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."payment_batches" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_batches payment_batches_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_batches_insert" ON "public"."payment_batches" FOR INSERT WITH CHECK (true);


--
-- Name: payment_batches payment_batches_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_batches_select" ON "public"."payment_batches" FOR SELECT USING (true);


--
-- Name: payment_batches payment_batches_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_batches_update" ON "public"."payment_batches" FOR UPDATE USING (true);


--
-- Name: payment_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."payment_policies" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_policies payment_policies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_policies_insert" ON "public"."payment_policies" FOR INSERT WITH CHECK (true);


--
-- Name: payment_policies payment_policies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_policies_select" ON "public"."payment_policies" FOR SELECT USING (true);


--
-- Name: payment_policies payment_policies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_policies_update" ON "public"."payment_policies" FOR UPDATE USING (true);


--
-- Name: payment_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."payment_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_requests payment_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_requests_insert" ON "public"."payment_requests" FOR INSERT WITH CHECK (true);


--
-- Name: payment_requests payment_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_requests_select" ON "public"."payment_requests" FOR SELECT USING (true);


--
-- Name: payment_requests payment_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payment_requests_update" ON "public"."payment_requests" FOR UPDATE USING (true);


--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings platform_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "platform_settings_insert" ON "public"."platform_settings" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: platform_settings platform_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "platform_settings_select" ON "public"."platform_settings" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: platform_settings platform_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "platform_settings_update" ON "public"."platform_settings" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: portfolio_aggregation_log portfolio_agg_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_agg_log_insert" ON "public"."portfolio_aggregation_log" FOR INSERT WITH CHECK (true);


--
-- Name: portfolio_aggregation_log portfolio_agg_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_agg_log_select" ON "public"."portfolio_aggregation_log" FOR SELECT USING (true);


--
-- Name: portfolio_aggregation_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."portfolio_aggregation_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_read_model portfolio_read_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_read_insert" ON "public"."portfolio_read_model" FOR INSERT WITH CHECK (true);


--
-- Name: portfolio_read_model; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."portfolio_read_model" ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_read_model portfolio_read_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_read_select" ON "public"."portfolio_read_model" FOR SELECT USING (true);


--
-- Name: portfolio_read_model portfolio_read_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_read_update" ON "public"."portfolio_read_model" FOR UPDATE USING (true);


--
-- Name: portfolio_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."portfolio_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_snapshots portfolio_snapshots_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_snapshots_insert" ON "public"."portfolio_snapshots" FOR INSERT WITH CHECK (true);


--
-- Name: portfolio_snapshots portfolio_snapshots_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "portfolio_snapshots_select" ON "public"."portfolio_snapshots" FOR SELECT USING (true);


--
-- Name: posting_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."posting_rules" ENABLE ROW LEVEL SECURITY;

--
-- Name: posting_rules posting_rules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posting_rules_insert" ON "public"."posting_rules" FOR INSERT WITH CHECK (true);


--
-- Name: posting_rules posting_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posting_rules_select" ON "public"."posting_rules" FOR SELECT USING (true);


--
-- Name: posting_template_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."posting_template_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: posting_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."posting_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: posting_templates posting_templates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posting_templates_insert" ON "public"."posting_templates" FOR INSERT WITH CHECK (true);


--
-- Name: posting_templates posting_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posting_templates_select" ON "public"."posting_templates" FOR SELECT USING (true);


--
-- Name: processed_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."processed_commands" ENABLE ROW LEVEL SECURITY;

--
-- Name: processed_commands processed_commands_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "processed_commands_all" ON "public"."processed_commands" USING (true);


--
-- Name: product_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."product_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_events product_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_events_insert" ON "public"."product_events" FOR INSERT WITH CHECK (true);


--
-- Name: product_events product_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_events_select" ON "public"."product_events" FOR SELECT USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));


--
-- Name: properties properties_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties_delete" ON "public"."properties" FOR DELETE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: properties properties_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties_insert" ON "public"."properties" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: properties properties_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties_select" ON "public"."properties" FOR SELECT USING ((("entity_id" = ANY ("public"."auth_entities"())) OR ("owner_entity_id" = ANY ("public"."auth_entities"()))));


--
-- Name: properties properties_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "properties_update" ON "public"."properties" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: property_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."property_assets" ENABLE ROW LEVEL SECURITY;

--
-- Name: property_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."property_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: property_timeline property_timeline_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "property_timeline_insert" ON "public"."property_timeline" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: property_timeline property_timeline_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "property_timeline_select" ON "public"."property_timeline" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: property_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."property_types" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders purchase_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "purchase_orders_insert" ON "public"."purchase_orders" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: purchase_orders purchase_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "purchase_orders_select" ON "public"."purchase_orders" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: purchase_orders purchase_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "purchase_orders_update" ON "public"."purchase_orders" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: rates_recovery_allocations rates_allocations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_allocations_insert" ON "public"."rates_recovery_allocations" FOR INSERT WITH CHECK (true);


--
-- Name: rates_recovery_allocations rates_allocations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_allocations_select" ON "public"."rates_recovery_allocations" FOR SELECT USING (true);


--
-- Name: rates_recovery_allocations rates_allocations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_allocations_update" ON "public"."rates_recovery_allocations" FOR UPDATE USING (true);


--
-- Name: rates_recovery_document_links rates_doc_links_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_doc_links_insert" ON "public"."rates_recovery_document_links" FOR INSERT WITH CHECK (true);


--
-- Name: rates_recovery_document_links rates_doc_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_doc_links_select" ON "public"."rates_recovery_document_links" FOR SELECT USING (true);


--
-- Name: rates_recovery_documents rates_docs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_docs_insert" ON "public"."rates_recovery_documents" FOR INSERT WITH CHECK (true);


--
-- Name: rates_recovery_documents rates_docs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_docs_select" ON "public"."rates_recovery_documents" FOR SELECT USING (true);


--
-- Name: rates_recovery_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rates_recovery_allocations" ENABLE ROW LEVEL SECURITY;

--
-- Name: rates_recovery_document_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rates_recovery_document_links" ENABLE ROW LEVEL SECURITY;

--
-- Name: rates_recovery_document_snippets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rates_recovery_document_snippets" ENABLE ROW LEVEL SECURITY;

--
-- Name: rates_recovery_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rates_recovery_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: rates_recovery_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rates_recovery_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: rates_recovery_runs rates_runs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_runs_insert" ON "public"."rates_recovery_runs" FOR INSERT WITH CHECK (true);


--
-- Name: rates_recovery_runs rates_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_runs_select" ON "public"."rates_recovery_runs" FOR SELECT USING (true);


--
-- Name: rates_recovery_runs rates_runs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "rates_runs_update" ON "public"."rates_recovery_runs" FOR UPDATE USING (true);


--
-- Name: recurring_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."recurring_expenses" ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_expenses recurring_expenses_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "recurring_expenses_all" ON "public"."recurring_expenses" USING (true);


--
-- Name: report_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."report_audit_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: report_audit_log report_audit_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "report_audit_log_insert" ON "public"."report_audit_log" FOR INSERT WITH CHECK (true);


--
-- Name: report_audit_log report_audit_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "report_audit_log_select" ON "public"."report_audit_log" FOR SELECT USING (true);


--
-- Name: revenue_interventions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."revenue_interventions" ENABLE ROW LEVEL SECURITY;

--
-- Name: revenue_outlooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."revenue_outlooks" ENABLE ROW LEVEL SECURITY;

--
-- Name: revenue_outlooks revenue_outlooks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "revenue_outlooks_select" ON "public"."revenue_outlooks" FOR SELECT USING (true);


--
-- Name: revenue_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."revenue_states" ENABLE ROW LEVEL SECURITY;

--
-- Name: revenue_states revenue_states_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "revenue_states_select" ON "public"."revenue_states" FOR SELECT USING (true);


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "roles_insert" ON "public"."roles" FOR INSERT WITH CHECK (true);


--
-- Name: roles roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "roles_select" ON "public"."roles" FOR SELECT USING (true);


--
-- Name: roles roles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "roles_update" ON "public"."roles" FOR UPDATE USING (true);


--
-- Name: maintenance_schedules schedules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "schedules_select" ON "public"."maintenance_schedules" FOR SELECT USING (true);


--
-- Name: supplier_scores scores_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scores_select" ON "public"."supplier_scores" FOR SELECT USING (true);


--
-- Name: search_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."search_activity" ENABLE ROW LEVEL SECURITY;

--
-- Name: search_activity search_activity_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "search_activity_insert" ON "public"."search_activity" FOR INSERT WITH CHECK (true);


--
-- Name: search_activity search_activity_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "search_activity_select" ON "public"."search_activity" FOR SELECT USING (true);


--
-- Name: service_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."service_contracts" ENABLE ROW LEVEL SECURITY;

--
-- Name: service_contracts service_contracts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_contracts_insert" ON "public"."service_contracts" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: service_contracts service_contracts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_contracts_select" ON "public"."service_contracts" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: service_contracts service_contracts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_contracts_update" ON "public"."service_contracts" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: signature_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."signature_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: signature_requests signature_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signature_requests_insert" ON "public"."signature_requests" FOR INSERT WITH CHECK (true);


--
-- Name: signature_requests signature_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signature_requests_select" ON "public"."signature_requests" FOR SELECT USING (true);


--
-- Name: signature_requests signature_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signature_requests_update" ON "public"."signature_requests" FOR UPDATE USING (true);


--
-- Name: signature_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."signature_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: signature_sessions signature_sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signature_sessions_insert" ON "public"."signature_sessions" FOR INSERT WITH CHECK (true);


--
-- Name: signature_sessions signature_sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signature_sessions_select" ON "public"."signature_sessions" FOR SELECT USING (true);


--
-- Name: signature_sessions signature_sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signature_sessions_update" ON "public"."signature_sessions" FOR UPDATE USING (true);


--
-- Name: signing_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."signing_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: signing_events signing_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signing_events_insert" ON "public"."signing_events" FOR INSERT WITH CHECK (true);


--
-- Name: signing_events signing_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "signing_events_select" ON "public"."signing_events" FOR SELECT USING (true);


--
-- Name: rates_recovery_document_snippets snippets_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "snippets_delete" ON "public"."rates_recovery_document_snippets" FOR DELETE USING (true);


--
-- Name: rates_recovery_document_snippets snippets_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "snippets_insert" ON "public"."rates_recovery_document_snippets" FOR INSERT WITH CHECK (true);


--
-- Name: rates_recovery_document_snippets snippets_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "snippets_select" ON "public"."rates_recovery_document_snippets" FOR SELECT USING (true);


--
-- Name: statement_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."statement_configs" ENABLE ROW LEVEL SECURITY;

--
-- Name: statement_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."statement_overrides" ENABLE ROW LEVEL SECURITY;

--
-- Name: statements_generated; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."statements_generated" ENABLE ROW LEVEL SECURITY;

--
-- Name: statements_generated statements_generated_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "statements_generated_insert" ON "public"."statements_generated" FOR INSERT WITH CHECK (true);


--
-- Name: statements_generated statements_generated_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "statements_generated_select_all" ON "public"."statements_generated" FOR SELECT USING (true);


--
-- Name: sub_ledger_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sub_ledger_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_ledger_entries sub_ledger_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sub_ledger_insert" ON "public"."sub_ledger_entries" FOR INSERT WITH CHECK (true);


--
-- Name: sub_ledger_entries sub_ledger_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sub_ledger_select" ON "public"."sub_ledger_entries" FOR SELECT USING (true);


--
-- Name: supplier_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_accounts supplier_accounts_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_accounts_all" ON "public"."supplier_accounts" USING (true);


--
-- Name: supplier_accounts supplier_accounts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_accounts_insert" ON "public"."supplier_accounts" FOR INSERT WITH CHECK (true);


--
-- Name: supplier_accounts supplier_accounts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_accounts_select" ON "public"."supplier_accounts" FOR SELECT USING (true);


--
-- Name: supplier_accounts supplier_accounts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_accounts_update" ON "public"."supplier_accounts" FOR UPDATE USING (true);


--
-- Name: supplier_credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_credit_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_credit_notes supplier_credit_notes_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_credit_notes_all" ON "public"."supplier_credit_notes" USING (true);


--
-- Name: supplier_invoice_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_invoice_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_invoice_lines supplier_invoice_lines_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_invoice_lines_all" ON "public"."supplier_invoice_lines" USING (true);


--
-- Name: supplier_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_invoices supplier_invoices_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_invoices_insert" ON "public"."supplier_invoices" FOR INSERT WITH CHECK (true);


--
-- Name: supplier_invoices_new; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_invoices_new" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_invoices_new supplier_invoices_new_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_invoices_new_all" ON "public"."supplier_invoices_new" USING (true);


--
-- Name: supplier_invoices supplier_invoices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_invoices_select" ON "public"."supplier_invoices" FOR SELECT USING (true);


--
-- Name: supplier_invoices supplier_invoices_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_invoices_update" ON "public"."supplier_invoices" FOR UPDATE USING (true);


--
-- Name: supplier_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_scores" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_statement_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_statement_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_statement_lines supplier_statement_lines_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_statement_lines_all" ON "public"."supplier_statement_lines" USING (true);


--
-- Name: supplier_statements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_statements" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_statements supplier_statements_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "supplier_statements_all" ON "public"."supplier_statements" USING (true);


--
-- Name: supplier_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."supplier_visits" ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suppliers_insert" ON "public"."suppliers" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: suppliers suppliers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suppliers_select" ON "public"."suppliers" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: suppliers suppliers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "suppliers_update" ON "public"."suppliers" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: tax_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tax_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_config tax_config_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tax_config_select" ON "public"."tax_config" FOR SELECT USING (true);


--
-- Name: trial_balances tb_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tb_select" ON "public"."trial_balances" FOR SELECT USING (true);


--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members team_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team_members_delete" ON "public"."team_members" FOR DELETE USING (true);


--
-- Name: team_members team_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team_members_insert" ON "public"."team_members" FOR INSERT WITH CHECK (true);


--
-- Name: team_members team_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "team_members_select" ON "public"."team_members" FOR SELECT USING (true);


--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;

--
-- Name: teams teams_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "teams_insert" ON "public"."teams" FOR INSERT WITH CHECK (true);


--
-- Name: teams teams_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "teams_select" ON "public"."teams" FOR SELECT USING (true);


--
-- Name: teams teams_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "teams_update" ON "public"."teams" FOR UPDATE USING (true);


--
-- Name: posting_template_lines template_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "template_lines_select" ON "public"."posting_template_lines" FOR SELECT USING (true);


--
-- Name: tenant_communication_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tenant_communication_prefs" ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tenant_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_notes tenant_notes_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant_notes_all" ON "public"."tenant_notes" USING (true);


--
-- Name: tenants tenants_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenants_delete" ON "public"."tenants" FOR DELETE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: tenants tenants_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenants_insert" ON "public"."tenants" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: tenants tenants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenants_select" ON "public"."tenants" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: tenants tenants_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenants_update" ON "public"."tenants" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: treasury_obligations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."treasury_obligations" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_obligations treasury_obligations_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "treasury_obligations_all" ON "public"."treasury_obligations" USING (true);


--
-- Name: trial_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."trial_balances" ENABLE ROW LEVEL SECURITY;

--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "units_all" ON "public"."units" USING (true);


--
-- Name: user_entities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_entities" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entities user_entities_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entities_insert" ON "public"."user_entities" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_entities user_entities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entities_select" ON "public"."user_entities" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: user_entities user_entities_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entities_update" ON "public"."user_entities" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: user_entity_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_entity_access" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entity_access user_entity_access_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entity_access_select" ON "public"."user_entity_access" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."platform_role" = 'platform_admin'::"text"))))));


--
-- Name: user_entity_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_entity_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entity_permissions user_entity_permissions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entity_permissions_insert" ON "public"."user_entity_permissions" FOR INSERT WITH CHECK (true);


--
-- Name: user_entity_permissions user_entity_permissions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entity_permissions_select" ON "public"."user_entity_permissions" FOR SELECT USING (true);


--
-- Name: user_entity_permissions user_entity_permissions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_entity_permissions_update" ON "public"."user_entity_permissions" FOR UPDATE USING (true);


--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences user_preferences_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_preferences_insert" ON "public"."user_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_preferences user_preferences_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_preferences_select" ON "public"."user_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: user_preferences user_preferences_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_preferences_update" ON "public"."user_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: user_preferences user_prefs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_prefs_insert" ON "public"."user_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_preferences user_prefs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_prefs_select" ON "public"."user_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: user_preferences user_prefs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_prefs_update" ON "public"."user_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: vacancies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."vacancies" ENABLE ROW LEVEL SECURITY;

--
-- Name: vacancies vacancies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vacancies_insert" ON "public"."vacancies" FOR INSERT WITH CHECK (true);


--
-- Name: vacancies vacancies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vacancies_select" ON "public"."vacancies" FOR SELECT USING (true);


--
-- Name: vacancies vacancies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "vacancies_update" ON "public"."vacancies" FOR UPDATE USING (true);


--
-- Name: vat_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."vat_returns" ENABLE ROW LEVEL SECURITY;

--
-- Name: viewings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."viewings" ENABLE ROW LEVEL SECURITY;

--
-- Name: viewings viewings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "viewings_insert" ON "public"."viewings" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: viewings viewings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "viewings_select" ON "public"."viewings" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: viewings viewings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "viewings_update" ON "public"."viewings" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: supplier_visits visits_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "visits_insert" ON "public"."supplier_visits" FOR INSERT WITH CHECK (true);


--
-- Name: supplier_visits visits_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "visits_select" ON "public"."supplier_visits" FOR SELECT USING (true);


--
-- Name: supplier_visits visits_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "visits_update" ON "public"."supplier_visits" FOR UPDATE USING (true);


--
-- Name: work_order_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_order_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: work_order_events work_order_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_order_events_insert" ON "public"."work_order_events" FOR INSERT WITH CHECK (true);


--
-- Name: work_order_events work_order_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_order_events_select" ON "public"."work_order_events" FOR SELECT USING (true);


--
-- Name: work_order_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_order_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: work_order_timeline work_order_timeline_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_order_timeline_insert" ON "public"."work_order_timeline" FOR INSERT WITH CHECK (true);


--
-- Name: work_order_timeline work_order_timeline_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_order_timeline_select" ON "public"."work_order_timeline" FOR SELECT USING (true);


--
-- Name: work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: work_orders work_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_orders_insert" ON "public"."work_orders" FOR INSERT WITH CHECK (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: work_orders work_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_orders_select" ON "public"."work_orders" FOR SELECT USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: work_orders work_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "work_orders_update" ON "public"."work_orders" FOR UPDATE USING (("entity_id" = ANY ("public"."auth_entities"())));


--
-- Name: workflow_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."workflow_states" ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_states workflow_states_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "workflow_states_insert" ON "public"."workflow_states" FOR INSERT WITH CHECK (true);


--
-- Name: workflow_states workflow_states_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "workflow_states_select" ON "public"."workflow_states" FOR SELECT USING (true);


--
-- Name: workflow_states workflow_states_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "workflow_states_update" ON "public"."workflow_states" FOR UPDATE USING (true);


--
-- Name: billing_worksheets worksheets_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "worksheets_all" ON "public"."billing_worksheets" USING (true);


--
-- PostgreSQL database dump complete
--

\unrestrict ZxmbTOTu0l2xMkoUO0WPEuKCmS9JHGvwpFuG6LRX4pGTHFRyW1TbsZy1SqKsagC

