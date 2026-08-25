'use client';

import { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc =
  `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

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

interface LeaseTemplateReviewWorkspaceProps {
  sourceDocumentUrl: string | null;
  sourceMimeType?: string | null;
  fields: FieldMapping[];
  suggestions: AISuggestion[];
}

export default function LeaseTemplateReviewWorkspace({
  sourceDocumentUrl,
  sourceMimeType,
  fields,
}: LeaseTemplateReviewWorkspaceProps) {
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(
    fields[0]?.key || null
  );
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
const [previewLoading, setPreviewLoading] = useState(false);
const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedField = useMemo(
    () =>
      fields.find(field => field.key === selectedFieldKey) || null,
    [fields, selectedFieldKey]
  );

  const selectedEvidence = selectedField?.evidence || [];
  useEffect(() => {
  if (
    !sourceDocumentUrl ||
    sourceMimeType?.includes('pdf')
  ) {
    return;
  }

  let cancelled = false;

  async function loadPreview() {
    try {
      setPreviewLoading(true);
      setPreviewError(null);

      if (!sourceDocumentUrl) {
  return;
}

      const response = await fetch(sourceDocumentUrl);

      if (!response.ok) {
        throw new Error('Unable to load the source document.');
      }

      const blob = await response.blob();

      const formData = new FormData();

      formData.append(
        'file',
        new File(
          [blob],
          'lease-template.docx',
          {
            type:
              sourceMimeType ||
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }
        )
      );

      const previewResponse = await fetch(
        '/api/lease-templates/preview',
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await previewResponse.json();

      if (!previewResponse.ok) {
        throw new Error(
          result?.error ||
            'Unable to render the Word document preview.'
        );
      }

      if (!cancelled) {
        setPreviewHtml(result.html || '');
      }
    } catch (error) {
      console.error(
        'Lease template preview failed:',
        error
      );

      if (!cancelled) {
        setPreviewError(
          error instanceof Error
            ? error.message
            : 'Unable to render the source document.'
        );
      }
    } finally {
      if (!cancelled) {
        setPreviewLoading(false);
      }
    }
  }

  loadPreview();

  return () => {
    cancelled = true;
  };
}, [sourceDocumentUrl, sourceMimeType]);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-black">
      <div className="grid min-h-[720px] grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        {/* Source document */}
        <div className="border-r border-white/[0.06]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="text-sm font-medium text-white">
                Source Document
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Select a field to inspect its source evidence.
              </p>
            </div>

            <span className="text-[11px] text-zinc-600">
              {sourceMimeType || 'Document'}
            </span>
          </div>

          <div className="flex h-[660px] items-center justify-center bg-zinc-950 p-4">
            {sourceDocumentUrl ? (
  sourceMimeType?.includes('pdf') ? (
    <Document
      file={sourceDocumentUrl}
      loading={
        <div className="text-sm text-zinc-500">
          Loading source document…
        </div>
      }
      error={
        <div className="text-sm text-red-400">
          Unable to render PDF document.
        </div>
      }
    >
      <div className="relative">
        <Page
          pageNumber={1}
          width={700}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />

        {selectedEvidence
          .filter(
            evidence =>
              evidence.page === undefined ||
              evidence.page === 1
          )
          .map((evidence, index) => {
            const box = evidence.boundingBox;

            if (!box) return null;

            return (
              <div
                key={`${evidence.text}-${index}`}
                className="pointer-events-none absolute rounded border-2 border-amber-400 bg-amber-400/20"
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                }}
              />
            );
          })}
      </div>
    </Document>
  ) : (
  <div className="h-full w-full overflow-y-auto rounded-lg border border-white/[0.06] bg-white">
    {previewLoading ? (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">
          Rendering source document…
        </p>
      </div>
    ) : previewError ? (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-red-400">
          {previewError}
        </p>
      </div>
    ) : previewHtml ? (
      <article
        className="prose prose-sm max-w-none p-10 text-black"
        dangerouslySetInnerHTML={{
          __html: previewHtml,
        }}
      />
    ) : (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">
          Source document preview unavailable.
        </p>
      </div>
    )}
  </div>
)
) : (
  <div className="text-center">
    <p className="text-sm text-zinc-500">
      Source document unavailable.
    </p>
  </div>
)}
          </div>
        </div>

        {/* Extraction review */}
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <p className="text-sm font-medium text-white">
              Extracted Fields
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Review each value against the source document.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {fields.map(field => {
              const selected = field.key === selectedFieldKey;
              const confidence = field.confidence ?? 0;

              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => setSelectedFieldKey(field.key)}
                  className={`block w-full border-b border-white/[0.05] px-5 py-4 text-left transition ${
                    selected
                      ? 'bg-white/[0.05]'
                      : 'hover:bg-white/[0.025]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        {field.label}
                      </p>

                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {formatFieldValue(field.value)}
                      </p>
                    </div>

                    <ConfidenceBadge confidence={confidence} />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-700">
                      {field.key}
                    </span>

                    {field.approved ? (
                      <span className="text-[10px] text-emerald-400">
                        Confirmed
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600">
                        Review required
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Evidence */}
          <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">
              Source Evidence
            </p>

            {selectedEvidence.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedEvidence.map((evidence, index) => (
                  <div
                    key={`${evidence.text}-${index}`}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <p className="text-sm leading-5 text-zinc-300">
                      “{evidence.text}”
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-600">
                      {evidence.page && (
                        <span>Page {evidence.page}</span>
                      )}

                      {evidence.boundingBox && (
                        <span>Positional evidence available</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-zinc-600">
                No positional source evidence is available for this
                field.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: number;
}) {
  const className =
    confidence >= 90
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
      : confidence >= 70
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-400'
        : 'border-red-400/20 bg-red-400/10 text-red-400';

  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-1 text-[10px] ${className}`}
    >
      {confidence}%
    </span>
  );
}

function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'No value detected';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}