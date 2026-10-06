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
