'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Loader2,
  Save,
  UserRound,
} from 'lucide-react';

import { useEntityContext } from '@/app/context/EntityContext';
import { supabase } from '@/lib/supabase';
import { createLeasingOpportunity } from '@/lib/leasing/opportunities/client';

interface PropertyOption {
  id: string;
  property_name: string;
  entity_id: string | null;
  owner_entity_id?: string | null;
  managing_entity_id?: string | null;
}

interface UnitOption {
  id: string;
  property_id: string | null;
  unit_number: string;
  unit_name: string | null;
  gla_sqm: number | null;
  occupancy_status: string | null;
}

interface FormState {
  prospectName: string;
  companyRegistration: string;
  vatNumber: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;

  propertyId: string;
  unitId: string;

  monthlyRental: string;
  depositAmount: string;
  escalationPercent: string;
  leaseTermMonths: string;
  leasedAreaSqm: string;
  rentalRatePerSqm: string;
  rentalVatTreatment: string;

  commencementDate: string;
  expiryDate: string;
  beneficialOccupationDate: string;

  parkingBays: string;
  storageAllocation: string;
  negotiationNotes: string;
}

const initialForm: FormState = {
  prospectName: '',
  companyRegistration: '',
  vatNumber: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  industry: '',

  propertyId: '',
  unitId: '',

  monthlyRental: '',
  depositAmount: '',
  escalationPercent: '',
  leaseTermMonths: '',
  leasedAreaSqm: '',
  rentalRatePerSqm: '',
  rentalVatTreatment: '',

  commencementDate: '',
  expiryDate: '',
  beneficialOccupationDate: '',

  parkingBays: '0',
  storageAllocation: '',
  negotiationNotes: '',
};

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function NewCommercialLeasingOpportunityPage() {
  const router = useRouter();

  const {
    activeEntityId,
    availableEntities,
    loading: entityLoading,
  } = useEntityContext();

  const [entityId, setEntityId] = useState('');
  const [form, setForm] = useState<FormState>(initialForm);

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeEntityId) {
      setEntityId(activeEntityId);
      return;
    }

    if (availableEntities.length === 1) {
      setEntityId(availableEntities[0].entity_id);
    }
  }, [activeEntityId, availableEntities]);

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      setProperties([]);
      setUnits([]);
      setForm((current) => ({
        ...current,
        propertyId: '',
        unitId: '',
      }));

      if (!entityId) return;

      setLoadingProperties(true);

      const { data, error: propertyError } = await supabase
        .from('properties')
        .select(
          'id, property_name, entity_id, owner_entity_id, managing_entity_id',
        )
        .or(
          `entity_id.eq.${entityId},owner_entity_id.eq.${entityId},managing_entity_id.eq.${entityId}`,
        )
        .order('property_name');

      if (cancelled) return;

      if (propertyError) {
        setError(propertyError.message);
        setProperties([]);
      } else {
        setProperties((data || []) as PropertyOption[]);
      }

      setLoadingProperties(false);
    }

    void loadProperties();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      setUnits([]);

      if (!form.propertyId) return;

      setLoadingUnits(true);

      const { data, error: unitError } = await supabase
        .from('units')
        .select(
          'id, property_id, unit_number, unit_name, gla_sqm, occupancy_status',
        )
        .eq('property_id', form.propertyId)
        .order('unit_number');

      if (cancelled) return;

      if (unitError) {
        setError(unitError.message);
        setUnits([]);
      } else {
        setUnits((data || []) as UnitOption[]);
      }

      setLoadingUnits(false);
    }

    void loadUnits();

    return () => {
      cancelled = true;
    };
  }, [form.propertyId]);

  const selectedEntity = useMemo(
    () =>
      availableEntities.find((entity) => entity.entity_id === entityId) ??
      null,
    [availableEntities, entityId],
  );

  function setField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'propertyId' ? { unitId: '' } : {}),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!entityId) {
      setError('Select the entity responsible for this opportunity.');
      return;
    }

    if (!form.prospectName.trim()) {
      setError('Prospect name is required.');
      return;
    }

    setSaving(true);

    try {
      const result = await createLeasingOpportunity(supabase, {
        entityId,
        prospectName: form.prospectName,

        companyRegistration: form.companyRegistration,
        vatNumber: form.vatNumber,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        industry: form.industry,

        propertyId: form.propertyId || null,
        unitId: form.unitId || null,

        monthlyRental: optionalNumber(form.monthlyRental),
        depositAmount: optionalNumber(form.depositAmount),
        escalationPercent: optionalNumber(form.escalationPercent),
        leaseTermMonths: optionalNumber(form.leaseTermMonths),
        leasedAreaSqm: optionalNumber(form.leasedAreaSqm),
        rentalRatePerSqm: optionalNumber(form.rentalRatePerSqm),
        rentalVatTreatment:
          form.rentalVatTreatment === 'exclusive' ||
          form.rentalVatTreatment === 'inclusive' ||
          form.rentalVatTreatment === 'not_applicable'
            ? form.rentalVatTreatment
            : null,

        commencementDate: form.commencementDate || null,
        expiryDate: form.expiryDate || null,
        beneficialOccupationDate:
          form.beneficialOccupationDate || null,

        parkingBays: optionalNumber(form.parkingBays),
        storageAllocation: form.storageAllocation,
        negotiationNotes: form.negotiationNotes,
      });

      router.push(`/commercial-leasing/${result.opportunity_id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to create leasing opportunity.',
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-50';

  const labelClass =
    'mb-1.5 block text-xs font-medium text-[var(--text-secondary)]';

  if (entityLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 pb-12 pt-8">
      <div>
        <button
          type="button"
          onClick={() => router.push('/commercial-leasing')}
          className="mb-5 flex items-center gap-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Commercial Leasing
        </button>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              New Opportunity
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              Capture the working commercial terms. Approval evidence and the
              immutable commercial version are created later when the deal is
              submitted for approval.
            </p>
          </div>

          {selectedEntity && (
            <div className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              {selectedEntity.entity_name}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <Section
          icon={<Building2 className="h-4 w-4" />}
          title="Entity & Premises"
          description="Choose the commercial entity and the premises involved in the deal."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entity" required>
              <select
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select entity</option>
                {availableEntities.map((entity) => (
                  <option
                    key={entity.entity_id}
                    value={entity.entity_id}
                  >
                    {entity.entity_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Property">
              <select
                value={form.propertyId}
                onChange={(event) =>
                  setField('propertyId', event.target.value)
                }
                className={inputClass}
                disabled={!entityId || loadingProperties}
              >
                <option value="">
                  {loadingProperties
                    ? 'Loading properties...'
                    : 'Select property'}
                </option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.property_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Unit">
              <select
                value={form.unitId}
                onChange={(event) =>
                  setField('unitId', event.target.value)
                }
                className={inputClass}
                disabled={!form.propertyId || loadingUnits}
              >
                <option value="">
                  {loadingUnits ? 'Loading units...' : 'Select unit'}
                </option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_number}
                    {unit.unit_name ? ` · ${unit.unit_name}` : ''}
                    {unit.gla_sqm ? ` · ${unit.gla_sqm} m²` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section
          icon={<UserRound className="h-4 w-4" />}
          title="Prospect"
          description="The proposed tenant and primary commercial contact."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Prospect / Company Name" required>
              <input
                value={form.prospectName}
                onChange={(event) =>
                  setField('prospectName', event.target.value)
                }
                className={inputClass}
                placeholder="Tenant or company name"
                required
              />
            </Field>

            <Field label="Industry">
              <input
                value={form.industry}
                onChange={(event) =>
                  setField('industry', event.target.value)
                }
                className={inputClass}
                placeholder="e.g. Retail"
              />
            </Field>

            <Field label="Company Registration">
              <input
                value={form.companyRegistration}
                onChange={(event) =>
                  setField('companyRegistration', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="VAT Number">
              <input
                value={form.vatNumber}
                onChange={(event) =>
                  setField('vatNumber', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Contact Person">
              <input
                value={form.contactPerson}
                onChange={(event) =>
                  setField('contactPerson', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Contact Email">
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setField('contactEmail', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Contact Phone">
              <input
                value={form.contactPhone}
                onChange={(event) =>
                  setField('contactPhone', event.target.value)
                }
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section
          icon={<CalendarDays className="h-4 w-4" />}
          title="Commercial Terms"
          description="Working terms remain editable until submitted into the governed approval workflow."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Monthly Rental">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyRental}
                onChange={(event) =>
                  setField('monthlyRental', event.target.value)
                }
                className={inputClass}
                placeholder="R"
              />
            </Field>

            <Field label="Deposit">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.depositAmount}
                onChange={(event) =>
                  setField('depositAmount', event.target.value)
                }
                className={inputClass}
                placeholder="R"
              />
            </Field>

            <Field label="Escalation">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.escalationPercent}
                onChange={(event) =>
                  setField('escalationPercent', event.target.value)
                }
                className={inputClass}
                placeholder="%"
              />
            </Field>

            <Field label="Lease Term">
              <input
                type="number"
                min="1"
                step="1"
                value={form.leaseTermMonths}
                onChange={(event) =>
                  setField('leaseTermMonths', event.target.value)
                }
                className={inputClass}
                placeholder="Months"
              />
            </Field>

            <Field label="Leased Area">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.leasedAreaSqm}
                onChange={(event) =>
                  setField('leasedAreaSqm', event.target.value)
                }
                className={inputClass}
                placeholder="m²"
              />
            </Field>

            <Field label="Rental Rate / m²">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.rentalRatePerSqm}
                onChange={(event) =>
                  setField('rentalRatePerSqm', event.target.value)
                }
                className={inputClass}
                placeholder="R / m²"
              />
            </Field>

            <Field label="Rental VAT Treatment">
              <select
                value={form.rentalVatTreatment}
                onChange={(event) =>
                  setField('rentalVatTreatment', event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select treatment</option>
                <option value="exclusive">VAT exclusive</option>
                <option value="inclusive">VAT inclusive</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </Field>

            <Field label="Parking Bays">
              <input
                type="number"
                min="0"
                step="1"
                value={form.parkingBays}
                onChange={(event) =>
                  setField('parkingBays', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Storage">
              <input
                value={form.storageAllocation}
                onChange={(event) =>
                  setField('storageAllocation', event.target.value)
                }
                className={inputClass}
                placeholder="Optional allocation"
              />
            </Field>

            <Field label="Commencement Date">
              <input
                type="date"
                value={form.commencementDate}
                onChange={(event) =>
                  setField('commencementDate', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Expiry Date">
              <input
                type="date"
                value={form.expiryDate}
                onChange={(event) =>
                  setField('expiryDate', event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Beneficial Occupation">
              <input
                type="date"
                value={form.beneficialOccupationDate}
                onChange={(event) =>
                  setField(
                    'beneficialOccupationDate',
                    event.target.value,
                  )
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Negotiation Notes</label>
            <textarea
              value={form.negotiationNotes}
              onChange={(event) =>
                setField('negotiationNotes', event.target.value)
              }
              rows={4}
              className={inputClass}
              placeholder="Commercial context, concessions, outstanding terms or negotiation notes..."
            />
          </div>
        </Section>

        <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-5">
          <p className="max-w-xl text-xs leading-5 text-[var(--text-muted)]">
            Creating an opportunity starts the working commercial record. It
            does not approve terms, generate a lease or create an execution.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/commercial-leasing')}
              disabled={saving}
              className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !entityId}
              className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Create Opportunity
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="flex items-start gap-3 border-b border-[var(--border-default)] px-5 py-4">
        <div className="mt-0.5 text-[var(--text-muted)]">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {description}
          </p>
        </div>
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}
