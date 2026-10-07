-- AssetFlow: canonical Lease Template Administration access profile.
--
-- This profile grants governed administration of lease templates.
-- It remains separate from Lease Authority so template governance
-- and commercial/execution authority are independently assignable.

DO $$
DECLARE
  v_client record;
  v_profile_id uuid;
  v_permission_key text;
  v_permission_keys constant text[] := ARRAY[
    'leasing.template.create',
    'leasing.template.edit',
    'leasing.template.review',
    'leasing.template.approve',
    'leasing.template.archive'
  ];
BEGIN
  FOR v_client IN
    SELECT DISTINCT client_account_id
    FROM public.access_profiles
    WHERE system_key = 'standard_access'
      AND client_account_id IS NOT NULL
  LOOP
    SELECT id
    INTO v_profile_id
    FROM public.access_profiles
    WHERE client_account_id = v_client.client_account_id
      AND name = 'Lease Template Administration'
      AND system_key IS NULL
      AND is_system = false
    LIMIT 1;

    IF v_profile_id IS NULL THEN
      INSERT INTO public.access_profiles (
        client_account_id,
        name,
        description,
        is_system,
        system_key
      )
      VALUES (
        v_client.client_account_id,
        'Lease Template Administration',
        'Governed authority to create, edit, review, approve and archive lease templates.',
        false,
        NULL
      )
      RETURNING id INTO v_profile_id;
    END IF;

    FOREACH v_permission_key IN ARRAY v_permission_keys
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.permission_catalogue pc
        WHERE pc.key = v_permission_key
          AND pc.is_active = true
          AND pc.assignable_by_client = true
          AND pc.scope = 'client'
      ) THEN
        RAISE EXCEPTION
          'Required canonical permission % is unavailable or not client-assignable',
          v_permission_key;
      END IF;
    END LOOP;

    -- The named canonical profile must contain exactly the intended
    -- lease-template administration capability set.
    DELETE FROM public.access_profile_permissions
    WHERE access_profile_id = v_profile_id
      AND NOT (permission_key = ANY(v_permission_keys));

    FOREACH v_permission_key IN ARRAY v_permission_keys
    LOOP
      INSERT INTO public.access_profile_permissions (
        access_profile_id,
        permission_key
      )
      VALUES (
        v_profile_id,
        v_permission_key
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    IF (
      SELECT count(*)
      FROM public.access_profile_permissions app
      WHERE app.access_profile_id = v_profile_id
        AND app.permission_key = ANY(v_permission_keys)
    ) <> 5 THEN
      RAISE EXCEPTION
        'Lease Template Administration permission provisioning failed for client %',
        v_client.client_account_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.access_profile_permissions app
      WHERE app.access_profile_id = v_profile_id
        AND NOT (app.permission_key = ANY(v_permission_keys))
    ) THEN
      RAISE EXCEPTION
        'Lease Template Administration contains unexpected permissions for client %',
        v_client.client_account_id;
    END IF;
  END LOOP;
END;
$$;
