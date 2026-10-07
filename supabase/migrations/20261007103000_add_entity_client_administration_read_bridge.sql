-- Resolve the canonical client administration read model from an entity
-- already selected by the authenticated AssetFlow user.
--
-- This keeps canonical client-account discovery behind the governed
-- administration boundary and avoids relying on static frontend company config.

CREATE OR REPLACE FUNCTION public.get_client_administration_for_entity(
    p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_client_account_id uuid;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_entity_id IS NULL THEN
        RAISE EXCEPTION 'Entity is required';
    END IF;

    SELECT e.client_account_id
    INTO v_client_account_id
    FROM public.entities AS e
    WHERE e.id = p_entity_id;

    IF v_client_account_id IS NULL THEN
        RAISE EXCEPTION 'Canonical client account not found for entity';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_entity_access AS uea
        WHERE uea.user_id = v_actor_id
          AND uea.entity_id = p_entity_id
    ) THEN
        RAISE EXCEPTION 'Entity access required';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        v_client_account_id
    ) THEN
        RAISE EXCEPTION 'Active client Super User authority required';
    END IF;

    RETURN public.get_client_administration(
        v_client_account_id
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.get_client_administration_for_entity(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.get_client_administration_for_entity(uuid)
TO authenticated;

COMMENT ON FUNCTION
    public.get_client_administration_for_entity(uuid)
IS
'Resolves the canonical client administration read model from an authenticated user''s selected entity. Requires entity access and active client Super User authority.';