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
    /property\s+name\s*:\s*(?:\n\s*)?([^\n]+)/i,
    /property\s*:\s*(?:\n\s*)?([^\n]+)/i,
    /premises\s+are\s+situated\s+at\s+([^,\n]+)/i,
  ],
},

  {
  key: 'unit_number',
  label: 'Unit / Shop Number',
  type: 'text',
  required: true,
  patterns: [
    /unit\s*(?:\/\s*shop\s*)?number\s*:\s*(?:\n\s*)?([^\n.]+)/i,
    /shop\s*number\s*:\s*(?:\n\s*)?([^\n.]+)/i,
    /(?:unit|shop)\s*(?:no\.?|number)?\s*[:\-]\s*(?:\n\s*)?([A-Za-z0-9][A-Za-z0-9 .\/-]*)/i,
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
    /monthly\s+rental\s*(?:is\s*)?[:\-]?\s*(?:\n\s*)?(?:R\s*)?([\d,\s]+(?:\.\d{2})?)/i,
    /monthly\s+rent\s*(?:is\s*)?[:\-]?\s*(?:\n\s*)?(?:R\s*)?([\d,\s]+(?:\.\d{2})?)/i,
    /rental\s*(?:is\s*)?[:\-]?\s*(?:\n\s*)?(?:R\s*)?([\d,\s]+(?:\.\d{2})?)/i,
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
function extractPartyIdentifier(
  text: string,
  party: Party,
  labels: string[],
  identifierType: 'registration' | 'vat'
): { value?: string; confidence: number } {
  const context = getPartyContext(text, party);

  if (!context) {
    return {
      confidence: 0,
    };
  }

  const escapedLabels = labels.map(label =>
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  if (!escapedLabels.length) {
    return {
      confidence: 0,
    };
  }

  const labelPattern = escapedLabels.join('|');

  const registrationPattern =
    '(?:\\d{4}\\/\\d{4,8}\\/\\d{2}|\\d{4}\\/\\d{5,8}\\/\\d{2})';

  const vatPattern =
    '\\d{8,12}';

  const identifierPattern =
    identifierType === 'registration'
      ? registrationPattern
      : vatPattern;

  const pattern = new RegExp(
    `(?:${labelPattern})\\s*[:\\-–—=]?\\s*(?:No\\.?\\s*)?(${identifierPattern})\\b`,
    'i'
  );

  const match = context.block.match(pattern);

  if (match?.[1]) {
    return {
      value: normaliseExtractedValue(match[1]),
      confidence: context.confidence,
    };
  }

  /*
   * OCR / DOCX fallback:
   *
   * Handles cases where the label and identifier are
   * separated by line breaks or extra punctuation.
   */
  const fallbackPattern = new RegExp(
    `(?:${labelPattern})[\\s\\S]{0,40}?(${identifierPattern})\\b`,
    'i'
  );

  const fallbackMatch = context.block.match(
    fallbackPattern
  );

  if (fallbackMatch?.[1]) {
    return {
      value: normaliseExtractedValue(
        fallbackMatch[1]
      ),
      confidence: 88,
    };
  }

  return {
    confidence: 0,
  };
}

function extractPartyField(
  text: string,
  party: Party,
  labels: string[]
): { value?: string; confidence: number } {
  const context = getPartyContext(text, party);

  if (!context) {
    return { confidence: 0 };
  }

  const block = normaliseExtractedValue(context.block);

  /*
   * PARTY NAME
   *
   * The legal-name extraction is deliberately conservative.
   *
   * We stop before:
   * Registration
   * Company Registration
   * VAT
   * Email
   * Telephone
   * Cell
   * Phone
   * hereinafter
   */
  if (labels.length === 0) {
    const nameMatch = block.match(
      /^(.+?)(?=\s*,?\s*(?:hereinafter|company\s+registration|registration\s+(?:no\.?|number)|vat(?:\s+registration)?(?:\s+no\.?|number)?|email|e-mail|telephone|phone|cell|mobile)\b|$)/i
    );

    if (nameMatch?.[1]) {
      const value = normaliseExtractedValue(
        nameMatch[1]
      );

      if (
        value &&
        !/^(?:the\s+)?(?:lessor|landlord|lessee|tenant)$/i.test(value)
      ) {
        return {
          value,
          confidence: context.confidence,
        };
      }
    }

    return { confidence: 0 };
  }

  /*
   * STRUCTURED PARTY FIELD
   *
   * Each labelled value is extracted independently.
   * This prevents registration/VAT/email/phone values from
   * consuming unrelated numbers later in the document.
   */
  for (const label of labels) {
    const escapedLabel = label.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const match = block.match(
      new RegExp(
        `${escapedLabel}\\s*(?:[:\\-–—=]|is|of)?\\s*([^,;\\n]+?)(?=\\s*(?:,|;|\\n|$))`,
        'i'
      )
    );

    if (match?.[1]) {
      const value = normaliseExtractedValue(
        match[1]
      );

      if (value) {
        return {
          value,
          confidence: context.confidence,
        };
      }
    }
  }

  /*
   * Label may be followed by punctuation and then another
   * labelled field without a comma.
   */
  for (const label of labels) {
    const escapedLabel = label.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const match = block.match(
      new RegExp(
        `${escapedLabel}\\s*(?:[:\\-–—=]|is|of)?\\s*([A-Za-z0-9@+./()\\-\\s]{1,120}?)(?=\\s+(?:Registration|Company Registration|VAT|VAT Registration|Email|E-mail|Telephone|Phone|Cell|Mobile)\\b|$)`,
        'i'
      )
    );

    if (match?.[1]) {
      const value = normaliseExtractedValue(
        match[1]
      );

      if (value) {
        return {
          value,
          confidence: context.confidence,
        };
      }
    }
  }

  return { confidence: 0 };
}
function extractPartyNumericField(
  text: string,
  party: Party,
  labels: string[],
  type: 'registration' | 'vat'
): { value?: string; confidence: number } {
  const context = getPartyContext(text, party);

  // Prefer the party-specific block.
  // Only fall back to the complete document if no party block exists.
  const searchText = context?.block || text;

  const escapedLabels = labels.map(label =>
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  if (escapedLabels.length === 0) {
    return { confidence: 0 };
  }

  const labelPattern = escapedLabels.join('|');

  const valuePattern =
    type === 'vat'
      ? '\\d{10}'
      : '\\d{4}\\/\\d{3,8}(?:\\/\\d{2})?';

  const pattern = new RegExp(
    `(?:${labelPattern})\\s*(?:number|no\\.?|nr\\.?)?\\s*(?:is|:|-|–|—|=)?\\s*(${valuePattern})(?!\\d)`,
    'i'
  );

  const match = searchText.match(pattern);

  if (!match?.[1]) {
    return { confidence: 0 };
  }

  const extracted = match[1].trim();

  if (isContaminatedExtractedValue(extracted, type)) {
    return { confidence: 0 };
  }

  return {
    value: extracted,
    confidence: context?.confidence ?? 90,
  };
}


function extractPartyRegistrationNumber(
  text: string,
  party: Party
): { value?: string; confidence: number } {
  return extractPartyNumericField(
    text,
    party,
    [
      'Company Registration Number',
      'Company Registration No.',
      'Company Registration No',
      'Registration Number',
      'Registration No.',
      'Registration No',
      'Registration Nr.',
      'Registration Nr',
      'Reg Number',
      'Reg No.',
      'Reg No',
    ],
    'registration'
  );
}


function extractPartyVatNumber(
  text: string,
  party: Party
): { value?: string; confidence: number } {
  return extractPartyNumericField(
    text,
    party,
    [
      'VAT Registration Number',
      'VAT Registration No.',
      'VAT Registration No',
      'VAT Number',
      'VAT No.',
      'VAT No',
      'VAT Nr.',
      'VAT Nr',
      'VAT Reg Number',
      'VAT Reg No.',
      'VAT Reg No',
    ],
    'vat'
  );
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
    /(?:Telephone|Phone|Cell|Mobile)\s*(?:[:\-–—=])?\s*([+]?[0-9][0-9\s()\-]{6,18})(?=\s*(?:[,;.]|$))/i
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
function normaliseLeaseText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function normaliseExtractedValue(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\-–—="“”'']+/, '')
    .replace(/[\s:;,\-–—="“”'']+$/, '')
    .trim();
}
function isContaminatedExtractedValue(
  value: string,
  type: 'registration' | 'vat'
): boolean {
  const normalised = value.trim();

  if (!normalised) {
    return true;
  }

  if (type === 'vat') {
    return !/^\d{10}$/.test(normalised);
  }

  return !/^\d{4}\/\d{3,8}(?:\/\d{2})?$/.test(normalised);
}

function extractFirst(
  text: string,
  patterns: RegExp[],
  confidence = 92
): { value?: string; confidence: number } {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const value = normaliseExtractedValue(match[1]);

      if (value) {
        return {
          value,
          confidence,
        };
      }
    }
  }

  return { confidence: 0 };
}

function extractCurrencyValue(
  text: string,
  patterns: RegExp[]
): { value?: string; confidence: number } {
  const result = extractFirst(text, patterns, 94);

  if (!result.value) {
    return result;
  }

  const cleaned = result.value
    .replace(/\s/g, '')
    .replace(/,/g, '');

  const numeric = Number(
    cleaned.replace(/^R/i, '')
  );

  if (!Number.isFinite(numeric)) {
    return { confidence: 0 };
  }

  return {
    value: numeric.toFixed(2),
    confidence: result.confidence,
  };
}

function extractDateValue(
  text: string,
  patterns: RegExp[]
): { value?: string; confidence: number } {
  return extractFirst(text, patterns, 94);
}

function extractLabelledValue(
  text: string,
  labels: string[],
  confidence = 90
): { value?: string; confidence: number } {
  const escapedLabels = labels.map(label =>
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  if (!escapedLabels.length) {
    return { confidence: 0 };
  }

  const labelPattern = escapedLabels.join('|');

  const patterns = [
    new RegExp(
      `(?:${labelPattern})\\s*(?:[:\\-–—=]|is|of)?\\s*([^\\n]+)`,
      'i'
    ),

    new RegExp(
      `(?:${labelPattern})\\s*(?:[:\\-–—=]|is|of)?\\s*([A-Za-z0-9][\\s\\S]{0,120}?)(?=\\s+(?:Registration|VAT|Telephone|Phone|Cell|Mobile|Email|Tenant|Lessee|Landlord|Lessor|Property|Premises|Unit|Shop|Suite|Commencement|Expiry|Termination)\\b|$)`,
      'i'
    ),
  ];

  return extractFirst(text, patterns, confidence);
}

function extractPropertyName(
  text: string
): { value?: string; confidence: number } {
  return extractFirst(
    text,
    [
      /property\s+name\s*[:\-–—=]\s*([^\n]+)/i,
      /property\s*[:\-–—=]\s*([^\n]+)/i,
      /building\s+name\s*[:\-–—=]\s*([^\n]+)/i,
      /building\s*[:\-–—=]\s*([^\n]+)/i,
      /shopping\s+centre\s+name\s*[:\-–—=]\s*([^\n]+)/i,
      /shopping\s+centre\s*[:\-–—=]\s*([^\n]+)/i,
      /centre\s+name\s*[:\-–—=]\s*([^\n]+)/i,
      /estate\s+name\s*[:\-–—=]\s*([^\n]+)/i,
      /site\s+name\s*[:\-–—=]\s*([^\n]+)/i,

      /(?:property|building|shopping\s+centre|centre|estate|site)\s+(?:is|known\s+as)\s+["']?([^,"\n]+)["']?/i,

      /premises\s+(?:known\s+as|called)\s+["']?([^,"\n]+)["']?/i,

      /premises\s+(?:are|is)\s+situated\s+at\s+([^,\n]+)/i,

      /situated\s+at\s+([^,\n]+?)(?=\s+(?:unit|shop|suite|office|portion)\b|,|$)/i,
    ],
    94
  );
}

function extractUnitNumber(
  text: string
): { value?: string; confidence: number } {
  return extractFirst(
    text,
    [
      /(?:unit|shop|suite|office|portion)\s*(?:number|no\.?|nr\.?)?\s*[:\-–—=]\s*([A-Za-z0-9][A-Za-z0-9 /_-]*)/i,

      /(?:unit|shop|suite|office|portion)\s+(?:number|no\.?|nr\.?)?\s*([A-Za-z0-9][A-Za-z0-9 /_-]*)(?=\s*(?:,|\.|\n|$))/i,

      /(?:unit|shop|suite|office)\s*#\s*([A-Za-z0-9][A-Za-z0-9 /_-]*)/i,

      /(?:unit|shop|suite|office)\s*([A-Za-z0-9][A-Za-z0-9 /_-]*)(?=\s+(?:at|situated|within|in)\b)/i,

      /premises\s*[:\-–—=]\s*(?:unit|shop|suite|office)\s*([A-Za-z0-9][A-Za-z0-9 /_-]*)/i,

      /(?:unit|shop|suite|office)\s+(?:being|forming)\s+number\s+([A-Za-z0-9][A-Za-z0-9 /_-]*)/i,
    ],
    94
  );
}

function extractMonthlyRental(
  text: string
): { value?: string; confidence: number } {
  const amount =
    '(\\d{1,3}(?:[\\s,]\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)';

  return extractCurrencyValue(text, [
    new RegExp(
      `(?:monthly\\s+rental|monthly\\s+rent|basic\\s+rental|base\\s+rent|gross\\s+rental|initial\\s+rental|commencing\\s+rental|rental\\s+amount|monthly\\s+rental\\s+amount)\\s*(?:is|shall\\s+be|of|:|-|–|—|=)?\\s*R?\\s*${amount}`,
      'i'
    ),

    new RegExp(
      `(?:rental|rent)\\s+(?:payable|per\\s+month|monthly)\\s*(?:is|shall\\s+be|of|:|-|–|—|=)?\\s*R?\\s*${amount}`,
      'i'
    ),

    new RegExp(
      `R\\s*${amount}\\s*(?:per\\s+month|monthly|per\\s+calendar\\s+month)`,
      'i'
    ),

    new RegExp(
      `monthly\\s+rental[^\\n]{0,100}?R\\s*${amount}`,
      'i'
    ),

    new RegExp(
      `monthly\\s+rent[^\\n]{0,100}?R\\s*${amount}`,
      'i'
    ),
  ]);
}

function extractLeaseDate(
  text: string,
  kind: 'commencement' | 'expiry'
): { value?: string; confidence: number } {
  const date =
    '(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})';

  if (kind === 'commencement') {
    return extractDateValue(text, [
      new RegExp(
        `(?:lease\\s+)?commencement\\s+date\\s*(?:is|:|-|–|—|=)?\\s*${date}`,
        'i'
      ),

      new RegExp(
        `commenc(?:es|ing|ement)\\s+(?:on|from)\\s*${date}`,
        'i'
      ),

      new RegExp(
        `(?:start|effective|occupation)\\s+date\\s*(?:is|:|-|–|—|=)?\\s*${date}`,
        'i'
      ),

      new RegExp(
        `lease\\s+(?:shall\\s+)?commence[^\\n]{0,100}?${date}`,
        'i'
      ),
    ]);
  }

  return extractDateValue(text, [
    new RegExp(
      `(?:lease\\s+)?(?:expiry|expiration|termination|end)\\s+date\\s*(?:is|:|-|–|—|=)?\\s*${date}`,
      'i'
    ),

    new RegExp(
      `(?:expires|expire|terminates|terminate)\\s+(?:on|upon)\\s*${date}`,
      'i'
    ),

    new RegExp(
      `(?:lease|agreement)\\s+(?:ends|shall\\s+end)\\s+(?:on|at)\\s*${date}`,
      'i'
    ),
  ]);
}

export function analyseLeaseTemplate(
  text: string
): LeaseTemplateAnalysis {
  const sourceText = text;
  const normalisedText = normaliseLeaseText(text);
    const tenantRegistration = extractPartyRegistrationNumber(
    normalisedText,
    'tenant'
  );

  const landlordRegistration = extractPartyRegistrationNumber(
    normalisedText,
    'landlord'
  );

  const tenantVat = extractPartyVatNumber(
    normalisedText,
    'tenant'
  );

  const landlordVat = extractPartyVatNumber(
    normalisedText,
    'landlord'
  );
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
  let extracted = extractValue(
    normalisedText,
    definition.patterns
  );

  switch (definition.key) {
    case 'tenant_name':
      extracted = extractPartyField(
        normalisedText,
        'tenant',
        []
      );
      break;

    case 'landlord_name':
      extracted = extractPartyField(
        normalisedText,
        'landlord',
        []
      );
      break;

    case 'tenant_registration_number':
      extracted = extractPartyIdentifier(
        normalisedText,
        'tenant',
        [
          'Registration Number',
          'Company Registration Number',
          'Registration No',
          'Registration Nr',
          'Reg No',
          'Reg Nr',
          'Company No',
          'Company Number',
        ],
        'registration'
      );
      break;

    case 'landlord_registration_number':
      extracted = extractPartyIdentifier(
        normalisedText,
        'landlord',
        [
          'Registration Number',
          'Company Registration Number',
          'Registration No',
          'Registration Nr',
          'Reg No',
          'Reg Nr',
          'Company No',
          'Company Number',
        ],
        'registration'
      );
      break;

    case 'tenant_vat_number':
      extracted = extractPartyIdentifier(
        normalisedText,
        'tenant',
        [
          'VAT Registration Number',
          'VAT Registration No',
          'VAT Number',
          'VAT No',
          'VAT Nr',
        ],
        'vat'
      );
      break;

    case 'landlord_vat_number':
      extracted = extractPartyIdentifier(
        normalisedText,
        'landlord',
        [
          'VAT Registration Number',
          'VAT Registration No',
          'VAT Number',
          'VAT No',
          'VAT Nr',
        ],
        'vat'
      );
      break;

    case 'tenant_email':
      extracted = extractPartyField(
        normalisedText,
        'tenant',
        [
          'Email',
          'Email Address',
          'Email Address',
          'E-mail',
          'E-mail Address',
        ]
      );
      break;

    case 'landlord_email':
      extracted = extractPartyField(
        normalisedText,
        'landlord',
        [
          'Email',
          'Email Address',
          'E-mail',
          'E-mail Address',
        ]
      );
      break;

    case 'tenant_phone':
      extracted = extractPartyPhone(
        normalisedText,
        'tenant'
      );
      break;

    case 'landlord_phone':
      extracted = extractPartyPhone(
        normalisedText,
        'landlord'
      );
      break;

    case 'property_name':
      extracted = extractPropertyName(
        normalisedText
      );
      break;

    case 'unit_number':
      extracted = extractUnitNumber(
        normalisedText
      );
      break;

    case 'lease_commencement_date':
      extracted = extractLeaseDate(
        normalisedText,
        'commencement'
      );
      break;

    case 'lease_expiry_date':
      extracted = extractLeaseDate(
        normalisedText,
        'expiry'
      );
      break;

    case 'monthly_rental':
      extracted = extractMonthlyRental(
        normalisedText
      );
      break;

    case 'rental_escalation':
      extracted = extractFirst(
        normalisedText,
        [
          /(?:annual|yearly|per\s+annum)?\s*(?:rental\s+)?escalation\s*(?:of|is|:|-|–|—|=)?\s*(\d+(?:\.\d+)?)\s*%/i,

          /(\d+(?:\.\d+)?)\s*%\s*(?:annual|yearly|per\s+annum)\s+(?:rental\s+)?escalation/i,

          /rent(?:al)?[^.\n]{0,100}?increase[^.\n]{0,50}?(\d+(?:\.\d+)?)\s*%/i,

          /rent(?:al)?[^.\n]{0,100}?escalat[^.\n]{0,50}?(\d+(?:\.\d+)?)\s*%/i,
        ],
        92
      );
      break;

    case 'deposit_amount':
      extracted = extractCurrencyValue(
        normalisedText,
        [
          /security\s+deposit\s*(?:of|is|:|-|–|—|=)?\s*R?\s*(\d{1,3}(?:[\s,]\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,

          /deposit\s*(?:of|is|:|-|–|—|=)?\s*R?\s*(\d{1,3}(?:[\s,]\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,

          /deposit[^.\n]{0,100}?R\s*(\d{1,3}(?:[\s,]\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,
        ]
      );
      break;

    case 'lease_fee':
      extracted = extractCurrencyValue(
        normalisedText,
        [
          /(?:lease|administration|admin)\s+fee\s*(?:of|is|:|-|–|—|=)?\s*R?\s*(\d{1,3}(?:[\s,]\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,

          /(?:lease|administration|admin)\s+fee[^.\n]{0,100}?R\s*(\d{1,3}(?:[\s,]\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/i,
        ]
      );
      break;
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
                endOffset:
                  startOffset + extractedText.length,
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
  pattern.test(normalisedText)
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