-- ============================================================================
-- AssetFlow
-- Canonical Property Scope Foundation
--
-- Establishes:
--   Entity -> Portfolio -> Property
--   Property -> canonical Property Type
--
-- Important:
--   - Portfolio membership is optional.
--   - A property may belong to at most one portfolio.
--   - A portfolio may contain many properties.
--   - A portfolio must belong to the same entity as its properties.
--   - Property types may be global system types or entity-specific custom types.
--   - Legacy properties.property_type and properties.operational_region remain.
--   - Ambiguous legacy classifications are NOT guessed.
-- ============================================================================


-- ============================================================================
-- 1. CANONICAL PORTFOLIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_id uuid NOT NULL
    REFERENCES public.entities(id),

  portfolio_code text NOT NULL,
  portfolio_name text NOT NULL,
  description text,

  is_active boolean NOT NULL DEFAULT true,

  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT portfolios_entity_code_key
    UNIQUE (entity_id, portfolio_code),

  CONSTRAINT portfolios_entity_id_id_key
    UNIQUE (entity_id, id),

  CONSTRAINT portfolios_code_not_blank
    CHECK (btrim(portfolio_code) <> ''),

  CONSTRAINT portfolios_name_not_blank
    CHECK (btrim(portfolio_name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_portfolios_entity_id
  ON public.portfolios(entity_id);

CREATE INDEX IF NOT EXISTS idx_portfolios_active
  ON public.portfolios(entity_id, is_active);


-- ============================================================================
-- 2. PROPERTY CANONICAL SCOPE COLUMNS
-- ============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS portfolio_id uuid,
  ADD COLUMN IF NOT EXISTS property_type_id uuid;


-- Standard FK for property type existence.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.properties'::regclass
      AND conname = 'properties_property_type_id_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_property_type_id_fkey
      FOREIGN KEY (property_type_id)
      REFERENCES public.property_types(id);
  END IF;
END
$$;


-- Composite FK enforces:
-- property.entity_id = portfolio.entity_id
--
-- This prevents cross-entity portfolio assignment at database level.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.properties'::regclass
      AND conname = 'properties_entity_portfolio_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_entity_portfolio_fkey
      FOREIGN KEY (entity_id, portfolio_id)
      REFERENCES public.portfolios(entity_id, id);
  END IF;
END
$$;


CREATE INDEX IF NOT EXISTS idx_properties_portfolio_id
  ON public.properties(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_properties_property_type_id
  ON public.properties(property_type_id);


-- ============================================================================
-- 3. CANONICAL SYSTEM PROPERTY TYPES
-- ============================================================================
--
-- Existing system types are preserved.
-- Vacant Land is added as a distinct PROPERTY CLASSIFICATION.
--
-- This is deliberately separate from unit occupancy/vacancy status.
-- ============================================================================

INSERT INTO public.property_types (
  entity_id,
  type_name,
  is_active,
  is_system
)
SELECT
  NULL,
  'Vacant Land',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.property_types
  WHERE entity_id IS NULL
    AND lower(btrim(type_name)) = 'vacant land'
);


-- ============================================================================
-- 4. PROPERTY TYPE LINEAGE VALIDATION
-- ============================================================================
--
-- A property may use:
--   1. a global system property type (entity_id IS NULL, is_system = true), OR
--   2. a custom property type belonging to the property's own entity.
--
-- A property may NOT use another entity's custom property type.
--
-- property_type_id remains nullable during migration because existing
-- "commercial" values cannot be safely mapped to a canonical type.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_property_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_entity_id uuid;
  v_type_is_system boolean;
BEGIN
  IF NEW.property_type_id IS NOT NULL THEN
    SELECT
      pt.entity_id,
      COALESCE(pt.is_system, false)
    INTO
      v_type_entity_id,
      v_type_is_system
    FROM public.property_types pt
    WHERE pt.id = NEW.property_type_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Property type % does not exist',
        NEW.property_type_id;
    END IF;

    IF NOT (
      (v_type_entity_id IS NULL AND v_type_is_system = true)
      OR
      (v_type_entity_id = NEW.entity_id)
    ) THEN
      RAISE EXCEPTION
        'Property type % is not valid for entity %',
        NEW.property_type_id,
        NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_property_scope
  ON public.properties;

CREATE TRIGGER trg_validate_property_scope
BEFORE INSERT OR UPDATE OF entity_id, property_type_id
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.validate_property_scope();


-- ============================================================================
-- 5. SAFE LEGACY BACKFILL
-- ============================================================================
--
-- Only an unambiguous match is migrated automatically:
--
--   office -> Office
--
-- "commercial" is deliberately NOT mapped because it could represent
-- Retail, Office, Industrial, Mixed Use, etc.
-- ============================================================================

UPDATE public.properties p
SET property_type_id = pt.id
FROM public.property_types pt
WHERE p.property_type_id IS NULL
  AND lower(btrim(p.property_type)) = 'office'
  AND pt.entity_id IS NULL
  AND COALESCE(pt.is_system, false) = true
  AND lower(btrim(pt.type_name)) = 'office';


-- ============================================================================
-- 6. GOVERNED PORTFOLIO COMMANDS
-- ============================================================================
--
-- Portfolio reads are entity-scoped.
-- Portfolio writes are command-only and require explicit permissions.
-- ============================================================================

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolios_select
  ON public.portfolios;

CREATE POLICY portfolios_select
ON public.portfolios
FOR SELECT
TO authenticated
USING (
  entity_id = ANY(public.auth_entities())
);


CREATE OR REPLACE FUNCTION public.create_portfolio(
  p_entity_id uuid,
  p_portfolio_code text,
  p_portfolio_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_portfolio_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required';
  END IF;

  IF NOT (p_entity_id = ANY(public.auth_entities())) THEN
    RAISE EXCEPTION 'User does not have access to entity %', p_entity_id;
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    p_entity_id,
    'portfolio.create'
  ) THEN
    RAISE EXCEPTION 'Permission portfolio.create required';
  END IF;

  IF NULLIF(btrim(p_portfolio_code), '') IS NULL THEN
    RAISE EXCEPTION 'Portfolio code is required';
  END IF;

  IF NULLIF(btrim(p_portfolio_name), '') IS NULL THEN
    RAISE EXCEPTION 'Portfolio name is required';
  END IF;

  INSERT INTO public.portfolios (
    entity_id,
    portfolio_code,
    portfolio_name,
    description,
    created_by
  )
  VALUES (
    p_entity_id,
    btrim(p_portfolio_code),
    btrim(p_portfolio_name),
    NULLIF(btrim(p_description), ''),
    v_user_id
  )
  RETURNING id INTO v_portfolio_id;

  RETURN v_portfolio_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_portfolio(
  p_portfolio_id uuid,
  p_portfolio_code text,
  p_portfolio_name text,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT entity_id
  INTO v_entity_id
  FROM public.portfolios
  WHERE id = p_portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio % not found', p_portfolio_id;
  END IF;

  IF NOT (v_entity_id = ANY(public.auth_entities())) THEN
    RAISE EXCEPTION 'User does not have access to this portfolio';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_entity_id,
    'portfolio.edit'
  ) THEN
    RAISE EXCEPTION 'Permission portfolio.edit required';
  END IF;

  IF NULLIF(btrim(p_portfolio_code), '') IS NULL THEN
    RAISE EXCEPTION 'Portfolio code is required';
  END IF;

  IF NULLIF(btrim(p_portfolio_name), '') IS NULL THEN
    RAISE EXCEPTION 'Portfolio name is required';
  END IF;

  UPDATE public.portfolios
  SET
    portfolio_code = btrim(p_portfolio_code),
    portfolio_name = btrim(p_portfolio_name),
    description = NULLIF(btrim(p_description), ''),
    updated_at = now()
  WHERE id = p_portfolio_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.archive_portfolio(
  p_portfolio_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT entity_id
  INTO v_entity_id
  FROM public.portfolios
  WHERE id = p_portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio % not found', p_portfolio_id;
  END IF;

  IF NOT (v_entity_id = ANY(public.auth_entities())) THEN
    RAISE EXCEPTION 'User does not have access to this portfolio';
  END IF;

  IF NOT public.has_entity_permission(
    v_user_id,
    v_entity_id,
    'portfolio.archive'
  ) THEN
    RAISE EXCEPTION 'Permission portfolio.archive required';
  END IF;

  UPDATE public.portfolios
  SET
    is_active = false,
    updated_at = now()
  WHERE id = p_portfolio_id;
END;
$$;


-- ============================================================================
-- 7. CANONICAL AUTHORITY KEYS
-- ============================================================================
--
-- These keys are consumed by the governed command layer:
--
--   property.create
--   property.edit
--   property.archive
--   portfolio.create
--   portfolio.edit
--   portfolio.archive
--   property_type.manage
--
-- user_entity_permissions stores assignments, so this migration deliberately
-- does not grant these permissions to arbitrary users.
-- ============================================================================


-- ============================================================================
-- 8. PRIVILEGES
-- ============================================================================

REVOKE ALL ON TABLE public.portfolios
FROM anon, authenticated;

GRANT SELECT
ON TABLE public.portfolios
TO authenticated;

GRANT ALL
ON TABLE public.portfolios
TO service_role;


REVOKE ALL
ON FUNCTION public.create_portfolio(uuid, text, text, text)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.update_portfolio(uuid, text, text, text)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.archive_portfolio(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.create_portfolio(uuid, text, text, text)
TO authenticated, postgres, service_role;

GRANT EXECUTE
ON FUNCTION public.update_portfolio(uuid, text, text, text)
TO authenticated, postgres, service_role;

GRANT EXECUTE
ON FUNCTION public.archive_portfolio(uuid)
TO authenticated, postgres, service_role;


-- Internal validation function: not an application command.
REVOKE ALL
ON FUNCTION public.validate_property_scope()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.validate_property_scope()
TO postgres, service_role;


-- ============================================================================
-- 9. DOCUMENT THE TRANSITIONAL COLUMNS
-- ============================================================================

COMMENT ON COLUMN public.properties.portfolio_id IS
  'Canonical optional portfolio assignment. Portfolio must belong to the same entity as the property.';

COMMENT ON COLUMN public.properties.property_type_id IS
  'Canonical property classification. Temporarily nullable while ambiguous legacy property_type values are classified.';

COMMENT ON COLUMN public.properties.property_type IS
  'Legacy property type text retained temporarily for compatibility during canonical property type migration.';

COMMENT ON COLUMN public.properties.operational_region IS
  'Operational region. Must not be treated as the canonical portfolio relationship.';

COMMENT ON TABLE public.portfolios IS
  'Canonical optional grouping of properties within an AssetFlow entity. A property may belong to zero or one portfolio.';
