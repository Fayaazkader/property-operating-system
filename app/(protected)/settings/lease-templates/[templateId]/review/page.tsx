import {
  notFound,
  redirect,
} from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { leaseTemplateService } from '@/lib/lease/templates/service';
import LeaseTemplateReviewWorkspace from '@/app/components/lease-templates/LeaseTemplateReviewWorkspace';
import LeaseTemplateReviewActions from '@/app/components/lease-templates/LeaseTemplateReviewActions';
import {
  isCanonicalLeaseFieldKey,
} from '@/lib/lease/templates/field-registry';

import type {
  LeaseTemplateAISuggestion,
  LeaseTemplateFieldMapping,
} from '@/lib/lease/templates/types';

interface PageProps {
  params: Promise<{
    templateId: string;
  }>;
}

export default async function LeaseTemplateReviewPage({
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
   * This page still uses the existing server-side active-entity
   * resolution contract.
   *
   * The mapping API does not infer an entity this way: it receives the
   * explicit entityId and verifies user_entity_access before mutation.
   *
   * Active-company/entity resolution across the wider platform remains
   * a separate architecture item to standardise.
   */
  const { data: entities, error: entityError } =
    await supabase.rpc('auth_entities');

  if (entityError) {
    console.error(
      '[LEASE REVIEW] Unable to resolve authorised entities:',
      entityError
    );
    notFound();
  }

  const entityId = entities?.[0];

  if (!entityId) {
    notFound();
  }

  const template =
    await leaseTemplateService.getForReview(
      templateId,
      entityId,
      supabase
    );

    if (!template) {
    notFound();
  }

  /*
   * Approved templates are immutable from the review workspace.
   * Their canonical route is the read-only template detail page.
   */
  if (
    template.status === 'active' &&
    template.review_status === 'approved'
  ) {
    redirect(
      `/settings/lease-templates/${templateId}`
    );
  }

  let sourceDocumentUrl: string | null = null;

  if (template.source_document_url) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(
        template.source_document_url,
        3600
      );

    if (error) {
      console.error(
        '[LEASE REVIEW] Failed to create source document URL:',
        error
      );
    } else {
      sourceDocumentUrl =
        data?.signedUrl || null;
    }
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

  const suggestedMappings =
    mappings.filter(
      mapping =>
        mapping.status === 'suggested'
    );

  const rejectedMappings =
    mappings.filter(
      mapping =>
        mapping.status === 'rejected'
    );

  const unresolvedMappings =
    mappings.filter(
      mapping =>
        mapping.status === 'unresolved' ||
        !mapping.target
    );

  /*
   * Approval requires every mapping to have reached an explicit
   * terminal human-review state.
   *
   * This also catches malformed or legacy mapping states rather than
   * allowing the UI to appear approval-ready while the database will
   * correctly reject the transaction.
   */
  const unreviewedMappings =
    mappings.filter(
      mapping =>
        mapping.status !== 'confirmed' &&
        mapping.status !== 'rejected'
    );

  /*
   * Suggested and unresolved mappings already have their own user-facing
   * review messages. This collection isolates only malformed or unknown
   * review states so those mappings are not silently overlooked.
   */
  const unknownStatusMappings =
    unreviewedMappings.filter(
      mapping =>
        mapping.status !== 'suggested' &&
        mapping.status !== 'unresolved'
    );

  /*
   * Confirmed mappings must remain structurally reusable:
   *   - canonical AssetFlow field;
   *   - object target;
   *   - non-empty targetId.
   *
   * The approval RPC independently enforces the same invariant.
   */
  const invalidConfirmedMappings =
    confirmedMappings.filter(
      mapping =>
        !isCanonicalLeaseFieldKey(
          mapping.fieldKey
        ) ||
        !mapping.target ||
        typeof mapping.target !== 'object' ||
        typeof mapping.target.targetId !==
          'string' ||
        mapping.target.targetId.trim().length === 0
    );

  /*
   * A target-bearing suggestion represents reusable document structure
   * that has been discovered but has not yet been assigned to a
   * canonical AssetFlow field.
   *
   * General analyser warnings without targets remain review context but
   * do not count as unresolved document targets.
   */
  const unresolvedTargetSuggestions =
    suggestions.filter(
      suggestion =>
        Boolean(
          suggestion.target &&
            typeof suggestion.target.targetId ===
              'string' &&
            suggestion.target.targetId.trim().length > 0
        )
    );

  const blockingSuggestions =
    suggestions.filter(
      suggestion =>
        suggestion.severity === 'critical'
    );

  const reviewRequiredCount =
    suggestedMappings.length +
    unresolvedMappings.length +
    unresolvedTargetSuggestions.length;

  /*
   * Client-facing approval readiness mirrors the database governance
   * invariants so the UI does not offer an approval action that is
   * already known to be invalid.
   *
   * The database RPC remains authoritative and re-validates every
   * invariant inside the locked approval transaction.
   */
  const hasSourceDocument =
    Boolean(template.source_document_id);

  const canApprove =
    hasSourceDocument &&
    confirmedMappings.length > 0 &&
    suggestedMappings.length === 0 &&
    unresolvedMappings.length === 0 &&
    unreviewedMappings.length === 0 &&
    invalidConfirmedMappings.length === 0 &&
    unresolvedTargetSuggestions.length === 0 &&
    blockingSuggestions.length === 0;

  const approvalBlockedReasons: string[] = [];

  if (!hasSourceDocument) {
    approvalBlockedReasons.push(
      'A source document is required.'
    );
  }

  if (confirmedMappings.length === 0) {
    approvalBlockedReasons.push(
      'At least one reusable mapping must be confirmed.'
    );
  }

  if (suggestedMappings.length > 0) {
    approvalBlockedReasons.push(
      `${suggestedMappings.length} suggested ${
        suggestedMappings.length === 1
          ? 'mapping requires'
          : 'mappings require'
      } review.`
    );
  }

  if (unresolvedMappings.length > 0) {
    approvalBlockedReasons.push(
      `${unresolvedMappings.length} ${
        unresolvedMappings.length === 1
          ? 'mapping is'
          : 'mappings are'
      } unresolved.`
    );
  }

  if (unknownStatusMappings.length > 0) {
    approvalBlockedReasons.push(
      `${unknownStatusMappings.length} ${
        unknownStatusMappings.length === 1
          ? 'mapping has'
          : 'mappings have'
      } an invalid review state.`
    );
  }

  if (invalidConfirmedMappings.length > 0) {
    approvalBlockedReasons.push(
      `${invalidConfirmedMappings.length} confirmed ${
        invalidConfirmedMappings.length === 1
          ? 'mapping has'
          : 'mappings have'
      } an invalid canonical field or document target.`
    );
  }

  if (unresolvedTargetSuggestions.length > 0) {
    approvalBlockedReasons.push(
      `${unresolvedTargetSuggestions.length} document ${
        unresolvedTargetSuggestions.length === 1
          ? 'target still requires'
          : 'targets still require'
      } assignment.`
    );
  }

  if (blockingSuggestions.length > 0) {
    approvalBlockedReasons.push(
      `${blockingSuggestions.length} critical ${
        blockingSuggestions.length === 1
          ? 'finding must'
          : 'findings must'
      } be resolved.`
    );
  }

   const approvalBlockedReason =
    approvalBlockedReasons.length > 0
      ? approvalBlockedReasons.join(' ')
      : null;

  const averageDetectionConfidence =
    calculateAverageConfidence(
      mappings,
      'detection'
    );

  const averageMappingConfidence =
    calculateAverageConfidence(
      mappings,
      'mapping'
    );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-light text-white">
              Review Lease Template
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              {template.template_name} · v
              {template.version}
            </p>
          </div>

          <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-400">
            In Review
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
          AssetFlow has analysed the source
          document and proposed reusable mappings
          between locations in the customer&apos;s
          lease template and canonical AssetFlow
          lease fields. Nothing has been approved
          automatically.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Mappings Detected"
          value={String(mappings.length)}
        />

        <SummaryCard
          label="Confirmed"
          value={String(
            confirmedMappings.length
          )}
        />

        <SummaryCard
          label="Review Required"
          value={String(
            reviewRequiredCount
          )}
        />

        <SummaryCard
          label="Unresolved Targets"
          value={String(
            unresolvedTargetSuggestions.length +
              unresolvedMappings.length
          )}
        />
      </div>

      {/* Mapping state */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Mapping Status
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            Review state for reusable document
            mappings. Template approval remains a
            separate governance step.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 px-6 py-5 lg:grid-cols-4">
          <MetaItem
            label="Suggested"
            value={String(
              suggestedMappings.length
            )}
          />

          <MetaItem
            label="Confirmed"
            value={String(
              confirmedMappings.length
            )}
          />

          <MetaItem
            label="Rejected"
            value={String(
              rejectedMappings.length
            )}
          />

          <MetaItem
            label="Critical Findings"
            value={String(
              blockingSuggestions.length
            )}
          />
        </div>
      </section>

      {/* Confidence */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Analysis Confidence
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            Confidence is shown by analysis
            dimension rather than as a single
            template-wide score.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 px-6 py-5">
          <MetaItem
            label="Target Detection"
            value={
              averageDetectionConfidence === null
                ? 'Not available'
                : `${averageDetectionConfidence}%`
            }
          />

          <MetaItem
            label="Semantic Mapping"
            value={
              averageMappingConfidence === null
                ? 'Not available'
                : `${averageMappingConfidence}%`
            }
          />
        </div>
      </section>

      {/* Document context */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Source Document
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            The original legal document remains
            preserved and is not modified during
            review.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 px-6 py-5 md:grid-cols-3">
          <MetaItem
            label="File"
            value={
              template.source_file_name ||
              'Not available'
            }
          />

          <MetaItem
            label="Document Type"
            value={
              template.source_mime_type ||
              'Unknown'
            }
          />

          <MetaItem
            label="Review Status"
            value="Human review required"
          />
        </div>
      </section>

      <LeaseTemplateReviewWorkspace
        templateId={templateId}
        entityId={entityId}
        sourceDocumentUrl={
          sourceDocumentUrl
        }
        sourceMimeType={
          template.source_mime_type
        }
        fields={mappings}
        suggestions={suggestions}
      />

      {/* Analysis suggestions */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Analysis Findings
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            Findings may include unresolved
            document targets, warnings and other
            analyser observations. They are not
            approved mappings.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="px-6 py-10">
            <p className="text-sm text-zinc-500">
              No additional findings were
              generated.
            </p>
          </div>
        ) : (
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
                  <div className="flex items-start gap-4">
                    <SuggestionBadge
                      severity={
                        suggestion.severity
                      }
                    />

                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">
                        {suggestion.title}
                      </p>

                      <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
                        {
                          suggestion.description
                        }
                      </p>

                      {suggestion.target && (
                        <p className="mt-2 break-all text-xs text-zinc-600">
                          Target:{' '}
                          {
                            suggestion.target
                              .targetId
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* Governance notice */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Governance
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          Mapping review does not alter the
          customer&apos;s original legal document.
          Suggested mappings and unresolved targets
          remain provisional until reviewed by an
          authorised user. Template-level approval
          is a separate governance decision and
          must not manufacture or infer missing
          mappings.
        </p>
      </section>

      <LeaseTemplateReviewActions
  templateId={templateId}
  entityId={entityId}
  canApprove={canApprove}
  approvalBlockedReason={
    approvalBlockedReason
  }
/>
    </div>
  );
}

function calculateAverageConfidence(
  mappings: LeaseTemplateFieldMapping[],
  dimension: 'detection' | 'mapping'
): number | null {
  const values = mappings
    .map(
      mapping =>
        mapping.confidence?.[dimension]
    )
    .filter(
      (value): value is number =>
        typeof value === 'number'
    );

  if (values.length === 0) {
    return null;
  }

  return Math.round(
    values.reduce(
      (total, value) =>
        total + value,
      0
    ) / values.length
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-5 py-4">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-xl font-light text-white">
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

      <p className="mt-1 truncate text-sm text-zinc-300">
        {value}
      </p>
    </div>
  );
}

function SuggestionBadge({
  severity,
}: {
  severity: LeaseTemplateAISuggestion['severity'];
}) {
  const label =
    severity === 'critical'
      ? 'Critical'
      : severity === 'warning'
        ? 'Review'
        : 'Info';

  return (
    <span className="shrink-0 rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-500">
      {label}
    </span>
  );
}