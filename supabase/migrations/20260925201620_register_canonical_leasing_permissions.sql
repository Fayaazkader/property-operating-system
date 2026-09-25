BEGIN;

INSERT INTO public.permission_catalogue (
  "key",
  category,
  name,
  description
)
VALUES
  (
    'leasing.opportunity.create',
    'leasing',
    'Create Leasing Opportunities',
    'Create new canonical commercial leasing opportunities.'
  ),
  (
    'leasing.opportunity.edit',
    'leasing',
    'Edit Leasing Opportunities',
    'Edit working commercial terms and opportunity information before governed submission.'
  ),
  (
    'leasing.commercial.submit',
    'leasing',
    'Submit Commercial Terms',
    'Submit commercial terms as an immutable version for internal approval.'
  ),
  (
    'leasing.commercial.approve',
    'leasing',
    'Approve Commercial Terms',
    'Approve an exact submitted commercial terms version.'
  ),
  (
    'leasing.commercial.reject',
    'leasing',
    'Reject Commercial Terms',
    'Reject submitted commercial terms and return the transaction for revision.'
  ),
  (
    'leasing.document.generate',
    'leasing',
    'Generate Lease Documents',
    'Generate lease documents from approved commercial terms and an approved customer template.'
  ),
  (
    'leasing.execution.send',
    'leasing',
    'Send Lease for Execution',
    'Send an approved lease document into the governed execution and signature workflow.'
  ),
  (
    'leasing.activation.execute',
    'leasing',
    'Activate Executed Leases',
    'Activate a fully executed lease into operational tenant, billing, deposit, commission, and occupancy workflows.'
  )
ON CONFLICT ("key") DO UPDATE
SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

COMMIT;
