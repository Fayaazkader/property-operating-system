// lib/revenue/lod-merge-fields.ts
// Available merge fields for Letter of Demand templates

export const LOD_MERGE_FIELDS = [
  { key: '{{tenant_name}}', label: 'Tenant Name', category: 'Tenant' },
  { key: '{{tenant_reference}}', label: 'Tenant Reference', category: 'Tenant' },
  { key: '{{lease_ref}}', label: 'Lease Reference', category: 'Lease' },
  { key: '{{property_name}}', label: 'Property Name', category: 'Lease' },
  { key: '{{arrears_amount}}', label: 'Arrears Amount', category: 'Financial' },
  { key: '{{days_overdue}}', label: 'Days Overdue', category: 'Financial' },
  { key: '{{last_payment_date}}', label: 'Last Payment Date', category: 'Financial' },
  { key: '{{last_payment_amount}}', label: 'Last Payment Amount', category: 'Financial' },
  { key: '{{statement_date}}', label: 'Statement Date', category: 'Financial' },
  { key: '{{company_name}}', label: 'Company Name', category: 'Company' },
  { key: '{{company_email}}', label: 'Company Email', category: 'Company' },
  { key: '{{company_phone}}', label: 'Company Phone', category: 'Company' },
  { key: '{{bank_name}}', label: 'Bank Name', category: 'Banking' },
  { key: '{{bank_account}}', label: 'Bank Account', category: 'Banking' },
  { key: '{{bank_branch}}', label: 'Bank Branch', category: 'Banking' },
  { key: '{{today}}', label: 'Today\'s Date', category: 'System' },
  { key: '{{due_date}}', label: 'Due Date (7 days)', category: 'System' },
] as const;
