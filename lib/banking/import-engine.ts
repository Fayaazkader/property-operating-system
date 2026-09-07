import { ImportedTransaction } from "@/app/types/finance";
import { ServiceResponse } from "@/app/types/service";

export type BankImportPreset = {
  column_mapping: Record<string, number>;
  amount_type: "single" | "dual";
  date_format: string;
  skip_rows: number;
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
    const text = await file.text();

    if (!text.trim()) {
      return {
        success: false,
        error: "File is empty.",
      };
    }

    const rows = parseCSV(text);

    if (rows.length < 2) {
      return {
        success: false,
        error: "File contains no transaction data.",
      };
    }

    const mapping = preset?.column_mapping || {
      date: 1,
      description: 3,
      amount: 4,
      reference: 2,
    };

    const skipRows = preset?.skip_rows || 0;
    const dateFormat = preset?.date_format || "DD/MM/YYYY";
    const amountType = preset?.amount_type || "single";
    const statementMapping = preset?.statement_mapping;

    const headerIndex = skipRows;
    const dataStartIndex = skipRows + 1;

    if (headerIndex >= rows.length) {
      return {
        success: false,
        error: "Invalid header row configuration.",
      };
    }

    const transactions: ImportedTransaction[] = [];
    let openingBalance: number | null = null;
let closingBalance: number | null = null;
let statementDate: string | null = null;

if (statementMapping) {
  if (statementMapping.opening_balance) {
    const raw = rows[headerIndex]?.[getColumnIndex(statementMapping.opening_balance)];
    openingBalance = parseAmount(raw);
  }

  if (statementMapping.closing_balance) {
    const raw = rows[headerIndex]?.[getColumnIndex(statementMapping.closing_balance)];
    closingBalance = parseAmount(raw);
  }

  if (statementMapping.statement_date) {
    const raw = rows[headerIndex]?.[getColumnIndex(statementMapping.statement_date)];
    const parsed = parseDate(raw || "", dateFormat);
    statementDate = parsed || raw || null;
  }
}

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
    error: "No valid transaction dates could be determined from the file.",
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

function getColumnIndex(column?: number): number {
  if (!column || column < 1) return 0;

  // Presets use 1-based column numbers.
  return column - 1;
}

function parseAmount(value?: string): number | null {
  if (!value) return null;

  const cleaned = value
    .replace(/\s/g, "")
    .replace(/R/gi, "")
    .replace(/,/g, "");

  if (!cleaned) return null;

  const parsed = Number(
    cleaned.replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field.trim());
      field = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());

    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function parseDate(
  dateStr: string,
  format: string
): string | null {
  if (!dateStr) return null;

  const parts = dateStr.trim().split(/[\/.\-]/);

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

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}