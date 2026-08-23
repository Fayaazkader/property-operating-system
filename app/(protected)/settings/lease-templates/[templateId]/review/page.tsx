import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { leaseTemplateService } from '@/lib/lease/templates/service';
import LeaseTemplateReviewWorkspace from '@/app/components/lease-templates/LeaseTemplateReviewWorkspace';

interface PageProps {
  params: Promise<{
    templateId: string;
  }>;
}

interface FieldEvidence {
  text: string;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface FieldMapping {
  key: string;
  label: string;
  type: string;
  required: boolean;
  value?: unknown;
  confidence?: number;
  source?: string;
  evidence?: FieldEvidence[];
  approved?: boolean;
}

interface AISuggestion {
  type: 'field' | 'clause' | 'inconsistency' | 'warning';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export default async function LeaseTemplateReviewPage({
  params,
}: PageProps) {
  const { templateId } = await params;

  console.log('[LEASE REVIEW] templateId:', templateId);
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({
              name,
              value,
              ...options,
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log(
    '[LEASE REVIEW] server user:',
    user?.id || 'NO USER'
  );

  if (!user) {
    console.error('[LEASE REVIEW] No authenticated server user');
    notFound();
  }

  const { data: entities } = await supabase.rpc('auth_entities');
  console.log('[LEASE REVIEW] entities:', entities);
console.log('[LEASE REVIEW] entityId:', entities?.[0] || 'NO ENTITY');
  const entityId = entities?.[0];

  if (!entityId) {
    notFound();
  }
console.log('[LEASE REVIEW] querying template:', {
  templateId,
  entityId,
});
  const template = await leaseTemplateService.getForReview(
  templateId,
  entityId,
  supabase
);
console.log('[LEASE REVIEW] template result:', template);

if (!template) {
  console.error('[LEASE REVIEW] TEMPLATE NOT FOUND');
}

  if (!template) {
    notFound();
  }
    let sourceDocumentUrl: string | null = null;

  if (template.source_document_url) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(template.source_document_url, 3600);

    if (error) {
      console.error(
        '[LEASE REVIEW] Failed to create source document URL:',
        error
      );
    } else {
      sourceDocumentUrl = data?.signedUrl || null;
      console.log(
  '[LEASE REVIEW] source document URL:',
  sourceDocumentUrl
);
    }
  }

  console.log(
    '[LEASE REVIEW] source document available:',
    Boolean(sourceDocumentUrl)
  );

  const fields = Array.isArray(template.field_mapping)
    ? (template.field_mapping as FieldMapping[])
    : [];

  const suggestions = Array.isArray(template.ai_suggestions)
    ? (template.ai_suggestions as AISuggestion[])
    : [];

  const detectedFields = fields.filter(
    field =>
      field.value !== undefined &&
      field.value !== null &&
      field.value !== ''
  );

  const missingRequired = fields.filter(
    field =>
      field.required &&
      (field.value === undefined ||
        field.value === null ||
        field.value === '')
  );

  const overallConfidence =
    fields.length > 0
      ? Math.round(
          fields.reduce(
            (total, field) => total + (field.confidence || 0),
            0
          ) / fields.length
        )
      : 0;

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
              {template.template_name} · v{template.version}
            </p>
          </div>

          <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-400">
            In Review
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
          AssetFlow has analysed the source document and identified
          candidate fields and review suggestions. Nothing has been
          approved automatically.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Fields Detected"
          value={String(detectedFields.length)}
        />

        <SummaryCard
          label="Fields Analysed"
          value={String(fields.length)}
        />

        <SummaryCard
          label="Suggestions"
          value={String(suggestions.length)}
        />

        <SummaryCard
          label="Confidence"
          value={`${overallConfidence}%`}
        />
      </div>

      {/* Document context */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Source Document
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            The original legal document remains preserved.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 px-6 py-5">
          <MetaItem
            label="File"
            value={template.source_file_name || 'Not available'}
          />

          <MetaItem
            label="Document Type"
            value={template.source_mime_type || 'Unknown'}
          />

          <MetaItem
            label="Review Status"
            value="Human review required"
          />
        </div>
      </section>

      <LeaseTemplateReviewWorkspace
  sourceDocumentUrl={sourceDocumentUrl}
  sourceMimeType={template.source_mime_type}
  fields={fields}
  suggestions={suggestions}
/>

      {/* Missing required fields */}
      {missingRequired.length > 0 && (
        <section className="rounded-xl border border-red-400/15 bg-red-400/[0.03]">
          <div className="px-6 py-5">
            <h2 className="text-sm font-medium text-red-300">
              Required Fields Requiring Review
            </h2>

            <p className="mt-1 text-xs text-red-300/60">
              AssetFlow could not confidently identify values for
              these required fields.
            </p>
          </div>

          <div className="border-t border-red-400/10 divide-y divide-red-400/10">
            {missingRequired.map(field => (
              <div
                key={field.key}
                className="px-6 py-4"
              >
                <p className="text-sm text-zinc-300">
                  {field.label}
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  {field.key}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI suggestions */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-medium text-white">
            Analysis Suggestions
          </h2>

          <p className="mt-1 text-xs text-zinc-500">
            These are recommendations only. AssetFlow does not make
            legal decisions.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="px-6 py-10">
            <p className="text-sm text-zinc-500">
              No additional suggestions were generated.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${index}`}
                className="px-6 py-5"
              >
                <div className="flex items-start gap-4">
                  <SuggestionBadge
                    severity={suggestion.severity}
                  />

                  <div>
                    <p className="text-sm text-zinc-200">
                      {suggestion.title}
                    </p>

                    <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Governance notice */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Governance
        </p>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          This review does not alter the original legal document.
          Extracted values and suggestions remain provisional until
          reviewed and approved by an authorised user.
        </p>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-6">
        <button
          type="button"
          className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
        >
          Back
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-lg border border-red-400/20 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-400/[0.05]"
          >
            Reject
          </button>

          <button
            type="button"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Approve Template
          </button>
        </div>
      </div>
    </div>
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
  severity: AISuggestion['severity'];
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

function formatFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}