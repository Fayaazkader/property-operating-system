BEGIN;

-- Extend the canonical lease-template semantic registry with commercial
-- terms backed by the immutable approved leasing authority.

CREATE OR REPLACE FUNCTION public.lease_template_field_definition(
  p_field_key text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_field_key
    WHEN 'tenant_name' THEN
      jsonb_build_object(
        'key', 'tenant_name',
        'label', 'Tenant / Lessee Name',
        'type', 'text',
        'required', true
      )

    WHEN 'landlord_name' THEN
      jsonb_build_object(
        'key', 'landlord_name',
        'label', 'Landlord / Lessor Name',
        'type', 'text',
        'required', true
      )

    WHEN 'tenant_registration_number' THEN
      jsonb_build_object(
        'key', 'tenant_registration_number',
        'label', 'Tenant Registration Number',
        'type', 'text',
        'required', false
      )

    WHEN 'landlord_registration_number' THEN
      jsonb_build_object(
        'key', 'landlord_registration_number',
        'label', 'Landlord Registration Number',
        'type', 'text',
        'required', false
      )

    WHEN 'tenant_vat_number' THEN
      jsonb_build_object(
        'key', 'tenant_vat_number',
        'label', 'Tenant VAT Number',
        'type', 'text',
        'required', false
      )

    WHEN 'landlord_vat_number' THEN
      jsonb_build_object(
        'key', 'landlord_vat_number',
        'label', 'Landlord VAT Number',
        'type', 'text',
        'required', false
      )

    WHEN 'tenant_email' THEN
      jsonb_build_object(
        'key', 'tenant_email',
        'label', 'Tenant Email',
        'type', 'email',
        'required', false
      )

    WHEN 'landlord_email' THEN
      jsonb_build_object(
        'key', 'landlord_email',
        'label', 'Landlord Email',
        'type', 'email',
        'required', false
      )

    WHEN 'tenant_phone' THEN
      jsonb_build_object(
        'key', 'tenant_phone',
        'label', 'Tenant Telephone',
        'type', 'phone',
        'required', false
      )

    WHEN 'landlord_phone' THEN
      jsonb_build_object(
        'key', 'landlord_phone',
        'label', 'Landlord Telephone',
        'type', 'phone',
        'required', false
      )

    WHEN 'property_name' THEN
      jsonb_build_object(
        'key', 'property_name',
        'label', 'Property Name',
        'type', 'text',
        'required', true
      )

    WHEN 'unit_number' THEN
      jsonb_build_object(
        'key', 'unit_number',
        'label', 'Unit / Shop Number',
        'type', 'text',
        'required', true
      )

    WHEN 'lease_commencement_date' THEN
      jsonb_build_object(
        'key', 'lease_commencement_date',
        'label', 'Lease Commencement Date',
        'type', 'date',
        'required', true
      )

    WHEN 'lease_expiry_date' THEN
      jsonb_build_object(
        'key', 'lease_expiry_date',
        'label', 'Lease Expiry Date',
        'type', 'date',
        'required', true
      )

    WHEN 'lease_term' THEN
      jsonb_build_object(
        'key', 'lease_term',
        'label', 'Lease Term (Months)',
        'type', 'number',
        'required', false
      )

    WHEN 'leased_area' THEN
      jsonb_build_object(
        'key', 'leased_area',
        'label', 'Leased Area (m²)',
        'type', 'number',
        'required', false
      )

    WHEN 'rental_rate' THEN
      jsonb_build_object(
        'key', 'rental_rate',
        'label', 'Rental Rate per m²',
        'type', 'currency',
        'required', false
      )

    WHEN 'vat_treatment' THEN
      jsonb_build_object(
        'key', 'vat_treatment',
        'label', 'Rental VAT Treatment',
        'type', 'text',
        'required', false
      )

    WHEN 'monthly_rental' THEN
      jsonb_build_object(
        'key', 'monthly_rental',
        'label', 'Monthly Rental',
        'type', 'currency',
        'required', true
      )

    WHEN 'rental_escalation' THEN
      jsonb_build_object(
        'key', 'rental_escalation',
        'label', 'Rental Escalation',
        'type', 'percentage',
        'required', false
      )

    WHEN 'deposit_amount' THEN
      jsonb_build_object(
        'key', 'deposit_amount',
        'label', 'Deposit Amount',
        'type', 'currency',
        'required', false
      )

    WHEN 'lease_fee' THEN
      jsonb_build_object(
        'key', 'lease_fee',
        'label', 'Lease / Administration Fee',
        'type', 'currency',
        'required', false
      )

    ELSE NULL
  END;
$$;

COMMIT;
