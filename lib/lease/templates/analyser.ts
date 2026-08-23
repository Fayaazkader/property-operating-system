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

interface FieldDefinition {
  key: string;
  label: string;
  type: LeaseTemplateField['type'];
  required: boolean;
  patterns: RegExp[];
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'tenant_name',
    label: 'Tenant / Lessee Name',
    type: 'text',
    required: true,
    patterns: [
      /(?:Lessee|Tenant|Applicant)\s*:\s*([^\n]+)/i,
      /(?:Lessee|Tenant|Applicant)\s+([A-Z][^\n]+?)(?=\s+(?:Registration|VAT|Identity|ID|Email|Telephone|Phone)\b)/i,
    ],
  },

  {
    key: 'landlord_name',
    label: 'Landlord / Lessor Name',
    type: 'text',
    required: true,
    patterns: [
      /(?:Lessor|Landlord)\s*:\s*([^\n]+)/i,
      /(?:Lessor|Landlord)\s+([A-Z][^\n]+?)(?=\s+(?:Registration|VAT|Email|Telephone|Phone)\b)/i,
    ],
  },

  {
  key: 'tenant_registration_number',
  label: 'Tenant Registration Number',
  type: 'text',
  required: false,
  patterns: [],
},

{
  key: 'landlord_registration_number',
  label: 'Landlord Registration Number',
  type: 'text',
  required: false,
  patterns: [],
},

{
  key: 'tenant_vat_number',
  label: 'Tenant VAT Number',
  type: 'text',
  required: false,
  patterns: [],
},

