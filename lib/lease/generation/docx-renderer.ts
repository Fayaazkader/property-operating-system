import { createHash } from 'crypto';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

import type { LeaseGenerationValue } from './types';
import type { VerifiedLeaseTemplateSource } from './source-loader';
import type { LeaseRenderPlan } from './renderer';
import { LeaseRendererError } from './renderer';

export interface LeaseRenderedFieldEvidence {
  mappingId: string;
  fieldKey: string;
  targetId: string;
  token: string;
  renderedValue: string;
}

export interface RenderedLeaseDocument {
  bytes: Uint8Array;
  mimeType:
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  extension: 'docx';
  checksum: string;
  fields: LeaseRenderedFieldEvidence[];
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function formatLeaseValue(value: LeaseGenerationValue): string {
  if (value === null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function getPlaceholderKey(token: string | undefined): string | null {
  if (!token) {
    return null;
  }

  const match = token.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);

  return match?.[1] ?? null;
}

export function renderLeaseDocx(
  source: VerifiedLeaseTemplateSource,
  plan: LeaseRenderPlan,
): RenderedLeaseDocument {
  if (source.format !== 'docx' || plan.format !== 'docx') {
    throw new LeaseRendererError(
      'source_format_mismatch',
      'DOCX renderer received a non-DOCX source or render plan.',
    );
  }

  const renderData: Record<string, string> = {};
  const fields: LeaseRenderedFieldEvidence[] = [];

  for (const entry of plan.entries) {
    if (entry.target.kind !== 'placeholder') {
      throw new LeaseRendererError(
        'unsupported_target',
        `DOCX renderer does not support target ${entry.target.kind}.`,
      );
    }

    const placeholderKey = getPlaceholderKey(entry.target.token);

    if (!placeholderKey) {
      throw new LeaseRendererError(
        'unsupported_target',
        `DOCX target ${entry.target.targetId} is not a supported {{field_name}} placeholder.`,
      );
    }

    /*
     * The approved mapping remains authoritative. A token that names a
     * different canonical field is contradictory and must never be rendered
     * silently.
     */
    if (placeholderKey !== entry.fieldKey) {
      throw new LeaseRendererError(
        'invalid_mapping',
        `Placeholder ${entry.target.token} does not match approved field ${entry.fieldKey}.`,
      );
    }

    const renderedValue = formatLeaseValue(entry.value);

    if (
      Object.prototype.hasOwnProperty.call(renderData, placeholderKey) &&
      renderData[placeholderKey] !== renderedValue
    ) {
      throw new LeaseRendererError(
        'invalid_mapping',
        `Conflicting values were supplied for placeholder ${placeholderKey}.`,
      );
    }

    renderData[placeholderKey] = renderedValue;

    fields.push({
      mappingId: entry.mappingId,
      fieldKey: entry.fieldKey,
      targetId: entry.target.targetId,
      token: entry.target.token!,
      renderedValue,
    });
  }

  if (fields.length === 0) {
    throw new LeaseRendererError(
      'invalid_mapping',
      'DOCX render plan contains no fields to populate.',
    );
  }

  let template: Docxtemplater;

  try {
    const zip = new PizZip(source.bytes);

    template = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: {
    start: '{{',
    end: '}}',
  },

      /*
       * Fail closed. AssetFlow must never silently generate a contractual
       * document containing an unresolved approved placeholder.
       */
      nullGetter() {
        throw new Error(
          'Lease template contains a placeholder without an approved render value.',
        );
      },
    });

    template.render(renderData);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown DOCX rendering failure.';

    throw new LeaseRendererError(
      'invalid_mapping',
      `Lease DOCX rendering failed: ${message}`,
    );
  }

  const buffer = template
    .getZip()
    .generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) {
    throw new LeaseRendererError(
      'invalid_mapping',
      'DOCX renderer produced an empty document.',
    );
  }

  return {
    bytes,
    mimeType: DOCX_MIME,
    extension: 'docx',
    checksum: sha256(bytes),
    fields,
  };
}
