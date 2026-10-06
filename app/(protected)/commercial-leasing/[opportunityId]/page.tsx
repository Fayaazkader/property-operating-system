'use client';

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Save,
  Send,
  UserRound,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  approveLeasingCommercialTerms,
  submitLeasingCommercialTerms,
  updateLeasingOpportunity,
} from '@/lib/leasing/opportunities/client';

interface Opportunity {
  id: string;
  opportunity_code: string;
  status: string;
  entity_id: string;

  prospect_name: string;
  company_registration: string | null;
  vat_number: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;

  property_id: string | null;
  unit_id: string | null;
  vacancy_id: string | null;
  broker_id: string | null;

  monthly_rental: number | null;
  deposit_amount: number | null;
  escalation_percent: number | null;
  lease_term_months: number | null;

  commencement_date: string | null;
  expiry_date: string | null;
  beneficial_occupation_date: string | null;

  parking_bays: number | null;
  storage_allocation: string | null;
  negotiation_notes: string | null;

  current_version: number | null;
  approved_terms_version_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CommercialSnapshot {
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
  vacancyId?: string | null;
  brokerId?: string | null;

  monthlyRental?: number | null;
  depositAmount?: number | null;
  escalationPercent?: number | null;
  leaseTermMonths?: number | null;

  commencementDate?: string | null;
  expiryDate?: string | null;
  beneficialOccupationDate?: string | null;

  parkingBays?: number | null;
  storageAllocation?: string | null;
  negotiationNotes?: string | null;

  opportunityId?: string | null;
  opportunityCode?: string | null;
  sourceOfferId?: string | null;
  capturedAt?: string | null;
}

interface CommercialVersion {
  id: string;
  opportunity_id: string;
  version_number: number;
  snapshot: CommercialSnapshot;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
}

interface PropertyOption {
  id: string;
  property_name: string;
}

interface UnitOption {
  id: string;
  property_id: string | null;
  unit_number: string;
  unit_name: string | null;
  gla_sqm: number | null;
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

  commencementDate: string;
  expiryDate: string;
  beneficialOccupationDate: string;

