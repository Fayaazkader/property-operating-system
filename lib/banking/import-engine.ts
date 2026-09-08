import { ImportedTransaction } from "@/app/types/finance";
import { ServiceResponse } from "@/app/types/service";
import { ingestDocument } from "@/lib/document-intelligence/ingestion";
import { extractBankStatement } from "@/lib/document-intelligence/extractors/bank-statement";

export type BankImportPreset = {
  column_mapping: Record<string, number>;
  amount_type: "single" | "dual";
  date_format: string;
  skip_rows: number;
  transaction_header_row?: number;
  bank_name?: string | null;

  statement_mapping?: {
    opening_balance?: number;
    closing_balance?: number;
    statement_date?: number;
  };
};

export type ParsedBankImport = {
  transactions: ImportedTransaction[];
  startDate: string;
  endDate: string;
  openingBalance: number | null;
  closingBalance: number | null;
  statementDate: string | null;
};

export async function importBankStatement(
  file: File,
  preset?: BankImportPreset | null
): Promise<ServiceResponse<ParsedBankImport>> {
  try {
    const ingestion = await ingestDocument(file);

    /*
     * ---------------------------------------------------------
     * Canonical Document Intelligence extraction
     * ---------------------------------------------------------
     *
     * Structured sources (CSV/XLS/XLSX) may still use an
     * explicitly configured bank preset. This preserves the
     * existing customer-specific mappings.
     *
     * PDF/image sources do not have structured columns, so they
     * use the canonical bank-statement extractor.
     */

    if (ingestion.content.kind === "text") {
      const extraction = extractBankStatement({
        text: ingestion.content.text,
        rawText: ingestion.content.rawText,
        confidence: ingestion.content.confidence,
        evidence: ingestion.content.evidence,
      });

      const transactions: ImportedTransaction[] =
        extraction.transactions
          .map((transaction): ImportedTransaction | null => {
            const date = transaction.date?.value;
            const description = transaction.description?.value;
            const reference = transaction.reference?.value;
            const amount =
              transaction.amount?.value ??
              (
                typeof transaction.credit?.value === "number" ||
                typeof transaction.debit?.value === "number"
                  ? Number(transaction.credit?.value || 0) -
                    Number(transaction.debit?.value || 0)
                  : undefined
              );

            if (
              typeof date !== "string" ||
              !date ||
              typeof description !== "string" ||
              !description ||
              typeof amount !== "number" ||
              !Number.isFinite(amount)
            ) {
              return null;
            }

            return {
              id: crypto.randomUUID(),
              transactionDate: date,
              description,
              amount,
              reference:
                typeof reference === "string" && reference
                  ? reference
                  : undefined,
              status: "unmatched",
              queue: "review",
              allocationStatus: "unallocated",
              isBalanced: false,
              splitAllocations: [],
            };
          })
          .filter(
            (transaction): transaction is ImportedTransaction =>
              transaction !== null
          );

      if (transactions.length === 0) {
        return {
          success: false,
          error:
            extraction.warnings.join(" ") ||
            "No valid transactions could be extracted from the document.",
        };
      }

      const dates = transactions
        .map((transaction) => transaction.transactionDate)
        .filter(
          (date): date is string =>
            typeof date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(date)
        )
        .sort();

      if (dates.length === 0) {
        return {
          success: false,
          error:
            "No valid transaction dates could be determined from the document.",
        };
      }

      return {
        success: true,
        data: {
          transactions,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          openingBalance:
            typeof extraction.fields.openingBalance?.value === "number"
              ? extraction.fields.openingBalance.value
              : null,
          closingBalance:
            typeof extraction.fields.closingBalance?.value === "number"
              ? extraction.fields.closingBalance.value
              : null,
          statementDate:
            typeof extraction.fields.statementDate?.value === "string"
              ? extraction.fields.statementDate.value
              : null,
        },
      };
    }

    /*
     * ---------------------------------------------------------
     * Structured source
     * ---------------------------------------------------------
     *
     * CSV/XLS/XLSX all arrive here as normalized rows.
     * Existing presets remain authoritative for customer-specific
     * column mappings.
     */

    const rows = ingestion.content.rows;

    if (rows.length < 2) {
      return {
        success: false,
        error: "File contains no transaction data.",
      };
    }

    /*
     * Without a preset, use the canonical Document Intelligence
     * statement extractor rather than assuming fixed columns.
     */
    if (!preset) {
      const extraction = extractBankStatement({ rows });

      const transactions: ImportedTransaction[] =
        extraction.transactions
          .map((transaction): ImportedTransaction | null => {
            const date = transaction.date?.value;
            const description = transaction.description?.value;
            const reference = transaction.reference?.value;
            const amount =
              transaction.amount?.value ??
              (
                typeof transaction.credit?.value === "number" ||
                typeof transaction.debit?.value === "number"
                  ? Number(transaction.credit?.value || 0) -
                    Number(transaction.debit?.value || 0)
                  : undefined
              );

            if (
              typeof date !== "string" ||
              !date ||
              typeof description !== "string" ||
              !description ||
              typeof amount !== "number" ||
              !Number.isFinite(amount)
            ) {
              return null;
            }

            return {
              id: crypto.randomUUID(),
              transactionDate: date,
              description,
              amount,
              reference:
                typeof reference === "string" && reference
                  ? reference
                  : undefined,
              status: "unmatched",
              queue: "review",
              allocationStatus: "unallocated",
              isBalanced: false,
              splitAllocations: [],
            };
          })
          .filter(
            (transaction): transaction is ImportedTransaction =>
              transaction !== null
          );

      if (transactions.length === 0) {
        return {
          success: false,
          error:
            extraction.warnings.join(" ") ||
            "No valid transactions could be extracted from the file.",
        };
      }

      const dates = transactions
        .map((transaction) => transaction.transactionDate)
        .filter(
          (date): date is string =>
            typeof date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(date)
        )
        .sort();

      if (dates.length === 0) {
        return {
          success: false,
          error:
            "No valid transaction dates could be determined from the file.",
        };
      }

      return {
        success: true,
        data: {
          transactions,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          openingBalance:
            typeof extraction.fields.openingBalance?.value === "number"
              ? extraction.fields.openingBalance.value
              : null,
          closingBalance:
            typeof extraction.fields.closingBalance?.value === "number"
              ? extraction.fields.closingBalance.value
              : null,
          statementDate:
            typeof extraction.fields.statementDate?.value === "string"
              ? extraction.fields.statementDate.value
              : null,
        },
      };
    }

    const mapping = preset.column_mapping;

    const skipRows = preset.skip_rows || 0;
    const dateFormat = preset.date_format || "DD/MM/YYYY";
    const amountType = preset.amount_type || "single";
    const statementMapping = preset.statement_mapping;

    const headerIndex =
      preset.transaction_header_row ?? skipRows;

    const dataStartIndex = headerIndex + 1;

    if (headerIndex >= rows.length) {
      return {
        success: false,
        error: "Invalid header row configuration.",
      };
    }

    let openingBalance: number | null = null;
    let closingBalance: number | null = null;
    let statementDate: string | null = null;

    if (statementMapping?.opening_balance) {
      openingBalance = findMappedStatementAmount(
        rows,
        statementMapping.opening_balance
      );
    }

    if (statementMapping?.closing_balance) {
      closingBalance = findMappedStatementAmount(
        rows,
        statementMapping.closing_balance
      );
    }

    if (statementMapping?.statement_date) {
      statementDate = findMappedStatementDate(
        rows,
        statementMapping.statement_date,
        dateFormat
      );
    }

    if (openingBalance === null) {
      openingBalance = detectStatementBalance(
        rows,
        [
          "opening balance",
          "opening bal",
          "opening",
          "balance b/f",
          "balance bf",
          "balance brought forward",
          "b/f balance",
          "brought forward",
          "balance brought fwd",
        ],
        "opening"
      );
    }

    if (closingBalance === null) {
      closingBalance = detectStatementBalance(
        rows,
        [
          "closing balance",
          "closing bal",
          "closing",
          "balance c/f",
          "balance cf",
          "balance carried forward",
          "c/f balance",
          "carried forward",
          "balance carried fwd",
        ],
        "closing"
      );
    }

    if (statementDate === null) {
      statementDate = detectStatementDate(rows, dateFormat);
    }

    const transactions: ImportedTransaction[] = [];

    for (const columns of rows.slice(dataStartIndex)) {
      if (columns.length < 2) continue;

      const dateIdx = getColumnIndex(mapping.date);
      const descIdx = getColumnIndex(mapping.description);
      const refIdx = getColumnIndex(mapping.reference);

      const rawDate = columns[dateIdx] || "";
      const description = (columns[descIdx] || "").trim();
      const reference = (columns[refIdx] || "").trim();

      if (!description) continue;

      let amount = 0;

      if (amountType === "dual") {
        const debitIdx = getColumnIndex(
          mapping.debit ?? mapping.amount
        );

        const creditIdx = getColumnIndex(
          mapping.credit
        );

        const debit = parseAmount(columns[debitIdx]);
        const credit = parseAmount(columns[creditIdx]);

        if (debit !== null && credit !== null) {
          amount = credit - debit;
        } else if (credit !== null) {
          amount = credit;
        } else if (debit !== null) {
          amount = -debit;
        } else {
          continue;
        }
      } else {
        const amountIdx = getColumnIndex(mapping.amount);
        const parsedAmount = parseAmount(columns[amountIdx]);

        if (parsedAmount === null) continue;

        amount = parsedAmount;
      }

      const parsedDate = parseDate(rawDate, dateFormat);

      transactions.push({
        id: crypto.randomUUID(),
        transactionDate: parsedDate || rawDate,
        description,
        amount,
        reference: reference || undefined,
        status: "unmatched",
        queue: "review",
        allocationStatus: "unallocated",
        isBalanced: false,
        splitAllocations: [],
      });
    }

    if (transactions.length === 0) {
      return {
        success: false,
        error: "No valid transactions could be extracted from the file.",
      };
    }

    const dates = transactions
      .map((transaction) => transaction.transactionDate)
      .filter(
        (date): date is string =>
          typeof date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(date)
      )
      .sort();

    if (dates.length === 0) {
      return {
        success: false,
        error:
          "No valid transaction dates could be determined from the file.",
      };
    }

    return {
      success: true,
      data: {
        transactions,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        openingBalance,
        closingBalance,
        statementDate,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to import bank transactions.",
    };
  }
}

/**
 * Find an amount using an explicit 1-based column mapping.
 *
 * We search all rows rather than only the transaction header,
 * because statement balances commonly appear in metadata rows.
 */
function findMappedStatementAmount(
  rows: string[][],
  column: number
): number | null {
  const index = getColumnIndex(column);

  for (const row of rows) {
    const value = row[index];

    const parsed = parseAmount(value);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function findMappedStatementDate(
  rows: string[][],
  column: number,
  dateFormat: string
): string | null {
  const index = getColumnIndex(column);

  for (const row of rows) {
    const value = row[index];

    if (!value) continue;

    const parsed = parseDate(
      value,
      dateFormat
    );

    if (
      parsed &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

/**
 * Detect a statement balance from labelled metadata.
 *
 * We deliberately inspect rows outside the transaction table.
 * This prevents a transaction amount from accidentally being
 * treated as an opening or closing balance.
 */
function detectStatementBalance(
  rows: string[][],
  labels: string[],
  direction: "opening" | "closing"
): number | null {
  const normalizedLabels = labels.map(
    normalizeLabel
  );

  /*
   * First pass:
   * Look for an explicit label and a numeric value in
   * another column on the same row.
   */
  for (const row of rows) {
    const normalizedRow = row.map(
      normalizeLabel
    );

    const labelIndex = normalizedRow.findIndex(
      (cell) =>
        cell &&
        normalizedLabels.some(
          (label) =>
            cell === label ||
            cell.includes(label)
        )
    );

    if (labelIndex === -1) continue;

    /*
     * Prefer a numeric value immediately following
     * the balance label.
     */
    for (
      let index = labelIndex + 1;
      index < row.length;
      index++
    ) {
      const parsed = parseAmount(row[index]);

      if (parsed !== null) {
        return parsed;
      }
    }

    /*
     * Some statements put the amount before the label.
     */
    for (
      let index = labelIndex - 1;
      index >= 0;
      index--
    ) {
      const parsed = parseAmount(row[index]);

      if (parsed !== null) {
        return parsed;
      }
    }
  }

  /*
   * Second pass:
   * Handle labels and values split across adjacent rows,
   * e.g.
   *
   * Opening Balance
   * 100000.00
   */
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];

    const containsLabel = row.some((cell) => {
      const normalized = normalizeLabel(cell);

      return normalizedLabels.some(
        (label) =>
          normalized === label ||
          normalized.includes(label)
      );
    });

    if (!containsLabel) continue;

    for (
      let nextRowIndex = rowIndex + 1;
      nextRowIndex <=
        Math.min(rowIndex + 2, rows.length - 1);
      nextRowIndex++
    ) {
      for (const cell of rows[nextRowIndex]) {
        const parsed = parseAmount(cell);

        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  /*
   * Direction is intentionally retained in the function
   * signature because it makes the detection contract explicit
   * and allows future bank-specific rules without changing
   * callers.
   */
  void direction;

  return null;
}

function detectStatementDate(
  rows: string[][],
  dateFormat: string
): string | null {
  const labels = [
    "statement date",
    "statement period",
    "period ending",
    "period end",
    "as at",
    "as of",
  ].map(normalizeLabel);

  for (const row of rows) {
    const normalizedRow = row.map(
      normalizeLabel
    );

    const labelIndex = normalizedRow.findIndex(
      (cell) =>
        cell &&
        labels.some(
          (label) =>
            cell === label ||
            cell.includes(label)
        )
    );

    if (labelIndex === -1) continue;

    for (
      let index = labelIndex + 1;
      index < row.length;
      index++
    ) {
      const parsed = parseDate(
        row[index] || "",
        dateFormat
      );

      if (
        parsed &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed)
      ) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeLabel(
  value: string | undefined
): string {
  return (value || "")
    .toLowerCase()
    .replace(/[_:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getColumnIndex(
  column?: number
): number {
  if (!column || column < 1) return 0;

  // Presets use 1-based column numbers.
  return column - 1;
}

function parseAmount(
  value?: string
): number | null {
  if (!value) return null;

  const cleaned = value
    .replace(/\s/g, "")
    .replace(/R/gi, "")
    .replace(/,/g, "");

  if (!cleaned) return null;

  const parsed = Number(
    cleaned.replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseDate(
  dateStr: string,
  format: string
): string | null {
  if (!dateStr) return null;

  const parts = dateStr
    .trim()
    .split(/[\/.\-]/);

  if (parts.length !== 3) {
    return dateStr;
  }

  let day: number;
  let month: number;
  let year: number;

  if (format === "DD/MM/YYYY") {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else if (format === "MM/DD/YYYY") {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else if (format === "YYYY-MM-DD") {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    return dateStr;
  }

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year)
  ) {
    return dateStr;
  }

  if (year < 100) {
    year += 2000;
  }

  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}