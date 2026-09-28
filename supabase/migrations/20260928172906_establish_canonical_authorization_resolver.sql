-- ============================================================================
-- AssetFlow
-- Canonical client authorization resolver
--
-- Purpose:
--   Cut canonical entities over to the client-account authorization model while
--   temporarily preserving the existing permission resolver for legacy entities.
--
-- Canonical authority dimensions:
--   1. Active client account
--   2. Active canonical client membership
--   3. Explicit entity access
--   4. Active client-scoped permission
--   5. Super User inherent administration authority
--   6. Explicit client-user permission override
--   7. Assigned access-profile grants
--
-- Deliberately NOT authority:
--   - organisational role type
--   - legacy org_role
--   - legacy role_id
--   - legacy user_entity_permissions for canonical entities
--
-- Transitional rule:
--   entities.client_account_id IS NULL     -> legacy resolver
--   entities.client_account_id IS NOT NULL -> canonical resolver only
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.has_entity_permission(
  p_user_id uuid,
  p_entity_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_account_id uuid;
  v_client_status text;

  v_permission_active boolean;
  v_permission_scope text;
  v_super_user_inherent boolean;

  v_client_user_id uuid;
  v_is_super_user boolean;

  v_explicit_enabled boolean;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. Fail closed for invalid input.
  -- --------------------------------------------------------------------------
  IF p_user_id IS NULL
     OR p_entity_id IS NULL
     OR p_permission_key IS NULL
     OR btrim(p_permission_key) = ''
  THEN
    RETURN false;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. Resolve the entity and determine whether it has crossed the canonical
  --    client-account boundary.
  -- --------------------------------------------------------------------------
  SELECT e.client_account_id
  INTO v_client_account_id
  FROM public.entities AS e
  WHERE e.id = p_entity_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. Transitional legacy path.
  --
  --    This is intentionally available only while client_account_id is NULL.
  --    Once an entity is canonical, legacy permission rows can no longer grant
  --    authority for that entity.
  -- --------------------------------------------------------------------------
  IF v_client_account_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_entity_permissions AS uep
      WHERE uep.user_id = p_user_id
        AND uep.entity_id = p_entity_id
        AND uep.permission_key = p_permission_key
        AND uep.enabled = true
    );
  END IF;

  -- --------------------------------------------------------------------------
  -- 4. Canonical permission must exist, be active, and be client-scoped.
  -- --------------------------------------------------------------------------
  SELECT
    pc.is_active,
    pc.scope,
    pc.super_user_inherent
  INTO
    v_permission_active,
    v_permission_scope,
    v_super_user_inherent
  FROM public.permission_catalogue AS pc
  WHERE pc.key = p_permission_key;

  IF NOT FOUND
     OR v_permission_active IS DISTINCT FROM true
     OR v_permission_scope IS DISTINCT FROM 'client'
  THEN
    RETURN false;
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. Client account must be active.
  -- --------------------------------------------------------------------------
  SELECT ca.status
  INTO v_client_status
  FROM public.client_accounts AS ca
  WHERE ca.id = v_client_account_id;

  IF NOT FOUND
     OR v_client_status IS DISTINCT FROM 'active'
  THEN
    RETURN false;
  END IF;

  -- --------------------------------------------------------------------------
  -- 6. User must be an active canonical member of this exact client account.
  --
  --    Organisational role is descriptive only and does not participate here.
  -- --------------------------------------------------------------------------
  SELECT
    cu.id,
    cu.is_super_user
  INTO
    v_client_user_id,
    v_is_super_user
  FROM public.client_users AS cu
  WHERE cu.client_account_id = v_client_account_id
    AND cu.user_id = p_user_id
    AND cu.status = 'active';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- --------------------------------------------------------------------------
  -- 7. Canonical client membership alone is insufficient.
  --
  --    The user must have explicit access to this legal entity.
  --    Legacy org_role and role_id values are deliberately ignored.
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_entity_access AS uea
    WHERE uea.user_id = p_user_id
      AND uea.entity_id = p_entity_id
  ) THEN
    RETURN false;
  END IF;

  -- --------------------------------------------------------------------------
  -- 8. Super User inherent administration authority.
  --
  --    Only catalogue permissions explicitly marked super_user_inherent are
  --    granted here. Super User does not automatically receive operational,
  --    financial, leasing, governance, or other ordinary capabilities.
  -- --------------------------------------------------------------------------
  IF v_is_super_user IS TRUE
     AND v_super_user_inherent IS TRUE
  THEN
    RETURN true;
  END IF;

  -- --------------------------------------------------------------------------
  -- 9. Explicit client-user override.
  --
  --    Explicit assignment has precedence over access profiles.
  --    enabled = false is therefore a real deny override.
  -- --------------------------------------------------------------------------
  SELECT cup.enabled
  INTO v_explicit_enabled
  FROM public.client_user_permissions AS cup
  WHERE cup.client_account_id = v_client_account_id
    AND cup.client_user_id = v_client_user_id
    AND cup.permission_key = p_permission_key;

  IF FOUND THEN
    RETURN v_explicit_enabled;
  END IF;

  -- --------------------------------------------------------------------------
  -- 10. Reusable access-profile grant.
  -- --------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM public.client_user_access_profiles AS cuap
    INNER JOIN public.access_profile_permissions AS app
      ON app.access_profile_id = cuap.access_profile_id
    WHERE cuap.client_account_id = v_client_account_id
      AND cuap.client_user_id = v_client_user_id
      AND app.permission_key = p_permission_key
  ) THEN
    RETURN true;
  END IF;

  -- --------------------------------------------------------------------------
  -- 11. No canonical authority established.
  -- --------------------------------------------------------------------------
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.has_entity_permission(
  uuid,
  uuid,
  text
) IS
'Internal AssetFlow authorization resolver. Canonical entities resolve authority from active client membership, explicit entity access, Super User inherent administration permissions, explicit client-user overrides, and access profiles. Organisational role does not confer authority. Legacy user_entity_permissions are consulted only for entities that have not yet been attached to a canonical client account.';

-- ============================================================================
-- Internal workflow primitive.
--
-- Preserve the hardened execution boundary. Governed database commands may
-- invoke this SECURITY DEFINER function internally; browser roles must not call
-- the resolver directly.
-- ============================================================================

REVOKE ALL ON FUNCTION public.has_entity_permission(
  uuid,
  uuid,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.has_entity_permission(
  uuid,
  uuid,
  text
) FROM anon;

REVOKE ALL ON FUNCTION public.has_entity_permission(
  uuid,
  uuid,
  text
) FROM authenticated;

COMMIT;
