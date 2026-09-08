import { supabase } from "@/lib/supabase/client";

export type BankAccountMatch = {
  id: string;
  bankName: string | null;
  accountNumber: string | null;
  confidence: number;
  matchedBy: "account_number" | "bank_and_account" | null;
};

export async function matchBankAccount(
  accountNumber: string | null,
  bankName: string | null,
  entityId: string
): Promise<BankAccountMatch | null> {
  if (!entityId || !accountNumber) {
    return null;
  }

  const normalizedAccountNumber =
    normalizeAccountNumber(accountNumber);

  if (!normalizedAccountNumber) {
    return null;
  }

  /*
   * Fetch active accounts for the selected entity and
   * normalize locally. This allows bank statements containing
   * spaces, hyphens or other formatting to match the same
   * underlying account.
   */
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_number")
    .eq("entity_id", entityId)
    .eq("is_active", true);

  if (error) {
    throw new Error(
      `Unable to match bank account: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  const accountMatches = data.filter(
    (account) =>
      normalizeAccountNumber(
        account.account_number
      ) === normalizedAccountNumber
  );

  if (accountMatches.length === 0) {
    return null;
  }

  const normalizedBank =
    normalizeBankName(bankName);

  const exactBankMatch = accountMatches.find(
    (account) =>
      normalizedBank &&
      normalizeBankName(account.bank_name) ===
        normalizedBank
  );

  const matched =
    exactBankMatch || accountMatches[0];

  return {
    id: matched.id,
    bankName: matched.bank_name,
    accountNumber: matched.account_number,
    confidence: exactBankMatch ? 100 : 95,
    matchedBy: exactBankMatch
      ? "bank_and_account"
      : "account_number",
  };
}

function normalizeAccountNumber(
  value: string | null
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\D/g, "");

  return normalized || null;
}

function normalizeBankName(
  value: string | null
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (normalized.includes("standardbank")) {
    return "standardbank";
  }

  if (
    normalized === "fnb" ||
    normalized.includes("firstnationalbank")
  ) {
    return "fnb";
  }

  if (normalized.includes("absa")) {
    return "absa";
  }

  if (normalized.includes("nedbank")) {
    return "nedbank";
  }

  return normalized;
}