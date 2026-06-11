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
    return { valid: false, errors, warnings };
  }

  const text = await file.text();
  const lines = text.split("\n").filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    errors.push("File contains no transaction data.");
    return { valid: false, errors, warnings };
  }

  // 2. Use preset mapping or default
  const mapping = preset?.column_mapping || {
    date: 1,
    description: 3,
    amount: 4,
    reference: 2,
  };
  const skipRows = preset?.skip_rows || 0;

  // 3. Check header row exists if skip_rows is 0
  const headerLine = lines[skipRows] || lines[0];
  const columns = headerLine.split(",").map(col => col.replace(/"/g, "").trim());

  if (columns.length < 3) {
    errors.push("File format invalid. Expected at least 3 columns.");
    return { valid: false, errors, warnings };
  }

  // 4. Validate column mapping against actual columns
  const dateIdx = (mapping.date || 1) - 1;
  const descIdx = (mapping.description || 3) - 1;
  const amountIdx = (mapping.amount || 4) - 1;
  const refIdx = (mapping.reference || 2) - 1;

  const maxIdx = Math.max(dateIdx, descIdx, amountIdx, refIdx);
  if (maxIdx >= columns.length) {
    errors.push(
      `Column mapping references column ${maxIdx + 1} but file only has ${columns.length} columns. Check your preset settings.`
    );
    return { valid: false, errors, warnings };
  }

  // 5. Check if mapped columns exist and have data
  const dataRows = lines.slice(skipRows + 1).filter(line => line.trim().length > 0);
  
  if (dataRows.length === 0) {
    errors.push("No transaction data found after header rows.");
    return { valid: false, errors, warnings };
  }

  // 6. Validate first data row has values in mapped columns
  const firstRow = dataRows[0].split(",").map(col => col.replace(/"/g, "").trim());
  
  if (!firstRow[dateIdx] || firstRow[dateIdx].trim() === "") {
    warnings.push(`Date column (column ${mapping.date}) is empty in first row.`);
  }
  if (!firstRow[amountIdx] || firstRow[amountIdx].trim() === "") {
    errors.push(`Amount column (column ${mapping.amount}) is empty in first row.`);
    return { valid: false, errors, warnings };
  }

  // 7. Check amount is numeric
  const amountStr = firstRow[amountIdx]?.replace(/[^0-9.\-]/g, "") || "";
  if (isNaN(parseFloat(amountStr))) {
    errors.push(`Amount column contains non-numeric value: "${firstRow[amountIdx]}". Check column mapping.`);
    return { valid: false, errors, warnings };
  }

  // 8. Count transactions
  const transactionCount = dataRows.length;
  if (transactionCount > 5000) {
    warnings.push(`Large import: ${transactionCount} transactions. This may take a moment.`);
  }

  return {
    valid: true,
    errors,
    warnings,
    transactionCount,
  };
}