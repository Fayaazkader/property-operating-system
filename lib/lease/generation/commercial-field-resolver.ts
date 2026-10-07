import type {
  ApprovedCommercialSnapshot,
  LeaseCanonicalValues,
  LeaseGenerationEntity,
  LeaseGenerationProperty,
  LeaseGenerationUnit,
} from './types';

function valueOrNull(
  value: string | number | boolean | null | undefined,
): string | number | boolean | null {
  return value ?? null;
}

export function resolveLeaseCanonicalValues(params: {
  snapshot: ApprovedCommercialSnapshot;
  entity: LeaseGenerationEntity;
  property: LeaseGenerationProperty;
  unit: LeaseGenerationUnit;
}): LeaseCanonicalValues {
  const {
    snapshot,
    entity,
    property,
    unit,
  } = params;

  return {
    tenant_name: valueOrNull(snapshot.prospectName),
    landlord_name: valueOrNull(entity.name ?? entity.entity_name),

    tenant_registration_number: valueOrNull(
      snapshot.companyRegistration,
    ),
    landlord_registration_number: valueOrNull(
      entity.registration_number,
    ),

    tenant_vat_number: valueOrNull(snapshot.vatNumber),
    landlord_vat_number: valueOrNull(entity.vat_number),

    tenant_email: valueOrNull(snapshot.contactEmail),
    landlord_email: valueOrNull(entity.email),

    tenant_phone: valueOrNull(snapshot.contactPhone),
    landlord_phone: valueOrNull(entity.telephone),

    property_name: valueOrNull(property.property_name),
    unit_number: valueOrNull(
      snapshot.unitNumber ?? unit.unit_number,
    ),

    lease_commencement_date: valueOrNull(
      snapshot.commencementDate,
    ),
    lease_expiry_date: valueOrNull(snapshot.expiryDate),

    lease_term: valueOrNull(snapshot.leaseTermMonths),
    leased_area: valueOrNull(snapshot.leasedAreaSqm),
    rental_rate: valueOrNull(snapshot.rentalRatePerSqm),
    vat_treatment: valueOrNull(snapshot.rentalVatTreatment),

    monthly_rental: valueOrNull(snapshot.monthlyRental),
    rental_escalation: valueOrNull(
      snapshot.escalationPercent,
    ),
    deposit_amount: valueOrNull(snapshot.depositAmount),

    // No approved commercial authority for this value has yet been
    // established. It must remain absent rather than being inferred.
    lease_fee: null,
  };
}
