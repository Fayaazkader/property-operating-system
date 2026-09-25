/**
 * AssetFlow canonical permission registry.
 *
 * Permission keys describe capabilities, not roles.
 * Clients decide which users receive which capabilities through
 * user_entity_permissions.
 *
 * Do not hard-code role assumptions into workflow services.
 */

export const PERMISSIONS = {
  LEASING: {
    OPPORTUNITY_CREATE: 'leasing.opportunity.create',
    OPPORTUNITY_EDIT: 'leasing.opportunity.edit',

    COMMERCIAL_SUBMIT: 'leasing.commercial.submit',
    COMMERCIAL_APPROVE: 'leasing.commercial.approve',
    COMMERCIAL_REJECT: 'leasing.commercial.reject',

    DOCUMENT_GENERATE: 'leasing.document.generate',
    EXECUTION_SEND: 'leasing.execution.send',
    ACTIVATION_EXECUTE: 'leasing.activation.execute',
  },
} as const;

export type PermissionKey =
  | (typeof PERMISSIONS.LEASING)[keyof typeof PERMISSIONS.LEASING];

export const LEASING_PERMISSIONS = [
  {
    key: PERMISSIONS.LEASING.OPPORTUNITY_CREATE,
    label: 'Create leasing opportunities',
    description: 'Create a new commercial leasing transaction.',
  },
  {
    key: PERMISSIONS.LEASING.OPPORTUNITY_EDIT,
    label: 'Edit leasing opportunities',
    description: 'Edit working commercial leasing transaction data.',
  },
  {
    key: PERMISSIONS.LEASING.COMMERCIAL_SUBMIT,
    label: 'Submit commercial terms',
    description: 'Freeze working commercial terms into an immutable version for approval.',
  },
  {
    key: PERMISSIONS.LEASING.COMMERCIAL_APPROVE,
    label: 'Approve commercial terms',
    description: 'Approve an immutable commercial terms version.',
  },
  {
    key: PERMISSIONS.LEASING.COMMERCIAL_REJECT,
    label: 'Reject commercial terms',
    description: 'Reject an immutable commercial terms version.',
  },
  {
    key: PERMISSIONS.LEASING.DOCUMENT_GENERATE,
    label: 'Generate lease documents',
    description: 'Generate a lease from approved commercial terms and an approved client template.',
  },
  {
    key: PERMISSIONS.LEASING.EXECUTION_SEND,
    label: 'Send leases for execution',
    description: 'Send an approved lease document into the execution workflow.',
  },
  {
    key: PERMISSIONS.LEASING.ACTIVATION_EXECUTE,
    label: 'Activate executed leases',
    description: 'Perform governed operational activation after legal execution.',
  },
] as const;
