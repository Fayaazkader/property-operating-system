-- AssetFlow
-- Bootstrap the first controlled canonical client account.
--
-- Existing legal entity:
--   Testing / ENT-000007
--
-- Initial canonical client user:
--   kmohammedfayaaz@gmail.com
--   Organisational role: Property Manager
--   Super User: yes
--
-- This is a controlled data canonicalisation migration.
-- It does not infer authority from the organisational role and does not
-- grant operational or governance permissions.

DO $bootstrap$
DECLARE
  v_entity_id constant uuid :=
    '682a1ffc-b368-47de-9ca1-58a6b1b415c4'::uuid;

  v_user_id constant uuid :=
    '9b1d3862-1eb2-45db-bd78-cec200d86d24'::uuid;

  v_expected_email constant text :=
    'kmohammedfayaaz@gmail.com';

  v_client_account_id uuid := gen_random_uuid();
  v_role_type_id uuid := gen_random_uuid();
  v_client_user_id uuid := gen_random_uuid();

  v_entity_name text;
  v_entity_code text;
  v_existing_client_account_id uuid;
  v_auth_email text;
  v_entity_access_count integer;
BEGIN
  /*
   * ------------------------------------------------------------
   * 1. Assert the exact existing legal entity being canonicalised.
   * ------------------------------------------------------------
   */

  SELECT
    e.entity_name,
    e.entity_code,
    e.client_account_id
  INTO
    v_entity_name,
    v_entity_code,
    v_existing_client_account_id
  FROM public.entities e
  WHERE e.id = v_entity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Bootstrap aborted: expected Testing entity % does not exist',
      v_entity_id;
  END IF;

  IF v_entity_name IS DISTINCT FROM 'Testing'
     OR v_entity_code IS DISTINCT FROM 'ENT-000007'
  THEN
    RAISE EXCEPTION
      'Bootstrap aborted: entity identity mismatch for %. Found name %, code %',
      v_entity_id,
      v_entity_name,
      v_entity_code;
  END IF;

  IF v_existing_client_account_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Bootstrap aborted: Testing entity % is already assigned to client account %',
      v_entity_id,
      v_existing_client_account_id;
  END IF;


  /*
   * ------------------------------------------------------------
   * 2. Assert the controlled authenticated identity.
   * ------------------------------------------------------------
   */

  SELECT lower(btrim(u.email))
  INTO v_auth_email
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Bootstrap aborted: controlled auth user % does not exist',
      v_user_id;
  END IF;

  IF v_auth_email IS DISTINCT FROM lower(v_expected_email) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: controlled user email mismatch. Expected %, found %',
      v_expected_email,
      v_auth_email;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_user_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: controlled user % has no profile',
      v_user_id;
  END IF;


  /*
   * ------------------------------------------------------------
   * 3. Assert explicit access to the existing legal entity.
   *
   * The existing row is retained unchanged. Its legacy org_role
   * is transitional compatibility data and is not canonical
   * authorization.
   * ------------------------------------------------------------
   */

  SELECT count(*)
  INTO v_entity_access_count
  FROM public.user_entity_access uea
  WHERE uea.user_id = v_user_id
    AND uea.entity_id = v_entity_id;

  IF v_entity_access_count <> 1 THEN
    RAISE EXCEPTION
      'Bootstrap aborted: expected exactly one entity-access row for user % and entity %, found %',
      v_user_id,
      v_entity_id,
      v_entity_access_count;
  END IF;


  /*
   * ------------------------------------------------------------
   * 4. Assert this controlled bootstrap has not already occurred.
   * ------------------------------------------------------------
   */

  IF EXISTS (
    SELECT 1
    FROM public.client_accounts ca
    WHERE lower(btrim(ca.name)) = 'testing'
  ) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: a client account named Testing already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_users cu
    WHERE cu.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: controlled user % already has canonical client membership',
      v_user_id;
  END IF;


  /*
   * ------------------------------------------------------------
   * 5. Create the canonical client account.
   * ------------------------------------------------------------
   */

  INSERT INTO public.client_accounts (
    id,
    name,
    status
  )
  VALUES (
    v_client_account_id,
    'Testing',
    'active'
  );


  /*
   * ------------------------------------------------------------
   * 6. Create the required organisational role.
   *
   * This describes what the user does. It grants no authority.
   * ------------------------------------------------------------
   */

  INSERT INTO public.client_role_types (
    id,
    client_account_id,
    name,
    description,
    is_active
  )
  VALUES (
    v_role_type_id,
    v_client_account_id,
    'Property Manager',
    'Property Manager organisational role.',
    true
  );


  /*
   * ------------------------------------------------------------
   * 7. Establish canonical client membership.
   *
   * Super User is explicit client-administration authority.
   * No operational/governance capabilities are granted here.
   * ------------------------------------------------------------
   */

  INSERT INTO public.client_users (
    id,
    client_account_id,
    user_id,
    role_type_id,
    is_super_user,
    status
  )
  VALUES (
    v_client_user_id,
    v_client_account_id,
    v_user_id,
    v_role_type_id,
    true,
    'active'
  );


  /*
   * ------------------------------------------------------------
   * 8. Attach the existing legal entity to the client account.
   * ------------------------------------------------------------
   */

  UPDATE public.entities
  SET
    client_account_id = v_client_account_id,
    updated_at = now()
  WHERE id = v_entity_id
    AND client_account_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Bootstrap aborted: Testing entity % could not be attached to client account',
      v_entity_id;
  END IF;


  /*
   * ------------------------------------------------------------
   * 9. Final graph assertions.
   * ------------------------------------------------------------
   */

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_users cu
    JOIN public.client_role_types crt
      ON crt.client_account_id = cu.client_account_id
     AND crt.id = cu.role_type_id
    JOIN public.entities e
      ON e.client_account_id = cu.client_account_id
    WHERE cu.id = v_client_user_id
      AND cu.user_id = v_user_id
      AND cu.client_account_id = v_client_account_id
      AND cu.status = 'active'
      AND cu.is_super_user = true
      AND crt.name = 'Property Manager'
      AND crt.is_active = true
      AND e.id = v_entity_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: canonical Testing client graph failed final validation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_user_permissions cup
    WHERE cup.client_user_id = v_client_user_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: unexpected operational permission assignment detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_user_access_profiles cuap
    WHERE cuap.client_user_id = v_client_user_id
  ) THEN
    RAISE EXCEPTION
      'Bootstrap aborted: unexpected access profile assignment detected';
  END IF;

  RAISE NOTICE
    'Canonical Testing client bootstrap validated: client_account=%, client_user=%, role_type=%, entity=%',
    v_client_account_id,
    v_client_user_id,
    v_role_type_id,
    v_entity_id;
END;
$bootstrap$;
