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

  PROPERTY: {
    PROPERTY_CREATE: 'property.create',
    PROPERTY_EDIT: 'property.edit',
    PROPERTY_ARCHIVE: 'property.archive',

    PORTFOLIO_CREATE: 'portfolio.create',
    PORTFOLIO_EDIT: 'portfolio.edit',
    PORTFOLIO_ARCHIVE: 'portfolio.archive',

    PROPERTY_TYPE_MANAGE: 'property_type.manage',
  },
} as const;

export type PermissionKey =
  | (typeof PERMISSIONS.LEASING)[keyof typeof PERMISSIONS.LEASING]
  | (typeof PERMISSIONS.PROPERTY)[keyof typeof PERMISSIONS.PROPERTY];

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

export const PROPERTY_PERMISSIONS = [
  {
    key: PERMISSIONS.PROPERTY.PROPERTY_CREATE,
    label: 'Create properties',
    description: 'Create properties within an authorised entity.',
  },
  {
    key: PERMISSIONS.PROPERTY.PROPERTY_EDIT,
    label: 'Edit properties',
    description: 'Edit property master data and governed property relationships.',
  },
  {
    key: PERMISSIONS.PROPERTY.PROPERTY_ARCHIVE,
    label: 'Archive properties',
    description: 'Archive properties without destroying historical operational lineage.',
  },
  {
    key: PERMISSIONS.PROPERTY.PORTFOLIO_CREATE,
    label: 'Create portfolios',
    description: 'Create organisational property portfolios within an authorised entity.',
  },
  {
    key: PERMISSIONS.PROPERTY.PORTFOLIO_EDIT,
    label: 'Edit portfolios',
    description: 'Edit portfolio master data within an authorised entity.',
  },
  {
    key: PERMISSIONS.PROPERTY.PORTFOLIO_ARCHIVE,
    label: 'Archive portfolios',
    description: 'Archive portfolios while preserving historical property relationships.',
  },
  {
    key: PERMISSIONS.PROPERTY.PROPERTY_TYPE_MANAGE,
    label: 'Manage property types',
    description: 'Manage entity-specific property classifications.',
  },
] as const;
