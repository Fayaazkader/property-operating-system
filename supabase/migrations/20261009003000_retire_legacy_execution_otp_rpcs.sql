BEGIN;

-- Retire legacy OTP RPCs that are not bound to the current
-- invitation-token verification contract.
-- Keep the functions present for historical migration compatibility,
-- but prevent API callers from executing them.

REVOKE ALL ON FUNCTION
  public.issue_execution_verification_challenge(
    uuid, uuid, text, text, text
  )
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.verify_execution_verification_challenge(
    uuid, text
  )
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
