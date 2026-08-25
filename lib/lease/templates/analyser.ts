import type { LeaseTemplateField } from './types';

export interface LeaseTemplateValidation {
  valid: boolean;
  errors: Array<{
    code: string;
    field?: string;
    message: string;
  }>;
  warnings: Array<{
    code: string;
    field?: string;
    message: string;
  }>;
}

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

  validation: LeaseTemplateValidation;
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
    patterns: [],
  },

  {
    key: 'landlord_name',
    label: 'Landlord / Lessor Name',
    type: 'text',
    required: true,
    patterns: [],
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
    key: 'landlord_email',
    label: 'Landlord Email',
    type: 'email',
    required: false,
    patterns: [],
  },

  {
    key: 'tenant_phone',
    label: 'Tenant Telephone',
    type: 'phone',
    required: false,
    patterns: [],
  },

  {
    key: 'landlord_phone',
    label: 'Landlord Telephone',
    type: 'phone',
    required: false,
    patterns: [],
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
  /(?:Unit\s*\/?\s*Shop\s*Number|Unit\s*Number|Shop\s*Number)\s*:\s*([^\n.]+)/i,
  /(?:Unit|Shop)\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Za-z0-9 -]+)/i,
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

type Party = 'tenant' | 'landlord';

interface PartyContext {
  party: Party;
  block: string;
  confidence: number;
}

function getPartyContext(
  text: string,
  party: Party
): PartyContext | null {
  const partyPattern =
    party === 'tenant'
      ? '(?:LESSEE\\s*/\\s*TENANT|TENANT\\s*/\\s*LESSEE|LESSEE|TENANT|APPLICANT)'
      : '(?:LESSOR\\s*/\\s*LANDLORD|LANDLORD\\s*/\\s*LESSOR|LESSOR|LANDLORD)';

  const otherPartyPattern =
    party === 'tenant'
      ? '(?:LESSOR\\s*/\\s*LANDLORD|LANDLORD\\s*/\\s*LESSOR|LESSOR|LANDLORD)'
      : '(?:LESSEE\\s*/\\s*TENANT|TENANT\\s*/\\s*LESSEE|LESSEE|TENANT|APPLICANT)';

  const pattern = new RegExp(
    `${partyPattern}\\s*:?\\s*([\\s\\S]*?)(?=${otherPartyPattern}\\s*:?\\s*|$)`,
    'i'
  );

  const match = text.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  return {
    party,
    block: match[1],
    confidence: 94,
  };
}

function extractPartyField(
  text: string,
  party: Party,
  labels: string[]
): { value?: string; confidence: number } {
  const context = getPartyContext(text, party);

  /*
   * PARTY NAME
   *
   * Handles:
   *
   * LESSOR: Summit Commercial Estates (Pty) Ltd
   *
   * LESSEE / TENANT: Prime Retail Concepts (Pty) Ltd
   */
  if (labels.length === 0) {
    const partyPattern =
      party === 'tenant'
        ? '(?:LESSEE\\s*/\\s*TENANT|TENANT\\s*/\\s*LESSEE|LESSEE|TENANT|APPLICANT)'
        : '(?:LESSOR\\s*/\\s*LANDLORD|LANDLORD\\s*/\\s*LESSOR|LESSOR|LANDLORD)';

    const namePattern = new RegExp(
      `${partyPattern}\\s*:?\\s*(.+?)(?=\\s+Registration\\s+Number|\\s+VAT\\s+Number|\\s+Telephone|\\s+Phone|\\s+Cell|\\s+Mobile|\\s+Email|$)`,
      'i'
    );

    const match = text.match(namePattern);

    if (match?.[1]) {
      const value = cleanValue(match[1]);

      if (value) {
        return {
          value,
          confidence: 94,
        };
      }
    }

    /*
     * If the direct extraction fails, try the party context.
     */
    if (context) {
      const contextMatch = context.block.match(
        /^\s*(.+?)(?=\s+Registration\s+Number|\s+VAT\s+Number|\s+Telephone|\s+Phone|\s+Cell|\s+Mobile|\s+Email|$)/i
      );

      if (contextMatch?.[1]) {
        const value = cleanValue(contextMatch[1]);

        if (value) {
          return {
            value,
            confidence: context.confidence,
          };
        }
      }
    }

    return {
      confidence: 0,
    };
  }

  /*
   * STRUCTURED PARTY FIELDS
   */
  if (context) {
    for (const label of labels) {
      const escapedLabel = label.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const pattern = new RegExp(
        `${escapedLabel}\\s*[:\\-]?\\s*(.+?)(?=\\s+(?:Registration Number|VAT Number|Telephone|Phone|Cell|Mobile|Email)\\b|$)`,
        'i'
      );

      const match = context.block.match(pattern);

      if (match?.[1]) {
        const value = cleanValue(match[1]);

        if (value) {
          return {
            value,
            confidence: context.confidence,
          };
        }
      }
    }
  }

  /*
   * COLLAPSED OCR / DOCX FALLBACK
   */
  for (const label of labels) {
    const escapedLabel = label.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const pattern = new RegExp(
      `${escapedLabel}\\s*[:\\-]?\\s*(.+?)(?=Registration\\s+Number|VAT\\s+Number|Telephone|Phone|Cell|Mobile|Email|$)`,
      'i'
    );

    const match = text.match(pattern);

    if (match?.[1]) {
      const value = cleanValue(match[1]);

      if (value) {
        return {
          value,
          confidence: 88,
        };
      }
    }
  }

  return {
    confidence: 0,
  };
}

