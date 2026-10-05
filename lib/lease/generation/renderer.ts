import type {
  LeaseTemplateFieldMapping,
  LeaseTemplateTargetKind,
} from '../templates/types';
import type {
  LeaseGenerationManifest,
  LeaseGenerationValue,
} from './types';
import type {
  LeaseTemplateSourceFormat,
  VerifiedLeaseTemplateSource,
} from './source-loader';

export type LeaseRenderCapability =
  | 'supported'
  | 'unsupported_format'
  | 'unsupported_target';

export interface LeaseRenderTargetCheck {
  mappingId: string;
  fieldKey: string;
  targetKind: LeaseTemplateTargetKind | null;
  capability: LeaseRenderCapability;
  message?: string;
}

export interface LeaseRenderPlanEntry {
  mappingId: string;
  fieldKey: string;
  value: LeaseGenerationValue;
  target: NonNullable<LeaseTemplateFieldMapping['target']>;
}

export interface LeaseRenderPlan {
  format: LeaseTemplateSourceFormat;
  entries: LeaseRenderPlanEntry[];
  checks: LeaseRenderTargetCheck[];
}

export class LeaseRendererError extends Error {
  constructor(
    public readonly code:
      | 'source_format_mismatch'
      | 'unsupported_target'
      | 'invalid_mapping'
      | 'missing_value',
    message: string,
  ) {
    super(message);
    this.name = 'LeaseRendererError';
  }
}

/*
 * Phase 1 renderer capability contract.
 *
 * A target kind appearing in the shared template type system does NOT mean
 * that AssetFlow currently knows how to render it safely.
 *
 * Capabilities are deliberately fail-closed and are expanded only when a
 * format-specific renderer has been implemented and verified.
 */
const SUPPORTED_TARGETS: Record<
  LeaseTemplateSourceFormat,
  ReadonlySet<LeaseTemplateTargetKind>
> = {
  /*
   * Placeholder rendering will be enabled only with the DOCX renderer that
   * understands WordprocessingML run boundaries. It is intentionally not
   * claimed here yet.
   */
  docx: new Set<LeaseTemplateTargetKind>(['placeholder']),

  /*
   * pdf-lib is available, but PDF rendering is not claimed until AssetFlow
   * has proven AcroForm/coordinate targets produced by the analyser.
   */
  pdf: new Set<LeaseTemplateTargetKind>(),
};

function hasValue(value: LeaseGenerationValue | undefined): boolean {
  return value !== null && value !== undefined && value !== '';
}

function getCanonicalValue(
  manifest: LeaseGenerationManifest,
  fieldKey: string,
): LeaseGenerationValue | undefined {
  return manifest.values[fieldKey];
}

export function getLeaseRenderCapability(
  format: LeaseTemplateSourceFormat,
  mapping: LeaseTemplateFieldMapping,
): LeaseRenderTargetCheck {
  if (!mapping.target) {
    return {
      mappingId: mapping.id,
      fieldKey: mapping.fieldKey,
      targetKind: null,
      capability: 'unsupported_target',
      message: `Mapping ${mapping.id} has no render target.`,
    };
  }

  const targetKind = mapping.target.kind;
  const supported = SUPPORTED_TARGETS[format].has(targetKind);

  if (!supported) {
    return {
      mappingId: mapping.id,
      fieldKey: mapping.fieldKey,
      targetKind,
      capability: 'unsupported_target',
      message:
        `Target ${targetKind} is not supported by the ${format.toUpperCase()} renderer.`,
    };
  }

  return {
    mappingId: mapping.id,
    fieldKey: mapping.fieldKey,
    targetKind,
    capability: 'supported',
  };
}

export function buildLeaseRenderPlan(
  manifest: LeaseGenerationManifest,
  source: VerifiedLeaseTemplateSource,
): LeaseRenderPlan {
  const checks: LeaseRenderTargetCheck[] = [];
  const entries: LeaseRenderPlanEntry[] = [];

  for (const mapping of manifest.mappings) {
    /*
     * Generation manifests should already contain only reviewed mappings,
     * but the renderer independently refuses contradictory mapping state.
     */
    if (
      mapping.status !== 'confirmed' ||
      mapping.approved !== true ||
      !mapping.target
    ) {
      throw new LeaseRendererError(
        'invalid_mapping',
        `Mapping ${mapping.id} is not confirmed, approved and renderable.`,
      );
    }

    const capability = getLeaseRenderCapability(source.format, mapping);
    checks.push(capability);

    if (capability.capability !== 'supported') {
      continue;
    }

    const value = getCanonicalValue(manifest, mapping.fieldKey);

    if (!hasValue(value) && mapping.required) {
      throw new LeaseRendererError(
        'missing_value',
        `Required field ${mapping.fieldKey} has no render value.`,
      );
    }

    /*
     * Approved optional mappings remain part of the render plan even when
     * their canonical value is absent. The format renderer must deliberately
     * render them as blank rather than allowing a raw contractual placeholder
     * to survive in the generated document.
     */
    entries.push({
      mappingId: mapping.id,
      fieldKey: mapping.fieldKey,
      value: hasValue(value) ? value! : null,
      target: mapping.target,
    });
  }

  const unsupported = checks.filter(
    (check) => check.capability !== 'supported',
  );

  if (unsupported.length > 0) {
    throw new LeaseRendererError(
      'unsupported_target',
      unsupported
        .map(
          (check) =>
            `${check.fieldKey}: ${check.targetKind ?? 'missing target'}`,
        )
        .join(', '),
    );
  }

  return {
    format: source.format,
    entries,
    checks,
  };
}
