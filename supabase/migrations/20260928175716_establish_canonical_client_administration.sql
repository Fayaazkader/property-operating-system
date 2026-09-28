-- AssetFlow canonical client administration foundation.
--
-- Establishes:
--   * explicit default-access permission classification;
--   * canonical client invitation intent;
--   * relational invitation entity/profile/permission configuration.
--
-- This migration deliberately does NOT:
--   * infer authority from organisational role;
--   * grant browser access to canonical administration tables;
--   * make all client-assignable permissions default permissions;
--   * confer Super User authority through an invitation;
--   * remove legacy administration paths yet.

-- ============================================================
-- 1. Permission default-access classification
--
-- assignable_by_client:
--   may a client administrator explicitly configure the capability?
--
-- default_access:
--   should the capability form part of ordinary baseline access?
--
-- super_user_inherent:
--   is the capability inherent to canonical client Super Users?
--
-- These concepts are intentionally independent.
-- New permissions fail closed from baseline access unless explicitly
-- classified default_access = true.
-- ============================================================

ALTER TABLE public.permission_catalogue
    ADD COLUMN default_access boolean NOT NULL DEFAULT false;

UPDATE public.permission_catalogue
SET default_access = true
WHERE key IN (
    'financial.allocate',
    'financial.create',
    'financial.edit',
    'financial.export',
    'financial.view',
    'governance.evaluate',
    'governance.exception.request',
    'leasing.commercial.submit',
    'leasing.create',
    'leasing.edit',
    'leasing.opportunity.create',
    'leasing.opportunity.edit',
    'leasing.view',
    'operations.assign',
    'operations.complete',
    'operations.create',
    'operations.view'
);

-- Defensive contract: an inherent Super User administration capability
-- must never simultaneously become ordinary baseline access.
ALTER TABLE public.permission_catalogue
    ADD CONSTRAINT permission_catalogue_default_access_contract
    CHECK (
        NOT default_access
        OR (
            scope = 'client'
            AND assignable_by_client = true
            AND super_user_inherent = false
        )
    );

-- ============================================================
-- 2. System-managed access-profile identity
--
-- System profiles require a stable machine identity independent
-- of their display name. Client-created profiles leave system_key
-- NULL. AssetFlow owns the non-NULL system-key namespace.
--
-- standard_access is the canonical ordinary baseline profile.
-- Additional system profile keys must be introduced deliberately
-- through a future schema migration.
-- ============================================================

ALTER TABLE public.access_profiles
    ADD COLUMN system_key text;

ALTER TABLE public.access_profiles
    ADD CONSTRAINT access_profiles_system_key_contract
    CHECK (
        system_key IS NULL
        OR (
            system_key = lower(btrim(system_key))
            AND btrim(system_key) <> ''
            AND system_key IN ('standard_access')
            AND is_system = true
        )
    );

CREATE UNIQUE INDEX access_profiles_client_system_key_key
    ON public.access_profiles (
        client_account_id,
        system_key
    )
    WHERE system_key IS NOT NULL;

COMMENT ON COLUMN public.access_profiles.system_key IS
'AssetFlow-owned stable identifier for a system-managed access profile. NULL for client-created profiles.';

-- ============================================================
-- 3. Same-client entity referential foundation
--
-- Canonical administration relationships must be able to enforce
-- the client/entity boundary relationally, not only procedurally.
-- Existing entities.client_account_id remains nullable during the
-- legacy migration period; canonical relationships can reference
-- only an entity whose client account matches explicitly.
-- ============================================================

ALTER TABLE public.entities
    ADD CONSTRAINT entities_client_id_id_key
    UNIQUE (client_account_id, id);

-- ============================================================
-- 4. Canonical client invitations
--
-- Invitations describe intended membership/configuration.
-- They do not create authority until claimed by the matching,
-- authenticated identity through the governed acceptance command.
--
-- Only a cryptographic token hash is persisted. The raw invitation
-- token must never be stored in this table or audit_log.
-- ============================================================

CREATE TABLE public.client_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_account_id uuid NOT NULL,
    email text NOT NULL,
    role_type_id uuid NOT NULL,
    token_hash text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    invited_by uuid NOT NULL,
    accepted_by uuid,
    accepted_at timestamptz,
    revoked_by uuid,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_invitations_client_account_id_fkey
        FOREIGN KEY (client_account_id)
        REFERENCES public.client_accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT client_invitations_role_same_client_fkey
        FOREIGN KEY (client_account_id, role_type_id)
        REFERENCES public.client_role_types(client_account_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT client_invitations_invited_by_fkey
        FOREIGN KEY (invited_by)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT client_invitations_accepted_by_fkey
        FOREIGN KEY (accepted_by)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT client_invitations_revoked_by_fkey
        FOREIGN KEY (revoked_by)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT client_invitations_email_normalized
        CHECK (
            email = lower(btrim(email))
            AND btrim(email) <> ''
        ),

    CONSTRAINT client_invitations_token_hash_not_blank
        CHECK (btrim(token_hash) <> ''),

    CONSTRAINT client_invitations_status_check
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),

    CONSTRAINT client_invitations_expiry_after_creation
        CHECK (expires_at > created_at),

    CONSTRAINT client_invitations_lifecycle_check
        CHECK (
            (
                status = 'pending'
                AND accepted_by IS NULL
                AND accepted_at IS NULL
                AND revoked_by IS NULL
                AND revoked_at IS NULL
            )
            OR
            (
                status = 'accepted'
                AND accepted_by IS NOT NULL
                AND accepted_at IS NOT NULL
                AND revoked_by IS NULL
                AND revoked_at IS NULL
            )
            OR
            (
                status = 'revoked'
                AND accepted_by IS NULL
                AND accepted_at IS NULL
                AND revoked_by IS NOT NULL
                AND revoked_at IS NOT NULL
            )
            OR
            (
                status = 'expired'
                AND accepted_by IS NULL
                AND accepted_at IS NULL
                AND revoked_by IS NULL
                AND revoked_at IS NULL
            )
        ),

    CONSTRAINT client_invitations_client_id_id_key
        UNIQUE (client_account_id, id),

    CONSTRAINT client_invitations_token_hash_key
        UNIQUE (token_hash)
);

CREATE UNIQUE INDEX client_invitations_pending_email_key
    ON public.client_invitations (
        client_account_id,
        lower(btrim(email))
    )
    WHERE status = 'pending';

CREATE INDEX idx_client_invitations_client_account
    ON public.client_invitations(client_account_id);

CREATE INDEX idx_client_invitations_email
    ON public.client_invitations(email);

CREATE INDEX idx_client_invitations_expires_at
    ON public.client_invitations(expires_at)
    WHERE status = 'pending';

-- ============================================================
-- 5. Intended entity access
-- ============================================================

