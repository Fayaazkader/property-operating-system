import type { OCRResult } from './ocr/types';

export interface ExtractedField {
  value: any;
  confidence: number;
}

export interface ExtractedLeaseFields {
  tenantName?: ExtractedField;
  landlordName?: ExtractedField;
  monthlyRental?: ExtractedField;
  deposit?: ExtractedField;
  escalation?: ExtractedField;
  commencementDate?: ExtractedField;
  expiryDate?: ExtractedField;
  parkingBays?: ExtractedField;
  propertyAddress?: ExtractedField;
  glaSqm?: ExtractedField;
}

export interface ExtractionResult {
  fields: ExtractedLeaseFields;
  overallConfidence: number;
  requiresReview: boolean;
  warnings: string[];
}

export interface ExtractionProvider {
  name: string;
  extract(ocrResult: OCRResult): ExtractionResult;
}

interface FieldDefinition {
  aliases: string[];
  patterns: RegExp[];
  transform: (match: string) => any;
  validate?: (value: any) => boolean;
}

const LEASE_FIELDS: Record<string, FieldDefinition> = {
  tenantName: {
    aliases: ['tenant', 'lessee', 'tenant name', 'occupier', 'customer'],
    patterns: [/tenant[:\s]+(.+)/i, /lessee[:\s]+(.+)/i],
    transform: (m) => m.trim(),
    validate: (v) => v.length > 1,
  },
  landlordName: {
    aliases: ['landlord', 'lessor', 'owner', 'property owner'],
    patterns: [/landlord[:\s]+(.+)/i, /lessor[:\s]+(.+)/i, /owner[:\s]+(.+)/i],
    transform: (m) => m.trim(),
  },
  monthlyRental: {
    aliases: ['monthly rental', 'basic rental', 'rental', 'monthly charge', 'base rent', 'rental amount'],
    patterns: [/monthly rental[:\s]+R?\s*([\d\s,]+)/i, /basic rental[:\s]+R?\s*([\d\s,]+)/i, /rental[:\s]+R?\s*([\d\s,]+)/i, /monthly charge[:\s]+R?\s*([\d\s,]+)/i],
    transform: (m) => parseFloat(m.replace(/[R\s,]/g, '')),
    validate: (v) => v > 0,
  },
  deposit: {
    aliases: ['deposit', 'security deposit', 'rental deposit'],
    patterns: [/deposit[:\s]+R?\s*([\d\s,]+)/i, /security deposit[:\s]+R?\s*([\d\s,]+)/i],
    transform: (m) => parseFloat(m.replace(/[R\s,]/g, '')),
    validate: (v) => v > 0,
  },
  escalation: {
    aliases: ['escalation', 'annual increase', 'escalation rate'],
    patterns: [/escalation[:\s]+([\d.]+)\s*%/i, /annual increase[:\s]+([\d.]+)\s*%/i],
    transform: (m) => parseFloat(m.replace(/%/g, '')),
  },
  commencementDate: {
    aliases: ['commencement', 'start date', 'commencing', 'lease start', 'commencement date'],
    patterns: [/commencement[:\s]+(.+)/i, /start date[:\s]+(.+)/i, /commencing[:\s]+(.+)/i],
    transform: (m) => m.trim(),
    validate: (v) => !isNaN(Date.parse(v)),
  },
  expiryDate: {
    aliases: ['expiry', 'end date', 'termination', 'lease end', 'expiration'],
    patterns: [/expir[yi][:\s]+(.+)/i, /end date[:\s]+(.+)/i, /termination[:\s]+(.+)/i],
    transform: (m) => m.trim(),
    validate: (v) => !isNaN(Date.parse(v)),
  },
  parkingBays: {
    aliases: ['parking', 'parking bays', 'bays'],
    patterns: [/parking[:\s]+([\d]+)\s*bays?/i, /parking bays?[:\s]+([\d]+)/i],
    transform: (m) => parseInt(m),
  },
  propertyAddress: {
    aliases: ['premises', 'property', 'address', 'property address', 'location'],
    patterns: [/premises[:\s]+(.+)/i, /property[:\s]+(.+)/i, /address[:\s]+(.+)/i],
    transform: (m) => m.trim(),
  },
  glaSqm: {
    aliases: ['gla', 'area', 'size', 'square meters', 'sqm'],
    patterns: [/GLA[:\s]+([\d\s,]+)\s*sqm/i, /area[:\s]+([\d\s,]+)\s*sqm/i],
    transform: (m) => parseFloat(m.replace(/[,\s]/g, '')),
  },
};

