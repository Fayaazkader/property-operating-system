import {
  QueryResult,
} from "@/app/types/query";

import {
  BankTransaction,
} from "@/app/types/finance";

export async function getTransactions():
  Promise<
    QueryResult<
      BankTransaction[]
    >
  > {
  try {
    return {
      data: [],

      error: null,
    };
  } catch (error) {
    return {
      data: null,

      error:
        "Failed to load transactions.",
    };
  }
}