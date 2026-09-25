'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  Document,
  Page,
  pdfjs,
} from 'react-pdf';

import { createClient } from '@/lib/supabase/client';

import {
  LEASE_FIELD_DEFINITIONS,
} from '@/lib/lease/templates/field-registry';

import type {
  LeaseTemplateAISuggestion,
  LeaseTemplateDocumentTarget,
  LeaseTemplateFieldEvidence,
  LeaseTemplateFieldMapping,
} from '@/lib/lease/templates/types';

pdfjs.GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';

interface LeaseTemplateReviewWorkspaceProps {
  templateId: string;
  entityId: string;
  sourceDocumentUrl: string | null;
  sourceMimeType?: string | null;
  fields: LeaseTemplateFieldMapping[];
  suggestions: LeaseTemplateAISuggestion[];
}

type MappingAction =
  | 'confirm'
  | 'correct'
  | 'reject'
  | 'assign';

interface MappingReviewResponse {
  success?: boolean;
  error?: string;
  auditRecorded?: boolean;
  field_mapping?: LeaseTemplateFieldMapping[];
  ai_suggestions?: LeaseTemplateAISuggestion[];
}

export default function LeaseTemplateReviewWorkspace({
  templateId,
  entityId,
  sourceDocumentUrl,
  sourceMimeType,
  fields,
  suggestions,
}: LeaseTemplateReviewWorkspaceProps) {
  const router = useRouter();
  const [mappings, setMappings] =
    useState<LeaseTemplateFieldMapping[]>(
      fields
    );

  const [reviewSuggestions, setReviewSuggestions] =
    useState<LeaseTemplateAISuggestion[]>(
      suggestions
    );

  const [selectedMappingId, setSelectedMappingId] =
    useState<string | null>(
      fields[0]?.id || null
    );

  const [
    selectedSuggestionId,
    setSelectedSuggestionId,
  ] = useState<string | null>(null);

  const [
    selectedFieldKey,
    setSelectedFieldKey,
  ] = useState<string>('');

  const [previewHtml, setPreviewHtml] =
    useState<string | null>(null);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [previewError, setPreviewError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [actionNotice, setActionNotice] =
    useState<string | null>(null);

  const [savingAction, setSavingAction] =
    useState<MappingAction | null>(null);

  useEffect(() => {
    setMappings(fields);
  }, [fields]);

  useEffect(() => {
    setReviewSuggestions(suggestions);
  }, [suggestions]);

  const selectedMapping = useMemo(
    () =>
      mappings.find(
        mapping =>
          mapping.id === selectedMappingId
      ) || null,
    [mappings, selectedMappingId]
  );

  const unresolvedSuggestions = useMemo(
    () =>
      reviewSuggestions.filter(
        suggestion =>
          Boolean(
            suggestion.id &&
              suggestion.target
          )
      ),
    [reviewSuggestions]
  );

  const selectedSuggestion = useMemo(
    () =>
      unresolvedSuggestions.find(
        suggestion =>
          suggestion.id ===
          selectedSuggestionId
      ) || null,
    [
      unresolvedSuggestions,
      selectedSuggestionId,
    ]
  );

  const selectedTarget =
    selectedMapping?.target ||
    selectedSuggestion?.target;

  const selectedEvidence =
    selectedMapping?.evidence ||
    selectedSuggestion?.evidence ||
    [];

  const isPdf =
    sourceMimeType === 'application/pdf';

  useEffect(() => {
   if (
  !sourceDocumentUrl ||
  isPdf
) {
  setPreviewHtml(null);
  setPreviewError(null);
  return;
}

/*
 * Capture the narrowed URL for the asynchronous preview operation.
 * React props may change between renders, so the effect works with
 * the source URL belonging to this specific execution.
 */
const previewSourceUrl = sourceDocumentUrl;

let cancelled = false;

async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const response =
  await fetch(previewSourceUrl);

        if (!response.ok) {
          throw new Error(
            'Unable to load the source document.'
          );
        }

        const blob = await response.blob();

        const fileName =
          sourceMimeType?.includes(
            'wordprocessingml'
          )
            ? 'lease-template.docx'
            : 'lease-template.doc';

        const file = new File(
          [blob],
          fileName,
          {
            type:
              sourceMimeType ||
              blob.type,
          }
        );

        const formData =
          new FormData();

        formData.append('file', file);

        const previewResponse =
          await fetch(
            '/api/lease-templates/preview',
            {
              method: 'POST',
              body: formData,
            }
          );

        const payload =
          (await previewResponse.json()) as {
            html?: string;
            error?: string;
          };

        if (!previewResponse.ok) {
          throw new Error(
            payload.error ||
              'Unable to create document preview.'
          );
        }

        if (!cancelled) {
          setPreviewHtml(
            payload.html || ''
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Unable to preview the source document.'
          );
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [
    sourceDocumentUrl,
    sourceMimeType,
    isPdf,
  ]);

  async function reviewMapping(
    action: MappingAction,
    options?: {
      mappingId?: string;
      suggestionId?: string;
      fieldKey?: string;
    }
  ) {
    setSavingAction(action);
    setActionError(null);
    setActionNotice(null);

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken =
        session?.access_token;

      if (!accessToken) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const response = await fetch(
        `/api/lease-templates/${templateId}/mappings`,
        {
          method: 'PATCH',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            entityId,
            action,
            ...options,
          }),
        }
      );

            const payload =
        (await response.json()) as MappingReviewResponse;

      if (!response.ok) {
        throw new Error(
          payload.error ||
            'Unable to save mapping review.'
        );
      }

      if (
        payload.success !== true ||
        !Array.isArray(
          payload.field_mapping
        ) ||
        !Array.isArray(
          payload.ai_suggestions
        )
      ) {
        throw new Error(
          'The server did not return the authoritative mapping state.'
        );
      }

      /*
       * These arrays are the state produced by the locked database
       * transaction. Do not reconstruct the mutation client-side.
       */
      applyReturnedState(payload);

      /*
       * Mapping state also drives server-rendered summary counts and
       * template approval readiness. Refresh the server component tree
       * after local state has accepted the authoritative transaction
       * result.
       */
      router.refresh();

      if (action === 'confirm') {
        setActionNotice(
          'Mapping confirmed.'
        );
      }

      if (action === 'correct') {
        setActionNotice(
          'Mapping corrected and confirmed.'
        );
      }

      if (action === 'reject') {
        setActionNotice(
          'Mapping rejected.'
        );
      }

      if (action === 'assign') {
        setActionNotice(
          'Target assigned and confirmed.'
        );

        setSelectedSuggestionId(null);
      }

      setSelectedFieldKey('');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to save mapping review.'
      );
    } finally {
      setSavingAction(null);
    }
  }

    function applyReturnedState(
    payload: MappingReviewResponse
  ) {
    if (
      Array.isArray(
        payload.field_mapping
      )
    ) {
      setMappings(
        payload.field_mapping
      );
    }

    if (
      Array.isArray(
        payload.ai_suggestions
      )
    ) {
      setReviewSuggestions(
        payload.ai_suggestions
      );
    }
  }

  function selectMapping(
    mapping: LeaseTemplateFieldMapping
  ) {
    setSelectedMappingId(mapping.id);
    setSelectedSuggestionId(null);
    setSelectedFieldKey(
      mapping.fieldKey
    );
    setActionError(null);
    setActionNotice(null);
  }

  function selectSuggestion(
    suggestion: LeaseTemplateAISuggestion
  ) {
    if (!suggestion.id) {
      return;
    }

    setSelectedSuggestionId(
      suggestion.id
    );
    setSelectedMappingId(null);
    setSelectedFieldKey('');
    setActionError(null);
    setActionNotice(null);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.01]">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <h2 className="text-sm font-medium text-white">
          Mapping Review Workspace
        </h2>

        <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
          Review the exact location AssetFlow
          detected in the customer&apos;s document,
          then confirm, correct or reject its
          semantic mapping. Unresolved targets can
          be assigned manually.
        </p>
      </div>

      {actionError && (
        <div className="border-b border-red-400/10 bg-red-400/[0.04] px-6 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {actionNotice && (
        <div className="border-b border-emerald-400/10 bg-emerald-400/[0.04] px-6 py-3 text-sm text-emerald-300">
          {actionNotice}
        </div>
      )}

      <div className="grid min-h-[680px] grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
        {/* Source document */}
        <div className="border-b border-white/[0.06] xl:border-b-0 xl:border-r">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Source Document
            </p>
          </div>

          <div className="min-h-[620px] overflow-auto bg-zinc-950/40 p-5">
            {!sourceDocumentUrl && (
              <EmptyState text="Source document preview is unavailable." />
            )}

            {sourceDocumentUrl &&
              isPdf && (
                <PdfPreview
                  sourceDocumentUrl={
                    sourceDocumentUrl
                  }
                  evidence={
                    selectedEvidence
                  }
                  target={
                    selectedTarget
                  }
                />
              )}

            {sourceDocumentUrl &&
              !isPdf &&
              previewLoading && (
                <EmptyState text="Preparing document preview…" />
              )}

            {sourceDocumentUrl &&
              !isPdf &&
              previewError && (
                <EmptyState
                  text={previewError}
                />
              )}

            {sourceDocumentUrl &&
              !isPdf &&
              !previewLoading &&
              !previewError &&
              previewHtml !== null && (
                <div
                  className="min-h-[580px] rounded-lg bg-white p-8 text-sm text-zinc-900"
                  dangerouslySetInnerHTML={{
                    __html: previewHtml,
                  }}
                />
              )}
          </div>
        </div>

        {/* Mapping review */}
        <div className="min-w-0">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Reusable Mappings
            </p>
          </div>

          <div className="max-h-[320px] overflow-auto border-b border-white/[0.06]">
            {mappings.length === 0 ? (
              <EmptyState text="No semantic mappings have been proposed yet." />
            ) : (
              mappings.map(mapping => (
                <button
                  key={mapping.id}
                  type="button"
                  onClick={() =>
                    selectMapping(mapping)
                  }
                  className={`block w-full border-b border-white/[0.04] px-5 py-4 text-left transition ${
                    selectedMappingId ===
                    mapping.id
                      ? 'bg-white/[0.05]'
                      : 'hover:bg-white/[0.025]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">
                        {mapping.label}
                      </p>

                      <p className="mt-1 truncate text-xs text-zinc-600">
                        {mapping.fieldKey}
                      </p>
                    </div>

                    <MappingStatusBadge
                      status={
                        mapping.status
                      }
                    />
                  </div>

                  <p className="mt-2 truncate text-xs text-zinc-500">
                    {formatTarget(
                      mapping.target
                    )}
                  </p>
                </button>
              ))
            )}
          </div>

          {unresolvedSuggestions.length >
            0 && (
            <>
              <div className="border-b border-white/[0.06] px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Unresolved Targets
                </p>
              </div>

              <div className="max-h-[220px] overflow-auto border-b border-white/[0.06]">
                {unresolvedSuggestions.map(
                  suggestion => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() =>
                        selectSuggestion(
                          suggestion
                        )
                      }
                      className={`block w-full border-b border-white/[0.04] px-5 py-4 text-left transition ${
                        selectedSuggestionId ===
                        suggestion.id
                          ? 'bg-white/[0.05]'
                          : 'hover:bg-white/[0.025]'
                      }`}
                    >
                      <p className="text-sm text-zinc-300">
                        {
                          suggestion.title
                        }
                      </p>

                      <p className="mt-1 truncate text-xs text-zinc-600">
                        {formatTarget(
                          suggestion.target
                        )}
                      </p>
                    </button>
                  )
                )}
              </div>
            </>
          )}

          <div className="p-5">
            {selectedMapping && (
              <MappingEditor
                mapping={
                  selectedMapping
                }
                selectedFieldKey={
                  selectedFieldKey
                }
                setSelectedFieldKey={
                  setSelectedFieldKey
                }
                savingAction={
                  savingAction
                }
                onConfirm={() =>
                  reviewMapping(
                    'confirm',
                    {
                      mappingId:
                        selectedMapping.id,
                    }
                  )
                }
                onCorrect={() =>
                  reviewMapping(
                    'correct',
                    {
                      mappingId:
                        selectedMapping.id,
                      fieldKey:
                        selectedFieldKey,
                    }
                  )
                }
                onReject={() =>
                  reviewMapping(
                    'reject',
                    {
                      mappingId:
                        selectedMapping.id,
                    }
                  )
                }
              />
            )}

            {selectedSuggestion && (
              <SuggestionAssignment
                suggestion={
                  selectedSuggestion
                }
                selectedFieldKey={
                  selectedFieldKey
                }
                setSelectedFieldKey={
                  setSelectedFieldKey
                }
                savingAction={
                  savingAction
                }
                onAssign={() =>
                  reviewMapping(
                    'assign',
                    {
                      suggestionId:
                        selectedSuggestion.id,
                      fieldKey:
                        selectedFieldKey,
                    }
                  )
                }
              />
            )}

            {!selectedMapping &&
              !selectedSuggestion && (
                <EmptyState text="Select a mapping or unresolved target to review it." />
              )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MappingEditor({
  mapping,
  selectedFieldKey,
  setSelectedFieldKey,
  savingAction,
  onConfirm,
  onCorrect,
  onReject,
}: {
  mapping: LeaseTemplateFieldMapping;
  selectedFieldKey: string;
  setSelectedFieldKey: (
    value: string
  ) => void;
  savingAction: MappingAction | null;
  onConfirm: () => void;
  onCorrect: () => void;
  onReject: () => void;
}) {
  const fieldChanged =
    selectedFieldKey !==
    mapping.fieldKey;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-600">
          Proposed AssetFlow Field
        </p>

        <p className="mt-2 text-sm text-zinc-200">
          {mapping.label}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {mapping.fieldKey}
        </p>
      </div>

      <TargetDetails
        target={mapping.target}
      />

      <ConfidenceDetails
        mapping={mapping}
      />

      <EvidenceDetails
        evidence={mapping.evidence}
      />

      <div>
        <label
          htmlFor={`mapping-field-${mapping.id}`}
          className="text-xs uppercase tracking-wide text-zinc-600"
        >
          Correct Mapping
        </label>

        <select
          id={`mapping-field-${mapping.id}`}
          value={selectedFieldKey}
          onChange={event =>
            setSelectedFieldKey(
              event.target.value
            )
          }
          className="mt-2 w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 outline-none"
        >
          {LEASE_FIELD_DEFINITIONS.map(
            definition => (
              <option
                key={definition.key}
                value={definition.key}
              >
                {definition.label}
              </option>
            )
          )}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
        <button
          type="button"
          disabled={
            Boolean(savingAction) ||
            !mapping.target
          }
          onClick={onConfirm}
          className="rounded-lg border border-white/[0.08] bg-white px-4 py-2 text-sm text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savingAction === 'confirm'
            ? 'Confirming…'
            : 'Confirm'}
        </button>

        <button
          type="button"
          disabled={
            Boolean(savingAction) ||
            !fieldChanged ||
            !selectedFieldKey ||
            !mapping.target
          }
          onClick={onCorrect}
          className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savingAction === 'correct'
            ? 'Saving…'
            : 'Save Correction'}
        </button>

        <button
          type="button"
          disabled={Boolean(savingAction)}
          onClick={onReject}
          className="rounded-lg border border-red-400/20 px-4 py-2 text-sm text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savingAction === 'reject'
            ? 'Rejecting…'
            : 'Reject Mapping'}
        </button>
      </div>
    </div>
  );
}

function SuggestionAssignment({
  suggestion,
  selectedFieldKey,
  setSelectedFieldKey,
  savingAction,
  onAssign,
}: {
  suggestion: LeaseTemplateAISuggestion;
  selectedFieldKey: string;
  setSelectedFieldKey: (
    value: string
  ) => void;
  savingAction: MappingAction | null;
  onAssign: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-600">
          Unresolved Target
        </p>

        <p className="mt-2 text-sm text-zinc-200">
          {suggestion.title}
        </p>

        <p className="mt-1 text-sm leading-6 text-zinc-500">
          {suggestion.description}
        </p>
      </div>

      <TargetDetails
        target={suggestion.target}
      />

      <EvidenceDetails
        evidence={suggestion.evidence}
      />

      <div>
        <label
          htmlFor={`suggestion-field-${suggestion.id}`}
          className="text-xs uppercase tracking-wide text-zinc-600"
        >
          Assign AssetFlow Field
        </label>

        <select
          id={`suggestion-field-${suggestion.id}`}
          value={selectedFieldKey}
          onChange={event =>
            setSelectedFieldKey(
              event.target.value
            )
          }
          className="mt-2 w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 outline-none"
        >
          <option value="">
            Select field…
          </option>

          {LEASE_FIELD_DEFINITIONS.map(
            definition => (
              <option
                key={definition.key}
                value={definition.key}
              >
                {definition.label}
              </option>
            )
          )}
        </select>
      </div>

      <button
        type="button"
        disabled={
          Boolean(savingAction) ||
          !selectedFieldKey ||
          !suggestion.target
        }
        onClick={onAssign}
        className="rounded-lg border border-white/[0.08] bg-white px-4 py-2 text-sm text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {savingAction === 'assign'
          ? 'Assigning…'
          : 'Assign & Confirm'}
      </button>
    </div>
  );
}

function TargetDetails({
  target,
}: {
  target?: LeaseTemplateDocumentTarget;
}) {
  if (!target) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-600">
          Document Target
        </p>

        <p className="mt-2 text-sm text-amber-300">
          No reusable document target is
          available.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-600">
        Document Target
      </p>

      <dl className="mt-2 space-y-2 text-sm">
        <DetailRow
          label="Type"
          value={target.kind}
        />

        <DetailRow
          label="Target ID"
          value={target.targetId}
        />

        {target.token && (
          <DetailRow
            label="Token"
            value={target.token}
          />
        )}

        {target.page !== undefined && (
          <DetailRow
            label="Page"
            value={String(target.page)}
          />
        )}

        {target.structuralPath && (
          <DetailRow
            label="Structure"
            value={
              target.structuralPath
            }
          />
        )}
      </dl>
    </div>
  );
}

function ConfidenceDetails({
  mapping,
}: {
  mapping: LeaseTemplateFieldMapping;
}) {
  const confidence =
    mapping.confidence;

  if (!confidence) {
    return null;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-600">
        Confidence
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <ConfidenceItem
          label="Detection"
          value={confidence.detection}
        />

        <ConfidenceItem
          label="Mapping"
          value={confidence.mapping}
        />

        <ConfidenceItem
          label="OCR"
          value={confidence.ocr}
        />

        <ConfidenceItem
          label="Extraction"
          value={confidence.extraction}
        />
      </div>
    </div>
  );
}

function ConfidenceItem({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-sm text-zinc-300">
        {typeof value === 'number'
          ? `${value}%`
          : '—'}
      </p>
    </div>
  );
}

function EvidenceDetails({
  evidence,
}: {
  evidence?:
    LeaseTemplateFieldEvidence[];
}) {
  if (!evidence?.length) {
    return null;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-600">
        Source Evidence
      </p>

      <div className="mt-2 space-y-2">
        {evidence.map(
          (item, index) => (
            <div
              key={`${item.text}-${index}`}
              className="rounded-lg border border-white/[0.05] px-3 py-2"
            >
              <p className="text-sm leading-5 text-zinc-400">
                {item.text}
              </p>

              <p className="mt-1 text-[11px] text-zinc-600">
                {formatEvidenceLocation(
                  item
                )}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function PdfPreview({
  sourceDocumentUrl,
  evidence,
  target,
}: {
  sourceDocumentUrl: string;
  evidence: LeaseTemplateFieldEvidence[];
  target?: LeaseTemplateDocumentTarget;
}) {
  /*
   * IMPORTANT:
   *
   * This intentionally preserves the existing PDF preview limitation:
   * page one only and no claim that OCR/PDF coordinates have been
   * transformed into rendered-page coordinates.
   *
   * We therefore do NOT draw positional bounding-box overlays here.
   * Displaying an unverified overlay would create false evidence.
   *
   * Multi-page navigation and coordinate transformation belong to the
   * subsequent document-rendering hardening step.
   */
  const evidenceForPageOne =
    evidence.filter(
      item =>
        item.page === undefined ||
        item.page === 1
    );

  return (
    <div className="space-y-4">
      <div className="overflow-auto rounded-lg bg-white p-3">
        <Document
          file={sourceDocumentUrl}
          loading={
            <p className="p-8 text-sm text-zinc-500">
              Loading PDF…
            </p>
          }
          error={
            <p className="p-8 text-sm text-red-500">
              Unable to display PDF.
            </p>
          }
        >
          <Page
            pageNumber={1}
            width={700}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      {(target ||
        evidenceForPageOne.length >
          0) && (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
            Selected Evidence
          </p>

          {target && (
            <p className="mt-2 break-all text-xs text-zinc-400">
              {formatTarget(target)}
            </p>
          )}

          {evidenceForPageOne.map(
            (item, index) => (
              <p
                key={`${item.text}-${index}`}
                className="mt-2 text-xs leading-5 text-zinc-500"
              >
                {item.text}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}

function MappingStatusBadge({
  status,
}: {
  status:
    LeaseTemplateFieldMapping['status'];
}) {
  const label =
    status === 'confirmed'
      ? 'Confirmed'
      : status === 'rejected'
        ? 'Rejected'
        : status === 'unresolved'
          ? 'Unresolved'
          : 'Suggested';

  return (
    <span className="shrink-0 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
      <dt className="text-zinc-600">
        {label}
      </dt>

      <dd className="break-all text-zinc-400">
        {value}
      </dd>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex min-h-[120px] items-center justify-center px-6 text-center">
      <p className="max-w-md text-sm leading-6 text-zinc-600">
        {text}
      </p>
    </div>
  );
}

function formatTarget(
  target?: LeaseTemplateDocumentTarget
): string {
  if (!target) {
    return 'No target';
  }

  if (target.token) {
    return `${target.kind} · ${target.token}`;
  }

  return `${target.kind} · ${target.targetId}`;
}

function formatEvidenceLocation(
  evidence: LeaseTemplateFieldEvidence
): string {
  const parts: string[] = [];

  if (evidence.page !== undefined) {
    parts.push(`Page ${evidence.page}`);
  }

  if (
    evidence.startOffset !== undefined &&
    evidence.endOffset !== undefined
  ) {
    parts.push(
      `Offsets ${evidence.startOffset}–${evidence.endOffset}`
    );
  }

  if (evidence.structuralPath) {
    parts.push(
      evidence.structuralPath
    );
  }

  return parts.length > 0
    ? parts.join(' · ')
    : 'Source location recorded';
}