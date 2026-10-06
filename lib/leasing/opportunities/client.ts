import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreateLeasingOpportunityInput {
  entityId: string;
  prospectName: string;

  propertyId?: string | null;
  unitId?: string | null;
  vacancyId?: string | null;

  companyRegistration?: string | null;
  vatNumber?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  industry?: string | null;

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
  negotiationNotes?: string | null;
}

export interface CreateLeasingOpportunityResult {
  success: boolean;
  opportunity_id: string;
  opportunity_code: string;
  status: 'prospecting';
  entity_id: string;
  property_id: string | null;
  unit_id: string | null;
  vacancy_id: string | null;
}

function nullableText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

export async function createLeasingOpportunity(
  client: SupabaseClient,
  input: CreateLeasingOpportunityInput,
): Promise<CreateLeasingOpportunityResult> {
  if (!input.entityId) {
    throw new Error('An entity is required.');
  }

  if (!input.prospectName.trim()) {
    throw new Error('Prospect name is required.');
  }

  if (input.unitId && !input.propertyId) {
    throw new Error('A property is required when a unit is selected.');
  }

  const { data, error } = await client.rpc('create_leasing_opportunity', {
    p_entity_id: input.entityId,
    p_prospect_name: input.prospectName.trim(),

    p_property_id: input.propertyId ?? null,
    p_unit_id: input.unitId ?? null,
    p_vacancy_id: input.vacancyId ?? null,

    p_company_registration: nullableText(input.companyRegistration),
    p_vat_number: nullableText(input.vatNumber),

    p_contact_person: nullableText(input.contactPerson),
    p_contact_email: nullableText(input.contactEmail),
    p_contact_phone: nullableText(input.contactPhone),
    p_industry: nullableText(input.industry),

    p_monthly_rental: nullableNumber(input.monthlyRental),
    p_deposit_amount: nullableNumber(input.depositAmount),
    p_escalation_percent: nullableNumber(input.escalationPercent),
    p_lease_term_months: nullableNumber(input.leaseTermMonths),

    p_commencement_date: input.commencementDate || null,
    p_expiry_date: input.expiryDate || null,
    p_beneficial_occupation_date:
      input.beneficialOccupationDate || null,

    p_parking_bays: nullableNumber(input.parkingBays),
    p_storage_allocation: nullableText(input.storageAllocation),

    p_broker_id: input.brokerId ?? null,
    p_negotiation_notes: nullableText(input.negotiationNotes),

    p_user_agent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });

  if (error) {
    throw new Error(error.message || 'Unable to create leasing opportunity.');
  }

  const result = data as CreateLeasingOpportunityResult | null;

  if (
    !result?.success ||
    typeof result.opportunity_id !== 'string' ||
    !result.opportunity_id
  ) {
    throw new Error(
      'Leasing opportunity creation returned an invalid result.',
    );
  }

  return result;
}

export interface UpdateLeasingOpportunityInput
  extends Omit<CreateLeasingOpportunityInput, 'entityId'> {
  opportunityId: string;
}

export interface UpdateLeasingOpportunityResult {
  success: boolean;
  opportunity_id: string;
  opportunity_code: string;
  status: string;
  entity_id: string;
  property_id: string | null;
  unit_id: string | null;
  vacancy_id: string | null;
  updated_at: string;
}

export interface CommercialVersionResult {
  success: boolean;
  opportunity_id: string;
  version_id: string;
  version_number: number;
  status: 'internal_approval';
  snapshot: Record<string, unknown>;
}

export interface CommercialApprovalResult {
  success: boolean;
  opportunity_id: string;
  approval_id: string;
  approved_version_id: string;
  approved_version_number: number;
  status: 'drafting';
}

export async function updateLeasingOpportunity(
  client: SupabaseClient,
  input: UpdateLeasingOpportunityInput,
): Promise<UpdateLeasingOpportunityResult> {
  if (!input.opportunityId) {
    throw new Error('Opportunity is required.');
  }

  if (!input.prospectName.trim()) {
    throw new Error('Prospect name is required.');
  }

  if (input.unitId && !input.propertyId) {
    throw new Error('A property is required when a unit is selected.');
  }

  const { data, error } = await client.rpc('update_leasing_opportunity', {
    p_opportunity_id: input.opportunityId,
    p_prospect_name: input.prospectName.trim(),

    p_property_id: input.propertyId ?? null,
    p_unit_id: input.unitId ?? null,
    p_vacancy_id: input.vacancyId ?? null,

    p_company_registration: nullableText(input.companyRegistration),
    p_vat_number: nullableText(input.vatNumber),

    p_contact_person: nullableText(input.contactPerson),
    p_contact_email: nullableText(input.contactEmail),
    p_contact_phone: nullableText(input.contactPhone),
    p_industry: nullableText(input.industry),

    p_monthly_rental: nullableNumber(input.monthlyRental),
    p_deposit_amount: nullableNumber(input.depositAmount),
    p_escalation_percent: nullableNumber(input.escalationPercent),
    p_lease_term_months: nullableNumber(input.leaseTermMonths),

    p_commencement_date: input.commencementDate || null,
    p_expiry_date: input.expiryDate || null,
    p_beneficial_occupation_date:
      input.beneficialOccupationDate || null,

    p_parking_bays: nullableNumber(input.parkingBays),
    p_storage_allocation: nullableText(input.storageAllocation),

    p_broker_id: input.brokerId ?? null,
    p_negotiation_notes: nullableText(input.negotiationNotes),

    p_user_agent:
      typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });

  if (error) {
    throw new Error(error.message || 'Unable to update leasing opportunity.');
  }

  const result = data as UpdateLeasingOpportunityResult | null;

  if (
    !result?.success ||
    result.opportunity_id !== input.opportunityId
  ) {
    throw new Error(
      'Leasing opportunity update returned an invalid result.',
    );
  }

  return result;
}

export async function submitLeasingCommercialTerms(
  client: SupabaseClient,
  opportunityId: string,
  notes?: string | null,
): Promise<CommercialVersionResult> {
  if (!opportunityId) {
    throw new Error('Opportunity is required.');
  }

  const { data, error } = await client.rpc(
    'create_leasing_commercial_version',
    {
      p_opportunity_id: opportunityId,
      p_source_offer_id: null,
      p_notes: nullableText(notes),
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  );

  if (error) {
    throw new Error(
      error.message || 'Unable to submit commercial terms for approval.',
    );
  }

  const result = data as CommercialVersionResult | null;

  if (
    !result?.success ||
    !result.version_id ||
    result.status !== 'internal_approval'
  ) {
    throw new Error(
      'Commercial submission returned an invalid result.',
    );
  }

  return result;
}

export async function approveLeasingCommercialTerms(
  client: SupabaseClient,
  opportunityId: string,
  versionId: string,
): Promise<CommercialApprovalResult> {
  if (!opportunityId || !versionId) {
    throw new Error('Opportunity and commercial version are required.');
  }

  const { data, error } = await client.rpc(
    'approve_leasing_commercial_terms',
    {
      p_opportunity_id: opportunityId,
      p_version_id: versionId,
      p_channel: 'web',
      p_decision_context: {
        surface: 'commercial_leasing_workspace',
      },
      p_evidence: {},
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  );

  if (error) {
    throw new Error(
      error.message || 'Unable to approve commercial terms.',
    );
  }

  const result = data as CommercialApprovalResult | null;

  if (
    !result?.success ||
    result.approved_version_id !== versionId ||
    result.status !== 'drafting'
  ) {
    throw new Error(
      'Commercial approval returned an invalid result.',
    );
  }

  return result;
}
