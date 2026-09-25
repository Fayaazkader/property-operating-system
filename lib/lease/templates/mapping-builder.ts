import type { LeaseTemplateAnalysis } from './analyser';

import {
  getLeaseFieldDefinition,
  normaliseLeaseFieldToken,
  resolveLeaseFieldKey,
} from './field-registry';

import type {
  LeaseTemplateAISuggestion,
  LeaseTemplateDocumentTarget,
  LeaseTemplateFieldEvidence,
  LeaseTemplateFieldMapping,
} from './types';

export interface LeaseTemplateMappingBuildResult {
  mappings: LeaseTemplateFieldMapping[];
  suggestions: LeaseTemplateAISuggestion[];
}

function buildPlaceholderTarget(
  placeholder: LeaseTemplateAnalysis['placeholders'][number]
): LeaseTemplateDocumentTarget {
  return {
    kind: 'placeholder',
    targetId: placeholder.targetId,
    token: placeholder.token,
    startOffset: placeholder.startOffset,
    endOffset: placeholder.endOffset,
  };
}

function buildMappingId(
  fieldKey: string,
  targetId: string
): string {
  return `mapping-${fieldKey}-${targetId}`;
}

function buildSuggestionId(
  targetId: string
): string {
  return `unresolved-${targetId}`;
}

function getPlaceholderEvidence(
  placeholder: LeaseTemplateAnalysis['placeholders'][number]
): LeaseTemplateFieldEvidence[] {
  return placeholder.evidence ?? [];
}

/*
 * Converts analyser discoveries into reusable semantic mappings.
 *
 * Important:
 * - document targets and canonical fields are separate concepts;
 * - unknown targets remain unresolved suggestions;
 * - repeated occurrences remain separate mappings;
 * - example values are evidence, not insertion targets;
 * - nothing produced here is automatically approved.
 */
export function buildLeaseTemplateMappings(
  analysis: LeaseTemplateAnalysis
): LeaseTemplateMappingBuildResult {
  const mappings: LeaseTemplateFieldMapping[] = [];
  const suggestions: LeaseTemplateAISuggestion[] = [];

  for (const placeholder of analysis.placeholders) {
    const target = buildPlaceholderTarget(placeholder);
    const evidence = getPlaceholderEvidence(placeholder);

    const proposedToken =
      placeholder.suggestedKey ??
      normaliseLeaseFieldToken(placeholder.token);

    const canonicalFieldKey = proposedToken
      ? resolveLeaseFieldKey(proposedToken)
      : undefined;

    if (!canonicalFieldKey) {
      suggestions.push({
        id: buildSuggestionId(placeholder.targetId),
        type: 'field',
        title: 'Unresolved template target',
        description:
          'AssetFlow detected an insertion target but could not safely determine which canonical lease field should populate it.',
        severity: 'warning',
        target,
        confidence: {
          detection: placeholder.confidence,
        },
        evidence,
      });

      continue;
    }

    const definition =
      getLeaseFieldDefinition(canonicalFieldKey);

    if (!definition) {
      /*
       * resolveLeaseFieldKey() should only return registered canonical
       * fields. Keep this defensive branch so registry inconsistencies
       * cannot silently create malformed mappings.
       */
      suggestions.push({
        id: buildSuggestionId(placeholder.targetId),
        type: 'warning',
        title: 'Unregistered lease field',
        description:
          'AssetFlow resolved this target to a lease field that is not present in the canonical lease-field registry.',
        severity: 'critical',
        fieldKey: canonicalFieldKey,
        target,
        confidence: {
          detection: placeholder.confidence,
        },
        evidence,
      });

      continue;
    }

    const normalisedOriginalToken =
      normaliseLeaseFieldToken(placeholder.token);

    const directCanonicalMatch =
      normalisedOriginalToken === canonicalFieldKey;

    mappings.push({
      id: buildMappingId(
        canonicalFieldKey,
        placeholder.targetId
      ),
      fieldKey: canonicalFieldKey,
      label: definition.label,
      type: definition.type,
      required: definition.required,
      target,
      status: 'suggested',
      confidence: {
        detection: placeholder.confidence,
        mapping: directCanonicalMatch ? 100 : 90,
      },
      evidence,
      source: 'ai',
      approved: false,
      approvedBy: null,
      approvedAt: null,
    });
  }

  /*
   * Preserve analyser-level findings as review suggestions.
   * These do not automatically become mappings.
   */
  for (const [index, suggestion] of analysis.suggestions.entries()) {
    suggestions.push({
      id: `analysis-${index + 1}`,
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      severity: suggestion.severity,
    });
  }

  return {
    mappings,
    suggestions,
  };
}
