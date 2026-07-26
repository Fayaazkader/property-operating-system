export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export const validationService = {
  async run(
    errorValidators: Array<() => ValidationError | null>,
    warningValidators?: Array<() => ValidationWarning | null>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const validate of errorValidators) {
      const error = validate();
      if (error) errors.push(error);
    }

    if (warningValidators) {
      for (const validate of warningValidators) {
        const warning = validate();
        if (warning) warnings.push(warning);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
};
