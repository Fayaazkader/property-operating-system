import type { LeaseTemplateField } from './types';

export interface LeaseTemplateAnalysis {
  fields: LeaseTemplateField[];
  placeholders: Array<{
    token: string;
    suggestedKey: string;
    label: string;
    confidence: number;
    source: 'explicit_placeholder' | 'pattern';
  }>;
  suggestions: Array<{
    type: 'field' | 'clause' | 'inconsistency' | 'warning';
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  overallConfidence: number;
}

const FIELD_PATTERNS: Array<{
  key: string;
  label: string;
  type: LeaseTemplateField['type'];
  patterns: RegExp[];
}> = [
  {
    key: 'tenant_name',
    label: 'Tenant / Lessee Name',
    type: 'text',
    patterns: [/\btenant\b/i, /\blessee\b/i],
  },
  {
    key: 'landlord_name',
    label: 'Landlord / Lessor Name',
    type: 'text',
    patterns: [/\blandlord\b/i, /\blessor\b/i],
  },
  {
    key: 'property_name',
    label: 'Property Name',
    type: 'text',
    patterns: [/\bproperty\b/i, /\bcentre\b/i, /\bcenter\b/i],
  },
  {
    key: 'unit_number',
    label: 'Unit / Shop Number',
    type: 'text',
    patterns: [/\bunit\b/i, /\bshop\b/i, /\bsuite\b/i],
  },
  {
    key: 'tenant_registration_number',
    label: 'Tenant Registration Number',
    type: 'text',
    patterns: [/\bregistration number\b/i, /\bcompany registration\b/i],
  },
  {
    key: 'tenant_email',
    label: 'Tenant Email',
    type: 'email',
    patterns: [/\bemail\b/i, /\be-mail\b/i],
  },
  {
    key: 'tenant_phone',
    label: 'Tenant Telephone',
    type: 'phone',
    patterns: [/\btelephone\b/i, /\bphone\b/i, /\bcell\b/i],
  },
  {
    key: 'lease_commencement_date',
    label: 'Lease Commencement Date',
    type: 'date',
    patterns: [/\bcommencement\b/i, /\bcommencing\b/i, /\bstart date\b/i],
  },
  {
    key: 'lease_expiry_date',
    label: 'Lease Expiry Date',
    type: 'date',
    patterns: [/\bexpiry\b/i, /\btermination date\b/i, /\bend date\b/i],
  },
  {
    key: 'monthly_rental',
    label: 'Monthly Rental',
    type: 'currency',
    patterns: [/\bmonthly rental\b/i, /\bmonthly rent\b/i],
  },
  {
    key: 'rental_escalation',
    label: 'Rental Escalation',
    type: 'percentage',
    patterns: [/\bescalation\b/i, /\bannual increase\b/i],
  },
  {
    key: 'deposit_amount',
    label: 'Deposit Amount',
    type: 'currency',
    patterns: [/\bdeposit\b/i],
  },
  {
    key: 'lease_fee',
    label: 'Lease / Administration Fee',
    type: 'currency',
    patterns: [/\blease fee\b/i, /\badministration fee\b/i],
  },
];

function normaliseToken(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function labelFromToken(token: string): string {
  return token
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function analyseLeaseTemplate(text: string): LeaseTemplateAnalysis {
  const placeholders: LeaseTemplateAnalysis['placeholders'] = [];
  const suggestions: LeaseTemplateAnalysis['suggestions'] = [];

  /*
   * Explicit placeholder convention:
   *
   * __________
   * {{tenant_name}}
   * [[tenant_name]]
   *
   * AssetFlow does not rewrite the legal document.
   * These are only interpreted as insertion locations.
   */
  const explicitPatterns = [
    /_{5,}/g,
    /\{\{\s*([^}]+?)\s*\}\}/g,
    /\[\[\s*([^\]]+?)\s*\]\]/g,
  ];

  for (const pattern of explicitPatterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1] || match[0];
      const key = normaliseToken(raw);

      if (!key || key.length < 2) continue;

      placeholders.push({
        token: match[0],
        suggestedKey: key,
        label: labelFromToken(key),
        confidence: match[1] ? 100 : 85,
        source: match[1]
          ? 'explicit_placeholder'
          : 'explicit_placeholder',
      });
    }
  }

  /*
   * Detect important lease concepts that may need
   * an insertion point even where the client's document
   * has not explicitly marked one.
   */
  const detectedKeys = new Set(
    placeholders.map(item => item.suggestedKey)
  );

  for (const field of FIELD_PATTERNS) {
    const detected = field.patterns.some(pattern => pattern.test(text));

    if (!detected) continue;

    if (!detectedKeys.has(field.key)) {
      suggestions.push({
        type: 'field',
        title: `Possible field: ${field.label}`,
        description:
          `AssetFlow detected this concept in the lease but could not identify a clear insertion placeholder. Review whether this section should contain a populated field.`,
        severity: 'info',
      });
    }
  }

  /*
   * Basic document-quality checks.
   * These are suggestions only — AssetFlow does not
   * alter the client's legal wording.
   */
  if (!/\btenant\b|\blessee\b/i.test(text)) {
    suggestions.push({
      type: 'warning',
      title: 'Tenant terminology not detected',
      description:
        'No obvious Tenant or Lessee reference was detected in the extracted document text.',
      severity: 'warning',
    });
  }

  if (!/\blandlord\b|\blessor\b/i.test(text)) {
    suggestions.push({
      type: 'warning',
      title: 'Landlord terminology not detected',
      description:
        'No obvious Landlord or Lessor reference was detected in the extracted document text.',
      severity: 'warning',
    });
  }

  if (!/\bsignature\b|\bsigned\b|\bsign\b/i.test(text)) {
    suggestions.push({
      type: 'warning',
      title: 'Signature section not detected',
      description:
        'No obvious signature section was detected. Confirm that the lease contains the required execution provisions.',
      severity: 'warning',
    });
  }

  const fields: LeaseTemplateField[] = placeholders.map(item => ({
    key: item.suggestedKey,
    label: item.label,
    type: inferFieldType(item.suggestedKey),
    required: isLikelyRequired(item.suggestedKey),
    source: 'user',
  }));

  const confidence =
    placeholders.length > 0
      ? Math.round(
          placeholders.reduce(
            (total, item) => total + item.confidence,
            0
          ) / placeholders.length
        )
      : 40;

  return {
    fields,
    placeholders,
    suggestions,
    overallConfidence: confidence,
  };
}

function inferFieldType(key: string): LeaseTemplateField['type'] {
  if (key.includes('email')) return 'email';
  if (key.includes('phone') || key.includes('telephone')) return 'phone';
  if (key.includes('date')) return 'date';
  if (
    key.includes('rental') ||
    key.includes('deposit') ||
    key.includes('fee') ||
    key.includes('amount')
  ) {
    return 'currency';
  }
  if (key.includes('percentage') || key.includes('escalation')) {
    return 'percentage';
  }

  return 'text';
}

function isLikelyRequired(key: string): boolean {
  return [
    'tenant_name',
    'landlord_name',
    'property_name',
    'unit_number',
    'lease_commencement_date',
    'monthly_rental',
  ].includes(key);
}