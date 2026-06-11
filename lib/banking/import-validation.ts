export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  transactionCount?: number;
};

export async function validateBankImport(file: File): Promise<ValidationResult> {
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

  // 2. Basic structure validation
  const header = lines[0].toLowerCase();
  const hasDate = header.includes("date");
  const hasAmount = header.includes("amount") || header.includes("debit") || header.includes("credit");
  const hasDescription = header.includes("description") || header.includes("reference") || header.includes("desc");

  if (!hasDate) {
    errors.push("File must contain a Date column.");
  }
  if (!hasAmount) {
    errors.push("File must contain an Amount, Debit, or Credit column.");
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // 3. Count transactions
  const transactionCount = lines.length - 1;
  if (transactionCount > 5000) {
    warnings.push(`Large import: ${transactionCount} transactions. This may take a moment.`);
  }

  // 4. Check for duplicate — hash the content
  const fileHash = await hashContent(text);

  return {
    valid: true,
    errors,
    warnings,
    transactionCount,
  };
}

export async function isDuplicateImport(file: File): Promise<boolean> {
  const { supabase } = await import("../supabase");
  const text = await file.text();
  const fileHash = await hashContent(text);

  const { data } = await supabase
    .from("bank_transactions")
    .select("imported_batch_reference")
    .eq("imported_batch_reference", fileHash)
    .limit(1);

  return !!(data && data.length > 0);
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}