CREATE TABLE public.client_invitation_entities (
    client_account_id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_invitation_entities_pkey
        PRIMARY KEY (invitation_id, entity_id),

    CONSTRAINT client_invitation_entities_invitation_same_client_fkey
        FOREIGN KEY (client_account_id, invitation_id)
        REFERENCES public.client_invitations(client_account_id, id)
        ON DELETE CASCADE,

    CONSTRAINT client_invitation_entities_entity_same_client_fkey
        FOREIGN KEY (client_account_id, entity_id)
        REFERENCES public.entities(client_account_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_client_invitation_entities_client_account
    ON public.client_invitation_entities(client_account_id);

CREATE INDEX idx_client_invitation_entities_entity
    ON public.client_invitation_entities(entity_id);

-- ============================================================
-- 6. Intended access-profile assignments
-- ============================================================

CREATE TABLE public.client_invitation_access_profiles (
    client_account_id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    access_profile_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_invitation_access_profiles_pkey
        PRIMARY KEY (invitation_id, access_profile_id),

    CONSTRAINT client_invitation_access_profiles_invitation_same_client_fkey
        FOREIGN KEY (client_account_id, invitation_id)
        REFERENCES public.client_invitations(client_account_id, id)
        ON DELETE CASCADE,

    CONSTRAINT client_invitation_access_profiles_profile_same_client_fkey
        FOREIGN KEY (client_account_id, access_profile_id)
        REFERENCES public.access_profiles(client_account_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_client_invitation_access_profiles_client_account
    ON public.client_invitation_access_profiles(client_account_id);

-- ============================================================
-- 7. Intended explicit permission overrides
-- ============================================================

CREATE TABLE public.client_invitation_permission_overrides (
    client_account_id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    permission_key text NOT NULL,
    enabled boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_invitation_permission_overrides_pkey
        PRIMARY KEY (invitation_id, permission_key),

    CONSTRAINT client_invitation_permission_overrides_invitation_same_client_fkey
        FOREIGN KEY (client_account_id, invitation_id)
        REFERENCES public.client_invitations(client_account_id, id)
        ON DELETE CASCADE,

    CONSTRAINT client_invitation_permission_overrides_permission_fkey
        FOREIGN KEY (permission_key)
        REFERENCES public.permission_catalogue(key)
        ON DELETE RESTRICT
);

CREATE INDEX idx_client_invitation_permission_overrides_client_account
    ON public.client_invitation_permission_overrides(client_account_id);

-- ============================================================
-- 8. Security posture
--
-- Canonical administration state is command-only. Enabling RLS is
-- defence in depth; direct browser privileges are also revoked.
-- ============================================================

ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitation_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitation_access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitation_permission_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_invitations
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.client_invitation_entities
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.client_invitation_access_profiles
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.client_invitation_permission_overrides
    FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.permission_catalogue.default_access IS
'True only when the capability is deliberately part of ordinary baseline client access. This is independent of organisational role and defaults false for newly registered permissions.';

COMMENT ON TABLE public.client_invitations IS
'Canonical client-level invitation intent. Membership and authority are established only when a matching authenticated identity claims the invitation through a governed command. Raw invitation tokens are never persisted.';

COMMENT ON TABLE public.client_invitation_entities IS
'Legal entities the invited user is intended to access after governed invitation acceptance.';

COMMENT ON TABLE public.client_invitation_access_profiles IS
'Access profiles intended for the invited user after governed invitation acceptance.';

COMMENT ON TABLE public.client_invitation_permission_overrides IS
'Explicit client-assignable permission overrides intended for the invited user after governed invitation acceptance.';

-- ============================================================
-- 9. Canonical client-administration authority
--
-- Client administration is client-scoped, not entity-scoped.
-- Organisational role, legacy org_role/role_id, access profiles,
-- and ordinary permission overrides do not confer Super User
-- authority.
--
-- This helper is internal only. Browser roles receive no EXECUTE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_client_super_user(
    p_user_id uuid,
    p_client_account_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_user_id IS NULL
       OR p_client_account_id IS NULL
    THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.client_accounts AS ca
        JOIN public.client_users AS cu
          ON cu.client_account_id = ca.id
        WHERE ca.id = p_client_account_id
          AND ca.status = 'active'
          AND cu.user_id = p_user_id
          AND cu.status = 'active'
          AND cu.is_super_user = true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_active_client_super_user(uuid, uuid)
    FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.is_active_client_super_user(uuid, uuid) IS
'Internal canonical client-administration authority predicate. Returns true only for an active Super User membership of an active client account. Organisational role and entity-scoped legacy authority do not participate.';

-- ============================================================
-- 10. Internal Standard Access synchronization
--
-- Standard Access is the canonical ordinary baseline profile for
-- every client. It is system-managed and contains exactly the
-- currently active permission-catalogue entries classified as
-- default_access.
--
-- This primitive is idempotent and returns the canonical profile ID.
-- Browser roles cannot execute it directly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_standard_access_profile_internal(
    p_client_account_id uuid,
    p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_profile_id uuid;
BEGIN
    IF p_client_account_id IS NULL
       OR p_actor_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account and actor are required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM auth.users AS au
        WHERE au.id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'Actor identity not found';
    END IF;

    -- Serialize profile creation/synchronization at the client boundary.
    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = p_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    -- Resolve the stable machine identity, never the display name.
    SELECT ap.id
    INTO v_profile_id
    FROM public.access_profiles AS ap
    WHERE ap.client_account_id = p_client_account_id
      AND ap.system_key = 'standard_access'
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.access_profiles (
            client_account_id,
            name,
            description,
            is_system,
            system_key,
            created_by
        )
        VALUES (
            p_client_account_id,
            'Standard Access',
            'AssetFlow-managed baseline operational access.',
            true,
            'standard_access',
            p_actor_id
        )
        RETURNING id
        INTO v_profile_id;
    ELSE
        -- Restore canonical system-owned metadata if display metadata was
        -- changed through a privileged/manual path.
        UPDATE public.access_profiles
        SET
            name = 'Standard Access',
            description = 'AssetFlow-managed baseline operational access.',
            is_system = true,
            updated_at = now()
        WHERE id = v_profile_id;
    END IF;

    -- Remove anything no longer classified as ordinary baseline access.
    DELETE FROM public.access_profile_permissions AS app
    WHERE app.access_profile_id = v_profile_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.permission_catalogue AS pc
          WHERE pc.key = app.permission_key
            AND pc.scope = 'client'
            AND pc.is_active = true
            AND pc.assignable_by_client = true
            AND pc.super_user_inherent = false
            AND pc.default_access = true
      );

    -- Add every currently classified baseline capability.
    INSERT INTO public.access_profile_permissions (
        access_profile_id,
        permission_key
    )
    SELECT
        v_profile_id,
        pc.key
    FROM public.permission_catalogue AS pc
    WHERE pc.scope = 'client'
      AND pc.is_active = true
      AND pc.assignable_by_client = true
      AND pc.super_user_inherent = false
      AND pc.default_access = true
    ON CONFLICT (access_profile_id, permission_key)
    DO NOTHING;

    RETURN v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_standard_access_profile_internal(
    uuid,
    uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.sync_standard_access_profile_internal(
    uuid,
    uuid
) FROM anon;

REVOKE ALL ON FUNCTION public.sync_standard_access_profile_internal(
    uuid,
    uuid
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.sync_standard_access_profile_internal(
    uuid,
    uuid
) TO service_role, postgres;

COMMENT ON FUNCTION public.sync_standard_access_profile_internal(
    uuid,
    uuid
) IS
'Internal AssetFlow primitive that creates or synchronizes one client Standard Access system profile from the active default-access permission classification and returns its profile ID.';

-- ============================================================
-- 11. Canonical client provisioning completion
--
-- Replace the already-deployed provisioning command so every newly
-- provisioned client starts with the same canonical authorization
-- graph used by later client administration:
--   * first authenticated member is the explicit Super User;
--   * first entity is explicitly assigned;
--   * Standard Access is created/synchronized and assigned;
--   * legacy user_entities is maintained only as a temporary
--     compatibility projection.
-- ============================================================

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

    RETURN jsonb_build_object(
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

COMMENT ON FUNCTION public.provision_client_account(
    text,
    text,
    text,
    text,
    text,
    text
) IS
'Canonical client onboarding command. Creates the client boundary, required organisational role, first Super User, first legal entity, Standard Access assignment, compatibility entity projection, and financial foundation atomically.';

-- ============================================================
-- 12. Governed client-user membership administration
--
-- Organisational role and membership status are administered here.
-- Authorization configuration and Super User authority are deliberately
-- managed through separate commands.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_client_user(
    p_client_account_id uuid,
    p_client_user_id uuid,
    p_role_type_id uuid,
    p_status text,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_target_user_id uuid;
    v_old_role_type_id uuid;
    v_old_status text;
    v_is_super_user boolean;
    v_active_super_user_count integer;
    v_standard_access_profile_id uuid;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL
       OR p_client_user_id IS NULL
       OR p_role_type_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account, client user, and organisational role are required';
    END IF;

    IF p_status IS NULL
       OR p_status NOT IN ('active', 'suspended')
    THEN
        RAISE EXCEPTION 'Invalid client user status';
    END IF;

    -- Serialize client-membership mutations before evaluating
    -- Super User authority or invariants. This prevents concurrent
    -- suspensions from independently observing the same pre-change
    -- active Super User count and leaving the client without one.
    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = p_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client Super User authority required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_role_types AS crt
        WHERE crt.client_account_id = p_client_account_id
          AND crt.id = p_role_type_id
          AND crt.is_active = true
    ) THEN
        RAISE EXCEPTION 'Active organisational role does not belong to this client';
    END IF;

    SELECT
        cu.user_id,
        cu.role_type_id,
        cu.status,
        cu.is_super_user
    INTO
        v_target_user_id,
        v_old_role_type_id,
        v_old_status,
        v_is_super_user
    FROM public.client_users AS cu
    WHERE cu.client_account_id = p_client_account_id
      AND cu.id = p_client_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client user does not belong to this client';
    END IF;

    IF v_is_super_user IS TRUE
       AND v_old_status = 'active'
       AND p_status = 'suspended'
    THEN
        SELECT count(*)
        INTO v_active_super_user_count
        FROM public.client_users AS cu
        WHERE cu.client_account_id = p_client_account_id
          AND cu.status = 'active'
          AND cu.is_super_user = true;

        IF v_active_super_user_count <= 1 THEN
            RAISE EXCEPTION 'Cannot suspend the last active Super User';
        END IF;
    END IF;

    UPDATE public.client_users
    SET
        role_type_id = p_role_type_id,
        status = p_status,
        updated_at = now()
    WHERE client_account_id = p_client_account_id
      AND id = p_client_user_id;

    /*
     * Suspension preserves authorization configuration; inactive
     * membership already fails closed in the canonical resolver.
     *
     * Reactivation must restore the mandatory system-managed baseline
     * before the membership becomes usable again.
     */
    IF p_status = 'active'
       AND v_old_status = 'suspended'
    THEN
        v_standard_access_profile_id :=
            public.sync_standard_access_profile_internal(
                p_client_account_id,
                v_actor_id
            );

        INSERT INTO public.client_user_access_profiles (
            client_account_id,
            client_user_id,
            access_profile_id,
            assigned_by
        )
        VALUES (
            p_client_account_id,
            p_client_user_id,
            v_standard_access_profile_id,
            v_actor_id
        )
        ON CONFLICT (client_user_id, access_profile_id)
        DO NOTHING;
    END IF;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'client_user',
        p_client_user_id,
        'Client user membership',
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'user_id', v_target_user_id,
            'role_type_id', v_old_role_type_id,
            'status', v_old_status,
            'is_super_user', v_is_super_user
        ),
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'user_id', v_target_user_id,
            'role_type_id', p_role_type_id,
            'status', p_status,
            'is_super_user', v_is_super_user,
            'standard_access_profile_id', v_standard_access_profile_id
        ),
        p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_client_user(
    uuid,
    uuid,
    uuid,
    text,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_client_user(
    uuid,
    uuid,
    uuid,
    text,
    text
) TO authenticated;

COMMENT ON FUNCTION public.update_client_user(
    uuid,
    uuid,
    uuid,
    text,
    text
) IS
'Governed canonical client-user membership administration. Updates required organisational role and active/suspended status only. Suspension preserves authorization configuration; reactivation restores mandatory Standard Access. Organisational role does not confer application authority, and this command cannot change Super User authority.';

-- ============================================================
-- 13. Governed client-user entity access
--
-- user_entity_access is the canonical entity-access assignment.
-- user_entities is maintained temporarily as a compatibility
-- projection for legacy runtime consumers and confers no
-- canonical authority.
--
-- Replacement semantics are intentional: p_entity_ids is the
-- complete desired entity set. An empty set is valid.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_client_user_entity_access(
    p_client_account_id uuid,
    p_client_user_id uuid,
    p_entity_ids uuid[],
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_target_user_id uuid;
    v_entity_ids uuid[] := COALESCE(p_entity_ids, ARRAY[]::uuid[]);
    v_old_entity_ids uuid[];
    v_invalid_entity_ids uuid[];
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL
       OR p_client_user_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account and client user are required';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client Super User authority required';
    END IF;

    SELECT cu.user_id
    INTO v_target_user_id
    FROM public.client_users AS cu
    WHERE cu.client_account_id = p_client_account_id
      AND cu.id = p_client_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client user does not belong to this client';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_entity_ids) AS requested(entity_id)
        GROUP BY requested.entity_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate entity assignments are not allowed';
    END IF;

    SELECT COALESCE(
        array_agg(requested.entity_id ORDER BY requested.entity_id),
        ARRAY[]::uuid[]
    )
    INTO v_invalid_entity_ids
    FROM unnest(v_entity_ids) AS requested(entity_id)
    LEFT JOIN public.entities AS e
      ON e.id = requested.entity_id
     AND e.client_account_id = p_client_account_id
    WHERE requested.entity_id IS NULL
       OR e.id IS NULL;

    IF cardinality(v_invalid_entity_ids) > 0 THEN
        RAISE EXCEPTION 'One or more entities do not belong to this client';
    END IF;

    SELECT COALESCE(
        array_agg(uea.entity_id ORDER BY uea.entity_id),
        ARRAY[]::uuid[]
    )
    INTO v_old_entity_ids
    FROM public.user_entity_access AS uea
    JOIN public.entities AS e
      ON e.id = uea.entity_id
     AND e.client_account_id = p_client_account_id
    WHERE uea.user_id = v_target_user_id;

    DELETE FROM public.user_entity_access AS uea
    USING public.entities AS e
    WHERE uea.user_id = v_target_user_id
      AND e.id = uea.entity_id
      AND e.client_account_id = p_client_account_id
      AND NOT (uea.entity_id = ANY(v_entity_ids));

    INSERT INTO public.user_entity_access (
        user_id,
        entity_id,
        role_id,
        org_role
    )
    SELECT
        v_target_user_id,
        requested.entity_id,
        NULL,
        'read_only'
    FROM unnest(v_entity_ids) AS requested(entity_id)
    ON CONFLICT (user_id, entity_id)
    DO UPDATE SET
        role_id = NULL,
        org_role = 'read_only';

    DELETE FROM public.user_entities AS ue
    USING public.entities AS e
    WHERE ue.user_id = v_target_user_id
      AND e.id = ue.entity_id
      AND e.client_account_id = p_client_account_id
      AND NOT (ue.entity_id = ANY(v_entity_ids));

    INSERT INTO public.user_entities (
        user_id,
        entity_id,
        role
    )
    SELECT
        v_target_user_id,
        requested.entity_id,
        'viewer'
    FROM unnest(v_entity_ids) AS requested(entity_id)
    ON CONFLICT (user_id, entity_id)
    DO UPDATE SET
        role = 'viewer';

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'client_user',
        p_client_user_id,
        'Client user entity access',
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'user_id', v_target_user_id,
            'entity_ids', v_old_entity_ids
        ),
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'user_id', v_target_user_id,
            'entity_ids', v_entity_ids
        ),
        p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_user_entity_access(
    uuid,
    uuid,
    uuid[],
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_client_user_entity_access(
    uuid,
    uuid,
    uuid[],
    text
) TO authenticated;

COMMENT ON FUNCTION public.set_client_user_entity_access(
    uuid,
    uuid,
    uuid[],
    text
) IS
'Governed replacement of a canonical client user''s legal-entity access. user_entity_access is authoritative; user_entities is synchronized temporarily for legacy runtime compatibility. Empty entity access is valid.';

-- ============================================================
-- 14. Governed client-user access-profile assignment
--
-- Standard Access is AssetFlow-managed baseline authorization and
-- is mandatory for every active canonical client user.
--
-- p_access_profile_ids therefore represents only the complete desired
-- set of additional client-managed profiles. Replacement semantics
-- apply to those additional profiles only. An empty set means that
-- the user retains Standard Access with no additional profiles.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_client_user_access_profiles(
    p_client_account_id uuid,
    p_client_user_id uuid,
    p_access_profile_ids uuid[],
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_target_status text;
    v_profile_ids uuid[] := COALESCE(
        p_access_profile_ids,
        ARRAY[]::uuid[]
    );
    v_standard_access_profile_id uuid;
    v_old_profile_ids uuid[];
    v_new_profile_ids uuid[];
    v_invalid_profile_ids uuid[];
    v_system_profile_ids uuid[];
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL
       OR p_client_user_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account and client user are required';
    END IF;

    /*
     * Serialize authorization administration at the client boundary.
     */
    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = p_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Active client Super User authority required';
    END IF;

    SELECT cu.status
    INTO v_target_status
    FROM public.client_users AS cu
    WHERE cu.client_account_id = p_client_account_id
      AND cu.id = p_client_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client user does not belong to this client';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_profile_ids) AS requested(access_profile_id)
        GROUP BY requested.access_profile_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate access-profile assignments are not allowed';
    END IF;

    SELECT COALESCE(
        array_agg(
            requested.access_profile_id
            ORDER BY requested.access_profile_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_invalid_profile_ids
    FROM unnest(v_profile_ids) AS requested(access_profile_id)
    LEFT JOIN public.access_profiles AS ap
      ON ap.id = requested.access_profile_id
     AND ap.client_account_id = p_client_account_id
    WHERE requested.access_profile_id IS NULL
       OR ap.id IS NULL;

    IF cardinality(v_invalid_profile_ids) > 0 THEN
        RAISE EXCEPTION 'One or more access profiles do not belong to this client';
    END IF;

    /*
     * System-managed profiles are never part of client-supplied profile
     * intent. This keeps Standard Access and future system profiles out
     * of ordinary client administration.
     */
    SELECT COALESCE(
        array_agg(
            ap.id
            ORDER BY ap.id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_system_profile_ids
    FROM unnest(v_profile_ids) AS requested(access_profile_id)
    INNER JOIN public.access_profiles AS ap
      ON ap.id = requested.access_profile_id
     AND ap.client_account_id = p_client_account_id
    WHERE ap.is_system = true
       OR ap.system_key IS NOT NULL;

    IF cardinality(v_system_profile_ids) > 0 THEN
        RAISE EXCEPTION 'System-managed access profiles cannot be assigned explicitly';
    END IF;

    SELECT COALESCE(
        array_agg(
            cuap.access_profile_id
            ORDER BY cuap.access_profile_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_old_profile_ids
    FROM public.client_user_access_profiles AS cuap
    WHERE cuap.client_account_id = p_client_account_id
      AND cuap.client_user_id = p_client_user_id;

    /*
     * Synchronize the system baseline from the permission catalogue.
     * This returns the stable client-local Standard Access profile.
     */
    v_standard_access_profile_id :=
        public.sync_standard_access_profile_internal(
            p_client_account_id,
            v_actor_id
        );

    /*
     * Replace only client-managed profile assignments.
     * System-managed assignments are deliberately outside this delete.
     */
    DELETE FROM public.client_user_access_profiles AS cuap
    USING public.access_profiles AS ap
    WHERE cuap.client_account_id = p_client_account_id
      AND cuap.client_user_id = p_client_user_id
      AND ap.id = cuap.access_profile_id
      AND ap.client_account_id = p_client_account_id
      AND ap.is_system = false
      AND ap.system_key IS NULL
      AND NOT (cuap.access_profile_id = ANY(v_profile_ids));

    INSERT INTO public.client_user_access_profiles (
        client_account_id,
        client_user_id,
        access_profile_id,
        assigned_by
    )
    SELECT
        p_client_account_id,
        p_client_user_id,
        requested.access_profile_id,
        v_actor_id
    FROM unnest(v_profile_ids) AS requested(access_profile_id)
    ON CONFLICT (client_user_id, access_profile_id)
    DO NOTHING;

    /*
     * Standard Access is mandatory for active canonical users. We also
     * restore it here if historical or transitional state omitted it.
     */
    IF v_target_status = 'active' THEN
        INSERT INTO public.client_user_access_profiles (
            client_account_id,
            client_user_id,
            access_profile_id,
            assigned_by
        )
        VALUES (
            p_client_account_id,
            p_client_user_id,
            v_standard_access_profile_id,
            v_actor_id
        )
        ON CONFLICT (client_user_id, access_profile_id)
        DO NOTHING;
    END IF;

    SELECT COALESCE(
        array_agg(
            cuap.access_profile_id
            ORDER BY cuap.access_profile_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_new_profile_ids
    FROM public.client_user_access_profiles AS cuap
    WHERE cuap.client_account_id = p_client_account_id
      AND cuap.client_user_id = p_client_user_id;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'client_user',
        p_client_user_id,
        'Client user access profiles',
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'access_profile_ids', v_old_profile_ids
        ),
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'access_profile_ids', v_new_profile_ids,
            'standard_access_profile_id', v_standard_access_profile_id
        ),
        p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_user_access_profiles(
    uuid,
    uuid,
    uuid[],
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_client_user_access_profiles(
    uuid,
    uuid,
    uuid[],
    text
) TO authenticated;

COMMENT ON FUNCTION public.set_client_user_access_profiles(
    uuid,
    uuid,
    uuid[],
    text
) IS
'Governed replacement of additional client-managed access-profile assignments. Standard Access is synchronized and retained automatically for active canonical client users; system-managed profiles cannot be supplied explicitly.';

-- ============================================================
-- 15. Governed client-user permission overrides
--
-- Explicit user permissions are tri-state:
--   no row         = no explicit override
--   enabled = true = explicit grant
--   enabled = false = explicit denial
--
-- Replacement semantics are intentional: p_permissions is the
-- complete desired explicit override set. An empty object removes
-- all explicit overrides for the client user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_client_user_permission_overrides(
    p_client_account_id uuid,
    p_client_user_id uuid,
    p_permissions jsonb,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_old_permissions jsonb;
    v_new_permissions jsonb;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL
       OR p_client_user_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account and client user are required';
    END IF;

    IF p_permissions IS NULL
       OR jsonb_typeof(p_permissions) <> 'object'
    THEN
        RAISE EXCEPTION 'Permissions must be a JSON object';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client Super User authority required';
    END IF;

    PERFORM 1
    FROM public.client_users AS cu
    WHERE cu.client_account_id = p_client_account_id
      AND cu.id = p_client_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client user does not belong to this client';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_each(p_permissions) AS submitted
        WHERE jsonb_typeof(submitted.value) <> 'boolean'
    ) THEN
        RAISE EXCEPTION 'Permission values must be boolean';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_each(p_permissions) AS submitted
        LEFT JOIN public.permission_catalogue AS pc
          ON pc.key = submitted.key
         AND pc.scope = 'client'
         AND pc.is_active = true
         AND pc.assignable_by_client = true
         AND pc.super_user_inherent = false
        WHERE pc.key IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more permissions are not assignable client permissions';
    END IF;

    SELECT COALESCE(
        jsonb_object_agg(
            cup.permission_key,
            cup.enabled
            ORDER BY cup.permission_key
        ),
        '{}'::jsonb
    )
    INTO v_old_permissions
    FROM public.client_user_permissions AS cup
    WHERE cup.client_account_id = p_client_account_id
      AND cup.client_user_id = p_client_user_id;

    DELETE FROM public.client_user_permissions AS cup
    WHERE cup.client_account_id = p_client_account_id
      AND cup.client_user_id = p_client_user_id
      AND NOT (p_permissions ? cup.permission_key);

    INSERT INTO public.client_user_permissions (
        client_account_id,
        client_user_id,
        permission_key,
        enabled,
        assigned_by,
        updated_at
    )
    SELECT
        p_client_account_id,
        p_client_user_id,
        submitted.key,
        (submitted.value #>> '{}')::boolean,
        v_actor_id,
        now()
    FROM jsonb_each(p_permissions) AS submitted
    ON CONFLICT (client_user_id, permission_key)
    DO UPDATE SET
        enabled = EXCLUDED.enabled,
        assigned_by = EXCLUDED.assigned_by,
        updated_at = now();

    SELECT COALESCE(
        jsonb_object_agg(
            cup.permission_key,
            cup.enabled
            ORDER BY cup.permission_key
        ),
        '{}'::jsonb
    )
    INTO v_new_permissions
    FROM public.client_user_permissions AS cup
    WHERE cup.client_account_id = p_client_account_id
      AND cup.client_user_id = p_client_user_id;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'client_user',
        p_client_user_id,
        'Client user permission overrides',
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'permissions', v_old_permissions
        ),
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'permissions', v_new_permissions
        ),
        p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_user_permission_overrides(
    uuid,
    uuid,
    jsonb,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_client_user_permission_overrides(
    uuid,
    uuid,
    jsonb,
    text
) TO authenticated;

COMMENT ON FUNCTION public.set_client_user_permission_overrides(
    uuid,
    uuid,
    jsonb,
    text
) IS
'Governed replacement of explicit permission overrides for a canonical client user. Only active client-scoped permissions explicitly assignable by the client may be overridden. Empty JSON removes all explicit overrides.';

-- ============================================================
-- 16. Internal invitation-expiry materialization
--
-- Internal lifecycle primitive only. Authority is established by
-- the governed outer command before calling this function.
--
-- Expiry validity is always derived from expires_at. This function
-- materializes pending -> expired for stale invitations and records
-- the transition without exposing token material.
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_client_invitations_internal(
    p_client_account_id uuid,
    p_email text,
    p_actor_id uuid,
    p_materialized_during text,
    p_user_agent text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email text := lower(btrim(p_email));
    v_actor_email text;
    v_expired_at timestamptz := now();
    v_expired_count integer := 0;
    v_invitation record;
BEGIN
    IF p_client_account_id IS NULL
       OR v_email IS NULL
       OR v_email = ''
       OR p_actor_id IS NULL
       OR p_materialized_during IS NULL
       OR btrim(p_materialized_during) = ''
    THEN
        RAISE EXCEPTION 'Client, email, actor, and materialization context are required';
    END IF;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
    WHERE p.id = p_actor_id;

    FOR v_invitation IN
        SELECT
            ci.id,
            ci.role_type_id,
            ci.expires_at
        FROM public.client_invitations AS ci
        WHERE ci.client_account_id = p_client_account_id
          AND ci.email = v_email
          AND ci.status = 'pending'
          AND ci.expires_at <= v_expired_at
        ORDER BY ci.created_at, ci.id
        FOR UPDATE
    LOOP
        UPDATE public.client_invitations
        SET
            status = 'expired',
            updated_at = v_expired_at
        WHERE client_account_id = p_client_account_id
          AND id = v_invitation.id
          AND status = 'pending'
          AND expires_at <= v_expired_at;

        IF FOUND THEN
            v_expired_count := v_expired_count + 1;

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
                p_actor_id,
                v_actor_email,
                'update',
                'client_invitation',
                v_invitation.id,
                'Client invitation expired',
                jsonb_build_object(
                    'client_account_id', p_client_account_id,
                    'email', v_email,
                    'role_type_id', v_invitation.role_type_id,
                    'status', 'pending',
                    'expires_at', v_invitation.expires_at
                ),
                jsonb_build_object(
                    'client_account_id', p_client_account_id,
                    'email', v_email,
                    'role_type_id', v_invitation.role_type_id,
                    'status', 'expired',
                    'expires_at', v_invitation.expires_at,
                    'expired_at', v_expired_at,
                    'materialized_during', btrim(p_materialized_during)
                ),
                p_user_agent
            );
        END IF;
    END LOOP;

    RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_client_invitations_internal(
    uuid,
    text,
    uuid,
    text,
    text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.expire_client_invitations_internal(
    uuid,
    text,
    uuid,
    text,
    text
) FROM anon;

REVOKE ALL ON FUNCTION public.expire_client_invitations_internal(
    uuid,
    text,
    uuid,
    text,
    text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.expire_client_invitations_internal(
    uuid,
    text,
    uuid,
    text,
    text
) TO service_role, postgres;

COMMENT ON FUNCTION public.expire_client_invitations_internal(
    uuid,
    text,
    uuid,
    text,
    text
) IS
'Internal invitation lifecycle primitive. Materializes stale pending invitations as expired for one client/email and records the transition. Browser roles cannot execute it directly.';

-- ============================================================
-- 17. Governed client invitation creation
--
-- Creates the complete invitation intent atomically.
-- The raw cryptographic token is returned exactly once and is
-- never persisted or written to audit_log. Only its SHA-256 hash
-- is stored.
--
-- Supported expiry periods intentionally match the product policy:
-- 1, 3, 7, 14, or 30 days.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_client_invitation(
    p_client_account_id uuid,
    p_email text,
    p_role_type_id uuid,
    p_entity_ids uuid[],
    p_access_profile_ids uuid[],
    p_permission_overrides jsonb,
    p_expiry_days integer DEFAULT 7,
    p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
    invitation_id uuid,
    invitation_token text,
    expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_email text := lower(btrim(p_email));
    v_entity_ids uuid[] := COALESCE(
        p_entity_ids,
        ARRAY[]::uuid[]
    );
    v_profile_ids uuid[] := COALESCE(
        p_access_profile_ids,
        ARRAY[]::uuid[]
    );
    v_permission_overrides jsonb := COALESCE(
        p_permission_overrides,
        '{}'::jsonb
    );
    v_invitation_id uuid;
    v_raw_token text;
    v_token_hash text;
    v_expires_at timestamptz;
    v_invalid_entity_ids uuid[];
    v_invalid_profile_ids uuid[];
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL
       OR p_role_type_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account and organisational role are required';
    END IF;

    IF v_email IS NULL
       OR v_email = ''
    THEN
        RAISE EXCEPTION 'Invitation email is required';
    END IF;

    IF p_expiry_days IS NULL
       OR p_expiry_days NOT IN (1, 3, 7, 14, 30)
    THEN
        RAISE EXCEPTION 'Invitation expiry must be 1, 3, 7, 14, or 30 days';
    END IF;

    IF jsonb_typeof(v_permission_overrides) <> 'object' THEN
        RAISE EXCEPTION 'Permission overrides must be a JSON object';
    END IF;

    -- Serialize governed client-administration mutations at the
    -- client boundary. This same lock discipline is used for
    -- authority-sensitive lifecycle operations.
    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = p_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client Super User authority required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_role_types AS crt
        WHERE crt.client_account_id = p_client_account_id
          AND crt.id = p_role_type_id
          AND crt.is_active = true
    ) THEN
        RAISE EXCEPTION 'Active organisational role does not belong to this client';
    END IF;

    -- Expiry validity is derived from expires_at. Materialize and
    -- audit any stale pending invitation for this client/email before
    -- applying the one-live-invitation rule.
    --
    -- The internal primitive cannot be executed by browser roles and
    -- does not make an authority decision of its own; authority has
    -- already been established above.
    PERFORM public.expire_client_invitations_internal(
        p_client_account_id,
        v_email,
        v_actor_id,
        'create_client_invitation',
        p_user_agent
    );

    IF EXISTS (
        SELECT 1
        FROM public.client_invitations AS ci
        WHERE ci.client_account_id = p_client_account_id
          AND ci.email = v_email
          AND ci.status = 'pending'
          AND ci.expires_at > now()
    ) THEN
        RAISE EXCEPTION 'An unexpired pending invitation already exists for this email';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_entity_ids) AS requested(entity_id)
        GROUP BY requested.entity_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate entity assignments are not allowed';
    END IF;

    SELECT COALESCE(
        array_agg(
            requested.entity_id
            ORDER BY requested.entity_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_invalid_entity_ids
    FROM unnest(v_entity_ids) AS requested(entity_id)
    LEFT JOIN public.entities AS e
      ON e.id = requested.entity_id
     AND e.client_account_id = p_client_account_id
    WHERE requested.entity_id IS NULL
       OR e.id IS NULL;

    IF cardinality(v_invalid_entity_ids) > 0 THEN
        RAISE EXCEPTION 'One or more entities do not belong to this client';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_profile_ids) AS requested(access_profile_id)
        GROUP BY requested.access_profile_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate access-profile assignments are not allowed';
    END IF;

    SELECT COALESCE(
        array_agg(
            requested.access_profile_id
            ORDER BY requested.access_profile_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_invalid_profile_ids
    FROM unnest(v_profile_ids) AS requested(access_profile_id)
    LEFT JOIN public.access_profiles AS ap
      ON ap.id = requested.access_profile_id
     AND ap.client_account_id = p_client_account_id
    WHERE requested.access_profile_id IS NULL
       OR ap.id IS NULL;

    IF cardinality(v_invalid_profile_ids) > 0 THEN
        RAISE EXCEPTION 'One or more access profiles do not belong to this client';
    END IF;

    /*
     * Invitation intent may contain only client-managed additional
     * profiles. Standard Access and any future system-managed profiles
     * are attached by canonical lifecycle commands, never by invitation
     * configuration.
     */
    IF EXISTS (
        SELECT 1
        FROM unnest(v_profile_ids) AS requested(access_profile_id)
        INNER JOIN public.access_profiles AS ap
          ON ap.id = requested.access_profile_id
         AND ap.client_account_id = p_client_account_id
        WHERE ap.is_system = true
           OR ap.system_key IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'System-managed access profiles cannot be assigned explicitly';
    END IF;

    /*
     * Invitation intent may contain only client-managed additional
     * profiles. Standard Access and any future system-managed profiles
     * are attached by canonical lifecycle commands, never by invitation
     * configuration.
     */
    IF EXISTS (
        SELECT 1
        FROM unnest(v_profile_ids) AS requested(access_profile_id)
        INNER JOIN public.access_profiles AS ap
          ON ap.id = requested.access_profile_id
         AND ap.client_account_id = p_client_account_id
        WHERE ap.is_system = true
           OR ap.system_key IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'System-managed access profiles cannot be assigned explicitly';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_each(v_permission_overrides) AS submitted
        WHERE jsonb_typeof(submitted.value) <> 'boolean'
    ) THEN
        RAISE EXCEPTION 'Permission override values must be boolean';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_each(v_permission_overrides) AS submitted
        LEFT JOIN public.permission_catalogue AS pc
          ON pc.key = submitted.key
         AND pc.scope = 'client'
         AND pc.is_active = true
         AND pc.assignable_by_client = true
         AND pc.super_user_inherent = false
        WHERE pc.key IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more permissions are not assignable client permissions';
    END IF;

    v_raw_token := encode(
        extensions.gen_random_bytes(32),
        'hex'
    );

    v_token_hash := encode(
        extensions.digest(
            convert_to(v_raw_token, 'UTF8'),
            'sha256'
        ),
        'hex'
    );

    v_expires_at := now() + make_interval(days => p_expiry_days);

    INSERT INTO public.client_invitations (
        client_account_id,
        email,
        role_type_id,
        token_hash,
        status,
        expires_at,
        invited_by
    )
    VALUES (
        p_client_account_id,
        v_email,
        p_role_type_id,
        v_token_hash,
        'pending',
        v_expires_at,
        v_actor_id
    )
    RETURNING id
    INTO v_invitation_id;

    INSERT INTO public.client_invitation_entities (
        client_account_id,
        invitation_id,
        entity_id
    )
    SELECT
        p_client_account_id,
        v_invitation_id,
        requested.entity_id
    FROM unnest(v_entity_ids) AS requested(entity_id);

    INSERT INTO public.client_invitation_access_profiles (
        client_account_id,
        invitation_id,
        access_profile_id
    )
    SELECT
        p_client_account_id,
        v_invitation_id,
        requested.access_profile_id
    FROM unnest(v_profile_ids) AS requested(access_profile_id);

    INSERT INTO public.client_invitation_permission_overrides (
        client_account_id,
        invitation_id,
        permission_key,
        enabled
    )
    SELECT
        p_client_account_id,
        v_invitation_id,
        submitted.key,
        (submitted.value #>> '{}')::boolean
    FROM jsonb_each(v_permission_overrides) AS submitted;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'create',
        'client_invitation',
        v_invitation_id,
        'Client invitation',
        NULL,
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'email', v_email,
            'role_type_id', p_role_type_id,
            'entity_ids', v_entity_ids,
            'access_profile_ids', v_profile_ids,
            'permission_overrides', v_permission_overrides,
            'expires_at', v_expires_at
        ),
        p_user_agent
    );

    RETURN QUERY
    SELECT
        v_invitation_id,
        v_raw_token,
        v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_invitation(
    uuid,
    text,
    uuid,
    uuid[],
    uuid[],
    jsonb,
    integer,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_client_invitation(
    uuid,
    text,
    uuid,
    uuid[],
    uuid[],
    jsonb,
    integer,
    text
) TO authenticated;

COMMENT ON FUNCTION public.create_client_invitation(
    uuid,
    text,
    uuid,
    uuid[],
    uuid[],
    jsonb,
    integer,
    text
) IS
'Creates complete canonical client invitation intent under Super User authority. Generates a 256-bit token, persists only its SHA-256 hash, and returns the raw token exactly once. Entity, profile, permission, expiry, client-boundary, and catalogue constraints are enforced atomically.';

-- ============================================================
-- 18. Governed client invitation revocation
--
-- Revocation is an explicit lifecycle transition. Invitation
-- history and intended configuration are retained; the invitation
-- is not deleted. Only pending invitations may be revoked.
-- ============================================================

CREATE OR REPLACE FUNCTION public.revoke_client_invitation(
    p_client_account_id uuid,
    p_invitation_id uuid,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_invitation_email text;
    v_role_type_id uuid;
    v_expires_at timestamptz;
    v_entity_ids uuid[];
    v_profile_ids uuid[];
    v_permission_overrides jsonb;
    v_revoked_at timestamptz;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL
       OR p_invitation_id IS NULL
    THEN
        RAISE EXCEPTION 'Client account and invitation are required';
    END IF;

    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = p_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Client Super User authority required';
    END IF;

    SELECT
        ci.email,
        ci.role_type_id,
        ci.expires_at
    INTO
        v_invitation_email,
        v_role_type_id,
        v_expires_at
    FROM public.client_invitations AS ci
    WHERE ci.client_account_id = p_client_account_id
      AND ci.id = p_invitation_id
      AND ci.status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending invitation does not belong to this client';
    END IF;

    SELECT COALESCE(
        array_agg(
            cie.entity_id
            ORDER BY cie.entity_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_entity_ids
    FROM public.client_invitation_entities AS cie
    WHERE cie.client_account_id = p_client_account_id
      AND cie.invitation_id = p_invitation_id;

    SELECT COALESCE(
        array_agg(
            ciap.access_profile_id
            ORDER BY ciap.access_profile_id
        ),
        ARRAY[]::uuid[]
    )
    INTO v_profile_ids
    FROM public.client_invitation_access_profiles AS ciap
    WHERE ciap.client_account_id = p_client_account_id
      AND ciap.invitation_id = p_invitation_id;

    SELECT COALESCE(
        jsonb_object_agg(
            cipo.permission_key,
            cipo.enabled
            ORDER BY cipo.permission_key
        ),
        '{}'::jsonb
    )
    INTO v_permission_overrides
    FROM public.client_invitation_permission_overrides AS cipo
    WHERE cipo.client_account_id = p_client_account_id
      AND cipo.invitation_id = p_invitation_id;

    v_revoked_at := now();

    UPDATE public.client_invitations
    SET
        status = 'revoked',
        revoked_by = v_actor_id,
        revoked_at = v_revoked_at,
        updated_at = v_revoked_at
    WHERE client_account_id = p_client_account_id
      AND id = p_invitation_id
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation is no longer pending';
    END IF;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'client_invitation',
        p_invitation_id,
        'Client invitation revoked',
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'email', v_invitation_email,
            'role_type_id', v_role_type_id,
            'status', 'pending',
            'entity_ids', v_entity_ids,
            'access_profile_ids', v_profile_ids,
            'permission_overrides', v_permission_overrides,
            'expires_at', v_expires_at
        ),
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'email', v_invitation_email,
            'role_type_id', v_role_type_id,
            'status', 'revoked',
            'entity_ids', v_entity_ids,
            'access_profile_ids', v_profile_ids,
            'permission_overrides', v_permission_overrides,
            'expires_at', v_expires_at,
            'revoked_by', v_actor_id,
            'revoked_at', v_revoked_at
        ),
        p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_client_invitation(
    uuid,
    uuid,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.revoke_client_invitation(
    uuid,
    uuid,
    text
) TO authenticated;

COMMENT ON FUNCTION public.revoke_client_invitation(
    uuid,
    uuid,
    text
) IS
'Explicitly revokes a pending canonical client invitation under Super User authority. Invitation history and intended configuration are retained for audit; raw token material is never exposed or logged.';

-- ============================================================
-- 19. Canonical client invitation acceptance
--
-- Invitation acceptance is identity-bound and atomic. Invitation
-- intent does not become authority until the matching authenticated
-- and email-confirmed Auth identity claims a valid token.
--
-- Expired invitations return a non-success lifecycle result instead
-- of raising after materialization, so the expired state and audit
-- record can commit.
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_client_invitation(
    p_invitation_token text,
    p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_token_hash text;
    v_invitation_id uuid;
    v_client_account_id uuid;
    v_invitation_email text;
    v_role_type_id uuid;
    v_status text;
    v_expires_at timestamptz;
    v_accepted_at timestamptz;
    v_client_user_id uuid;
    v_standard_access_profile_id uuid;
    v_entity_ids uuid[];
    v_profile_ids uuid[];
    v_permission_overrides jsonb;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_invitation_token IS NULL
       OR btrim(p_invitation_token) = ''
    THEN
        RAISE EXCEPTION 'Invitation token is required';
    END IF;

    SELECT lower(btrim(au.email))
    INTO v_actor_email
    FROM auth.users AS au
    WHERE au.id = v_actor_id
      AND au.email IS NOT NULL
      AND au.email_confirmed_at IS NOT NULL;

    IF v_actor_email IS NULL
       OR v_actor_email = ''
    THEN
        RAISE EXCEPTION 'A confirmed authenticated email is required';
    END IF;

    v_token_hash := encode(
        extensions.digest(
            convert_to(btrim(p_invitation_token), 'UTF8'),
            'sha256'
        ),
        'hex'
    );

    SELECT
        ci.id,
        ci.client_account_id,
        ci.email,
        ci.role_type_id,
        ci.status,
        ci.expires_at
    INTO
        v_invitation_id,
        v_client_account_id,
        v_invitation_email,
        v_role_type_id,
        v_status,
        v_expires_at
    FROM public.client_invitations AS ci
    WHERE ci.token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation token is invalid';
    END IF;

    -- Serialize membership/lifecycle changes at the client boundary.
    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = v_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF v_invitation_email <> v_actor_email THEN
        RAISE EXCEPTION 'Invitation email does not match the authenticated user';
    END IF;

    IF v_status = 'accepted' THEN
        RAISE EXCEPTION 'Invitation has already been accepted';
    END IF;

    IF v_status = 'revoked' THEN
        RAISE EXCEPTION 'Invitation has been revoked';
    END IF;

    IF v_status = 'expired' THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'invitation_id', v_invitation_id
        );
    END IF;

    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is not pending';
    END IF;

    -- Expiry is determined by time, not merely materialized status.
    IF v_expires_at <= now() THEN
        PERFORM public.expire_client_invitations_internal(
            v_client_account_id,
            v_invitation_email,
            v_actor_id,
            'accept_client_invitation',
            p_user_agent
        );

        RETURN jsonb_build_object(
            'status', 'expired',
            'invitation_id', v_invitation_id
        );
    END IF;

    -- Revalidate mutable invitation intent at claim time.
    IF NOT EXISTS (
        SELECT 1
        FROM public.client_role_types AS crt
        WHERE crt.client_account_id = v_client_account_id
          AND crt.id = v_role_type_id
          AND crt.is_active = true
    ) THEN
        RAISE EXCEPTION 'Invitation organisational role is no longer active';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_invitation_entities AS cie
        LEFT JOIN public.entities AS e
          ON e.client_account_id = cie.client_account_id
         AND e.id = cie.entity_id
        WHERE cie.client_account_id = v_client_account_id
          AND cie.invitation_id = v_invitation_id
          AND e.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Invitation contains invalid entity access';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_invitation_access_profiles AS ciap
        LEFT JOIN public.access_profiles AS ap
          ON ap.client_account_id = ciap.client_account_id
         AND ap.id = ciap.access_profile_id
        WHERE ciap.client_account_id = v_client_account_id
          AND ciap.invitation_id = v_invitation_id
          AND ap.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Invitation contains an invalid access profile';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_invitation_permission_overrides AS cipo
        LEFT JOIN public.permission_catalogue AS pc
          ON pc.key = cipo.permission_key
         AND pc.scope = 'client'
         AND pc.is_active = true
         AND pc.assignable_by_client = true
         AND pc.super_user_inherent = false
        WHERE cipo.client_account_id = v_client_account_id
          AND cipo.invitation_id = v_invitation_id
          AND pc.key IS NULL
    ) THEN
        RAISE EXCEPTION 'Invitation contains a permission that is no longer assignable';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_users AS cu
        WHERE cu.client_account_id = v_client_account_id
          AND cu.user_id = v_actor_id
    ) THEN
        RAISE EXCEPTION 'Authenticated user is already a member of this client';
    END IF;

    SELECT COALESCE(
        array_agg(cie.entity_id ORDER BY cie.entity_id),
        ARRAY[]::uuid[]
    )
    INTO v_entity_ids
    FROM public.client_invitation_entities AS cie
    WHERE cie.client_account_id = v_client_account_id
      AND cie.invitation_id = v_invitation_id;

    SELECT COALESCE(
        array_agg(ciap.access_profile_id ORDER BY ciap.access_profile_id),
        ARRAY[]::uuid[]
    )
    INTO v_profile_ids
    FROM public.client_invitation_access_profiles AS ciap
    WHERE ciap.client_account_id = v_client_account_id
      AND ciap.invitation_id = v_invitation_id;

    SELECT COALESCE(
        jsonb_object_agg(
            cipo.permission_key,
            cipo.enabled
            ORDER BY cipo.permission_key
        ),
        '{}'::jsonb
    )
    INTO v_permission_overrides
    FROM public.client_invitation_permission_overrides AS cipo
    WHERE cipo.client_account_id = v_client_account_id
      AND cipo.invitation_id = v_invitation_id;

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
        false,
        'active'
    )
    RETURNING id
    INTO v_client_user_id;

    -- Every ordinary client member receives the system-managed baseline.
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

    -- Invitation-specific profiles are additive to Standard Access.
    INSERT INTO public.client_user_access_profiles (
        client_account_id,
        client_user_id,
        access_profile_id,
        assigned_by
    )
    SELECT
        v_client_account_id,
        v_client_user_id,
        ciap.access_profile_id,
        v_actor_id
    FROM public.client_invitation_access_profiles AS ciap
    WHERE ciap.client_account_id = v_client_account_id
      AND ciap.invitation_id = v_invitation_id
      AND ciap.access_profile_id <> v_standard_access_profile_id
    ON CONFLICT (client_user_id, access_profile_id)
    DO NOTHING;

    INSERT INTO public.client_user_permissions (
        client_account_id,
        client_user_id,
        permission_key,
        enabled,
        assigned_by
    )
    SELECT
        v_client_account_id,
        v_client_user_id,
        cipo.permission_key,
        cipo.enabled,
        v_actor_id
    FROM public.client_invitation_permission_overrides AS cipo
    WHERE cipo.client_account_id = v_client_account_id
      AND cipo.invitation_id = v_invitation_id;

    -- Zero entity assignments are valid. These inserts naturally no-op.
    INSERT INTO public.user_entity_access (
        user_id,
        entity_id,
        role_id,
        org_role
    )
    SELECT
        v_actor_id,
        cie.entity_id,
        NULL,
        'read_only'
    FROM public.client_invitation_entities AS cie
    WHERE cie.client_account_id = v_client_account_id
      AND cie.invitation_id = v_invitation_id
    ON CONFLICT (user_id, entity_id) DO UPDATE
    SET
        role_id = NULL,
        org_role = 'read_only';

    INSERT INTO public.user_entities (
        user_id,
        entity_id,
        role
    )
    SELECT
        v_actor_id,
        cie.entity_id,
        'viewer'
    FROM public.client_invitation_entities AS cie
    WHERE cie.client_account_id = v_client_account_id
      AND cie.invitation_id = v_invitation_id
    ON CONFLICT (user_id, entity_id) DO UPDATE
    SET role = 'viewer';

    v_accepted_at := now();

    UPDATE public.client_invitations
    SET
        status = 'accepted',
        accepted_by = v_actor_id,
        accepted_at = v_accepted_at,
        updated_at = v_accepted_at
    WHERE id = v_invitation_id
      AND client_account_id = v_client_account_id
      AND status = 'pending'
      AND expires_at > v_accepted_at;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation could not be accepted';
    END IF;

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
        'client_invitation',
        v_invitation_id,
        'Client invitation accepted',
        jsonb_build_object(
            'client_account_id', v_client_account_id,
            'email', v_invitation_email,
            'role_type_id', v_role_type_id,
            'status', 'pending',
            'entity_ids', v_entity_ids,
            'access_profile_ids', v_profile_ids,
            'permission_overrides', v_permission_overrides,
            'expires_at', v_expires_at
        ),
        jsonb_build_object(
            'client_account_id', v_client_account_id,
            'email', v_invitation_email,
            'role_type_id', v_role_type_id,
            'status', 'accepted',
            'client_user_id', v_client_user_id,
            'is_super_user', false,
            'standard_access_profile_id', v_standard_access_profile_id,
            'entity_ids', v_entity_ids,
            'access_profile_ids', v_profile_ids,
            'permission_overrides', v_permission_overrides,
            'accepted_by', v_actor_id,
            'accepted_at', v_accepted_at
        ),
        p_user_agent
    );

    RETURN jsonb_build_object(
        'status', 'accepted',
        'invitation_id', v_invitation_id,
        'client_account_id', v_client_account_id,
        'client_user_id', v_client_user_id,
        'role_type_id', v_role_type_id,
        'standard_access_profile_id', v_standard_access_profile_id,
        'entity_ids', v_entity_ids,
        'is_super_user', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_client_invitation(
    text,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_client_invitation(
    text,
    text
) TO authenticated;

COMMENT ON FUNCTION public.accept_client_invitation(
    text,
    text
) IS
'Claims a canonical client invitation for the matching confirmed authenticated email. Establishes client membership, Standard Access, additional profile/permission intent, entity scope, and invitation acceptance atomically. Expired pending invitations are materialized and returned as expired without granting authority.';

-- ============================================================
-- 20. Governed Super User lifecycle
--
-- Super User is explicit client-administration authority. It is
-- independent of organisational role, access profiles, entity scope,
-- ordinary permissions, and platform authority.
--
-- Multiple active Super Users are permitted. An active client account
-- may never be left without at least one active Super User.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_client_user_super_user(
    p_client_account_id uuid,
    p_client_user_id uuid,
    p_is_super_user boolean,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_actor_email text;
    v_target_user_id uuid;
    v_target_status text;
    v_current_is_super_user boolean;
    v_active_super_user_count integer;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL THEN
        RAISE EXCEPTION 'Client account is required';
    END IF;

    IF p_client_user_id IS NULL THEN
        RAISE EXCEPTION 'Client user is required';
    END IF;

    IF p_is_super_user IS NULL THEN
        RAISE EXCEPTION 'Super User state is required';
    END IF;

    /*
     * Serialize all Super User lifecycle changes at the client boundary.
     * This prevents concurrent demotions/suspensions from independently
     * observing a valid Super User count and jointly violating the
     * minimum-one invariant.
     */
    PERFORM 1
    FROM public.client_accounts AS ca
    WHERE ca.id = p_client_account_id
      AND ca.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Active client Super User authority required';
    END IF;

    SELECT
        cu.user_id,
        cu.status,
        cu.is_super_user
    INTO
        v_target_user_id,
        v_target_status,
        v_current_is_super_user
    FROM public.client_users AS cu
    WHERE cu.id = p_client_user_id
      AND cu.client_account_id = p_client_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client user not found';
    END IF;

    /*
     * A suspended membership cannot be promoted into active client
     * administration authority. It may first be reactivated through the
     * governed membership command.
     */
    IF p_is_super_user = true
       AND v_target_status <> 'active'
    THEN
        RAISE EXCEPTION 'Only an active client user can become a Super User';
    END IF;

    /*
     * Idempotent requests are valid and produce no mutation/audit noise.
     */
    IF v_current_is_super_user = p_is_super_user THEN
        RETURN;
    END IF;

    IF p_is_super_user = false
       AND v_current_is_super_user = true
       AND v_target_status = 'active'
    THEN
        SELECT count(*)
        INTO v_active_super_user_count
        FROM public.client_users AS cu
        WHERE cu.client_account_id = p_client_account_id
          AND cu.status = 'active'
          AND cu.is_super_user = true;

        IF v_active_super_user_count <= 1 THEN
            RAISE EXCEPTION 'Client account must retain at least one active Super User';
        END IF;
    END IF;

    UPDATE public.client_users
    SET
        is_super_user = p_is_super_user,
        updated_at = now()
    WHERE id = p_client_user_id
      AND client_account_id = p_client_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client user could not be updated';
    END IF;

    SELECT p.email
    INTO v_actor_email
    FROM public.profiles AS p
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
        'client_user',
        p_client_user_id,
        'Client Super User authority changed',
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'user_id', v_target_user_id,
            'status', v_target_status,
            'is_super_user', v_current_is_super_user
        ),
        jsonb_build_object(
            'client_account_id', p_client_account_id,
            'user_id', v_target_user_id,
            'status', v_target_status,
            'is_super_user', p_is_super_user
        ),
        p_user_agent
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_user_super_user(
    uuid,
    uuid,
    boolean,
    text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_client_user_super_user(
    uuid,
    uuid,
    boolean,
    text
) TO authenticated;

COMMENT ON FUNCTION public.set_client_user_super_user(
    uuid,
    uuid,
    boolean,
    text
) IS
'Explicitly promotes or demotes client Super User authority under existing active Super User control. Organisational role, entity access, access profiles and platform role confer no Super User authority. An active client must retain at least one active Super User.';

-- ============================================================
-- 21. Existing canonical membership Standard Access backfill
--
-- Bring canonical memberships created before Standard Access existed
-- onto the same authorization baseline as newly provisioned and invited
-- users.
--
-- The backfill is deliberately limited to:
--   * active client accounts;
--   * active canonical client users;
--   * clients with an active Super User available as the accountable
--     system-profile creation/assignment actor.
--
-- Clients without an active Super User are not silently repaired here:
-- that is an invalid administration state requiring explicit remediation.
-- ============================================================

DO $$
DECLARE
    v_client record;
    v_standard_access_profile_id uuid;
BEGIN
    FOR v_client IN
        SELECT
            ca.id AS client_account_id,
            (
                SELECT cu.user_id
                FROM public.client_users AS cu
                WHERE cu.client_account_id = ca.id
                  AND cu.status = 'active'
                  AND cu.is_super_user = true
                ORDER BY cu.created_at, cu.id
                LIMIT 1
            ) AS actor_id
        FROM public.client_accounts AS ca
        WHERE ca.status = 'active'
          AND EXISTS (
              SELECT 1
              FROM public.client_users AS cu
              WHERE cu.client_account_id = ca.id
                AND cu.status = 'active'
          )
        ORDER BY ca.id
    LOOP
        IF v_client.actor_id IS NULL THEN
            RAISE EXCEPTION
                'Active client % has active canonical users but no active Super User',
                v_client.client_account_id;
        END IF;

        v_standard_access_profile_id :=
            public.sync_standard_access_profile_internal(
                v_client.client_account_id,
                v_client.actor_id
            );

        INSERT INTO public.client_user_access_profiles (
            client_account_id,
            client_user_id,
            access_profile_id,
            assigned_by
        )
        SELECT
            cu.client_account_id,
            cu.id,
            v_standard_access_profile_id,
            v_client.actor_id
        FROM public.client_users AS cu
        WHERE cu.client_account_id = v_client.client_account_id
          AND cu.status = 'active'
        ON CONFLICT (client_user_id, access_profile_id)
        DO NOTHING;
    END LOOP;
END;
$$;

COMMENT ON COLUMN public.access_profiles.system_key IS
'Stable AssetFlow-owned identifier for system-managed access profiles. NULL for client-created profiles. standard_access is the mandatory baseline profile for active canonical client users.';

-- ============================================================
-- 22. Retire legacy browser authorization mutation paths
--
-- Canonical client administration now owns user organisational role,
-- entity scope, access profiles, explicit permission overrides and
-- Super User authority.
--
-- These legacy entity-scoped mutation RPCs must no longer be callable
-- from browser roles because they bypass the canonical client boundary.
-- Their definitions remain temporarily for controlled internal/
-- compatibility use until legacy application callers are removed.
-- ============================================================

REVOKE ALL ON FUNCTION public.assign_entity_user_role(
    uuid,
    uuid,
    uuid,
    text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_entity_user_permissions(
    uuid,
    uuid,
    jsonb,
    text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assign_entity_user_role(
    uuid,
    uuid,
    uuid,
    text
) TO service_role, postgres;

GRANT EXECUTE ON FUNCTION public.set_entity_user_permissions(
    uuid,
    uuid,
    jsonb,
    text
) TO service_role, postgres;

COMMENT ON FUNCTION public.assign_entity_user_role(
    uuid,
    uuid,
    uuid,
    text
) IS
'Legacy entity-scoped authorization mutation retained temporarily for internal compatibility only. Browser execution is revoked; canonical client administration must use client-level governed commands.';

COMMENT ON FUNCTION public.set_entity_user_permissions(
    uuid,
    uuid,
    jsonb,
    text
) IS
'Legacy entity-scoped permission mutation retained temporarily for internal compatibility only. Browser execution is revoked; canonical client administration must use client-level governed commands.';
