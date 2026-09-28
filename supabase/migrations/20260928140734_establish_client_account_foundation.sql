-- AssetFlow canonical client-account foundation.
-- Additive only: this migration does not cut existing runtime authorization
-- over to the new client-account model.

-- ============================================================
-- 1. Client accounts
-- ============================================================

CREATE TABLE public.client_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_accounts_name_not_blank
        CHECK (btrim(name) <> ''),

    CONSTRAINT client_accounts_status_check
        CHECK (status IN ('active', 'suspended', 'archived'))
);

-- ============================================================
-- 2. Legal entities belong to a client account
-- Transitional: nullable until existing entities are explicitly
-- assigned. No automatic grouping/backfill is performed here.
-- ============================================================

ALTER TABLE public.entities
    ADD COLUMN client_account_id uuid;

ALTER TABLE public.entities
    ADD CONSTRAINT entities_client_account_id_fkey
    FOREIGN KEY (client_account_id)
    REFERENCES public.client_accounts(id)
    ON DELETE RESTRICT;

CREATE INDEX idx_entities_client_account_id
    ON public.entities(client_account_id);

-- ============================================================
-- 3. Organisational role types
--
-- A role type describes what a person does in the client's
-- organisation. It does NOT confer application authority.
-- ============================================================

CREATE TABLE public.client_role_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_account_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_role_types_client_account_id_fkey
        FOREIGN KEY (client_account_id)
        REFERENCES public.client_accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT client_role_types_name_not_blank
        CHECK (btrim(name) <> ''),

    CONSTRAINT client_role_types_client_id_id_key
        UNIQUE (client_account_id, id)
);

CREATE UNIQUE INDEX client_role_types_client_name_key
    ON public.client_role_types (
        client_account_id,
        lower(btrim(name))
    );

-- ============================================================
-- 4. Client users
--
-- This is client membership. A user may belong to more than one
-- client account. Organisational role is mandatory.
--
-- is_super_user represents client administration authority.
-- It is separate from AssetFlow platform authority and does not
-- automatically grant operational/governance capabilities.
-- ============================================================

CREATE TABLE public.client_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_type_id uuid NOT NULL,
    is_super_user boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_users_client_account_id_fkey
        FOREIGN KEY (client_account_id)
        REFERENCES public.client_accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT client_users_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT client_users_role_type_same_client_fkey
        FOREIGN KEY (client_account_id, role_type_id)
        REFERENCES public.client_role_types(client_account_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT client_users_status_check
        CHECK (status IN ('active', 'suspended')),

    CONSTRAINT client_users_client_user_key
        UNIQUE (client_account_id, user_id),

    CONSTRAINT client_users_client_id_id_key
        UNIQUE (client_account_id, id)
);

CREATE INDEX idx_client_users_user_id
    ON public.client_users(user_id);

CREATE INDEX idx_client_users_role_type_id
    ON public.client_users(role_type_id);

-- ============================================================
-- 5. Permission catalogue metadata
--
-- Existing catalogue entries are client-scoped today.
-- Administration permissions are inherent Super User powers and
-- are not ordinary client-delegable operational capabilities.
-- ============================================================

ALTER TABLE public.permission_catalogue
    ADD COLUMN scope text NOT NULL DEFAULT 'client',
    ADD COLUMN assignable_by_client boolean NOT NULL DEFAULT true,
    ADD COLUMN super_user_inherent boolean NOT NULL DEFAULT false,
    ADD COLUMN is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.permission_catalogue
    ADD CONSTRAINT permission_catalogue_scope_check
    CHECK (scope IN ('client', 'platform'));

UPDATE public.permission_catalogue
SET
    scope = 'client',
    assignable_by_client = false,
    super_user_inherent = true
WHERE key IN (
    'admin.features',
    'admin.integrations',
    'admin.roles',
    'admin.settings',
    'admin.users'
);

-- ============================================================
-- 6. Explicit client-user permission overrides
-- ============================================================

CREATE TABLE public.client_user_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_account_id uuid NOT NULL,
    client_user_id uuid NOT NULL,
    permission_key text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    assigned_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_user_permissions_client_account_id_fkey
        FOREIGN KEY (client_account_id)
        REFERENCES public.client_accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT client_user_permissions_user_same_client_fkey
        FOREIGN KEY (client_account_id, client_user_id)
        REFERENCES public.client_users(client_account_id, id)
        ON DELETE CASCADE,

    CONSTRAINT client_user_permissions_permission_key_fkey
        FOREIGN KEY (permission_key)
        REFERENCES public.permission_catalogue(key)
        ON DELETE RESTRICT,

    CONSTRAINT client_user_permissions_assigned_by_fkey
        FOREIGN KEY (assigned_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    CONSTRAINT client_user_permissions_user_permission_key
        UNIQUE (client_user_id, permission_key)
);

