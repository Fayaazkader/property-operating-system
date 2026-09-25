BEGIN;

-- ---------------------------------------------------------------------------
-- Canonical administration permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permission_catalogue (
  "key",
  category,
  name,
  description
)
VALUES
  (
    'admin.users',
    'admin',
    'Manage Users',
    'View entity members and administer their entity-scoped permissions.'
  ),
  (
    'admin.roles',
    'admin',
    'Manage Roles',
    'Create and maintain entity-scoped roles and permission bundles.'
  ),
  (
    'admin.settings',
    'admin',
    'Manage Settings',
    'Manage entity-level administrative settings.'
  ),
  (
    'admin.features',
    'admin',
    'Manage Feature Flags',
    'Manage entity-level feature configuration.'
  )
ON CONFLICT ("key") DO UPDATE
SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;


-- ---------------------------------------------------------------------------
-- Internal authority helper.
--
-- admin.users is the canonical capability.
-- entity_admin/platform_admin remain bootstrap compatibility paths so that
-- existing administrators are not locked out before explicit permissions
-- have been provisioned.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_administer_entity_users(
  p_entity_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      CASE
        -- Once an explicit capability assignment exists, it is authoritative.
        WHEN EXISTS (
          SELECT 1
          FROM public.user_entity_permissions uep
          WHERE uep.user_id = auth.uid()
            AND uep.entity_id = p_entity_id
            AND uep.permission_key = 'admin.users'
        )
        THEN EXISTS (
          SELECT 1
          FROM public.user_entity_permissions uep
          WHERE uep.user_id = auth.uid()
            AND uep.entity_id = p_entity_id
            AND uep.permission_key = 'admin.users'
            AND uep.enabled = true
        )

        -- Bootstrap compatibility only while no explicit assignment exists.
        ELSE (
          EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.platform_role = 'platform_admin'
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_entity_access uea
            WHERE uea.user_id = auth.uid()
              AND uea.entity_id = p_entity_id
              AND uea.org_role = 'entity_admin'
          )
        )
      END
    );
$$;

REVOKE ALL ON FUNCTION public.can_administer_entity_users(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_administer_entity_users(uuid) FROM authenticated;


-- ---------------------------------------------------------------------------
-- user_entity_access
--
-- Membership is canonical here.
-- Users can see their own memberships.
-- Entity user administrators can see memberships in entities they administer.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_entity_access_select"
  ON public.user_entity_access;

CREATE POLICY "user_entity_access_select"
ON public.user_entity_access
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_administer_entity_users(entity_id)
);


-- ---------------------------------------------------------------------------
-- user_entity_permissions
--
-- Remove legacy open mutation/read policies.
-- Users may inspect their own assignments.
-- Entity user administrators may inspect assignments for their entity.
-- Direct browser mutation is removed; governed RPC below performs writes.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_entity_permissions_insert"
  ON public.user_entity_permissions;

DROP POLICY IF EXISTS "user_entity_permissions_select"
  ON public.user_entity_permissions;

DROP POLICY IF EXISTS "user_entity_permissions_update"
  ON public.user_entity_permissions;

DROP POLICY IF EXISTS "user_entity_permissions_delete"
  ON public.user_entity_permissions;

CREATE POLICY "user_entity_permissions_select"
ON public.user_entity_permissions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_administer_entity_users(entity_id)
);

REVOKE INSERT, UPDATE, DELETE
ON public.user_entity_permissions
FROM authenticated;


