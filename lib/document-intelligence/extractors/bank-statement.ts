import type { DocumentEvidence } from "../ocr-adapter";

export interface ExtractedStatementField {
  value: string | number | undefined;
  confidence: number;
  evidence?: DocumentEvidence[];
}

export interface BankStatementTransaction {
  date?: ExtractedStatementField;
  description?: ExtractedStatementField;
  reference?: ExtractedStatementField;
  debit?: ExtractedStatementField;
  credit?: ExtractedStatementField;
  amount?: ExtractedStatementField;
  runningBalance?: ExtractedStatementField;
}

export interface BankStatementExtractionResult {
  fields: {
    bankName?: ExtractedStatementField;
    accountNumber?: ExtractedStatementField;
    statementDate?: ExtractedStatementField;
    openingBalance?: ExtractedStatementField;
    closingBalance?: ExtractedStatementField;
  };
  transactions: BankStatementTransaction[];
  overallConfidence: number;
  requiresReview: boolean;
  warnings: string[];
}

export interface BankStatementExtractionInput {
  rows?: string[][];
  text?: string;
  rawText?: string;
  confidence?: number;
  evidence?: DocumentEvidence[];
}

const DATE_PATTERNS = [
  /^\d{4}-\d{1,2}-\d{1,2}$/,
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/,
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,
];

const BANK_NAMES = [
  "FNB",
  "First National Bank",
  "ABSA",
  "Nedbank",
  "Standard Bank",
  "Capitec",
  "Investec",
  "African Bank",
  "Discovery Bank",
];