function extractPartyPhone(
  text: string,
  party: Party
): { value?: string; confidence: number } {
  const context = getPartyContext(text, party);

  if (!context) {
    return { confidence: 0 };
  }

  const match = context.block.match(
    /(?:Telephone|Phone|Cell|Mobile)\s*[:\-]?\s*([+()\d\s-]{7,})/i
  );

  if (!match?.[1]) {
    return { confidence: 0 };
  }

  const cleaned = match[1]
    .replace(/\s+/g, ' ')
    .trim();

  return {
    value: cleaned,
    confidence: context.confidence,
  };
}

function validateLeaseTemplate(
  text: string,
  fields: LeaseTemplateField[]
): LeaseTemplateValidation {
  const errors: LeaseTemplateValidation['errors'] = [];
  const warnings: LeaseTemplateValidation['warnings'] = [];

  const hasTenant =
    /\btenant\b|\blessee\b|\bapplicant\b/i.test(text);

  const hasLandlord =
    /\blandlord\b|\blessor\b/i.test(text);

  if (!hasTenant) {
    errors.push({
      code: 'TENANT_CONTEXT_MISSING',
      message:
        'The document does not contain a recognisable tenant or lessee context.',
    });
  }

  if (!hasLandlord) {
    errors.push({
      code: 'LANDLORD_CONTEXT_MISSING',
      message:
        'The document does not contain a recognisable landlord or lessor context.',
    });
  }

  const requiredKeys = [
    'tenant_name',
    'landlord_name',
    'property_name',
    'unit_number',
    'lease_commencement_date',
    'monthly_rental',
  ];

  for (const key of requiredKeys) {
    const field = fields.find(item => item.key === key);

    if (!field?.value) {
      errors.push({
        code: 'REQUIRED_FIELD_MISSING',
        field: key,
        message: `Required lease field "${field?.label || key}" could not be resolved.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
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

  if (definition.key === 'tenant_name') {
  extracted = extractPartyField(text, 'tenant', []);
}

if (definition.key === 'landlord_name') {
  extracted = extractPartyField(text, 'landlord', []);
}

  if (definition.key === 'tenant_registration_number') {
  extracted = extractPartyField(text, 'tenant', [
    'Registration Number',
    'Company Registration',
    'Registration No',
    'Reg No',
  ]);
}

if (definition.key === 'landlord_registration_number') {
  extracted = extractPartyField(text, 'landlord', [
    'Registration Number',
    'Company Registration',
    'Registration No',
    'Reg No',
  ]);
}

if (definition.key === 'tenant_vat_number') {
  extracted = extractPartyField(text, 'tenant', [
    'VAT Number',
    'VAT No',
    'VAT Registration Number',
  ]);
}

if (definition.key === 'landlord_vat_number') {
  extracted = extractPartyField(text, 'landlord', [
    'VAT Number',
    'VAT No',
    'VAT Registration Number',
  ]);
}

if (definition.key === 'tenant_email') {
  extracted = extractPartyField(text, 'tenant', [
    'Email',
    'Email Address',
  ]);
}

if (definition.key === 'landlord_email') {
  extracted = extractPartyField(text, 'landlord', [
    'Email',
    'Email Address',
  ]);
}

if (definition.key === 'tenant_phone') {
  extracted = extractPartyPhone(text, 'tenant');
}

if (definition.key === 'landlord_phone') {
  extracted = extractPartyPhone(text, 'landlord');
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
const validation = validateLeaseTemplate(text, fields);

return {
  fields,
  placeholders,
  suggestions,
  overallConfidence,
  validation,
};
}