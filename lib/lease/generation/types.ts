import type {
  LeaseTemplate,
  LeaseTemplateFieldMapping,
} from '../templates/types';

export type LeaseGenerationValue =
  | string
  | number
  | boolean
  | null;

export interface ApprovedCommercialSnapshot {
  opportunityId?: string;
  opportunityCode?: string;

  prospectName?: string | null;
  companyRegistration?: string | null;
  vatNumber?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  industry?: string | null;

  propertyId?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;

  monthlyRental?: number | null;
  depositAmount?: number | null;
  escalationPercent?: number | null;
  leaseTermMonths?: number | null;

  commencementDate?: string | null;
  expiryDate?: string | null;
  beneficialOccupationDate?: string | null;

  parkingBays?: number | null;
  storageAllocation?: string | null;

  brokerId?: string | null;
  commissionPercent?: number | null;
  commissionAmount?: number | null;
  commissionStructure?: string | null;
  commissionNotes?: string | null;

  negotiationNotes?: string | null;
  sourceOfferId?: string | null;
  capturedAt?: string | null;

  [key: string]: unknown;
}

export interface LeaseGenerationEntity {
  id: string;
  name?: string | null;
  entity_name?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  telephone?: string | null;
  email?: string | null;
}

export interface LeaseGenerationProperty {
  id: string;
  property_name: string;
  property_type?: string | null;
  entity_id?: string | null;
  owner_entity_id?: string | null;
  managing_entity_id?: string | null;
}

export interface LeaseGenerationUnit {
  id: string;
  property_id?: string | null;
  unit_number: string;
}

export interface LeaseCanonicalValues {
  [fieldKey: string]: LeaseGenerationValue;
}

export interface LeaseGenerationProvenance {
  entityId: string;
  opportunityId: string;
  commercialVersionId: string;
  commercialVersionNumber: number;
  templateId: string;
  templateVersion: number;
  sourceTemplateDocumentId?: string | null;
  sourceTemplateChecksum?: string | null;
}

export interface LeaseGenerationValidationIssue {
  code:
    | 'missing_required_value'
    | 'missing_optional_value'
    | 'missing_required_mapping'
    | 'invalid_mapping'
    | 'unsupported_target'
    | 'authority_mismatch';
  message: string;
  fieldKey?: string;
  mappingId?: string;
}

export interface LeaseGenerationValidation {
  valid: boolean;
  errors: LeaseGenerationValidationIssue[];
  warnings: LeaseGenerationValidationIssue[];
}

export interface LeaseGenerationManifest {
  values: LeaseCanonicalValues;
  mappings: LeaseTemplateFieldMapping[];
  provenance: LeaseGenerationProvenance;
  validation: LeaseGenerationValidation;
}

export interface BuildLeaseGenerationManifestInput {
  entityId: string;
  opportunityId: string;
  commercialVersionId: string;
  commercialVersionNumber: number;
  snapshot: ApprovedCommercialSnapshot;
  entity: LeaseGenerationEntity;
  property: LeaseGenerationProperty;
  unit: LeaseGenerationUnit;
  template: LeaseTemplate;
}
