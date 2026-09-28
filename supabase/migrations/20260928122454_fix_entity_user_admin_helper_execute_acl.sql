-- AssetFlow
-- Fix entity user administration helper execution ACL.
--
-- Authenticated RLS policies depend on can_administer_entity_users(uuid),
-- so authenticated users must be able to execute the helper.
--
-- Execution does not itself grant administration authority: the function
-- still evaluates the authenticated actor against the canonical admin.users
-- capability and the documented bootstrap compatibility paths.
--
-- Anonymous callers must not be able to execute this authenticated
-- authority helper.

BEGIN;

REVOKE ALL
ON FUNCTION public.can_administer_entity_users(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.can_administer_entity_users(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.can_administer_entity_users(uuid)
TO authenticated;

COMMIT;
