import { parseCSV } from "@/lib/banking/csv-parser";

export type BankDetectionResult = {
  
  bankName: string | null;
  accountNumber: string | null;

  transactionHeaderRow: number;

  dateColumn: number | null;
  descriptionColumn: number | null;
  referenceColumn: number | null;

  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;

  dateFormat: string | null;

  amountType: "single" | "dual";

  confidence: number;

  detectedHeaders: string[];

  needsReview: boolean;

  reasons: string[];
  
};

type DetectionScore = {
  value: string | null;
  score: number;
};

export function detectBankImport(
  text: string
): BankDetectionResult {
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return {
      bankName: null,
      accountNumber: null,
      dateColumn: null,
      transactionHeaderRow: 0,
      descriptionColumn: null,
      referenceColumn: null,
      amountColumn: null,
      debitColumn: null,
      creditColumn: null,
      dateFormat: null,
      amountType: "single",
      confidence: 0,
      detectedHeaders: [],
      needsReview: true,
      reasons: ["The file does not contain enough data to analyse."],
    };
  }

  const headerDetection = detectTransactionHeader(rows);

const headers = headerDetection.headers;

const detectedHeaders = headerDetection.originalHeaders;

const transactionHeaderRow = headerDetection.rowIndex;

  const dateColumn = findColumn(headers, [
    "date",
    "transaction date",
    "transaction_date",
    "effective date",
    "effective_date",
    "value date",
    "value_date",
  ]);

  const descriptionColumn = findColumn(headers, [
    "description",
    "transaction description",
    "transaction_description",
    "details",
    "narration",
    "transaction details",
  ]);

  const referenceColumn = findColumn(headers, [
    "reference",
    "transaction reference",
    "transaction_reference",
    "reference number",
    "reference no",
    "ref",
  ]);

  const amountColumn = findColumn(headers, [
    "amount",
    "transaction amount",
    "transaction_amount",
    "value",
  ]);

  const debitColumn = findColumn(headers, [
    "debit",
    "debit amount",
    "debit_amount",
    "withdrawal",
    "withdrawals",
  ]);

  const creditColumn = findColumn(headers, [
    "credit",
    "credit amount",
    "credit_amount",
    "deposit",
    "deposits",
  ]);

  const balanceColumn = findColumn(headers, [
    "balance",
    "running balance",
    "running_balance",
    "available balance",
  ]);

  const bankDetection = detectBank(rows);

  const accountNumber = detectAccountNumber(rows);

  const dateFormat = detectDateFormat(
    rows,
    dateColumn
  );

  const amountType =
    debitColumn !== null || creditColumn !== null
      ? "dual"
      : "single";

  const reasons: string[] = [];

  let confidence = 0;

  if (dateColumn !== null) {
    confidence += 25;
    reasons.push("Transaction date column detected.");
  }

  if (descriptionColumn !== null) {
    confidence += 20;
    reasons.push("Transaction description column detected.");
  }

  if (
    amountColumn !== null ||
    debitColumn !== null ||
    creditColumn !== null
  ) {
    confidence += 25;
    reasons.push("Transaction amount structure detected.");
  }

  if (referenceColumn !== null) {
    confidence += 10;
    reasons.push("Reference column detected.");
  }

  if (balanceColumn !== null) {
    confidence += 5;
    reasons.push("Balance column detected.");
  }

  if (dateFormat !== null) {
    confidence += 5;
    reasons.push(`Date format detected as ${dateFormat}.`);
  }

  if (bankDetection.value) {
    confidence += Math.min(bankDetection.score, 10);

    reasons.push(
      `Bank identified as ${bankDetection.value}.`
    );
  }

  const normalizedConfidence = Math.min(
    confidence,
    100
  );

  return {
    bankName: bankDetection.value,
    accountNumber,
    transactionHeaderRow,
    dateColumn,
    descriptionColumn,
    referenceColumn,
    amountColumn,
    debitColumn,
    creditColumn,
    dateFormat,
    amountType,
    confidence: normalizedConfidence,
    detectedHeaders,
    needsReview:
      dateColumn === null ||
      descriptionColumn === null ||
      (amountColumn === null &&
        debitColumn === null &&
        creditColumn === null) ||
      normalizedConfidence < 80,
    reasons,
  };
}

function findColumn(
  headers: string[],
  candidates: string[]
): number | null {
  for (const candidate of candidates) {
    const index = headers.findIndex(
      (header) => header === candidate
    );

    if (index !== -1) {
      return index + 1;
    }
  }

  return null;
}

function detectBank(
  rows: string[][]
): DetectionScore {
  const sample = rows
    .slice(0, Math.min(rows.length, 20))
    .flat()
    .join(" ")
    .toLowerCase();

  if (
    sample.includes("first national bank") ||
    sample.includes("fnb")
  ) {
    return {
      value: "FNB",
      score: 10,
    };
  }

  if (
    sample.includes("absa bank") ||
    sample.includes("absa")
  ) {
    return {
      value: "ABSA",
      score: 10,
    };
  }

  if (
    sample.includes("nedbank") ||
    sample.includes("ned bank")
  ) {
    return {
      value: "Nedbank",
      score: 10,
    };
  }

  if (
    sample.includes("standard bank") ||
    sample.includes("sbsa")
  ) {
    return {
      value: "Standard Bank",
      score: 10,
    };
  }

  return {
    value: null,
    score: 0,
  };
}

function detectAccountNumber(
  rows: string[][]
): string | null {
  const sample = rows
    .slice(0, Math.min(rows.length, 20))
    .flat()
    .join(" ");

  const patterns = [
    /account\s*(?:number|no\.?)?\s*[:\-]?\s*(\d{6,})/i,
    /a\/c\s*(?:number|no\.?)?\s*[:\-]?\s*(\d{6,})/i,
    /acc(?:ount)?\s*[:\-]?\s*(\d{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = sample.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function detectDateFormat(
  rows: string[][],
  dateColumn: number | null
): string | null {
  if (dateColumn === null) {
    return null;
  }

  const index = dateColumn - 1;

  const samples = rows
    .slice(1, Math.min(rows.length, 20))
    .map((row) => row[index])
    .filter(Boolean);

  for (const value of samples) {
    const date = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return "YYYY-MM-DD";
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      return "DD/MM/YYYY";
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
      return "DD-MM-YYYY";
    }

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
      return "DD.MM.YYYY";
    }
  }

  return null;
}
function detectTransactionHeader(rows: string[][]): {
  rowIndex: number;
  headers: string[];
  originalHeaders: string[];
} {
  const headerCandidates = [
    "date",
    "transaction date",
    "effective date",
    "value date",
    "description",
    "transaction description",
    "reference",
    "transaction reference",
    "amount",
    "debit",
    "credit",
    "balance",
  ];

  let bestRowIndex = 0;
  let bestScore = 0;

  const maxRowsToInspect = Math.min(rows.length, 50);

  for (let rowIndex = 0; rowIndex < maxRowsToInspect; rowIndex++) {
    const row = rows[rowIndex];

    if (!row || row.length === 0) {
      continue;
    }

    const normalized = row.map((value) =>
      value.trim().toLowerCase()
    );

    let score = 0;

    for (const cell of normalized) {
      if (
        headerCandidates.some(
          (candidate) =>
            cell === candidate ||
            cell.includes(candidate)
        )
      ) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = rowIndex;
    }
  }

  const originalHeaders =
    rows[bestRowIndex] || [];

  return {
    rowIndex: bestRowIndex,
    headers: originalHeaders.map((header) =>
      header.trim().toLowerCase()
    ),
    originalHeaders,
  };
}