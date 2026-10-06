-- AssetFlow
-- Canonicalise the existing Sandton Property Holdings production entity.
--
-- This migration deliberately preserves the existing legal entity UUID and
-- all property/data lineage attached to it.
--
-- It establishes:
--   - a canonical client account;
--   - an initial organisational role;
--   - an active canonical client user;
--   - explicit Super User administration authority;
--   - the existing Sandton entity inside the client boundary;
--   - current Standard Access operational authority.
--
-- Existing user_entity_access rows are preserved.
-- Legacy role fields remain compatibility data and do not grant canonical
-- authority once the entity is attached to the client account.

DO $canonicalise$
DECLARE
    v_entity_id constant uuid :=
        '00000000-0000-0000-0000-000000000101'::uuid;

    v_user_id constant uuid :=
        '5808794c-67fa-45af-b729-b99cace2b3d7'::uuid;

    v_expected_email constant text :=
        'fayaaz318@gmail.com';

    v_expected_entity_code constant text :=
        'SPH';

    v_expected_entity_name constant text :=
        'Sandton Property Holdings';

    v_client_account_id uuid := gen_random_uuid();
    v_role_type_id uuid := gen_random_uuid();
    v_client_user_id uuid := gen_random_uuid();
    v_standard_access_profile_id uuid;

    v_entity_code text;
    v_entity_name text;
    v_existing_client_account_id uuid;
    v_auth_email text;
    v_entity_access_count integer;
    v_property_ref_count integer;
