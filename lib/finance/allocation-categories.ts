import {
  AllocationCategory,
} from "@/app/types/allocation";

export const allocationCategories: AllocationCategory[] =
  [
    {
      id: crypto.randomUUID(),

      code:
        "TENANT_RENT",

      name:
        "Tenant Rental",

      description:
        "Standard tenant rental receipts",

      glAccountCode:
        "4000",

      createdByRole:
        "admin",

      active: true,
    },

    {
      id: crypto.randomUUID(),

      code:
        "INS_RECOVERY",

      name:
        "Insurance Recovery",

      description:
        "Insurance claim recoveries",

      glAccountCode:
        "4200",

      createdByRole:
        "admin",

      active: true,
    },

    {
      id: crypto.randomUUID(),

      code:
        "SUSPENSE",

      name:
        "Suspense Receipt",

      description:
        "Unallocated suspense receipts",

      glAccountCode:
        "2999",

      createdByRole:
        "portfolio_manager",

      active: true,
    },
  ];

  