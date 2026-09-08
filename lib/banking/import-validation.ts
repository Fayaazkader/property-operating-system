import { parseCSV } from "@/lib/banking/csv-parser";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  transactionCount?: number;
};

type PresetMapping = {
  column_mapping: Record<string, number>;
  amount_type: "single" | "dual";
  date_format: string;
  skip_rows: number;
  transaction_header_row?: number;
};

export async function validateBankImport(
  file: File,
  preset?: PresetMapping | null
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. File integrity
  if (!file || file.size === 0) {
    errors.push("File is empty or corrupt.");

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  const text = await file.text();
  const rows = parseCSV(text);
  console.log("AssetFlow validation rows:", rows);
console.log("AssetFlow validation preset:", preset);
console.log(
  "AssetFlow validation header row:",
  preset?.transaction_header_row
);

  // 2. Basic file structure
  if (rows.length < 2) {
    errors.push("File contains no transaction data.");

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // 3. Use preset mapping or default mapping
  const mapping =
    preset?.column_mapping || {
      date: 1,
      description: 3,
      amount: 4,
      reference: 2,
    };

  const skipRows = preset?.skip_rows || 0;

  // 4. Check header row exists
  const headerIndex =
  preset?.transaction_header_row ?? skipRows;

const columns =
  rows[headerIndex] || rows[0];

  console.log("AssetFlow validation header index:", headerIndex);
console.log("AssetFlow validation columns:", columns);
console.log(
  "AssetFlow validation column count:",
  columns?.length
);

  if (!columns || columns.length < 3) {
    errors.push(
      "File format invalid. Expected at least 3 columns."
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // 5. Validate column mapping against actual columns
  const dateIdx = (mapping.date || 1) - 1;
  const descIdx = (mapping.description || 3) - 1;
  const amountIdx = (mapping.amount || 4) - 1;
  const refIdx = (mapping.reference || 2) - 1;

  const maxIdx = Math.max(
    dateIdx,
    descIdx,
    amountIdx,
    refIdx
  );

  if (maxIdx >= columns.length) {
    errors.push(
      `Column mapping references column ${
        maxIdx + 1
      } but the file only has ${
        columns.length
      } columns. Check your preset settings.`
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // 6. Get transaction rows
  const dataRows = rows.slice(headerIndex + 1);

  if (dataRows.length === 0) {
    errors.push(
      "No transaction data found after header rows."
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // 7. Validate first transaction row
  const firstRow = dataRows[0];

  if (
    !firstRow[dateIdx] ||
    firstRow[dateIdx].trim() === ""
  ) {
    warnings.push(
      `Date column (column ${mapping.date}) is empty in the first transaction.`
    );
  }

  if (
    !firstRow[amountIdx] ||
    firstRow[amountIdx].trim() === ""
  ) {
    errors.push(
      `Amount column (column ${mapping.amount}) is empty in the first transaction.`
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // 8. Validate amount
  const amountStr =
    firstRow[amountIdx]
      ?.replace(/R/gi, "")
      .replace(/,/g, "")
      .replace(/\s/g, "")
      .trim() || "";

  const parsedAmount = Number(amountStr);

  if (!Number.isFinite(parsedAmount)) {
    errors.push(
      `Amount column contains a non-numeric value: "${firstRow[amountIdx]}". Check the column mapping.`
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // 9. Transaction count
  const transactionCount = dataRows.length;

  if (transactionCount > 5000) {
    warnings.push(
      `Large import: ${transactionCount} transactions. This may take a moment.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    transactionCount,
  };
}