  parkingBays: string;
  storageAllocation: string;
  negotiationNotes: string;
}

const editableStatuses = new Set([
  'prospecting',
  'offer_received',
  'commercial_review',
  'negotiation',
]);

const statusLabels: Record<string, string> = {
  prospecting: 'Prospecting',
  offer_received: 'Offer Received',
  commercial_review: 'Commercial Review',
  negotiation: 'Negotiation',
  internal_approval: 'Internal Approval',
  drafting: 'Lease Drafting',
  sent_for_signature: 'Sent for Signature',
  tenant_signed: 'Tenant Signed',
  landlord_signed: 'Landlord Signed',
  executed: 'Executed',
  ready_for_activation: 'Ready for Activation',
  activated: 'Activated',
  trading: 'Trading',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function value(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function toForm(opportunity: Opportunity): FormState {
  return {
    prospectName: opportunity.prospect_name || '',
    companyRegistration: opportunity.company_registration || '',
    vatNumber: opportunity.vat_number || '',
    contactPerson: opportunity.contact_person || '',
    contactEmail: opportunity.contact_email || '',
    contactPhone: opportunity.contact_phone || '',
    industry: opportunity.industry || '',

    propertyId: opportunity.property_id || '',
    unitId: opportunity.unit_id || '',

    monthlyRental: value(opportunity.monthly_rental),
    depositAmount: value(opportunity.deposit_amount),
    escalationPercent: value(opportunity.escalation_percent),
    leaseTermMonths: value(opportunity.lease_term_months),

    commencementDate: opportunity.commencement_date || '',
    expiryDate: opportunity.expiry_date || '',
    beneficialOccupationDate:
      opportunity.beneficial_occupation_date || '',

    parkingBays: value(opportunity.parking_bays ?? 0),
    storageAllocation: opportunity.storage_allocation || '',
    negotiationNotes: opportunity.negotiation_notes || '',
  };
}

function formatMoney(amount: unknown): string {
  const parsed =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string'
        ? Number(amount)
        : NaN;

  if (!Number.isFinite(parsed)) return '—';

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatDate(date: unknown): string {
  if (typeof date !== 'string' || !date) return '—';

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export default function CommercialLeasingOpportunityPage() {
  const router = useRouter();
  const params = useParams<{ opportunityId: string }>();
  const opportunityId = params.opportunityId;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [currentVersion, setCurrentVersion] =
    useState<CommercialVersion | null>(null);

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  const [form, setForm] = useState<FormState | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingPremises, setLoadingPremises] = useState(false);
  const [action, setAction] = useState<
    'save' | 'submit' | 'approve' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOpportunity = useCallback(async () => {
    if (!opportunityId) return;

    setError(null);

    const { data, error: opportunityError } = await supabase
      .from('leasing_opportunities')
      .select(
        [
          'id',
          'opportunity_code',
          'status',
          'entity_id',
          'prospect_name',
          'company_registration',
          'vat_number',
          'contact_person',
          'contact_email',
          'contact_phone',
          'industry',
          'property_id',
          'unit_id',
          'vacancy_id',
          'broker_id',
          'monthly_rental',
          'deposit_amount',
          'escalation_percent',
          'lease_term_months',
          'commencement_date',
          'expiry_date',
          'beneficial_occupation_date',
          'parking_bays',
          'storage_allocation',
          'negotiation_notes',
          'current_version',
          'approved_terms_version_id',
          'created_at',
          'updated_at',
        ].join(','),
      )
      .eq('id', opportunityId)
      .single();

    if (opportunityError || !data) {
      throw new Error(
        opportunityError?.message || 'Commercial opportunity not found.',
      );
    }

    const nextOpportunity = data as unknown as Opportunity;

    setOpportunity(nextOpportunity);
    setForm(toForm(nextOpportunity));

    const { data: versionData, error: versionError } = await supabase
      .from('leasing_opportunity_versions')
      .select(
        'id, opportunity_id, version_number, snapshot, notes, created_at, created_by',
      )
      .eq('opportunity_id', opportunityId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      throw new Error(versionError.message);
    }

    setCurrentVersion(
      (versionData as CommercialVersion | null) ?? null,
    );
  }, [opportunityId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        await loadOpportunity();
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load commercial opportunity.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [loadOpportunity]);

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      if (!opportunity?.entity_id) {
        setProperties([]);
        return;
      }

      setLoadingPremises(true);

      const { data, error: propertyError } = await supabase
        .from('properties')
        .select('id, property_name')
        .or(
          `entity_id.eq.${opportunity.entity_id},owner_entity_id.eq.${opportunity.entity_id},managing_entity_id.eq.${opportunity.entity_id}`,
        )
        .order('property_name');

      if (cancelled) return;

      if (propertyError) {
        setError(propertyError.message);
        setProperties([]);
      } else {
        setProperties((data || []) as PropertyOption[]);
      }

      setLoadingPremises(false);
    }

    void loadProperties();

    return () => {
      cancelled = true;
    };
  }, [opportunity?.entity_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      if (!form?.propertyId) {
        setUnits([]);
        return;
      }

      const { data, error: unitError } = await supabase
        .from('units')
        .select('id, property_id, unit_number, unit_name, gla_sqm')
        .eq('property_id', form.propertyId)
        .order('unit_number');

      if (cancelled) return;

      if (unitError) {
        setError(unitError.message);
        setUnits([]);
      } else {
        setUnits((data || []) as UnitOption[]);
      }
    }

    void loadUnits();

    return () => {
      cancelled = true;
    };
  }, [form?.propertyId]);

  const editable = Boolean(
    opportunity && editableStatuses.has(opportunity.status),
  );

  const awaitingApproval = opportunity?.status === 'internal_approval';
  const commerciallyApproved = Boolean(
    opportunity?.approved_terms_version_id,
  );

  const selectedProperty = useMemo(
    () =>
      properties.find(
        (property) => property.id === form?.propertyId,
      ) ?? null,
    [properties, form?.propertyId],
  );

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === form?.unitId) ?? null,
    [units, form?.unitId],
  );

  function setField<K extends keyof FormState>(
    field: K,
    nextValue: FormState[K],
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: nextValue,
            ...(field === 'propertyId' ? { unitId: '' } : {}),
          }
        : current,
    );
  }

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  async function saveWorkingTerms(
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();

    if (!opportunity || !form || !editable) return;

    clearMessages();
    setAction('save');

    try {
      await updateLeasingOpportunity(supabase, {
        opportunityId: opportunity.id,
        prospectName: form.prospectName,

        companyRegistration: form.companyRegistration,
        vatNumber: form.vatNumber,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        industry: form.industry,

        propertyId: form.propertyId || null,
        unitId: form.unitId || null,
        vacancyId: opportunity.vacancy_id,

        monthlyRental: optionalNumber(form.monthlyRental),
        depositAmount: optionalNumber(form.depositAmount),
        escalationPercent: optionalNumber(form.escalationPercent),
        leaseTermMonths: optionalNumber(form.leaseTermMonths),

        commencementDate: form.commencementDate || null,
        expiryDate: form.expiryDate || null,
        beneficialOccupationDate:
          form.beneficialOccupationDate || null,

        parkingBays: optionalNumber(form.parkingBays),
        storageAllocation: form.storageAllocation,
        brokerId: opportunity.broker_id,
        negotiationNotes: form.negotiationNotes,
      });

      await loadOpportunity();
      setNotice('Working commercial terms saved.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save commercial terms.',
      );
    } finally {
      setAction(null);
    }
  }

  async function submitForApproval() {
    if (!opportunity || !form || !editable) return;

    clearMessages();
    setAction('submit');

    try {
      await updateLeasingOpportunity(supabase, {
        opportunityId: opportunity.id,
        prospectName: form.prospectName,

        companyRegistration: form.companyRegistration,
        vatNumber: form.vatNumber,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        industry: form.industry,

        propertyId: form.propertyId || null,
        unitId: form.unitId || null,
        vacancyId: opportunity.vacancy_id,

        monthlyRental: optionalNumber(form.monthlyRental),
        depositAmount: optionalNumber(form.depositAmount),
        escalationPercent: optionalNumber(form.escalationPercent),
        leaseTermMonths: optionalNumber(form.leaseTermMonths),

        commencementDate: form.commencementDate || null,
        expiryDate: form.expiryDate || null,
        beneficialOccupationDate:
          form.beneficialOccupationDate || null,

        parkingBays: optionalNumber(form.parkingBays),
        storageAllocation: form.storageAllocation,
        brokerId: opportunity.broker_id,
        negotiationNotes: form.negotiationNotes,
      });

      const result = await submitLeasingCommercialTerms(
        supabase,
        opportunity.id,
        form.negotiationNotes,
      );

      await loadOpportunity();

      setNotice(
        `Commercial Version ${result.version_number} submitted for approval. Working terms are now locked.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to submit commercial terms.',
      );
    } finally {
      setAction(null);
    }
  }

  async function approveTerms() {
    if (
      !opportunity ||
      !currentVersion ||
      !awaitingApproval
    ) {
      return;
    }

    clearMessages();
    setAction('approve');

    try {
      const result = await approveLeasingCommercialTerms(
        supabase,
        opportunity.id,
        currentVersion.id,
      );

      await loadOpportunity();

      setNotice(
        `Commercial Version ${result.approved_version_number} approved. Lease preparation can now begin.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to approve commercial terms.',
      );
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!opportunity || !form) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <button
          type="button"
          onClick={() => router.push('/commercial-leasing')}
          className="mb-6 flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Commercial Leasing
        </button>

        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
          {error || 'Commercial opportunity could not be loaded.'}
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 pb-12 pt-8">
      <header>
        <button
          type="button"
          onClick={() => router.push('/commercial-leasing')}
          className="mb-5 flex items-center gap-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Commercial Leasing
        </button>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {opportunity.prospect_name || 'Unnamed Opportunity'}
              </h1>
              <StatusBadge status={opportunity.status} />
            </div>

            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {opportunity.opportunity_code}
              {selectedProperty
                ? ` · ${selectedProperty.property_name}`
                : ''}
              {selectedUnit
                ? ` · Unit ${selectedUnit.unit_number}`
                : ''}
            </p>
          </div>

          <div className="text-right text-xs text-[var(--text-muted)]">
            <p>Commercial authority</p>
            <p className="mt-1 font-medium text-[var(--text-secondary)]">
              {commerciallyApproved
                ? `Approved Version ${currentVersion?.version_number ?? '—'}`
                : awaitingApproval
                  ? `Version ${currentVersion?.version_number ?? '—'} awaiting approval`
                  : 'Working terms'}
            </p>
          </div>
        </div>
      </header>

      <AuthorityRail
        status={opportunity.status}
        hasVersion={Boolean(currentVersion)}
        approved={commerciallyApproved}
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {awaitingApproval && currentVersion ? (
        <ApprovalWorkspace
          version={currentVersion}
          approving={action === 'approve'}
          onApprove={approveTerms}
        />
      ) : (
        <form onSubmit={saveWorkingTerms} className="space-y-5">
          {!editable && commerciallyApproved && (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Approved commercial authority
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                  These working fields are read-only. Lease generation must
                  consume the approved immutable commercial version rather
                  than mutable screen values.
                </p>
              </div>
            </div>
          )}

          <Section
            icon={<Building2 className="h-4 w-4" />}
            title="Entity & Premises"
            description={
              editable
                ? 'Premises remain editable until commercial submission.'
                : 'Premises attached to the governed commercial record.'
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Property">
                <select
                  value={form.propertyId}
                  onChange={(event) =>
                    setField('propertyId', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable || loadingPremises}
                >
                  <option value="">
                    {loadingPremises
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
                  disabled={!editable || !form.propertyId}
                >
                  <option value="">Select unit</option>
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
            description="Proposed tenant and primary commercial contact."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Prospect / Company Name" required>
                <input
                  value={form.prospectName}
                  onChange={(event) =>
                    setField('prospectName', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
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
                  disabled={!editable}
                />
              </Field>

              <Field label="Company Registration">
                <input
                  value={form.companyRegistration}
                  onChange={(event) =>
                    setField('companyRegistration', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
                />
              </Field>

              <Field label="VAT Number">
                <input
                  value={form.vatNumber}
                  onChange={(event) =>
                    setField('vatNumber', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
                />
              </Field>

              <Field label="Contact Person">
                <input
                  value={form.contactPerson}
                  onChange={(event) =>
                    setField('contactPerson', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
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
                  disabled={!editable}
                />
              </Field>

              <Field label="Contact Phone">
                <input
                  value={form.contactPhone}
                  onChange={(event) =>
                    setField('contactPhone', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
                />
              </Field>
            </div>
          </Section>

          <Section
            icon={<CalendarDays className="h-4 w-4" />}
            title="Commercial Terms"
            description={
              editable
                ? 'Save working terms or submit them into immutable commercial approval.'
                : 'Commercial terms are governed by the approved immutable version.'
            }
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
                  disabled={!editable}
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
                  disabled={!editable}
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
                  disabled={!editable}
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
                  disabled={!editable}
                />
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
                  disabled={!editable}
                />
              </Field>

              <Field label="Storage">
                <input
                  value={form.storageAllocation}
                  onChange={(event) =>
                    setField('storageAllocation', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
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
                  disabled={!editable}
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
                  disabled={!editable}
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
                  disabled={!editable}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Negotiation Notes">
                <textarea
                  rows={4}
                  value={form.negotiationNotes}
                  onChange={(event) =>
                    setField('negotiationNotes', event.target.value)
                  }
                  className={inputClass}
                  disabled={!editable}
                />
              </Field>
            </div>
          </Section>

          {commerciallyApproved && currentVersion && (
            <ApprovedSummary version={currentVersion} />
          )}

          {editable && (
            <div className="flex flex-col justify-between gap-4 border-t border-[var(--border-default)] pt-5 sm:flex-row sm:items-center">
              <p className="max-w-xl text-xs leading-5 text-[var(--text-muted)]">
                Submission first saves these working terms, then creates an
                immutable commercial version. After submission, this screen
                becomes read-only until the governed approval decision.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={action !== null}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                >
                  {action === 'save' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>

                <button
                  type="button"
                  onClick={submitForApproval}
                  disabled={
                    action !== null || !form.prospectName.trim()
                  }
                  className="flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {action === 'submit' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit for Approval
                </button>
              </div>
            </div>
          )}

          {commerciallyApproved && (
            <div className="flex items-start justify-between gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Lease preparation
                  </h2>
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
                  Commercial authority is approved. The next governed action
                  is generation from an approved property template using this
                  immutable commercial version.
                </p>
              </div>

              <span className="shrink-0 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                Next checkpoint
              </span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function ApprovalWorkspace({
  version,
  approving,
  onApprove,
}: {
  version: CommercialVersion;
  approving: boolean;
  onApprove: () => void;
}) {
  const snapshot = version.snapshot || {};

  const rows = [
  ['Prospect', snapshot.prospectName || '—'],
  ['Monthly Rental', formatMoney(snapshot.monthlyRental)],
  ['Deposit', formatMoney(snapshot.depositAmount)],
  [
    'Escalation',
    snapshot.escalationPercent === null ||
    snapshot.escalationPercent === undefined
      ? '—'
      : `${snapshot.escalationPercent}%`,
  ],
  [
    'Lease Term',
    snapshot.leaseTermMonths === null ||
    snapshot.leaseTermMonths === undefined
      ? '—'
      : `${snapshot.leaseTermMonths} months`,
  ],
  ['Commencement', formatDate(snapshot.commencementDate)],
  ['Expiry', formatDate(snapshot.expiryDate)],
  [
    'Parking',
    snapshot.parkingBays === null ||
    snapshot.parkingBays === undefined
      ? '—'
      : String(snapshot.parkingBays),
  ],
  ['Storage', snapshot.storageAllocation || '—'],
];

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Commercial Approval
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Version {version.version_number} is immutable and awaiting an
            authorised approval decision. Working terms are locked.
          </p>
        </div>

        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          Awaiting approval
        </span>
      </div>

      <div className="grid gap-px bg-[var(--border-default)] sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, rowValue]) => (
          <div
            key={String(label)}
            className="bg-[var(--bg-secondary)] px-5 py-4"
          >
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              {String(label)}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {String(rowValue ?? '—')}
            </p>
          </div>
        ))}
      </div>

      {version.notes && (
        <div className="border-t border-[var(--border-default)] px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Submission notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
            {version.notes}
          </p>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 border-t border-[var(--border-default)] px-5 py-4 sm:flex-row sm:items-center">
        <p className="max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
          Approval applies to this exact immutable version. A stale or
          superseded commercial version cannot be approved by the canonical
          authority.
        </p>

        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {approving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Approve Terms
        </button>
      </div>
    </section>
  );
}

function ApprovedSummary({
  version,
}: {
  version: CommercialVersion;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Commercial Version {version.version_number} approved
        </p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
          This immutable version is now the commercial authority for lease
          generation.
        </p>
      </div>
    </div>
  );
}

function AuthorityRail({
  status,
  hasVersion,
  approved,
}: {
  status: string;
  hasVersion: boolean;
  approved: boolean;
}) {
  const steps = [
    {
      label: 'Working Terms',
      complete: hasVersion || approved,
      active: editableStatuses.has(status),
    },
    {
      label: 'Commercial Approval',
      complete: approved,
      active: status === 'internal_approval',
    },
    {
      label: 'Lease Preparation',
      complete: false,
      active: status === 'drafting' && approved,
    },
    {
      label: 'Execution',
      complete: false,
      active: [
        'sent_for_signature',
        'tenant_signed',
        'landlord_signed',
        'executed',
      ].includes(status),
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                step.complete
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : step.active
                    ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] text-[var(--text-muted)]',
              ].join(' ')}
            >
              {step.complete ? (
                <Check className="h-3.5 w-3.5" />
              ) : step.active ? (
                <Circle className="h-2.5 w-2.5 fill-current" />
              ) : (
                <span className="text-[10px]">{index + 1}</span>
              )}
            </div>

            <div>
              <p
                className={[
                  'text-xs font-medium',
                  step.active || step.complete
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
      {statusLabels[status] || status}
    </span>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
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
  children: ReactNode;
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
