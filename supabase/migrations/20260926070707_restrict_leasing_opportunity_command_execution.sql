BEGIN;

/* =========================================================================
 * Restrict canonical leasing command execution
 *
 * Canonical leasing workflow commands are authenticated application
 * commands. They must not be directly executable by the anon role.
 *
 * SECURITY DEFINER functions retain their internal authority while each
 * command continues to enforce auth, entity membership and the applicable
 * explicit leasing permission.
 * ====================================================================== */


/* -------------------------------------------------------------------------
 * 1. CREATE LEASING OPPORTUNITY
 * ---------------------------------------------------------------------- */

REVOKE ALL ON FUNCTION public.create_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
FROM anon;

GRANT EXECUTE ON FUNCTION public.create_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
TO authenticated;


/* -------------------------------------------------------------------------
 * 2. UPDATE LEASING OPPORTUNITY
 * ---------------------------------------------------------------------- */

REVOKE ALL ON FUNCTION public.update_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.update_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
FROM anon;

GRANT EXECUTE ON FUNCTION public.update_leasing_opportunity(
  uuid,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  date,
  integer,
  text,
  uuid,
  text,
  text
)
TO authenticated;


/* -------------------------------------------------------------------------
 * 3. SUBMIT / VERSION COMMERCIAL TERMS
 * ---------------------------------------------------------------------- */

REVOKE ALL ON FUNCTION public.create_leasing_commercial_version(
  uuid,
  uuid,
  text,
  text
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_leasing_commercial_version(
  uuid,
  uuid,
  text,
  text
)
FROM anon;

GRANT EXECUTE ON FUNCTION public.create_leasing_commercial_version(
  uuid,
  uuid,
  text,
  text
)
TO authenticated;


/* -------------------------------------------------------------------------
 * 4. APPROVE COMMERCIAL TERMS
 * ---------------------------------------------------------------------- */

REVOKE ALL ON FUNCTION public.approve_leasing_commercial_terms(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text
)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_leasing_commercial_terms(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text
)
FROM anon;

GRANT EXECUTE ON FUNCTION public.approve_leasing_commercial_terms(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  text
)
TO authenticated;

COMMIT;
