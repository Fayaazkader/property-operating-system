BEGIN;
-- Requires canonical client foundation, provisioning and administration migrations.
-- Receipt and the complete canonical graph commit or roll back together.
CREATE TABLE public.client_onboarding_receipts (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id),
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_onboarding_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_onboarding_receipts FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.provision_client_account(
    p_client_name text,
    p_entity_name text,
    p_entity_code text,
    p_role_type_name text,
    p_full_name text,
    p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_auth_email text;
    v_client_account_id uuid;
    v_role_type_id uuid;
    v_client_user_id uuid;
    v_entity_id uuid;
    v_standard_access_profile_id uuid;
    v_financial_result jsonb;
    v_result jsonb;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lower(btrim(au.email))
    INTO v_auth_email
    FROM auth.users AS au
    WHERE au.id = v_actor_id;

    IF v_auth_email IS NULL
       OR v_auth_email = ''
    THEN
        RAISE EXCEPTION 'Authenticated user identity could not be resolved';
    END IF;

    IF p_client_name IS NULL OR btrim(p_client_name) = '' THEN
        RAISE EXCEPTION 'Client account name is required';
    END IF;

    IF p_entity_name IS NULL OR btrim(p_entity_name) = '' THEN
        RAISE EXCEPTION 'Legal entity name is required';
    END IF;

    IF p_entity_code IS NULL OR btrim(p_entity_code) = '' THEN
        RAISE EXCEPTION 'Legal entity code is required';
    END IF;

    IF p_role_type_name IS NULL OR btrim(p_role_type_name) = '' THEN
        RAISE EXCEPTION 'Organisational role is required';
    END IF;

    IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
        RAISE EXCEPTION 'Full name is required';
    END IF;

    IF p_email IS NULL OR btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;

    IF lower(btrim(p_email)) <> v_auth_email THEN
        RAISE EXCEPTION 'Email must match the authenticated user';
    END IF;

    -- Serialize first-client creation per authenticated actor, including retries
    -- after a committed response was lost. No caller-supplied actor is accepted.
    PERFORM pg_advisory_xact_lock(hashtextextended('client-onboarding:' || v_actor_id::text, 0));
    SELECT result INTO v_result FROM public.client_onboarding_receipts WHERE user_id = v_actor_id;
    IF FOUND THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.client_users cu
            JOIN public.client_accounts ca ON ca.id = cu.client_account_id
            JOIN public.user_entity_access uea ON uea.user_id = cu.user_id
            JOIN public.entities e ON e.id = uea.entity_id AND e.client_account_id = ca.id
            WHERE cu.id = (v_result->>'client_user_id')::uuid
              AND cu.user_id = v_actor_id AND cu.status = 'active' AND cu.is_super_user = true
              AND ca.status = 'active' AND e.id = (v_result->>'entity_id')::uuid
        ) THEN
            RAISE EXCEPTION 'Existing workspace access requires administrator review';
        END IF;
        RETURN v_result;
    END IF;
    -- This command is initial onboarding, not a way to bypass suspended or
    -- existing membership. Additional entities use client administration.
    IF EXISTS (SELECT 1 FROM public.client_users WHERE user_id = v_actor_id)
       OR EXISTS (SELECT 1 FROM public.user_entity_access WHERE user_id = v_actor_id) THEN
        RAISE EXCEPTION 'An existing membership requires administrator review; no new workspace was created';
    END IF;

    -- Empty template tables would otherwise compare equal (0 = 0) and report
    -- a financial foundation with no accounts or posting rules as successful.
    IF NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE entity_id = '00000000-0000-0000-0000-000000000000'::uuid)
       OR NOT EXISTS (
           SELECT 1 FROM public.posting_templates pt
           JOIN public.posting_template_lines pl ON pl.template_id = pt.id
           WHERE pt.entity_id = '00000000-0000-0000-0000-000000000000'::uuid
       ) THEN
        RAISE EXCEPTION 'Canonical financial templates are not configured; contact your platform administrator';
    END IF;

    -- Preserve platform authority independently. This upsert deliberately
    -- does not overwrite an existing platform_role.
    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        platform_role
    )
    VALUES (
        v_actor_id,
        v_auth_email,
        btrim(p_full_name),
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name;

    INSERT INTO public.client_accounts (
        name,
        status
    )
    VALUES (
        btrim(p_client_name),
        'active'
    )
    RETURNING id
    INTO v_client_account_id;

    INSERT INTO public.client_role_types (
        client_account_id,
        name,
        is_active
    )
    VALUES (
        v_client_account_id,
        btrim(p_role_type_name),
        true
    )
    RETURNING id
    INTO v_role_type_id;

    INSERT INTO public.client_users (
        client_account_id,
        user_id,
        role_type_id,
        is_super_user,
        status
    )
    VALUES (
        v_client_account_id,
        v_actor_id,
        v_role_type_id,
        true,
        'active'
    )
    RETURNING id
    INTO v_client_user_id;

    INSERT INTO public.entities (
        entity_code,
        entity_name,
        name,
        client_account_id
    )
    VALUES (
        btrim(p_entity_code),
        btrim(p_entity_name),
        btrim(p_entity_name),
        v_client_account_id
    )
    RETURNING id
    INTO v_entity_id;

    -- Canonical entity scope. Legacy role fields carry no authority.
    INSERT INTO public.user_entity_access (
        user_id,
        entity_id,
        role_id,
        org_role
    )
    VALUES (
        v_actor_id,
        v_entity_id,
        NULL,
        'read_only'
    );

    -- Temporary compatibility projection for remaining legacy readers.
    INSERT INTO public.user_entities (
        user_id,
        entity_id,
        role
    )
    VALUES (
        v_actor_id,
        v_entity_id,
        'viewer'
    )
    ON CONFLICT (user_id, entity_id) DO UPDATE
    SET role = EXCLUDED.role;

    -- Establish the canonical baseline profile and attach it to the first
    -- client member. Super User administration authority remains separate.
    v_standard_access_profile_id :=
        public.sync_standard_access_profile_internal(
            v_client_account_id,
            v_actor_id
        );

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
        v_actor_id
    )
    ON CONFLICT (client_user_id, access_profile_id)
    DO NOTHING;

    v_financial_result :=
        public.provision_entity_financial_foundation(v_entity_id);

    -- Final graph validation. Any failure rolls back the complete
    -- provisioning transaction.
    IF NOT EXISTS (
        SELECT 1
        FROM public.client_accounts AS ca
        WHERE ca.id = v_client_account_id
          AND ca.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Client account provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_users AS cu
        WHERE cu.id = v_client_user_id
          AND cu.client_account_id = v_client_account_id
          AND cu.user_id = v_actor_id
          AND cu.role_type_id = v_role_type_id
          AND cu.is_super_user = true
          AND cu.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Initial client Super User provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.entities AS e
        WHERE e.id = v_entity_id
          AND e.client_account_id = v_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client legal entity provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = v_actor_id
          AND uea.entity_id = v_entity_id
          AND uea.role_id IS NULL
          AND uea.org_role = 'read_only'
    ) THEN
        RAISE EXCEPTION 'Initial canonical entity scope provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entities AS ue
        WHERE ue.user_id = v_actor_id
          AND ue.entity_id = v_entity_id
          AND ue.role = 'viewer'
    ) THEN
        RAISE EXCEPTION 'Initial compatibility entity scope provisioning failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.access_profiles AS ap
        INNER JOIN public.client_user_access_profiles AS cuap
          ON cuap.access_profile_id = ap.id
        WHERE ap.id = v_standard_access_profile_id
          AND ap.client_account_id = v_client_account_id
          AND ap.system_key = 'standard_access'
          AND ap.is_system = true
          AND cuap.client_account_id = v_client_account_id
          AND cuap.client_user_id = v_client_user_id
    ) THEN
        RAISE EXCEPTION 'Initial Standard Access provisioning failed';
    END IF;

    v_result := jsonb_build_object(
        'client_account_id', v_client_account_id,
        'client_user_id', v_client_user_id,
        'role_type_id', v_role_type_id,
        'entity_id', v_entity_id,
        'standard_access_profile_id', v_standard_access_profile_id,
        'user_id', v_actor_id,
        'is_super_user', true,
        'financial_foundation', v_financial_result,
        'status', 'provisioned'
    );
    INSERT INTO public.client_onboarding_receipts(user_id, result) VALUES(v_actor_id, v_result);
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_client_account(
    text,
    text,
    text,
    text,
    text,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.provision_client_account(
    text,
    text,
    text,
    text,
    text,
    text
) TO authenticated;

COMMENT ON TABLE public.client_onboarding_receipts IS
'Private first-client provisioning receipts. Actor-scoped retries return the original committed result without changing names or creating another client.';
COMMIT;
