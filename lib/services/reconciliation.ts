import {
  ReconciliationMatch,
  BankTransaction,
} from "@/app/types/finance";

import {
  ServiceResponse,
} from "@/app/types/service";

export async function reconcileTransactions(
  transactions: BankTransaction[]
): Promise<
  ServiceResponse<
    ReconciliationMatch[]
  >
> {
  try {
    return {
      success: true,

      data: [],
    };
  } catch (error) {
    return {
      success: false,

      error:
        "Failed to reconcile transactions.",
    };
  }
}