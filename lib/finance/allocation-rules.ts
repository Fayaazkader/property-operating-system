import {
  AllocationRule,
} from "@/app/types/allocation";

export const allocationRules: AllocationRule[] =
  [
    {
      id: crypto.randomUUID(),

      tenantName:
        "ABC Traders",

      allocationCategory:
        "Tenant Rental",

      percentage: 90,

      autoApply: true,
    },

    {
      id: crypto.randomUUID(),

      tenantName:
        "ABC Traders",

      allocationCategory:
        "Utilities Recovery",

      percentage: 10,

      autoApply: true,
    },
  ];