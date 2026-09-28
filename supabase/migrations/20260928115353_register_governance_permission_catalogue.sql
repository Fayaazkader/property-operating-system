-- AssetFlow
-- Register Canonical Governance Permission Catalogue
--
-- Registers the client-assignable governance capability vocabulary used by
-- AssetFlow's canonical governance authority layer.
--
-- This migration registers capabilities only.
-- It does not grant permissions to users or roles.
--
-- governance.policy.supersede is reserved for the canonical policy
-- supersession workflow. Registration does not imply that workflow is
-- currently implemented.

BEGIN;

INSERT INTO public.permission_catalogue (
  key,
  category,
  name,
  description
)
VALUES
  (
    'governance.policy.create',
    'governance',
    'Create Governance Policies',
    'Create entity-scoped governance policy sets.'
  ),
  (
    'governance.policy.edit',
    'governance',
    'Edit Governance Policies',
    'Configure rules on draft entity-scoped governance policy sets.'
  ),
  (
    'governance.policy.approve',
    'governance',
    'Approve Governance Policies',
    'Approve validated entity-scoped governance policy sets.'
  ),
  (
    'governance.policy.activate',
    'governance',
    'Activate Governance Policies',
    'Activate approved entity-scoped governance policy sets.'
  ),
  (
    'governance.policy.supersede',
    'governance',
    'Supersede Governance Policies',
    'Authority reserved for superseding active entity-scoped governance policy sets through the canonical policy lifecycle.'
  ),
  (
    'governance.exception.request',
    'governance',
    'Request Governance Exceptions',
    'Request a governed exception to an eligible client governance requirement.'
  ),
  (
    'governance.exception.decide',
    'governance',
    'Decide Governance Exceptions',
    'Approve, reject, or revoke governed exceptions where authorised.'
  ),
  (
    'governance.evaluate',
    'governance',
    'Evaluate Governance',
    'Execute canonical governance evaluation for an authorised entity and workflow context.'
  )
ON CONFLICT (key)
DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

COMMIT;
