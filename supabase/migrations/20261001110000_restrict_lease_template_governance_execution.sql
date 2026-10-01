-- AssetFlow: restrict lease-template governance RPC execution.
--
-- These SECURITY DEFINER functions accept a caller-supplied user ID.
-- Only trusted server-side routes may invoke them until the complete
-- authenticated, capability-governed workflow is deployed.
--
-- This migration records the emergency production containment in Git.
-- It is intentionally idempotent.

BEGIN;

REVOKE ALL ON FUNCTION public.approve_lease_template(
  uuid, uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.review_lease_template_mapping(
  uuid, uuid, uuid, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_lease_template(
  uuid, uuid, uuid, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.review_lease_template_mapping(
  uuid, uuid, uuid, text, text, text, text, text, text
) TO service_role;

DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.approve_lease_template(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.review_lease_template_mapping(uuid,uuid,uuid,text,text,text,text,text,text)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function, 'EXECUTE')
    THEN
      RAISE EXCEPTION
        'Lease-template RPC privileges failed verification: %',
        v_function;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
