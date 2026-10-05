import {
  LEASE_FIELD_DEFINITIONS,
  getLeaseFieldDefinition,
  isCanonicalLeaseFieldKey,
} from '../templates/field-registry';

import type {
  LeaseTemplate,
  LeaseTemplateFieldMapping,
} from '../templates/types';

import type {
  LeaseCanonicalValues,
  LeaseGenerationValidation,
  LeaseGenerationValidationIssue,
} from './types';

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

function isUsableMapping(
  mapping: LeaseTemplateFieldMapping,
): boolean {
  return (
    mapping.status === 'confirmed' &&
    mapping.approved === true &&
    !!mapping.target
  );
}

function hasContradictoryApprovalState(
  mapping: LeaseTemplateFieldMapping,
): boolean {
  return (
    (mapping.status === 'confirmed' &&
      mapping.approved !== true) ||
    (mapping.status !== 'confirmed' &&
      mapping.approved === true)
  );
}

export function validateLeaseGeneration(params: {
  values: LeaseCanonicalValues;
  template: LeaseTemplate;
}): LeaseGenerationValidation {
  const { values, template } = params;

  const errors: LeaseGenerationValidationIssue[] = [];
  const warnings: LeaseGenerationValidationIssue[] = [];

  const mappings = template.field_mapping ?? [];

  for (const definition of LEASE_FIELD_DEFINITIONS) {
    if (
      definition.required &&
      !hasValue(values[definition.key])
    ) {
      errors.push({
        code: 'missing_required_value',
        fieldKey: definition.key,
        message:
          `Required lease value "${definition.label}" is missing.`,
      });
    }
  }

  for (const mapping of mappings) {
    if (!isCanonicalLeaseFieldKey(mapping.fieldKey)) {
      if (
        mapping.status === 'confirmed' ||
        mapping.approved === true
      ) {
        errors.push({
          code: 'invalid_mapping',
          fieldKey: mapping.fieldKey,
          mappingId: mapping.id,
          message:
            `Approved mapping "${mapping.id}" references ` +
            `unknown canonical field "${mapping.fieldKey}".`,
        });
      }

      continue;
    }

    if (hasContradictoryApprovalState(mapping)) {
      errors.push({
        code: 'invalid_mapping',
        fieldKey: mapping.fieldKey,
        mappingId: mapping.id,
        message:
          `Mapping "${mapping.id}" has contradictory ` +
          'confirmation and approval state.',
      });

      continue;
    }

    if (
  mapping.status === 'confirmed' &&
  mapping.approved === true &&
  !mapping.target
) {
      errors.push({
        code: 'invalid_mapping',
        fieldKey: mapping.fieldKey,
        mappingId: mapping.id,
        message:
          `Mapping "${mapping.id}" is approved and confirmed ` +
          'but has no document target.',
      });
    }
  }

  for (const definition of LEASE_FIELD_DEFINITIONS) {
    if (!definition.required) {
      continue;
    }

    const usableMapping = mappings.some(
      mapping =>
        mapping.fieldKey === definition.key &&
        isUsableMapping(mapping),
    );

    if (!usableMapping) {
      errors.push({
        code: 'missing_required_mapping',
        fieldKey: definition.key,
        message:
          `Approved template has no confirmed approved mapping ` +
          `for required field "${definition.label}".`,
      });
    }
  }

  for (const mapping of mappings) {
    if (!isUsableMapping(mapping)) {
      continue;
    }

    const definition = getLeaseFieldDefinition(
      mapping.fieldKey,
    );

    if (
      definition &&
      !definition.required &&
      !hasValue(values[mapping.fieldKey])
    ) {
      warnings.push({
        code: 'missing_optional_value',
        fieldKey: mapping.fieldKey,
        mappingId: mapping.id,
        message:
          `Optional mapped field "${definition.label}" ` +
          'has no authoritative value and will remain empty.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