function normalize(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabel(value: string): string {
  return normalize(value)
    .toLowerCase()
    .replace(/[:_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isDate(value: string): boolean {
  const normalized = normalize(value);
  return DATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function parseDate(value: string): string | undefined {
  const normalized = normalize(value);

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }

  const parts = normalized.split(/[/-]/);

  if (parts.length === 3) {
    let day = Number(parts[0]);
    let month = Number(parts[1]);
    let year = Number(parts[2]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const dotParts = normalized.split(".");

  if (dotParts.length === 3) {
    const day = Number(dotParts[0]);
    const month = Number(dotParts[1]);
    let year = Number(dotParts[2]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  return undefined;
}

function parseAmount(value: string): number | undefined {
  let normalized = normalize(value);

  if (!normalized) return undefined;

  const negative =
    /^\(.*\)$/.test(normalized) ||
    normalized.includes("-");

  normalized = normalized
    .replace(/[R$£€]/gi, "")
    .replace(/[,\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^0-9.]/g, "");

  if (!normalized) return undefined;

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) return undefined;

  return negative ? -Math.abs(amount) : amount;
}

function field(
  value: string | number | undefined,
  confidence: number,
): ExtractedStatementField {
  return {
    value,
    confidence: value !== undefined && value !== "" ? confidence : 0,
  };
}

function findLabelValue(
  rows: string[][],
  labels: string[],
): ExtractedStatementField | undefined {
  const normalizedLabels = labels.map(normalizeLabel);

  for (const row of rows) {
    for (let index = 0; index < row.length; index++) {
      const cell = normalize(row[index]);
      const label = normalizeLabel(cell);

      const match = normalizedLabels.some(
        (candidate) =>
          label === candidate ||
          label.startsWith(`${candidate} `),
      );

      if (!match) continue;

      const remainder = cell.replace(/^.*?:\s*/, "").trim();

      if (remainder && normalizeLabel(remainder) !== label) {
        return field(remainder, 95);
      }

      const next = row[index + 1];

      if (next && normalize(next)) {
        return field(normalize(next), 95);
      }
    }
  }

  return undefined;
}

function findBankName(
  rows: string[][],
  text: string,
): ExtractedStatementField | undefined {
  const source = `${rows.flat().join(" ")} ${text}`;

  for (const bank of BANK_NAMES) {
    if (source.toLowerCase().includes(bank.toLowerCase())) {
      return field(bank, 95);
    }
  }

  return undefined;
}

function findAccountNumber(
  rows: string[][],
  text: string,
): ExtractedStatementField | undefined {
  const source = `${rows.flat().join(" ")} ${text}`;

  const match = source.match(
    /(?:account\s*(?:number|no|#)|a\/c|acc(?:ount)?)[\s:#-]*([0-9][0-9\s-]{5,20})/i,
  );

  if (!match?.[1]) return undefined;

  const accountNumber = match[1].replace(/\D/g, "");

  if (accountNumber.length < 6) return undefined;

  return field(accountNumber, 95);
}

function findBalance(
  rows: string[][],
  labels: string[],
): ExtractedStatementField | undefined {
  const result = findLabelValue(rows, labels);

  if (!result?.value) return undefined;

  const amount = parseAmount(String(result.value));

  return amount === undefined
    ? undefined
    : field(amount, result.confidence);
}

function findStatementDate(
  rows: string[][],
  text: string,
): ExtractedStatementField | undefined {
  const labelled = findLabelValue(rows, [
    "statement date",
    "statement period end",
    "period end",
    "date",
  ]);

  if (labelled?.value) {
    const parsed = parseDate(String(labelled.value));

    if (parsed) {
      return field(parsed, 95);
    }
  }

  const match = text.match(
    /(?:statement\s+date|period\s+end|as\s+at|closing\s+date)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  );

  if (match?.[1]) {
    const parsed = parseDate(match[1]);

    if (parsed) {
      return field(parsed, 90);
    }
  }

  return undefined;
}

function findHeader(rows: string[][]): {
  rowIndex: number;
  columns: Record<string, number>;
} | undefined {
  const aliases: Record<string, string[]> = {
    date: ["date", "transaction date", "value date"],
    description: [
      "description",
      "transaction description",
      "details",
      "narrative",
    ],
    reference: ["reference", "transaction reference", "ref"],
    amount: ["amount", "transaction amount"],
    debit: ["debit", "withdrawal", "debits"],
    credit: ["credit", "deposit", "credits"],
    balance: ["balance", "running balance", "closing balance"],
  };

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 80); rowIndex++) {
    const row = rows[rowIndex];

    const columns: Record<string, number> = {};

    row.forEach((cell, index) => {
      const normalized = normalizeLabel(cell);

      for (const [key, candidates] of Object.entries(aliases)) {
        if (
          columns[key] === undefined &&
          candidates.includes(normalized)
        ) {
          columns[key] = index;
        }
      }
    });

    if (
      columns.date !== undefined &&
      columns.description !== undefined &&
      (
        columns.amount !== undefined ||
        columns.debit !== undefined ||
        columns.credit !== undefined
      )
    ) {
      return { rowIndex, columns };
    }
  }

  return undefined;
}

function extractStructuredTransactions(
  rows: string[][],
  sourceConfidence: number,
): BankStatementTransaction[] {
  const header = findHeader(rows);

  if (!header) return [];

  const transactions: BankStatementTransaction[] = [];

  for (let index = header.rowIndex + 1; index < rows.length; index++) {
    const row = rows[index];

    if (!row.some((cell) => normalize(cell))) continue;

    const dateCell =
      header.columns.date !== undefined
        ? normalize(row[header.columns.date] || "")
        : "";

    if (!isDate(dateCell)) continue;

    const date = parseDate(dateCell);

    if (!date) continue;

    const description =
      header.columns.description !== undefined
        ? normalize(row[header.columns.description] || "")
        : "";

    const reference =
      header.columns.reference !== undefined
        ? normalize(row[header.columns.reference] || "")
        : "";

    const debitValue =
      header.columns.debit !== undefined
        ? parseAmount(row[header.columns.debit] || "")
        : undefined;

    const creditValue =
      header.columns.credit !== undefined
        ? parseAmount(row[header.columns.credit] || "")
        : undefined;

    const amountValue =
      header.columns.amount !== undefined
        ? parseAmount(row[header.columns.amount] || "")
        : undefined;

    const balanceValue =
      header.columns.balance !== undefined
        ? parseAmount(row[header.columns.balance] || "")
        : undefined;

    transactions.push({
      date: field(date, Math.min(98, sourceConfidence)),
      description: field(
        description || undefined,
        description ? Math.min(95, sourceConfidence) : 0,
      ),
      reference: field(
        reference || undefined,
        reference ? Math.min(95, sourceConfidence) : 0,
      ),
      debit:
        debitValue !== undefined
          ? field(Math.abs(debitValue), Math.min(98, sourceConfidence))
          : undefined,
      credit:
        creditValue !== undefined
          ? field(Math.abs(creditValue), Math.min(98, sourceConfidence))
          : undefined,
      amount:
        amountValue !== undefined
          ? field(amountValue, Math.min(98, sourceConfidence))
          : undefined,
      runningBalance:
        balanceValue !== undefined
          ? field(balanceValue, Math.min(98, sourceConfidence))
          : undefined,
    });
  }

  return transactions;
}

function extractTextTransactions(
  text: string,
  sourceConfidence: number,
): BankStatementTransaction[] {
  const transactions: BankStatementTransaction[] = [];

  const lines = text
    .split(/\r?\n/)
    .map(normalize)
    .filter(Boolean);

  for (const line of lines) {
    const dateMatch = line.match(
      /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\.\d{1,2}\.\d{2,4})\b/,
    );

    if (!dateMatch) continue;

    const date = parseDate(dateMatch[1]);

    if (!date) continue;

    const remainder = line.slice(dateMatch[0].length).trim();

    const amountMatches = [
      ...remainder.matchAll(
        /(?:R\s*)?-?\(?\d[\d,\s]*\.\d{2}\)?/g,
      ),
    ];

    if (amountMatches.length === 0) continue;

    const lastMatch = amountMatches[amountMatches.length - 1];

    if (!lastMatch) continue;

    const amount = parseAmount(lastMatch[0]);

    if (amount === undefined) continue;

    const description = remainder
      .slice(0, lastMatch.index ?? remainder.length)
      .trim();

    transactions.push({
      date: field(date, Math.min(85, sourceConfidence)),
      description: field(
        description || undefined,
        description ? Math.min(75, sourceConfidence) : 0,
      ),
      amount: field(
        amount,
        Math.min(75, sourceConfidence),
      ),
    });
  }

  return transactions;
}

function calculateConfidence(
  fields: BankStatementExtractionResult["fields"],
  transactions: BankStatementTransaction[],
): number {
  const fieldValues = Object.values(fields).filter(
    (item): item is ExtractedStatementField =>
      Boolean(item && item.value !== undefined),
  );

  const transactionConfidences = transactions
    .flatMap((transaction) =>
      Object.values(transaction).filter(
        (item): item is ExtractedStatementField =>
          Boolean(item && item.value !== undefined),
      ),
    )
    .map((item) => item.confidence);

  const all = [
    ...fieldValues.map((item) => item.confidence),
    ...transactionConfidences,
  ];

  if (all.length === 0) return 0;

  return Math.round(
    all.reduce((sum, value) => sum + value, 0) / all.length,
  );
}

export function extractBankStatement(
  input: BankStatementExtractionInput,
): BankStatementExtractionResult {
  const rows = input.rows || [];
  const text = input.text || "";
  const rawText = input.rawText || text;
  const sourceConfidence =
    typeof input.confidence === "number"
      ? input.confidence
      : 80;

  const warnings: string[] = [];

  const bankName = findBankName(rows, text);
  const accountNumber = findAccountNumber(rows, text);

  const statementDate = findStatementDate(rows, rawText);

  const openingBalance = findBalance(rows, [
    "opening balance",
    "opening",
    "balance brought forward",
    "balance b/f",
  ]);

  const closingBalance = findBalance(rows, [
    "closing balance",
    "closing",
    "balance carried forward",
    "balance c/f",
  ]);

  const fields = {
    bankName,
    accountNumber,
    statementDate,
    openingBalance,
    closingBalance,
  };

  const transactions =
    rows.length > 0
      ? extractStructuredTransactions(rows, sourceConfidence)
      : extractTextTransactions(rawText, sourceConfidence);

  if (!bankName) {
    warnings.push("Bank name could not be confidently identified.");
  }

  if (!accountNumber) {
    warnings.push("Account number could not be confidently identified.");
  }

  if (!statementDate) {
    warnings.push("Statement date could not be identified.");
  }

  if (!openingBalance) {
    warnings.push("Opening balance could not be identified.");
  }

  if (!closingBalance) {
    warnings.push("Closing balance could not be identified.");
  }

  if (transactions.length === 0) {
    warnings.push(
      "No transaction rows could be confidently extracted from the statement.",
    );
  }

  if (rows.length > 0 && !findHeader(rows)) {
    warnings.push(
      "A structured transaction header could not be identified.",
    );
  }

  const overallConfidence = calculateConfidence(
    fields,
    transactions,
  );

  const requiresReview =
    warnings.length > 0 ||
    transactions.length === 0 ||
    overallConfidence < 80;

  return {
    fields,
    transactions,
    overallConfidence,
    requiresReview,
    warnings,
  };
}
