import { ImportedTransaction } from "@/app/types/finance";
import { ServiceResponse } from "@/app/types/service";

type PresetMapping = {
  column_mapping: Record<string, number>;
  amount_type: "single" | "dual";
  date_format: string;
  skip_rows: number;
};

export async function importBankTransactions(
  file: File,
  preset?: PresetMapping | null
): Promise<ServiceResponse<ImportedTransaction[]>> {
  try {
    const text = await file.text();
    const rows = text.split("\n").filter((line) => line.trim().length > 0);

    if (rows.length < 2) {
      return {
        success: false,
        error: "File contains no transaction data.",
      };
    }

    // Use preset mapping or default to FNB format
    const mapping = preset?.column_mapping || {
      date: preset?.column_mapping?.date ?? 1,
      description: preset?.column_mapping?.description ?? 3,
      amount: preset?.column_mapping?.amount ?? 4,
      reference: preset?.column_mapping?.reference ?? 2,
    };
    const skipRows = preset?.skip_rows || 0;
    const dateFormat = preset?.date_format || "DD/MM/YYYY";
    console.log("Banking parser indices: date=", dateIdx, "desc=", descIdx, "ref=", refIdx, "amt=", amountIdx, "preset mapping:", preset?.column_mapping);

    const transactions: ImportedTransaction[] = [];
    const dataRows = rows.slice(skipRows + 1); // Skip header + extra rows

    for (const row of dataRows) {
      const columns = row.split(",").map((col) => col.replace(/"/g, "").trim());

      if (columns.length < 3) continue;

      // Extract values using column mapping (1-based to 0-based)
      const dateIdx = (mapping.date || 1) - 1;
      const descIdx = (mapping.description || 3) - 1;
      const amountIdx = (mapping.amount || 4) - 1;
      const refIdx = (mapping.reference || 2) - 1;

      const rawDate = columns[dateIdx] || "";
      const description = columns[descIdx] || "";
      const reference = columns[refIdx] || "";
      
      // Parse amount
      let amount = parseFloat(columns[amountIdx]?.replace(/[^0-9.\-]/g, "") || "0");
      if (isNaN(amount)) amount = 0;

      // Parse date
      let transactionDate = rawDate;
      try {
        const parsed = parseDate(rawDate, dateFormat);
        if (parsed) {
          transactionDate = parsed;
        }
      } catch {
        // Keep raw date if parsing fails
      }

      console.log('Banking parser: rawDate=', rawDate, 'rawAmt=', columns[amountIdx], 'rawDesc=', columns[descIdx], 'rawRef=', columns[refIdx]);
      if (description && !isNaN(amount)) {
        transactions.push({
          id: crypto.randomUUID(),
          transactionDate,
          description,
          amount,
          reference: reference || undefined,
          status: "unmatched",
          queue: "ready",
          allocationStatus: "unallocated",
          isBalanced: false,
          splitAllocations: [],
        });
      }
    }

    return {
      success: true,
      data: transactions,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to import bank transactions.",
    };
  }
}

function parseDate(dateStr: string, format: string): string | null {
  if (!dateStr) return null;

  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length !== 3) return dateStr;

  let day: number, month: number, year: number;

  if (format === "DD/MM/YYYY") {
    day = parseInt(parts[0]);
    month = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else if (format === "MM/DD/YYYY") {
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else if (format === "YYYY-MM-DD") {
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else {
    return dateStr;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return dateStr;

  // Fix two-digit years
  if (year < 100) year += 2000;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}