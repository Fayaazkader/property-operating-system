-- AssetFlow
-- Canonical Leasing Opportunity Foundation
--
-- leasing_opportunities is the canonical pre-lease transaction aggregate.
--
-- This migration establishes:
--   1. authoritative transaction lineage;
--   2. immutable commercial-term versions;
--   3. immutable human approval evidence;
--   4. entity-scoped RLS;
--   5. governed commercial version creation;
--   6. governed atomic commercial approval.
--
-- Deliberately NOT handled here:
--   - lease_intake consolidation;
--   - lease document generation;
--   - execution / signing;
--   - operational lease activation;
--   - billing / deposits;
--   - commission processing;
--   - WhatsApp transport logic.
--
-- Core authority model:
--   The client decides.
--   AssetFlow understands, validates, routes, executes and records.
--
-- Commercial approval always applies to one immutable version.
-- The mutable opportunity row is NOT itself approval evidence.

BEGIN;


/* ========================================================================
 * 1. CANONICAL OPPORTUNITY LINEAGE
 * ====================================================================== */

ALTER TABLE public.leasing_opportunities
  ADD COLUMN IF NOT EXISTS vacancy_id uuid,
  ADD COLUMN IF NOT EXISTS unit_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_offer_id uuid,
  ADD COLUMN IF NOT EXISTS approved_terms_version_id uuid;

