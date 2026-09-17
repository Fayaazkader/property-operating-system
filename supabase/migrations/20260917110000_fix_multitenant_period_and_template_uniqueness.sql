-- Financial periods are tenant-scoped.
-- period_name is a human-readable identifier and must not be globally unique.
ALTER TABLE public.financial_periods
  DROP CONSTRAINT IF EXISTS financial_periods_period_name_key;

CREATE UNIQUE INDEX financial_periods_entity_type_name_unique
  ON public.financial_periods (entity_id, period_type, period_name);

-- Each entity has one authoritative posting template per business event.
-- Template selection remains entity-scoped and deterministic.
CREATE UNIQUE INDEX posting_templates_entity_business_event_unique
  ON public.posting_templates (entity_id, business_event);
