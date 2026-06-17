export const COLUMN_ALIASES: Record<string, string[]> = {
  // Tenants
  tenant_name: ['tenant', 'tenant name', 'lessee', 'occupant', 'customer', 'company', 'company name', 'tenant company', 'client', 'tenant_name'],
  tenant_code: ['tenant code', 'code', 'tenant id', 'tenant number', 'reference', 'tenant_code'],
  company_type: ['company type', 'type', 'business type', 'industry', 'sector', 'company_type'],
  email: ['tenant email', 'email address', 'e-mail', 'tenant email address', 'email'],
  phone: ['tenant phone', 'phone number', 'contact number', 'telephone', 'mobile', 'phone'],
  vat_number: ['vat', 'vat number', 'vat no', 'tax number', 'vat_number'],
  industry: ['industry', 'sector'],
  
  // Properties
  property_name: ['property', 'property name', 'building', 'building name', 'asset', 'asset name', 'estate', 'site', 'property_name', 'prop name'],
  address_line_1: ['address', 'street address', 'address line 1', 'address1', 'property address', 'address_line_1', 'prop address'],
  city: ['city', 'suburb', 'town', 'city', 'prop city'],
  province: ['province', 'state', 'region', 'county', 'province', 'prop state'],
  postal_code: ['postal code', 'zip', 'zip code', 'postcode', 'postal_code', 'zip code'],
  total_gla_sqm: ['gla', 'gla sqm', 'area', 'size', 'square meters', 'sqm', 'total_gla_sqm', 'total area'],
  property_manager: ['prop mgr', 'property manager', 'asset manager', 'manager'],

  // Leases
  lease_id: ['lease number', 'lease id', 'lease reference', 'lease no', 'agreement number', 'lease code', 'lease_id'],
  unit_number: ['unit', 'unit number', 'suite', 'shop', 'office', 'unit_number'],
  gla_sqm: ['gla', 'gla sqm', 'area', 'size', 'square meters', 'sqm', 'gla_sqm'],
  monthly_rental: ['rent', 'rental', 'monthly rent', 'base rent', 'rent amount', 'current rent', 'monthly_rental', 'rent amt', 'monthly rental amount'],
  commencement_date: ['start date', 'lease start', 'commencement', 'start', 'effective date', 'commencement_date', 'lease start date'],
  expiry_date: ['end date', 'lease end', 'expiry', 'expiration', 'end', 'termination date', 'expiry_date', 'lease end date'],
  lease_status: ['status', 'lease status', 'current status', 'state', 'lease_status'],
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

// ===== USER MAPPING MEMORY =====
const USER_MAPPINGS_KEY = 'assetflow_user_mappings';

export function saveUserMapping(csvHeader: string, dbColumn: string): void {
  try {
    const existing = getUserMappings();
    existing[csvHeader.toLowerCase().trim()] = dbColumn;
    localStorage.setItem(USER_MAPPINGS_KEY, JSON.stringify(existing));
  } catch (error) {
    // localStorage not available (server-side)
  }
}

export function getUserMappings(): Record<string, string> {
  try {
    const stored = localStorage.getItem(USER_MAPPINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    // localStorage not available
  }
  return {};
}

export function getUserMappingForHeader(header: string): string | null {
  const mappings = getUserMappings();
  const key = header.toLowerCase().trim();
  return mappings[key] || null;
}

// ===== FUZZY MATCHING =====
export function fuzzyMatch(header: string, dbColumns: string[]): { bestMatch: string | null; score: number } {
  const normalized = header.toLowerCase().trim();
  
  // Remove common words
  const clean = normalized.replace(/\b(name|number|id|code|amount|date|type|status|reference)\b/g, '').trim();
  
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const dbCol of dbColumns) {
    const dbClean = dbCol.replace(/\b(name|number|id|code|amount|date|type|status|reference)\b/g, '').toLowerCase();
    
    // Exact match after cleaning
    if (dbClean === clean) {
      return { bestMatch: dbCol, score: 100 };
    }
    
    // Contains match
    if (dbClean.includes(clean) || clean.includes(dbClean)) {
      const score = Math.min(clean.length, dbClean.length) / Math.max(clean.length, dbClean.length) * 80 + 10;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = dbCol;
      }
    }
    
    // First letter match (e.g., "PM" → "property_manager")
    const initials = clean.split(' ').filter(w => w.length > 0).map(w => w[0]).join('');
    const dbInitials = dbClean.split('_').map(w => w[0]).join('');
    if (initials === dbInitials) {
      return { bestMatch: dbCol, score: 85 };
    }
  }
  
  return { bestMatch, score: bestScore };
}

// ===== UPDATED GET DB COLUMN =====
export function getDbColumnForHeader(header: string, target?: string): string | null {
  const normalized = header.toLowerCase().trim();
  
  // 1. Check user mappings first (highest priority)
  const userMapping = getUserMappingForHeader(header);
  if (userMapping) return userMapping;
  
  // 2. Check system presets
  for (const [system, mapping] of Object.entries(SYSTEM_PRESETS)) {
    const entry = Object.entries(mapping).find(([key]) => key.toLowerCase().trim() === normalized);
    if (entry) return entry[1];
  }
  
  // 3. Check aliases
  for (const [dbColumn, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(alias => alias.toLowerCase().trim() === normalized)) {
      return dbColumn;
    }
  }
  
  // 4. Try fuzzy match if target is provided
  if (target) {
    const dbColumns = getDbTargetForTarget(target);
    const { bestMatch, score } = fuzzyMatch(header, dbColumns);
    if (score >= 70) {
      return bestMatch;
    }
  }
  
  return null;
}

export function getDbTargetForTarget(target: string): string[] {
  const mapping: Record<string, string[]> = {
    properties: ['property_name', 'address_line_1', 'city', 'province', 'postal_code', 'total_gla_sqm', 'property_manager'],
    tenants: ['tenant_name', 'email', 'phone', 'tenant_code', 'company_type', 'vat_number', 'industry'],
    leases: ['lease_id', 'property_name', 'tenant_name', 'unit_number', 'gla_sqm', 'monthly_rental', 'commencement_date', 'expiry_date', 'lease_status'],
  };
  return mapping[target] || [];
}