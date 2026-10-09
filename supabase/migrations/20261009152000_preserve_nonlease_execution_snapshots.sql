-- Phase 1: preserve non-lease execution snapshots on dispatch.
-- Replaces the legacy trigger function; retains its trigger binding.
BEGIN;

CREATE OR REPLACE FUNCTION public.capture_execution_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_lease_snapshot jsonb;
BEGIN
  IF NEW.status = 'sent'
     AND OLD.status IS DISTINCT FROM 'sent'
  THEN
    -- Governed generated leases and manually uploaded documents
    -- already carry their authoritative frozen snapshots.
    IF COALESCE(
         (NEW.metadata ->> 'governed_generated_lease')::boolean,
         false
       )
       OR NEW.source_type = 'manual_document'
    THEN
      IF NEW.snapshot IS NULL THEN
        RAISE EXCEPTION
          'Frozen execution snapshot required before dispatch';
      END IF;

      RETURN NEW;
    END IF;

    -- Preserve legacy lease snapshot behavior only for lease sources.
    IF NEW.source_type IN ('lease', 'commercial_lease') THEN
      SELECT to_jsonb(l)
      INTO v_lease_snapshot
      FROM public.leases AS l
      WHERE l.id = NEW.source_id;

      IF v_lease_snapshot IS NULL THEN
        RAISE EXCEPTION
          'Source lease not found for execution snapshot';
      END IF;

      NEW.snapshot := v_lease_snapshot;
    ELSE
      -- Other execution types must not be interpreted as leases.
      IF NEW.snapshot IS NULL THEN
        RAISE EXCEPTION
          'Execution snapshot required before dispatch';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
