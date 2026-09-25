import Link from 'next/link';
import {
  notFound,
  redirect,
} from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import type {
  LeaseTemplateAISuggestion,
  LeaseTemplateFieldMapping,
} from '@/lib/lease/templates/types';

interface PageProps {
  params: Promise<{
    templateId: string;
  }>;
}

export default async function LeaseTemplatePage({
  params,
}: PageProps) {
  const { templateId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  /*
   * This follows the existing lease-template entity-resolution contract.
   * Active entity resolution should be standardised across AssetFlow
   * separately from this lifecycle fix.
   */
  const {
    data: entities,
    error: entityError,
  } = await supabase.rpc('auth_entities');

  if (entityError) {
    console.error(
      '[LEASE TEMPLATE] Unable to resolve authorised entities:',
      entityError
    );

    notFound();
  }

  const entityId = entities?.[0];

  if (!entityId) {
    notFound();
  }

  const {
    data: template,
    error: templateError,
  } = await supabase
    .from('lease_templates')
    .select('*')
    .eq('id', templateId)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (templateError) {
    console.error(
      '[LEASE TEMPLATE] Unable to load template:',
      templateError
    );

    notFound();
  }

  if (!template) {
    notFound();
  }

  /*
   * Draft/in-review templates belong in the governed review workflow.
   * Approved templates remain on this route as read-only records.
   */
  if (
    template.status !== 'active' ||
    template.review_status !== 'approved'
  ) {
    redirect(
      `/settings/lease-templates/${templateId}/review`
    );
  }

  const mappings: LeaseTemplateFieldMapping[] =
    Array.isArray(template.field_mapping)
      ? template.field_mapping
      : [];

  const suggestions: LeaseTemplateAISuggestion[] =
    Array.isArray(template.ai_suggestions)
      ? template.ai_suggestions
      : [];

  const confirmedMappings =
    mappings.filter(
      mapping =>
        mapping.status === 'confirmed'
    );

  const rejectedMappings =
    mappings.filter(
      mapping =>
        mapping.status === 'rejected'
    );

  const approvedMappings =
    confirmedMappings.filter(
      mapping =>
        mapping.approved === true
    );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-light text-white">
            Lease Template
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            {template.template_name} · v
            {template.version}
          </p>
        </div>

        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-400">
          Active
        </div>
      </div>

      <p className="max-w-3xl text-sm leading-6 text-zinc-400">
        This lease template has completed human review
        and is approved for reuse. The customer&apos;s
        original legal document remains preserved.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Mappings"
          value={String(mappings.length)}
        />

        <SummaryCard
          label="Approved"
          value={String(
            approvedMappings.length
          )}
        />

        <SummaryCard
          label="Rejected"
          value={String(
            rejectedMappings.length
          )}
        />

        <SummaryCard
          label="Version"
          value={`v${template.version}`}
        />
      </div>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Template Governance
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            Approval and source-document information
            for this reusable lease template.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 px-6 py-5 md:grid-cols-2 lg:grid-cols-4">
          <MetaItem
            label="Status"
            value="Active"
          />

          <MetaItem
            label="Review Status"
            value="Approved"
          />

          <MetaItem
            label="Approved At"
            value={
              template.reviewed_at
                ? formatDateTime(
                    template.reviewed_at
                  )
                : 'Not available'
            }
          />

          <MetaItem
            label="Source File"
            value={
              template.source_file_name ||
              'Not available'
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Approved Reusable Mappings
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            Confirmed mappings approved for this
            template version. This view is read-only.
          </p>
        </div>

        {approvedMappings.length === 0 ? (
          <div className="px-6 py-10">
            <p className="text-sm text-zinc-500">
              No approved reusable mappings were found.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {approvedMappings.map(mapping => (
              <div
                key={mapping.id}
                className="flex items-start justify-between gap-6 px-6 py-5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">
                    {mapping.label}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {mapping.fieldKey}
                  </p>

                  <p className="mt-2 break-all text-xs text-zinc-600">
                    {describeTarget(mapping)}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-emerald-400">
                  Approved
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {rejectedMappings.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
          <div className="border-b border-white/[0.06] px-6 py-5">
            <h2 className="text-sm font-medium text-white">
              Rejected Mappings
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Document targets explicitly rejected
              during human review. They are not approved
              for population.
            </p>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {rejectedMappings.map(mapping => (
              <div
                key={mapping.id}
                className="flex items-start justify-between gap-6 px-6 py-5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-300">
                    {mapping.label}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {mapping.fieldKey}
                  </p>

                  <p className="mt-2 break-all text-xs text-zinc-600">
                    {describeTarget(mapping)}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
                  Rejected
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
          <div className="border-b border-white/[0.06] px-6 py-5">
            <h2 className="text-sm font-medium text-white">
              Analysis Record
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Non-blocking analysis findings retained
              with this approved template version.
            </p>
          </div>

          <div className="divide-y divide-white/[0.05]">
            {suggestions.map(
              (suggestion, index) => (
                <div
                  key={
                    suggestion.id ||
                    `${suggestion.type}-${index}`
                  }
                  className="px-6 py-5"
                >
                  <p className="text-sm text-zinc-300">
                    {suggestion.title}
                  </p>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
                    {suggestion.description}
                  </p>
                </div>
              )
            )}
          </div>
        </section>
      )}

      <div>
        <Link
          href="/settings/lease-templates"
          className="inline-flex rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs text-zinc-300 transition hover:bg-white/[0.04]"
        >
          Back to Lease Templates
        </Link>
      </div>
    </div>
  );
}

function describeTarget(
  mapping: LeaseTemplateFieldMapping
): string {
  if (!mapping.target) {
    return 'Document target unavailable';
  }

  const token =
    mapping.target.token ||
    mapping.target.sourceText ||
    mapping.target.targetId;

  return `${mapping.target.kind} · ${token}`;
}

function formatDateTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(date);
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-6 py-5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-3 text-xl font-light text-white">
        {value}
      </p>
    </div>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>

      <p className="mt-2 break-words text-sm text-zinc-300">
        {value}
      </p>
    </div>
  );
}