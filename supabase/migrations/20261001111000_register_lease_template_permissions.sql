-- AssetFlow: register governed lease-template capabilities.
--
-- Catalogue registration does not grant permissions to any user,
-- access profile or role. Operational capabilities must be assigned
-- explicitly through the canonical client administration workflow.

BEGIN;

INSERT INTO public.permission_catalogue (
  key,
  category,
  name,
  description,
  scope,
  assignable_by_client,
  super_user_inherent,
  is_active
)
VALUES
  (
    'leasing.template.create',
    'leasing',
    'Create Lease Templates',
    'Create draft lease templates within an authorised entity.',
    'client', true, false, true
  ),
  (
    'leasing.template.edit',
    'leasing',
    'Edit Lease Templates',
    'Edit draft lease templates and attach source documents.',
    'client', true, false, true
  ),
  (
    'leasing.template.review',
    'leasing',
    'Review Lease-Template Mappings',
    'Confirm, correct, reject and assign document field mappings.',
    'client', true, false, true
  ),
  (
    'leasing.template.approve',
    'leasing',
    'Approve Lease Templates',
    'Approve validated lease templates for operational use.',
    'client', true, false, true
  ),
  (
    'leasing.template.archive',
    'leasing',
    'Archive Lease Templates',
    'Retire approved lease templates while preserving their history.',
    'client', true, false, true
  )
ON CONFLICT (key)
DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope,
  assignable_by_client = EXCLUDED.assignable_by_client,
  super_user_inherent = EXCLUDED.super_user_inherent,
  is_active = EXCLUDED.is_active;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.permission_catalogue
    WHERE key IN (
      'leasing.template.create',
      'leasing.template.edit',
      'leasing.template.review',
      'leasing.template.approve',
      'leasing.template.archive'
    )
      AND scope = 'client'
      AND assignable_by_client IS TRUE
      AND super_user_inherent IS FALSE
      AND is_active IS TRUE
  ) <> 5 THEN
    RAISE EXCEPTION 'Lease-template permission registration failed';
  END IF;
END;
$$;

COMMIT;