export class LeaseExtractionProvider implements ExtractionProvider {
  name = 'lease-extractor';

  extract(ocrResult: OCRResult): ExtractionResult {
    const warnings: string[] = [];
    
    // Phase 1: Candidate discovery via aliases in key-value pairs
    const candidates = this.discoverCandidates(ocrResult);
    
    // Phase 2: Validation
    const validated = this.validateCandidates(candidates, warnings);
    
    // Phase 3: Normalization
    const fields = this.normalizeFields(validated);
    
    // Phase 4: Confidence
    const overallConfidence = this.calculateOverallConfidence(fields);
    const requiresReview = Object.keys(fields).length < 5 || overallConfidence < 0.70;

    return { fields, overallConfidence, requiresReview, warnings };
  }

  private discoverCandidates(ocrResult: OCRResult): Record<string, { value: string; confidence: number }> {
    const candidates: Record<string, { value: string; confidence: number }> = {};
    const kvMap = new Map<string, { value: string; confidence: number }>();
    
    for (const kv of (ocrResult.keyValuePairs || [])) {
      kvMap.set(kv.key.toLowerCase().trim(), { value: kv.value, confidence: kv.confidence });
    }

    for (const [fieldName, def] of Object.entries(LEASE_FIELDS)) {
      // Try aliases against key-value pairs
      for (const alias of def.aliases) {
        const match = kvMap.get(alias);
        if (match) {
          candidates[fieldName] = match;
          break;
        }
      }

      // Fallback to regex on full text
      if (!candidates[fieldName]) {
        for (const pattern of def.patterns) {
          const match = ocrResult.text.match(pattern);
          if (match && match[1]) {
            candidates[fieldName] = { value: match[1], confidence: ocrResult.confidence * 0.75 };
            break;
          }
        }
      }
    }

    return candidates;
  }

  private validateCandidates(
    candidates: Record<string, { value: string; confidence: number }>,
    warnings: string[]
  ): Record<string, { value: any; confidence: number }> {
    const validated: Record<string, { value: any; confidence: number }> = {};

    for (const [fieldName, candidate] of Object.entries(candidates)) {
      const def = LEASE_FIELDS[fieldName];
      if (!def) continue;

      try {
        const value = def.transform(candidate.value);
        if (def.validate && !def.validate(value)) {
          warnings.push(`${fieldName}: "${candidate.value}" failed validation`);
          validated[fieldName] = { value, confidence: candidate.confidence * 0.5 };
        } else {
          validated[fieldName] = { value, confidence: candidate.confidence };
        }
      } catch {
        warnings.push(`Failed to parse ${fieldName}: "${candidate.value}"`);
      }
    }

    return validated;
  }

  private normalizeFields(validated: Record<string, { value: any; confidence: number }>): ExtractedLeaseFields {
    const fields: ExtractedLeaseFields = {};
    for (const [key, val] of Object.entries(validated)) {
      (fields as any)[key] = { value: val.value, confidence: val.confidence };
    }
    return fields;
  }

  private calculateOverallConfidence(fields: ExtractedLeaseFields): number {
    const entries = Object.values(fields).filter(f => f !== undefined);
    if (entries.length === 0) return 0;
    const total = entries.reduce((s, f) => s + (f?.confidence || 0), 0);
    return Math.round((total / entries.length) * 100) / 100;
  }
}

export const leaseExtractionProvider = new LeaseExtractionProvider();
