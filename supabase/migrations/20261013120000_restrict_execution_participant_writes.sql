BEGIN;

-- Participant mutations must be performed by controlled
-- SECURITY DEFINER database functions, not directly by
-- the application service role.
REVOKE INSERT, UPDATE, DELETE
ON TABLE public.execution_participants
FROM service_role;

-- Preserve participant reads for authorized server workflows.
GRANT SELECT
ON TABLE public.execution_participants
TO service_role;

COMMIT;
