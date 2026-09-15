import { ingestDocument } from "@/lib/document-intelligence/ingestion";
import { extractBankStatement } from "@/lib/document-intelligence/extractors/bank-statement";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  transactionCount?: number;
  confidence?: number;
  requiresReview?: boolean;
};

type PresetMapping = {
  column_mapping: Record<string, number>;
  amount_type: "single" | "dual";
  date_format: string;
  skip_rows: number;
  transaction_header_row?: number;
};

function validatePresetShape(
  rows: string[][],
  preset: PresetMapping,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const headerIndex =
    preset.transaction_header_row ?? preset.skip_rows ?? 0;

  const columns = rows[headerIndex];

  if (!columns || columns.length === 0) {
    return {
      valid: false,
      errors: ["Configured transaction header row could not be found."],
      warnings,
    };
  }

  for (const [name, value] of Object.entries(preset.column_mapping)) {
    if (!Number.isInteger(value) || value < 1) {
      errors.push(
        `Invalid ${name} column mapping: ${value}. Column mappings must be 1-based positive integers.`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  const dataRows = rows
    .slice(headerIndex + 1)
    .filter((row) =>
      row.some((cell) => String(cell ?? "").trim() !== ""),
    );

  if (dataRows.length === 0) {
    return {
      valid: false,
      errors: ["No transaction data found after the configured header row."],
      warnings,
    };
  }

  if (dataRows.length > 5000) {
    warnings.push(
      `Large import: ${dataRows.length} transactions. This may take a moment.`,
    );
  }

  return {
    valid: true,
    errors,
    warnings,
    transactionCount: dataRows.length,
  };
}

export async function validateBankImport(
  file: File,
  preset?: PresetMapping | null,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!file || file.size === 0) {
    return {
      valid: false,
      errors: ["File is empty or corrupt."],
      warnings,
    };
  }

  try {
    const ingestion = await ingestDocument(file);

    /*
     * All bank statement formats ultimately use the same
     * canonical bank statement extractor.
     *
     * Structured formats such as CSV/XLS/XLSX are normalized
     * into rows by Document Intelligence before extraction.
     *
     * PDF/image/scanned statements use the same extractor after
     * native text/OCR processing.
     */
    const extraction =
  ingestion.content.kind === "structured"
    ? extractBankStatement({
        rows: ingestion.content.rows,
      })
    : extractBankStatement({
        text: ingestion.content.text,
        rawText: ingestion.content.rawText,
        confidence: ingestion.content.confidence,
        evidence: ingestion.content.evidence,
      });

    /*
     * Presets remain supported for configured bank/customer
     * mappings, but they validate configuration shape only.
     * They do not replace canonical extraction.
     */
    if (preset && ingestion.content.kind === "structured") {
      const presetValidation = validatePresetShape(
        ingestion.content.rows,
        preset,
      );

      if (!presetValidation.valid) {
        return {
          valid: false,
          errors: presetValidation.errors,
          warnings: presetValidation.warnings,
          transactionCount: extraction.transactions.length,
          confidence: extraction.overallConfidence,
          requiresReview: true,
        };
      }

      warnings.push(...presetValidation.warnings);
    }

    const transactionCount = extraction.transactions.length;

    if (transactionCount === 0) {
      errors.push(
        extraction.warnings.join(" ") ||
          "No bank transactions could be extracted from the document.",
      );
    }

    if (extraction.warnings.length > 0) {
      warnings.push(...extraction.warnings);
    }

    const confidence = extraction.overallConfidence;
    const requiresReview = extraction.requiresReview;

    if (requiresReview) {
      warnings.push(
        "Document extraction requires review before import.",
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      transactionCount,
      confidence,
      requiresReview,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error
          ? error.message
          : "Bank document could not be processed.",
      ],
      warnings,
    };
  }
}