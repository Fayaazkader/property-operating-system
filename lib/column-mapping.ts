export const COLUMN_ALIASES: Record<string, string[]> = {
  // Tenants
  tenant_name: ['tenant', 'tenant name', 'lessee', 'occupant', 'customer', 'company', 'company name', 'tenant company', 'client'],
  tenant_code: ['tenant code', 'code', 'tenant id', 'tenant number', 'reference'],
  company_type: ['company type', 'type', 'business type', 'industry', 'sector'],
  email: ['tenant email', 'email address', 'e-mail', 'tenant email address'],
  phone: ['tenant phone', 'phone number', 'contact number', 'telephone', 'mobile'],
  vat_number: ['vat', 'vat number', 'vat no', 'tax number'],
  industry: ['industry', 'sector'],
  
  // Properties
  property_name: ['property', 'property name', 'building', 'building name', 'asset', 'asset name', 'estate', 'site'],
  address_line_1: ['address', 'street address', 'address line 1', 'address1', 'property address'],
  city: ['city', 'suburb', 'town'],
  province: ['province', 'state', 'region', 'county'],
  postal_code: ['postal code', 'zip', 'zip code', 'postcode'],
  total_gla_sqm: ['gla', 'gla sqm', 'area', 'size', 'square meters', 'sqm', 'total_gla_sqm'],

  // Leases
  lease_id: ['lease number', 'lease id', 'lease reference', 'lease no', 'agreement number', 'lease code'],
  unit_number: ['unit', 'unit number', 'suite', 'shop', 'office'],
  gla_sqm: ['gla', 'gla sqm', 'area', 'size', 'square meters', 'sqm'],
  monthly_rental: ['rent', 'rental', 'monthly rent', 'base rent', 'rent amount', 'current rent'],
  commencement_date: ['start date', 'lease start', 'commencement', 'start', 'effective date'],
  expiry_date: ['end date', 'lease end', 'expiry', 'expiration', 'end', 'termination date'],
  lease_status: ['status', 'lease status', 'current status', 'state'],
};

export const SYSTEM_PRESETS: Record<string, Record<string, string>> = {
  mda: {
    'Lease No': 'lease_id',
    'Property Name': 'property_name',
    'Tenant': 'tenant_name',
    'Unit': 'unit_number',
    'Sqm': 'gla_sqm',
    'Monthly Rent': 'monthly_rental',
    'Commencement': 'commencement_date',
    'Expiry': 'expiry_date',
    'Status': 'lease_status',
  },
  mri: {
    'Lease Number': 'lease_id',
    'Building': 'property_name',
    'Tenant Name': 'tenant_name',
    'Suite': 'unit_number',
    'Area': 'gla_sqm',
    'Base Rent': 'monthly_rental',
    'Start Date': 'commencement_date',
    'End Date': 'expiry_date',
  },
  're-leased': {
    'Agreement Number': 'lease_id',
    'Property': 'property_name',
    'Contact': 'tenant_name',
    'Space': 'unit_number',
    'Rent Per Month': 'monthly_rental',
    'Start': 'commencement_date',
    'Finish': 'expiry_date',
  },
  yardi: {
    'Lease Code': 'lease_id',
    'Property Code': 'property_name',
    'Tenant Code': 'tenant_name',
    'Unit ID': 'unit_number',
    'Rent Amount': 'monthly_rental',
    'Lease Start': 'commencement_date',
    'Lease End': 'expiry_date',
  },
};

export const SOURCE_SYSTEMS = [
  { value: 'mda', label: 'MDA' },
  { value: 'mri', label: 'MRI' },
  { value: 're-leased', label: 'Re-Leased' },
  { value: 'yardi', label: 'Yardi' },
  { value: 'other', label: 'Other / Generic CSV' },
];

export function detectSystem(headers: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const [system, mapping] of Object.entries(SYSTEM_PRESETS)) {
    const systemHeaders = Object.keys(mapping).map(h => h.toLowerCase().trim());
    const matchedCount = systemHeaders.filter(h => normalizedHeaders.includes(h)).length;
    if (matchedCount >= 3) return system;
  }
  return null;
}

export function getColumnAliases(): string[] {
  return Object.values(COLUMN_ALIASES).flat();
}

export function getDbColumnForHeader(header: string): string | null {
  const normalized = header.toLowerCase().trim();
  
  // Check if it's a system preset column
  for (const [system, mapping] of Object.entries(SYSTEM_PRESETS)) {
    const entry = Object.entries(mapping).find(([key]) => key.toLowerCase().trim() === normalized);
    if (entry) return entry[1];
  }
  
  // Check aliases
  for (const [dbColumn, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase().trim() === normalized)) {
      return dbColumn;
    }
  }
  
  return null;
}

export function getDbTargetForTarget(target: string): string[] {
  const mapping: Record<string, string[]> = {
    properties: ['property_name', 'address_line_1', 'city', 'province', 'postal_code', 'total_gla_sqm'],
    tenants: ['tenant_name', 'email', 'phone', 'tenant_code', 'company_type', 'vat_number', 'industry'],
    leases: ['lease_id', 'property_name', 'tenant_name', 'unit_number', 'gla_sqm', 'monthly_rental', 'commencement_date', 'expiry_date', 'lease_status'],
  };
  return mapping[target] || [];
}