CREATE INDEX idx_client_user_permissions_client_account
    ON public.client_user_permissions(client_account_id);

CREATE INDEX idx_client_user_permissions_permission_key
    ON public.client_user_permissions(permission_key);

-- ============================================================
-- 7. Access profiles
--
-- Reusable authorization bundles. These are deliberately NOT
-- called organisational roles.
-- ============================================================

CREATE TABLE public.access_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_account_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT false,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT access_profiles_client_account_id_fkey
        FOREIGN KEY (client_account_id)
        REFERENCES public.client_accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT access_profiles_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    CONSTRAINT access_profiles_name_not_blank
        CHECK (btrim(name) <> ''),

    CONSTRAINT access_profiles_client_id_id_key
        UNIQUE (client_account_id, id)
);

CREATE UNIQUE INDEX access_profiles_client_name_key
    ON public.access_profiles (
        client_account_id,
        lower(btrim(name))
    );

CREATE TABLE public.access_profile_permissions (
    access_profile_id uuid NOT NULL,
    permission_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT access_profile_permissions_pkey
        PRIMARY KEY (access_profile_id, permission_key),

    CONSTRAINT access_profile_permissions_profile_fkey
        FOREIGN KEY (access_profile_id)
        REFERENCES public.access_profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT access_profile_permissions_permission_fkey
        FOREIGN KEY (permission_key)
        REFERENCES public.permission_catalogue(key)
        ON DELETE RESTRICT
);

CREATE INDEX idx_access_profile_permissions_permission_key
    ON public.access_profile_permissions(permission_key);

CREATE TABLE public.client_user_access_profiles (
    client_account_id uuid NOT NULL,
    client_user_id uuid NOT NULL,
    access_profile_id uuid NOT NULL,
    assigned_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT client_user_access_profiles_pkey
        PRIMARY KEY (client_user_id, access_profile_id),

    CONSTRAINT client_user_access_profiles_client_account_id_fkey
        FOREIGN KEY (client_account_id)
        REFERENCES public.client_accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT client_user_access_profiles_user_same_client_fkey
        FOREIGN KEY (client_account_id, client_user_id)
        REFERENCES public.client_users(client_account_id, id)
        ON DELETE CASCADE,

    CONSTRAINT client_user_access_profiles_profile_same_client_fkey
        FOREIGN KEY (client_account_id, access_profile_id)
        REFERENCES public.access_profiles(client_account_id, id)
        ON DELETE CASCADE,

    CONSTRAINT client_user_access_profiles_assigned_by_fkey
        FOREIGN KEY (assigned_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_client_user_access_profiles_client_account
    ON public.client_user_access_profiles(client_account_id);

CREATE INDEX idx_client_user_access_profiles_access_profile
    ON public.client_user_access_profiles(access_profile_id);

-- ============================================================
-- 8. RLS
--
-- Foundation tables are protected immediately. No permissive
-- authenticated mutation policies are introduced here.
-- Governed administration commands will be added separately.
-- ============================================================

ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_role_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_user_access_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. Direct privilege hardening
-- ============================================================

REVOKE ALL ON TABLE public.client_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.client_role_types FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.client_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.client_user_permissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.access_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.access_profile_permissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.client_user_access_profiles FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.client_accounts IS
'Canonical AssetFlow client/customer boundary. Distinct from legal entities and property tenants.';

COMMENT ON TABLE public.client_role_types IS
'Client-defined organisational roles describing what a person does. Role type does not itself confer application authority.';

COMMENT ON TABLE public.client_users IS
'Canonical membership of an authenticated user in an AssetFlow client account. Organisational role is mandatory; Super User is explicit client administration authority.';

COMMENT ON COLUMN public.client_users.is_super_user IS
'Client administration authority only. Does not inherently grant operational or governance capabilities.';

COMMENT ON TABLE public.client_user_permissions IS
'Explicit client-level capability overrides for a client membership.';

COMMENT ON TABLE public.access_profiles IS
'Reusable client-level authorization bundles. Access profiles are distinct from organisational role types.';