ALTER TABLE public.leasing_opportunities
  ADD CONSTRAINT leasing_opportunities_vacancy_id_fkey
    FOREIGN KEY (vacancy_id)
    REFERENCES public.vacancies(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT leasing_opportunities_unit_id_fkey
    FOREIGN KEY (unit_id)
    REFERENCES public.units(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT leasing_opportunities_accepted_offer_id_fkey
    FOREIGN KEY (accepted_offer_id)
    REFERENCES public.offers(id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_leasing_opportunities_entity
  ON public.leasing_opportunities(entity_id);

CREATE INDEX IF NOT EXISTS idx_leasing_opportunities_vacancy
  ON public.leasing_opportunities(vacancy_id);

CREATE INDEX IF NOT EXISTS idx_leasing_opportunities_unit
  ON public.leasing_opportunities(unit_id);

CREATE INDEX IF NOT EXISTS idx_leasing_opportunities_accepted_offer
  ON public.leasing_opportunities(accepted_offer_id);


/* ========================================================================
 * 2. COMMERCIAL VERSION SNAPSHOT LEDGER
 * ====================================================================== */

ALTER TABLE public.leasing_opportunity_versions
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS source_offer_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Preserve historical records by deriving tenant ownership from their parent.
UPDATE public.leasing_opportunity_versions AS v
SET entity_id = o.entity_id
FROM public.leasing_opportunities AS o
WHERE v.opportunity_id = o.id
  AND v.entity_id IS NULL;

-- We will not invent ownership for orphaned legacy records.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.leasing_opportunity_versions
    WHERE opportunity_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot harden leasing opportunity versions: orphaned version rows exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.leasing_opportunity_versions
    WHERE entity_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot harden leasing opportunity versions: entity ownership could not be resolved.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.leasing_opportunity_versions
    GROUP BY opportunity_id, version_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot harden leasing opportunity versions: duplicate opportunity/version numbers exist.';
  END IF;
END;
$$;

ALTER TABLE public.leasing_opportunity_versions
  ALTER COLUMN opportunity_id SET NOT NULL,
  ALTER COLUMN entity_id SET NOT NULL;

ALTER TABLE public.leasing_opportunity_versions
  ADD CONSTRAINT leasing_opportunity_versions_entity_id_fkey
    FOREIGN KEY (entity_id)
    REFERENCES public.entities(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT leasing_opportunity_versions_source_offer_id_fkey
    FOREIGN KEY (source_offer_id)
    REFERENCES public.offers(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT leasing_opportunity_versions_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT leasing_opportunity_versions_opportunity_version_unique
    UNIQUE (opportunity_id, version_number);

CREATE INDEX IF NOT EXISTS idx_leasing_opportunity_versions_entity
  ON public.leasing_opportunity_versions(entity_id);

CREATE INDEX IF NOT EXISTS idx_leasing_opportunity_versions_offer
  ON public.leasing_opportunity_versions(source_offer_id);


/* ========================================================================
 * 3. COMMERCIAL APPROVAL LEDGER
 * ====================================================================== */

CREATE TABLE public.leasing_commercial_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL
    REFERENCES public.entities(id)
    ON DELETE RESTRICT,

  opportunity_id uuid NOT NULL
    REFERENCES public.leasing_opportunities(id)
    ON DELETE RESTRICT,

  opportunity_version_id uuid NOT NULL
    REFERENCES public.leasing_opportunity_versions(id)
    ON DELETE RESTRICT,

  offer_id uuid
    REFERENCES public.offers(id)
    ON DELETE RESTRICT,

  decision text NOT NULL
    CHECK (decision IN ('approved', 'rejected')),

  decided_by uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,

  decided_at timestamptz NOT NULL DEFAULT now(),

  channel text NOT NULL DEFAULT 'web'
    CHECK (channel IN ('web', 'whatsapp', 'api', 'system')),

  decision_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leasing_commercial_approvals_entity
  ON public.leasing_commercial_approvals(entity_id);

CREATE INDEX idx_leasing_commercial_approvals_opportunity
  ON public.leasing_commercial_approvals(opportunity_id);

CREATE INDEX idx_leasing_commercial_approvals_version
  ON public.leasing_commercial_approvals(opportunity_version_id);

CREATE INDEX idx_leasing_commercial_approvals_decided_at
  ON public.leasing_commercial_approvals(decided_at DESC);


/* ========================================================================
 * 4. APPROVED VERSION POINTER
 * ====================================================================== */

ALTER TABLE public.leasing_opportunities
  ADD CONSTRAINT leasing_opportunities_approved_terms_version_id_fkey
    FOREIGN KEY (approved_terms_version_id)
    REFERENCES public.leasing_opportunity_versions(id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_leasing_opportunities_approved_terms_version
  ON public.leasing_opportunities(approved_terms_version_id);


/* ========================================================================
 * 5. OPPORTUNITY LINEAGE VALIDATION
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.validate_leasing_opportunity_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_property_found boolean;
  v_unit_property_id uuid;
  v_vacancy_property_id uuid;
  v_vacancy_unit_id uuid;
  v_offer_entity_id uuid;
  v_offer_vacancy_id uuid;
  v_version_entity_id uuid;
  v_version_opportunity_id uuid;
BEGIN
  IF NEW.entity_id IS NULL THEN
    RAISE EXCEPTION 'Leasing opportunity requires entity_id.';
  END IF;

  -- The opportunity's entity must have a legitimate relationship to the
  -- property: direct entity, owner entity, or managing entity.
  IF NEW.property_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.properties AS p
      WHERE p.id = NEW.property_id
        AND NEW.entity_id IN (
          p.entity_id,
          p.owner_entity_id,
          p.managing_entity_id
        )
    )
    INTO v_property_found;

    IF NOT v_property_found THEN
      RAISE EXCEPTION
        'Property does not belong to or fall under management of the leasing opportunity entity.';
    END IF;
  END IF;

  IF NEW.unit_id IS NOT NULL THEN
    SELECT u.property_id
    INTO v_unit_property_id
    FROM public.units AS u
    WHERE u.id = NEW.unit_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced unit does not exist.';
    END IF;

    IF NEW.property_id IS NULL THEN
      RAISE EXCEPTION
        'A leasing opportunity with unit_id must also identify property_id.';
    END IF;

    IF v_unit_property_id IS DISTINCT FROM NEW.property_id THEN
      RAISE EXCEPTION
        'Referenced unit does not belong to the leasing opportunity property.';
    END IF;
  END IF;

  IF NEW.vacancy_id IS NOT NULL THEN
    SELECT v.property_id, v.unit_id
    INTO v_vacancy_property_id, v_vacancy_unit_id
    FROM public.vacancies AS v
    WHERE v.id = NEW.vacancy_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced vacancy does not exist.';
    END IF;

    IF NEW.property_id IS NULL OR NEW.unit_id IS NULL THEN
      RAISE EXCEPTION
        'A leasing opportunity with vacancy_id must identify property_id and unit_id.';
    END IF;

    IF v_vacancy_property_id IS DISTINCT FROM NEW.property_id THEN
      RAISE EXCEPTION
        'Referenced vacancy does not belong to the leasing opportunity property.';
    END IF;

    IF v_vacancy_unit_id IS DISTINCT FROM NEW.unit_id THEN
      RAISE EXCEPTION
        'Referenced vacancy does not belong to the leasing opportunity unit.';
    END IF;
  END IF;

  IF NEW.accepted_offer_id IS NOT NULL THEN
    SELECT o.entity_id, o.vacancy_id
    INTO v_offer_entity_id, v_offer_vacancy_id
    FROM public.offers AS o
    WHERE o.id = NEW.accepted_offer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced accepted offer does not exist.';
    END IF;

    IF v_offer_entity_id IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION
        'Accepted offer does not belong to the leasing opportunity entity.';
    END IF;

    IF NEW.vacancy_id IS NULL THEN
      RAISE EXCEPTION
        'A leasing opportunity with accepted_offer_id must identify vacancy_id.';
    END IF;

    IF v_offer_vacancy_id IS DISTINCT FROM NEW.vacancy_id THEN
      RAISE EXCEPTION
        'Accepted offer does not belong to the leasing opportunity vacancy.';
    END IF;
  END IF;

  IF NEW.approved_terms_version_id IS NOT NULL THEN
    SELECT v.entity_id, v.opportunity_id
    INTO v_version_entity_id, v_version_opportunity_id
    FROM public.leasing_opportunity_versions AS v
    WHERE v.id = NEW.approved_terms_version_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Approved commercial version does not exist.';
    END IF;

    IF v_version_entity_id IS DISTINCT FROM NEW.entity_id
       OR v_version_opportunity_id IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION
        'Approved commercial version does not belong to this leasing opportunity.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_leasing_opportunity_lineage
  ON public.leasing_opportunities;

CREATE TRIGGER validate_leasing_opportunity_lineage
BEFORE INSERT OR UPDATE
ON public.leasing_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.validate_leasing_opportunity_lineage();


/* ========================================================================
 * 6. VERSION LINEAGE VALIDATION + IMMUTABILITY
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.validate_leasing_opportunity_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_opportunity_entity_id uuid;
  v_opportunity_vacancy_id uuid;
  v_offer_entity_id uuid;
  v_offer_vacancy_id uuid;
BEGIN
  SELECT o.entity_id, o.vacancy_id
  INTO v_opportunity_entity_id, v_opportunity_vacancy_id
  FROM public.leasing_opportunities AS o
  WHERE o.id = NEW.opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced leasing opportunity does not exist.';
  END IF;

  IF NEW.entity_id IS DISTINCT FROM v_opportunity_entity_id THEN
    RAISE EXCEPTION
      'Commercial version entity does not match leasing opportunity entity.';
  END IF;

  IF NEW.source_offer_id IS NOT NULL THEN
    SELECT o.entity_id, o.vacancy_id
    INTO v_offer_entity_id, v_offer_vacancy_id
    FROM public.offers AS o
    WHERE o.id = NEW.source_offer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced source offer does not exist.';
    END IF;

    IF v_offer_entity_id IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION
        'Source offer does not belong to commercial version entity.';
    END IF;

    IF v_opportunity_vacancy_id IS NOT NULL
       AND v_offer_vacancy_id IS DISTINCT FROM v_opportunity_vacancy_id THEN
      RAISE EXCEPTION
        'Source offer does not belong to leasing opportunity vacancy.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_leasing_opportunity_version
  ON public.leasing_opportunity_versions;

CREATE TRIGGER validate_leasing_opportunity_version
BEFORE INSERT
ON public.leasing_opportunity_versions
FOR EACH ROW
EXECUTE FUNCTION public.validate_leasing_opportunity_version();


CREATE OR REPLACE FUNCTION public.prevent_leasing_commercial_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Commercial term versions are immutable; create a new version instead.';
END;
$$;

DROP TRIGGER IF EXISTS prevent_leasing_commercial_version_update
  ON public.leasing_opportunity_versions;

CREATE TRIGGER prevent_leasing_commercial_version_update
BEFORE UPDATE
ON public.leasing_opportunity_versions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_leasing_commercial_version_mutation();

DROP TRIGGER IF EXISTS prevent_leasing_commercial_version_delete
  ON public.leasing_opportunity_versions;

CREATE TRIGGER prevent_leasing_commercial_version_delete
BEFORE DELETE
ON public.leasing_opportunity_versions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_leasing_commercial_version_mutation();


/* ========================================================================
 * 7. APPROVAL IMMUTABILITY
 * ====================================================================== */

CREATE OR REPLACE FUNCTION public.prevent_leasing_commercial_approval_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Commercial approval records are immutable.';
END;
$$;

DROP TRIGGER IF EXISTS prevent_leasing_commercial_approval_update
  ON public.leasing_commercial_approvals;

CREATE TRIGGER prevent_leasing_commercial_approval_update
BEFORE UPDATE
ON public.leasing_commercial_approvals
FOR EACH ROW
EXECUTE FUNCTION public.prevent_leasing_commercial_approval_mutation();

DROP TRIGGER IF EXISTS prevent_leasing_commercial_approval_delete
  ON public.leasing_commercial_approvals;

CREATE TRIGGER prevent_leasing_commercial_approval_delete
BEFORE DELETE
ON public.leasing_commercial_approvals
FOR EACH ROW
EXECUTE FUNCTION public.prevent_leasing_commercial_approval_mutation();


/* ========================================================================
 * 8. RLS HARDENING
 * ====================================================================== */

ALTER TABLE public.leasing_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leasing_opportunity_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leasing_commercial_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leasing_opportunities_all
  ON public.leasing_opportunities;

DROP POLICY IF EXISTS leasing_opportunities_select
  ON public.leasing_opportunities;

DROP POLICY IF EXISTS leasing_opportunities_insert
  ON public.leasing_opportunities;

DROP POLICY IF EXISTS leasing_opportunities_update
  ON public.leasing_opportunities;

DROP POLICY IF EXISTS leasing_opportunities_delete
  ON public.leasing_opportunities;

CREATE POLICY leasing_opportunities_select
ON public.leasing_opportunities
FOR SELECT
USING (
  entity_id = ANY(public.auth_entities())
);

CREATE POLICY leasing_opportunities_insert
ON public.leasing_opportunities
FOR INSERT
WITH CHECK (
  entity_id = ANY(public.auth_entities())
);

CREATE POLICY leasing_opportunities_update
ON public.leasing_opportunities
FOR UPDATE
USING (
  entity_id = ANY(public.auth_entities())
)
WITH CHECK (
  entity_id = ANY(public.auth_entities())
);

CREATE POLICY leasing_opportunities_delete
ON public.leasing_opportunities
FOR DELETE
USING (
  entity_id = ANY(public.auth_entities())
);


DROP POLICY IF EXISTS leasing_opportunity_versions_all
  ON public.leasing_opportunity_versions;

DROP POLICY IF EXISTS leasing_opportunity_versions_select
  ON public.leasing_opportunity_versions;

DROP POLICY IF EXISTS leasing_opportunity_versions_insert
  ON public.leasing_opportunity_versions;

CREATE POLICY leasing_opportunity_versions_select
ON public.leasing_opportunity_versions
FOR SELECT
USING (
  entity_id = ANY(public.auth_entities())
);

-- No direct INSERT / UPDATE / DELETE policy.
-- Versions are created through the governed RPC.


DROP POLICY IF EXISTS leasing_commercial_approvals_select
  ON public.leasing_commercial_approvals;

CREATE POLICY leasing_commercial_approvals_select
ON public.leasing_commercial_approvals
FOR SELECT
USING (
  entity_id = ANY(public.auth_entities())
);

-- No direct INSERT / UPDATE / DELETE policy.
-- Decisions are recorded through governed RPCs.


/* ========================================================================
 * 9. GOVERNED COMMERCIAL VERSION CREATION
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

  /*
   * Complete immutable commercial snapshot.
   *
   * This is intentionally separate from the mutable opportunity row.
   * Later lease generation must consume an approved version, not current
   * working values from leasing_opportunities.
   */
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
    'beneficialOccupationDate', v_opportunity.beneficial_occupation_date,

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
    NULL,
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'version_number', v_next_version,
      'source_offer_id', p_source_offer_id,
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
    'snapshot', v_snapshot
  );
END;
$$;


/* ========================================================================
 * 10. ATOMIC COMMERCIAL APPROVAL
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

  /*
   * Lock the canonical transaction. All validation, approval evidence,
   * pointer mutation and audit work occurs in this transaction.
   */
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

  /*
   * Approval applies to the exact immutable snapshot.
   *
   * The RPC does not decide whether the commercial terms are commercially
   * acceptable. The authorised client user has made that decision.
   */
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
      'status', 'internal_approval',
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
    'status', 'internal_approval'
  );
END;
$$;


/* ========================================================================
 * 11. FUNCTION PRIVILEGES
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


COMMIT;
