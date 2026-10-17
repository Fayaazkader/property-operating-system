BEGIN;

CREATE OR REPLACE FUNCTION public.check_single_open_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'open' AND EXISTS (
    SELECT 1
    FROM public.financial_periods
    WHERE entity_id = NEW.entity_id
      AND period_type = NEW.period_type
      AND status = 'open'
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION
      'Only one open % period allowed per entity',
      NEW.period_type;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
