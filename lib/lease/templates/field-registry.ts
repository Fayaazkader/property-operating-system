import type { LeaseTemplateFieldType } from './types';

export interface LeaseFieldDefinition {
  key: string;
  label: string;
  type: LeaseTemplateFieldType;
  required: boolean;
}

/*
 * Canonical AssetFlow lease fields.
 *
 * This registry describes semantic lease fields only.
 * It must not contain document-specific extraction patterns,
 * placeholder locations, OCR evidence or generated values.
 */
export const LEASE_FIELD_DEFINITIONS: readonly LeaseFieldDefinition[] = [
  {
    key: 'tenant_name',
    label: 'Tenant / Lessee Name',
    type: 'text',
    required: true,
  },
  {
    key: 'landlord_name',
    label: 'Landlord / Lessor Name',
    type: 'text',
    required: true,
  },
  {
    key: 'tenant_registration_number',
    label: 'Tenant Registration Number',
    type: 'text',
    required: false,
  },
  {
    key: 'landlord_registration_number',
    label: 'Landlord Registration Number',
    type: 'text',
    required: false,
  },
  {
    key: 'tenant_vat_number',
    label: 'Tenant VAT Number',
    type: 'text',
    required: false,
  },
  {
    key: 'landlord_vat_number',
    label: 'Landlord VAT Number',
    type: 'text',
    required: false,
  },
  {
    key: 'tenant_email',
    label: 'Tenant Email',
    type: 'email',
    required: false,
  },
  {
    key: 'landlord_email',
    label: 'Landlord Email',
    type: 'email',
    required: false,
  },
  {
    key: 'tenant_phone',
    label: 'Tenant Telephone',
    type: 'phone',
    required: false,
  },
  {
    key: 'landlord_phone',
    label: 'Landlord Telephone',
    type: 'phone',
    required: false,
  },
  {
    key: 'property_name',
    label: 'Property Name',
    type: 'text',
    required: true,
  },
  {
    key: 'unit_number',
    label: 'Unit / Shop Number',
    type: 'text',
    required: true,
  },
  {
    key: 'lease_commencement_date',
    label: 'Lease Commencement Date',
    type: 'date',
    required: true,
  },
  {
    key: 'lease_expiry_date',
    label: 'Lease Expiry Date',
    type: 'date',
    required: true,
  },
  {
    key: 'monthly_rental',
    label: 'Monthly Rental',
    type: 'currency',
    required: true,
  },
  {
    key: 'rental_escalation',
    label: 'Rental Escalation',
    type: 'percentage',
    required: false,
  },
  {
    key: 'deposit_amount',
    label: 'Deposit Amount',
    type: 'currency',
    required: false,
  },
  {
    key: 'lease_fee',
    label: 'Lease / Administration Fee',
    type: 'currency',
    required: false,
  },
];

const LEASE_FIELD_BY_KEY = new Map(
  LEASE_FIELD_DEFINITIONS.map(definition => [
    definition.key,
    definition,
  ])
);

/*
 * Semantic aliases only.
 *
 * These aliases allow common customer terminology to resolve to an
 * AssetFlow canonical field without changing the customer's document.
 *
 * Do not add an alias unless its meaning is sufficiently unambiguous.
 */
const LEASE_FIELD_ALIASES: Readonly<Record<string, string>> = {
  lessee_name: 'tenant_name',
  tenant: 'tenant_name',
  lessee: 'tenant_name',

  lessor_name: 'landlord_name',
  landlord: 'landlord_name',
  lessor: 'landlord_name',

  tenant_registration: 'tenant_registration_number',
  lessee_registration_number: 'tenant_registration_number',

  landlord_registration: 'landlord_registration_number',
  lessor_registration_number: 'landlord_registration_number',

  tenant_vat: 'tenant_vat_number',
  lessee_vat_number: 'tenant_vat_number',

  landlord_vat: 'landlord_vat_number',
  lessor_vat_number: 'landlord_vat_number',

  shop_number: 'unit_number',
  shop_no: 'unit_number',
  unit_no: 'unit_number',

  commencement_date: 'lease_commencement_date',
  lease_start_date: 'lease_commencement_date',
  start_date: 'lease_commencement_date',

  expiry_date: 'lease_expiry_date',
  termination_date: 'lease_expiry_date',
  lease_end_date: 'lease_expiry_date',
  end_date: 'lease_expiry_date',

  rent: 'monthly_rental',
  monthly_rent: 'monthly_rental',

  escalation: 'rental_escalation',
  escalation_percentage: 'rental_escalation',

  deposit: 'deposit_amount',

  administration_fee: 'lease_fee',
  admin_fee: 'lease_fee',
};

export function normaliseLeaseFieldToken(
  token: string
): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function getLeaseFieldDefinition(
  key: string
): LeaseFieldDefinition | undefined {
  return LEASE_FIELD_BY_KEY.get(key);
}

export function isCanonicalLeaseFieldKey(
  key: string
): boolean {
  return LEASE_FIELD_BY_KEY.has(key);
}

export function resolveLeaseFieldKey(
  token: string
): string | undefined {
  const normalised = normaliseLeaseFieldToken(token);

  if (!normalised) {
    return undefined;
  }

  if (isCanonicalLeaseFieldKey(normalised)) {
    return normalised;
  }

  const alias = LEASE_FIELD_ALIASES[normalised];

  if (
    alias &&
    isCanonicalLeaseFieldKey(alias)
  ) {
    return alias;
  }

  return undefined;
}

export function inferLeaseFieldType(
  key: string
): LeaseTemplateFieldType {
  const canonicalKey =
    resolveLeaseFieldKey(key) ??
    normaliseLeaseFieldToken(key);

  const definition =
    getLeaseFieldDefinition(canonicalKey);

  if (definition) {
    return definition.type;
  }

  if (canonicalKey.includes('email')) return 'email';

  if (
    canonicalKey.includes('phone') ||
    canonicalKey.includes('telephone')
  ) {
    return 'phone';
  }

  if (canonicalKey.includes('date')) return 'date';

  if (
    canonicalKey.includes('rental') ||
    canonicalKey.includes('rent') ||
    canonicalKey.includes('deposit') ||
    canonicalKey.includes('fee') ||
    canonicalKey.includes('amount')
  ) {
    return 'currency';
  }

  if (
    canonicalKey.includes('percentage') ||
    canonicalKey.includes('escalation')
  ) {
    return 'percentage';
  }

  return 'text';
}

export function labelFromLeaseFieldToken(
  token: string
): string {
  const canonicalKey = resolveLeaseFieldKey(token);

  if (canonicalKey) {
    return (
      getLeaseFieldDefinition(canonicalKey)?.label ??
      canonicalKey
    );
  }

  return normaliseLeaseFieldToken(token)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
