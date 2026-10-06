DO $$
DECLARE
  v_client record;
  v_profile_id uuid;
  v_permission_key text;
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
      AND name = 'Lease Authority'
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
        'Lease Authority',
        'Elevated authority for commercial approval, governed lease generation, execution and activation.',
        false,
        NULL
      )
      RETURNING id INTO v_profile_id;
    END IF;

    FOREACH v_permission_key IN ARRAY ARRAY[
      'leasing.commercial.approve',
      'leasing.document.generate',
      'leasing.execution.send',
      'leasing.activation.execute'
    ]
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
  END LOOP;
END;
$$;
