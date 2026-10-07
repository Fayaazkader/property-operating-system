-- AssetFlow canonical client-administration read model.
--
-- Authority tables intentionally remain unavailable for direct browser SELECT.
-- This governed RPC exposes the minimum client-scoped administration state
-- required by the Settings / Users & Access control plane.

CREATE OR REPLACE FUNCTION public.get_client_administration(
    p_client_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_client_account_id IS NULL THEN
        RAISE EXCEPTION 'Client account is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.client_accounts AS ca
        WHERE ca.id = p_client_account_id
          AND ca.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Active client account not found';
    END IF;

    IF NOT public.is_active_client_super_user(
        v_actor_id,
        p_client_account_id
    ) THEN
        RAISE EXCEPTION 'Active client Super User authority required';
    END IF;

    SELECT jsonb_build_object(
        'clientAccount',
        (
            SELECT jsonb_build_object(
                'id', ca.id,
                'name', ca.name,
                'status', ca.status
            )
            FROM public.client_accounts AS ca
            WHERE ca.id = p_client_account_id
        ),

        'currentUser',
        (
            SELECT jsonb_build_object(
                'clientUserId', cu.id,
                'userId', cu.user_id,
                'email', p.email,
                'displayName', p.display_name,
                'roleTypeId', cu.role_type_id,
                'status', cu.status,
                'isSuperUser', cu.is_super_user
            )
            FROM public.client_users AS cu
            LEFT JOIN public.profiles AS p
              ON p.id = cu.user_id
            WHERE cu.client_account_id = p_client_account_id
              AND cu.user_id = v_actor_id
            LIMIT 1
        ),

        'roleTypes',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', crt.id,
                        'name', crt.name,
                        'description', crt.description,
                        'isActive', crt.is_active
                    )
                    ORDER BY lower(crt.name), crt.id
                )
                FROM public.client_role_types AS crt
                WHERE crt.client_account_id = p_client_account_id
            ),
            '[]'::jsonb
        ),

        'entities',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', e.id,
                        'name', e.name,
                        'code', e.entity_code
                    )
                    ORDER BY lower(e.name), e.id
                )
                FROM public.entities AS e
                WHERE e.client_account_id = p_client_account_id
            ),
            '[]'::jsonb
        ),

        'accessProfiles',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ap.id,
                        'name', ap.name,
                        'description', ap.description,
                        'isSystem', ap.is_system,
                        'systemKey', ap.system_key,
                        'permissions',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    app.permission_key
                                    ORDER BY app.permission_key
                                )
                                FROM public.access_profile_permissions AS app
                                WHERE app.access_profile_id = ap.id
                            ),
                            '[]'::jsonb
                        )
                    )
                    ORDER BY
                        CASE WHEN ap.system_key = 'standard_access' THEN 0 ELSE 1 END,
                        lower(ap.name),
                        ap.id
                )
                FROM public.access_profiles AS ap
                WHERE ap.client_account_id = p_client_account_id
            ),
            '[]'::jsonb
        ),

        'assignablePermissions',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'key', pc.key,
                        'name', pc.name,
                        'description', pc.description,
                        'category', pc.category
                    )
                    ORDER BY pc.category, pc.name, pc.key
                )
                FROM public.permission_catalogue AS pc
                WHERE pc.scope = 'client'
                  AND pc.is_active = true
                  AND pc.assignable_by_client = true
                  AND pc.super_user_inherent = false
            ),
            '[]'::jsonb
        ),

        'users',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'clientUserId', cu.id,
                        'userId', cu.user_id,
                        'email', p.email,
                        'displayName', p.display_name,
                        'roleTypeId', cu.role_type_id,
                        'status', cu.status,
                        'isSuperUser', cu.is_super_user,

                        'entityIds',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    uea.entity_id
                                    ORDER BY uea.entity_id
                                )
                                FROM public.user_entity_access AS uea
                                WHERE uea.user_id = cu.user_id
                                  AND EXISTS (
                                      SELECT 1
                                      FROM public.entities AS scoped_entity
                                      WHERE scoped_entity.id = uea.entity_id
                                        AND scoped_entity.client_account_id =
                                            p_client_account_id
                                  )
                            ),
                            '[]'::jsonb
                        ),

                        'accessProfileIds',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    cuap.access_profile_id
                                    ORDER BY cuap.access_profile_id
                                )
                                FROM public.client_user_access_profiles AS cuap
                                WHERE cuap.client_account_id =
                                        p_client_account_id
                                  AND cuap.client_user_id = cu.id
                            ),
                            '[]'::jsonb
                        ),

                        'permissionOverrides',
                        COALESCE(
                            (
                                SELECT jsonb_object_agg(
                                    cup.permission_key,
                                    cup.enabled
                                    ORDER BY cup.permission_key
                                )
                                FROM public.client_user_permissions AS cup
                                WHERE cup.client_account_id =
                                        p_client_account_id
                                  AND cup.client_user_id = cu.id
                            ),
                            '{}'::jsonb
                        )
                    )
                    ORDER BY
                        lower(COALESCE(p.display_name, p.email, '')),
                        cu.id
                )
                FROM public.client_users AS cu
                LEFT JOIN public.profiles AS p
                  ON p.id = cu.user_id
                WHERE cu.client_account_id = p_client_account_id
            ),
            '[]'::jsonb
        ),

        'invitations',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ci.id,
                        'email', ci.email,
                        'roleTypeId', ci.role_type_id,
                        'status',
                        CASE
                            WHEN ci.status = 'pending'
                             AND ci.expires_at <= now()
                            THEN 'expired'
                            ELSE ci.status
                        END,
                        'expiresAt', ci.expires_at,
                        'createdAt', ci.created_at,

                        'entityIds',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    cie.entity_id
                                    ORDER BY cie.entity_id
                                )
                                FROM public.client_invitation_entities AS cie
                                WHERE cie.invitation_id = ci.id
                                  AND cie.client_account_id =
                                      p_client_account_id
                            ),
                            '[]'::jsonb
                        ),

                        'accessProfileIds',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    ciap.access_profile_id
                                    ORDER BY ciap.access_profile_id
                                )
                                FROM public.client_invitation_access_profiles AS ciap
                                WHERE ciap.invitation_id = ci.id
                                  AND ciap.client_account_id =
                                      p_client_account_id
                            ),
                            '[]'::jsonb
                        ),

                        'permissionOverrides',
                        COALESCE(
                            (
                                SELECT jsonb_object_agg(
                                    cipo.permission_key,
                                    cipo.enabled
                                    ORDER BY cipo.permission_key
                                )
                                FROM public.client_invitation_permission_overrides AS cipo
                                WHERE cipo.invitation_id = ci.id
                                  AND cipo.client_account_id =
                                      p_client_account_id
                            ),
                            '{}'::jsonb
                        )
                    )
                    ORDER BY ci.created_at DESC, ci.id
                )
                FROM public.client_invitations AS ci
                WHERE ci.client_account_id = p_client_account_id
            ),
            '[]'::jsonb
        )
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_administration(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_client_administration(uuid)
TO authenticated;

COMMENT ON FUNCTION public.get_client_administration(uuid) IS
'Governed canonical read model for the AssetFlow Users & Access control plane. Available only to an active Super User of the requested active client account. Authority tables remain unavailable for direct browser SELECT.';