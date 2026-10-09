-- Restrict execution trigger helpers to privileged database roles.
-- Existing trigger bindings remain unchanged.

REVOKE ALL ON FUNCTION public.capture_execution_snapshot()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.check_execution_sla()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.lock_execution()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.prevent_source_updates_during_execution()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.capture_execution_snapshot()
TO service_role;

GRANT EXECUTE ON FUNCTION public.check_execution_sla()
TO service_role;

GRANT EXECUTE ON FUNCTION public.lock_execution()
TO service_role;

GRANT EXECUTE ON FUNCTION public.prevent_source_updates_during_execution()
TO service_role;
