import {
  ImportedTransaction,
} from "@/app/types/finance";

export function generateAllocationSuggestions(
  transaction: ImportedTransaction
) {

  if (
    transaction.matchedTenant
  ) {

    return [
      {
        category:
          "Tenant Rental",

        percentage: 90,
      },

      {
        category:
          "Utilities Recovery",

        percentage: 10,
      },
    ];
  }

  if (
    transaction.allocationCategory ===
    "Insurance Recovery"
  ) {

    return [
      {
        category:
          "Insurance Recovery",

        percentage: 100,
      },
    ];
  }

  return [
    {
      category:
        "Suspense Receipt",

      percentage: 100,
    },
  ];
}