-- ---------------------------------------------------------------------------
-- Governed permission administration command
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_entity_user_permissions(
  p_entity_id uuid,
  p_target_user_id uuid,
  p_permissions jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_permission record;
  v_old_permissions jsonb;
  v_new_permissions jsonb;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF p_permissions IS NULL
     OR jsonb_typeof(p_permissions) <> 'object' THEN
    RAISE EXCEPTION 'Permissions must be a JSON object';
  END IF;

  IF NOT public.can_administer_entity_users(p_entity_id) THEN
    RAISE EXCEPTION 'Permission denied: admin.users required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_entity_access
    WHERE user_id = p_target_user_id
      AND entity_id = p_entity_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of this entity';
  END IF;

  -- Every submitted key must exist in the canonical catalogue.
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_permissions) j
    LEFT JOIN public.permission_catalogue pc
      ON pc.key = j.key
    WHERE pc.key IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more permission keys are not registered';
  END IF;

  -- Every submitted value must be a JSON boolean.
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_permissions) j
    WHERE jsonb_typeof(j.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'Permission values must be boolean';
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(permission_key, enabled),
    '{}'::jsonb
  )
  INTO v_old_permissions
  FROM public.user_entity_permissions
  WHERE user_id = p_target_user_id
    AND entity_id = p_entity_id;

  FOR v_permission IN
    SELECT
      j.key AS permission_key,
      (j.value #>> '{}')::boolean AS enabled
    FROM jsonb_each(p_permissions) j
  LOOP
    INSERT INTO public.user_entity_permissions (
      user_id,
      entity_id,
      permission_key,
      enabled,
      assigned_by,
      updated_at
    )
    VALUES (
      p_target_user_id,
      p_entity_id,
      v_permission.permission_key,
      v_permission.enabled,
      v_actor_id,
      now()
    )
    ON CONFLICT (user_id, entity_id, permission_key)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      assigned_by = EXCLUDED.assigned_by,
      updated_at = now();
  END LOOP;

  SELECT COALESCE(
    jsonb_object_agg(permission_key, enabled),
    '{}'::jsonb
  )
  INTO v_new_permissions
  FROM public.user_entity_permissions
  WHERE user_id = p_target_user_id
    AND entity_id = p_entity_id;

  SELECT email
  INTO v_actor_email
  FROM public.profiles
  WHERE id = v_actor_id;

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    resource_label,
    old_values,
    new_values,
    user_agent
  )
  VALUES (
    v_actor_id,
    v_actor_email,
    'update',
    'user_entity_permissions',
    p_target_user_id,
    'Entity user permissions',
    jsonb_build_object(
      'entity_id', p_entity_id,
      'permissions', v_old_permissions
    ),
    jsonb_build_object(
      'entity_id', p_entity_id,
      'permissions', v_new_permissions
    ),
    p_user_agent
  );

  RETURN jsonb_build_object(
    'success', true,
    'entity_id', p_entity_id,
    'user_id', p_target_user_id,
    'permissions', v_new_permissions
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.set_entity_user_permissions(uuid, uuid, jsonb, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.set_entity_user_permissions(uuid, uuid, jsonb, text)
TO authenticated;


-- ---------------------------------------------------------------------------
-- Role catalogue hardening
--
-- Role reads remain entity-scoped. Direct browser role mutation is removed.
-- Role administration will use governed commands rather than open RLS writes.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "roles_insert"
  ON public.roles;

DROP POLICY IF EXISTS "roles_select"
  ON public.roles;

DROP POLICY IF EXISTS "roles_update"
  ON public.roles;

DROP POLICY IF EXISTS "roles_delete"
  ON public.roles;

CREATE POLICY "roles_select"
ON public.roles
FOR SELECT
TO authenticated
USING (
  entity_id = ANY(public.auth_entities())
);

REVOKE INSERT, UPDATE, DELETE
ON public.roles
FROM authenticated;


-- ---------------------------------------------------------------------------
-- Governed role assignment
--
-- A role assignment is one transaction:
--   1. validate actor authority;
--   2. validate target membership;
--   3. validate role belongs to the same entity;
--   4. update canonical membership role_id / org_role;
--   5. replace explicit permission assignments with the role bundle;
--   6. preserve an audit record.
--
-- org_role remains the coarse organisational classification used by legacy
-- application paths. The canonical role itself is represented by role_id.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_entity_user_role(
  p_entity_id uuid,
  p_target_user_id uuid,
  p_role_id uuid,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_email text;

  v_role_name text;
  v_role_permissions text[];

  v_old_role_id uuid;
  v_old_org_role text;

  v_new_org_role text;
  v_permission_key text;

  v_old_permissions jsonb;
  v_new_permissions jsonb;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity is required';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role is required';
  END IF;

  IF NOT public.can_administer_entity_users(p_entity_id) THEN
    RAISE EXCEPTION 'Permission denied: admin.users required';
  END IF;

  SELECT
    uea.role_id,
    uea.org_role
  INTO
    v_old_role_id,
    v_old_org_role
  FROM public.user_entity_access uea
  WHERE uea.user_id = p_target_user_id
    AND uea.entity_id = p_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user is not a member of this entity';
  END IF;

  SELECT
    r.name,
    r.role_permissions
  INTO
    v_role_name,
    v_role_permissions
  FROM public.roles r
  WHERE r.id = p_role_id
    AND r.entity_id = p_entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role does not belong to this entity';
  END IF;

  -- Every permission carried by the role must exist in the canonical
  -- permission catalogue. This prevents stale/hard-coded role bundles from
  -- silently granting unknown capabilities.
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(v_role_permissions, ARRAY[]::text[])) rp
    LEFT JOIN public.permission_catalogue pc
      ON pc.key = rp
    WHERE pc.key IS NULL
  ) THEN
    RAISE EXCEPTION 'Role contains one or more unregistered permissions';
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(permission_key, enabled),
    '{}'::jsonb
  )
  INTO v_old_permissions
  FROM public.user_entity_permissions
  WHERE user_id = p_target_user_id
    AND entity_id = p_entity_id;

  -- Preserve the legacy coarse organisational classification only where the
  -- role name maps to one of its allowed values. Otherwise retain the existing
  -- org_role. role_id is the canonical assigned role.
  v_new_org_role :=
    CASE
      WHEN v_role_name IN (
        'entity_admin',
        'finance',
        'property_manager',
        'read_only',
        'executive'
      )
      THEN v_role_name
      ELSE v_old_org_role
    END;

  UPDATE public.user_entity_access
  SET
    role_id = p_role_id,
    org_role = v_new_org_role
  WHERE user_id = p_target_user_id
    AND entity_id = p_entity_id;

  -- Role assignment replaces the explicit capability set for this
  -- user/entity with the selected role bundle.
  DELETE FROM public.user_entity_permissions
  WHERE user_id = p_target_user_id
    AND entity_id = p_entity_id;

  FOREACH v_permission_key IN ARRAY
    COALESCE(v_role_permissions, ARRAY[]::text[])
  LOOP
    INSERT INTO public.user_entity_permissions (
      user_id,
      entity_id,
      permission_key,
      enabled,
      assigned_by,
      updated_at
    )
    VALUES (
      p_target_user_id,
      p_entity_id,
      v_permission_key,
      true,
      v_actor_id,
      now()
    );
  END LOOP;

  SELECT COALESCE(
    jsonb_object_agg(permission_key, enabled),
    '{}'::jsonb
  )
  INTO v_new_permissions
  FROM public.user_entity_permissions
  WHERE user_id = p_target_user_id
    AND entity_id = p_entity_id;

  SELECT p.email
  INTO v_actor_email
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    resource_label,
    old_values,
    new_values,
    user_agent
  )
  VALUES (
    v_actor_id,
    v_actor_email,
    'update',
    'user_entity_access',
    p_target_user_id,
    'Entity user role',
    jsonb_build_object(
      'entity_id', p_entity_id,
      'role_id', v_old_role_id,
      'org_role', v_old_org_role,
      'permissions', v_old_permissions
    ),
    jsonb_build_object(
      'entity_id', p_entity_id,
      'role_id', p_role_id,
      'role_name', v_role_name,
      'org_role', v_new_org_role,
      'permissions', v_new_permissions
    ),
    p_user_agent
  );

  RETURN jsonb_build_object(
    'success', true,
    'entity_id', p_entity_id,
    'user_id', p_target_user_id,
    'role_id', p_role_id,
    'role_name', v_role_name,
    'org_role', v_new_org_role,
    'permissions', v_new_permissions
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.assign_entity_user_role(uuid, uuid, uuid, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.assign_entity_user_role(uuid, uuid, uuid, text)
TO authenticated;

COMMIT;