BEGIN
    /*
     * ------------------------------------------------------------
     * 1. Lock and assert the exact existing legal entity.
     * ------------------------------------------------------------
     */

    SELECT
        e.entity_code,
        e.entity_name,
        e.client_account_id
    INTO
        v_entity_code,
        v_entity_name,
        v_existing_client_account_id
    FROM public.entities AS e
    WHERE e.id = v_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: expected Sandton entity % does not exist',
            v_entity_id;
    END IF;

    IF v_entity_code IS DISTINCT FROM v_expected_entity_code
       OR v_entity_name IS DISTINCT FROM v_expected_entity_name
    THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Sandton entity identity mismatch. Expected code % / name %, found code % / name %',
            v_expected_entity_code,
            v_expected_entity_name,
            v_entity_code,
            v_entity_name;
    END IF;

    IF v_existing_client_account_id IS NOT NULL THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Sandton entity % is already assigned to client account %',
            v_entity_id,
            v_existing_client_account_id;
    END IF;


    /*
     * ------------------------------------------------------------
     * 2. Protect existing operational property lineage.
     *
     * Four property references were verified immediately before
     * this controlled migration. Refuse to proceed if that known
     * production shape has unexpectedly changed.
     * ------------------------------------------------------------
     */

    SELECT count(DISTINCT p.id)
    INTO v_property_ref_count
    FROM public.properties AS p
    WHERE p.entity_id = v_entity_id
       OR p.owner_entity_id = v_entity_id
       OR p.managing_entity_id = v_entity_id;

    IF v_property_ref_count <> 4 THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: expected 4 Sandton property references, found %',
            v_property_ref_count;
    END IF;


    /*
     * ------------------------------------------------------------
     * 3. Assert the exact initial authenticated identity.
     * ------------------------------------------------------------
     */

    SELECT lower(btrim(au.email))
    INTO v_auth_email
    FROM auth.users AS au
    WHERE au.id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: expected auth user % does not exist',
            v_user_id;
    END IF;

    IF v_auth_email IS DISTINCT FROM lower(v_expected_email) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: user email mismatch. Expected %, found %',
            v_expected_email,
            v_auth_email;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = v_user_id
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: user % has no profile',
            v_user_id;
    END IF;


    /*
     * ------------------------------------------------------------
     * 4. Assert existing explicit Sandton access.
     * ------------------------------------------------------------
     */

    SELECT count(*)
    INTO v_entity_access_count
    FROM public.user_entity_access AS uea
    WHERE uea.user_id = v_user_id
      AND uea.entity_id = v_entity_id;

    IF v_entity_access_count <> 1 THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: expected exactly one Sandton entity-access row for user %, found %',
            v_user_id,
            v_entity_access_count;
    END IF;


    /*
     * ------------------------------------------------------------
     * 5. Refuse conflicting or repeated canonical provisioning.
     * ------------------------------------------------------------
     */

    IF EXISTS (
        SELECT 1
        FROM public.client_accounts AS ca
        WHERE lower(btrim(ca.name)) =
              lower(btrim(v_expected_entity_name))
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: client account named % already exists',
            v_expected_entity_name;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_users AS cu
        WHERE cu.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: user % already has canonical client membership',
            v_user_id;
    END IF;


    /*
     * ------------------------------------------------------------
     * 6. Create the canonical client boundary.
     * ------------------------------------------------------------
     */

    INSERT INTO public.client_accounts (
        id,
        name,
        status
    )
    VALUES (
        v_client_account_id,
        v_expected_entity_name,
        'active'
    );


    /*
     * ------------------------------------------------------------
     * 7. Create the initial organisational role.
     *
     * This describes organisational responsibility only.
     * It does not itself confer operational authority.
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
     * 8. Establish initial canonical membership.
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
     * 9. Attach the EXISTING Sandton legal entity.
     *
     * No replacement entity is created. Existing UUID and all
     * property relationships remain unchanged.
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
            'Canonicalisation aborted: Sandton entity % could not be attached',
            v_entity_id;
    END IF;


    /*
     * ------------------------------------------------------------
     * 10. Establish the current mandatory Standard Access profile.
     * ------------------------------------------------------------
     */

    v_standard_access_profile_id :=
        public.sync_standard_access_profile_internal(
            v_client_account_id,
            v_user_id
        );

    IF v_standard_access_profile_id IS NULL THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Standard Access profile could not be established';
    END IF;

    INSERT INTO public.client_user_access_profiles (
        client_account_id,
        client_user_id,
        access_profile_id,
        assigned_by
    )
    VALUES (
        v_client_account_id,
        v_client_user_id,
        v_standard_access_profile_id,
        v_user_id
    )
    ON CONFLICT (client_user_id, access_profile_id)
    DO NOTHING;


    /*
     * ------------------------------------------------------------
     * 11. Final canonical graph validation.
     * ------------------------------------------------------------
     */

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_accounts AS ca
        WHERE ca.id = v_client_account_id
          AND ca.status = 'active'
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: active client account validation failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_users AS cu
        JOIN public.client_role_types AS crt
          ON crt.client_account_id = cu.client_account_id
         AND crt.id = cu.role_type_id
        WHERE cu.id = v_client_user_id
          AND cu.client_account_id = v_client_account_id
          AND cu.user_id = v_user_id
          AND cu.status = 'active'
          AND cu.is_super_user = true
          AND crt.name = 'Property Manager'
          AND crt.is_active = true
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: initial client membership validation failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.entities AS e
        WHERE e.id = v_entity_id
          AND e.client_account_id = v_client_account_id
          AND e.entity_code = v_expected_entity_code
          AND e.entity_name = v_expected_entity_name
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Sandton client-boundary validation failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = v_user_id
          AND uea.entity_id = v_entity_id
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Sandton entity access was not preserved';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.access_profiles AS ap
        JOIN public.client_user_access_profiles AS cuap
          ON cuap.access_profile_id = ap.id
        WHERE ap.id = v_standard_access_profile_id
          AND ap.client_account_id = v_client_account_id
          AND ap.system_key = 'standard_access'
          AND ap.is_system = true
          AND cuap.client_account_id = v_client_account_id
          AND cuap.client_user_id = v_client_user_id
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Standard Access assignment validation failed';
    END IF;

    IF NOT public.has_entity_permission(
        v_user_id,
        v_entity_id,
        'leasing.opportunity.create'
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: leasing.opportunity.create authority did not resolve';
    END IF;

    IF NOT public.has_entity_permission(
        v_user_id,
        v_entity_id,
        'leasing.opportunity.edit'
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: leasing.opportunity.edit authority did not resolve';
    END IF;

    IF NOT public.has_entity_permission(
        v_user_id,
        v_entity_id,
        'leasing.commercial.submit'
    ) THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: leasing.commercial.submit authority did not resolve';
    END IF;


    /*
     * ------------------------------------------------------------
     * 12. Reconfirm operational property lineage after cutover.
     * ------------------------------------------------------------
     */

    SELECT count(DISTINCT p.id)
    INTO v_property_ref_count
    FROM public.properties AS p
    WHERE p.entity_id = v_entity_id
       OR p.owner_entity_id = v_entity_id
       OR p.managing_entity_id = v_entity_id;

    IF v_property_ref_count <> 4 THEN
        RAISE EXCEPTION
            'Canonicalisation aborted: Sandton property lineage changed during cutover';
    END IF;

    RAISE NOTICE
        'Sandton canonicalisation validated: client_account=%, client_user=%, entity=%, standard_access=%',
        v_client_account_id,
        v_client_user_id,
        v_entity_id,
        v_standard_access_profile_id;
END;
$canonicalise$;