{
  key: 'landlord_vat_number',
  label: 'Landlord VAT Number',
  type: 'text',
  required: false,
  patterns: [],
},

  {
    key: 'tenant_email',
    label: 'Tenant Email',
    type: 'email',
    required: false,
    patterns: [],
  },

  {
    key: 'tenant_phone',
    label: 'Tenant Telephone',
    type: 'phone',
    required: false,
    patterns: [
      /(?:Telephone|Phone|Cell)\s*:\s*([+\d][\d\s()-]{6,})/i,
    ],
  },
  

  {
    key: 'property_name',
    label: 'Property Name',
    type: 'text',
    required: true,
    patterns: [
      /premises\s+are\s+situated\s+at\s+([^,\n]+),/i,
      /property\s*:\s*([^\n]+)/i,
    ],
  },

  {
    key: 'unit_number',
    label: 'Unit / Shop Number',
    type: 'text',
    required: true,
    patterns: [
      /\b(?:Unit|Shop|Suite)\s+([A-Z0-9-]+)/i,
    ],
  },

  {
    key: 'lease_commencement_date',
    label: 'Lease Commencement Date',
    type: 'date',
    required: true,
    patterns: [
      /commence(?:ment)?\s+on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /commencement\s+date\s*[:\-]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /start\s+date\s*[:\-]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    ],
  },

  {
    key: 'lease_expiry_date',
    label: 'Lease Expiry Date',
    type: 'date',
    required: true,
    patterns: [
      /terminate(?:s|d)?\s+on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /expiry\s+date\s*[:\-]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /termination\s+date\s*[:\-]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    ],
  },

  {
    key: 'monthly_rental',
    label: 'Monthly Rental',
    type: 'currency',
    required: true,
    patterns: [
      /monthly\s+rental\s+(?:is\s+)?R\s*([\d,\s]+\.\d{2})/i,
      /monthly\s+rent\s+(?:is\s+)?R\s*([\d,\s]+\.\d{2})/i,
      /rental\s+(?:is\s+)?R\s*([\d,\s]+\.\d{2})/i,
    ],
  },

  {
    key: 'rental_escalation',
    label: 'Rental Escalation',
    type: 'percentage',
    required: false,
    patterns: [
      /escalat(?:e|ion|es|ed)[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*(?:annual|yearly|per annum)/i,
    ],
  },

  {
    key: 'deposit_amount',
    label: 'Deposit Amount',
    type: 'currency',
    required: false,
    patterns: [
      /security\s+deposit\s+(?:of\s+)?R\s*([\d,\s]+\.\d{2})/i,
      /deposit\s+(?:of\s+)?R\s*([\d,\s]+\.\d{2})/i,
    ],
  },

  {
    key: 'lease_fee',
    label: 'Lease / Administration Fee',
    type: 'currency',
    required: false,
    patterns: [
      /(?:lease|administration)\s+fee\s+(?:of\s+)?R\s*([\d,\s]+\.\d{2})/i,
    ],
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

function cleanValue(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function extractValue(
  text: string,
  patterns: RegExp[]
): { value?: string; confidence: number } {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return {
        value: cleanValue(match[1]),
        confidence: 92,
      };
    }
  }

  return {
    confidence: 0,
  };
}

function inferFieldType(key: string): LeaseTemplateField['type'] {
  if (key.includes('email')) return 'email';

  if (
    key.includes('phone') ||
    key.includes('telephone')
  ) {
    return 'phone';
  }

  if (key.includes('date')) return 'date';

  if (
    key.includes('rental') ||
    key.includes('deposit') ||
    key.includes('fee') ||
    key.includes('amount')
  ) {
    return 'currency';
  }

  if (
    key.includes('percentage') ||
    key.includes('escalation')
  ) {
    return 'percentage';
  }

  return 'text';
}

function extractPartyField(
  text: string,
  party: 'tenant' | 'landlord',
  label: string
): { value?: string; confidence: number } {
  const partyPattern =
    party === 'tenant'
      ? /(?:Lessee|Tenant|Applicant)\s*:\s*([\s\S]{0,500}?)(?=\n?\s*(?:Lessor|Landlord)\s*:|$)/i
      : /(?:Lessor|Landlord)\s*:\s*([\s\S]{0,500}?)(?=\n?\s*(?:Lessee|Tenant|Applicant)\s*:|$)/i;

  const partyMatch = text.match(partyPattern);

  if (!partyMatch?.[1]) {
    return { confidence: 0 };
  }

  const block = partyMatch[1];

  const pattern = new RegExp(
    `${label}\\s*:\\s*([^\\n]+)`,
    'i'
  );

  const match = block.match(pattern);

  if (!match?.[1]) {
    return { confidence: 0 };
  }

  return {
    value: cleanValue(match[1]),
    confidence: 96,
  };
}

function extractPhone(text: string): {
  value?: string;
  confidence: number;
} {
  const result = extractPartyField(text, 'tenant', '(?:Telephone|Phone|Cell)');

  if (!result.value) {
    return { confidence: 0 };
  }

  const cleaned = result.value
    .replace(/[^\d+()\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    value: cleaned,
    confidence: result.confidence,
  };
}

export function analyseLeaseTemplate(
  text: string
): LeaseTemplateAnalysis {
  const placeholders: LeaseTemplateAnalysis['placeholders'] = [];
  const suggestions: LeaseTemplateAnalysis['suggestions'] = [];

  /*
   * ------------------------------------------------------------
   * 1. EXPLICIT TEMPLATE PLACEHOLDERS
   * ------------------------------------------------------------
   *
   * Supports:
   *
   * __________
   * {{tenant_name}}
   * [[tenant_name]]
   *
   * This remains important for blank lease templates.
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
        source: 'explicit_placeholder',
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * 2. ACTUAL DOCUMENT EXTRACTION
   * ------------------------------------------------------------
   *
   * This is the important distinction:
   *
   * A completed/signed lease does not contain placeholders.
   * We therefore extract actual values from the legal document.
   */
  const fields: LeaseTemplateField[] = [];

  for (const definition of FIELD_DEFINITIONS) {
  let extracted = extractValue(text, definition.patterns);

  if (definition.key === 'tenant_registration_number') {
    extracted = extractPartyField(
      text,
      'tenant',
      'Registration Number'
    );
  }

  if (definition.key === 'landlord_registration_number') {
    extracted = extractPartyField(
      text,
      'landlord',
      'Registration Number'
    );
  }

  if (definition.key === 'tenant_vat_number') {
    extracted = extractPartyField(
      text,
      'tenant',
      'VAT Number'
    );
  }

  if (definition.key === 'landlord_vat_number') {
    extracted = extractPartyField(
      text,
      'landlord',
      'VAT Number'
    );
  }

  if (definition.key === 'tenant_phone') {
    extracted = extractPhone(text);
  }
    if (definition.key === 'tenant_email') {
    extracted = extractPartyField(
      text,
      'tenant',
      'Email'
    );
  }

    if (extracted.value) {
  const extractedText = String(extracted.value);
  const startOffset = text.indexOf(extractedText);

  fields.push({
    key: definition.key,
    label: definition.label,
    type: definition.type,
    required: definition.required,
    value: extracted.value,
    confidence: extracted.confidence,
    source: 'ai',
    approved: false,
    evidence: [
      {
        text: extractedText,
        ...(startOffset >= 0
          ? {
              startOffset,
              endOffset: startOffset + extractedText.length,
            }
          : {}),
      },
    ],
  });

  continue;
}

    /*
     * If no value was found, still surface the concept as a
     * review suggestion rather than pretending it was extracted.
     */
    const conceptDetected = definition.patterns.some(pattern =>
      pattern.test(text)
    );

    if (conceptDetected) {
      suggestions.push({
        type: 'field',
        title: `Review field: ${definition.label}`,
        description:
          'AssetFlow detected this lease concept but could not confidently extract a value. Review the source document.',
        severity: 'warning',
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * 3. PLACEHOLDER-ONLY FIELDS
   * ------------------------------------------------------------
   *
   * If a blank template contains explicit placeholders, make sure
   * those fields also appear even when no actual value exists.
   */
  const existingKeys = new Set(fields.map(field => field.key));

  for (const placeholder of placeholders) {
    if (existingKeys.has(placeholder.suggestedKey)) {
      continue;
    }

    fields.push({
      key: placeholder.suggestedKey,
      label: placeholder.label,
      type: inferFieldType(placeholder.suggestedKey),
      required: [
        'tenant_name',
        'landlord_name',
        'property_name',
        'unit_number',
        'lease_commencement_date',
        'monthly_rental',
      ].includes(placeholder.suggestedKey),
      confidence: 100,
      source: 'user',
    });
  }

  /*
   * ------------------------------------------------------------
   * 4. DOCUMENT QUALITY / GOVERNANCE CHECKS
   * ------------------------------------------------------------
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

  /*
   * Required-field governance.
   */
  const fieldKeys = new Set(fields.map(field => field.key));

  for (const definition of FIELD_DEFINITIONS) {
    if (!definition.required) continue;

    if (!fieldKeys.has(definition.key)) {
      suggestions.push({
        type: 'field',
        title: `Missing field: ${definition.label}`,
        description:
          'This is a key lease field that AssetFlow could not extract automatically. Human review is required.',
        severity: 'warning',
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * 5. OVERALL CONFIDENCE
   * ------------------------------------------------------------
   */

  const confidenceValues = fields
    .map(field => field.confidence ?? 0)
    .filter(value => value > 0);

  const overallConfidence =
    confidenceValues.length > 0
      ? Math.round(
          confidenceValues.reduce(
            (total, value) => total + value,
            0
          ) / confidenceValues.length
        )
      : 0;

  return {
    fields,
    placeholders,
    suggestions,
    overallConfidence,
  };
}