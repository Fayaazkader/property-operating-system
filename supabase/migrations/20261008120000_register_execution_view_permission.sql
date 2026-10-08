BEGIN;

INSERT INTO public.permission_catalogue (
  "key",
  category,
  name,
  description
)
VALUES (
  'leasing.execution.view',
  'leasing',
  'View Lease Executions',
  'View execution status and authorised participant information for leases within an authorised entity.'
)
ON CONFLICT ("key") DO UPDATE
SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO public.access_profile_permissions (
  access_profile_id,
  permission_key
)
SELECT
  ap.id,
  'leasing.execution.view'
FROM public.access_profiles ap
JOIN public.permission_catalogue pc
  ON pc.key = 'leasing.execution.view'
WHERE ap.name = 'Lease Authority'
  AND ap.system_key IS NULL
  AND ap.is_system = false
  AND pc.is_active = true
  AND pc.assignable_by_client = true
  AND pc.scope = 'client'
ON CONFLICT DO NOTHING;

COMMIT;
