import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  allocationRules,
} from "@/lib/finance/allocation-rules";

export function generateAutomaticAllocations(
  transaction: ImportedTransaction
) {

  if (
    !transaction.matchedTenant
  ) {

    return [];
  }

  const matchingRules =
    allocationRules.filter(
      (rule) =>

        rule.tenantName ===
          transaction.matchedTenant &&

        rule.autoApply
    );

  return matchingRules.map(
    (rule) => ({
      id: crypto.randomUUID(),

      category:
        rule.allocationCategory,

      amount:
        Number(
          (
            transaction.amount *
            (
              rule.percentage /
              100
            )
          ).toFixed(2)
        ),

      percentage:
        rule.percentage,
    })
  );
}