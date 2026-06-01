import {
  RolePermissions,
} from "@/app/types/rbac";

export const rolePermissions:
  RolePermissions[] = [
  {
    role: "executive",

    permissions: [
      "view_dashboard",
      "view_financials",
      "manage_documents",
    ],
  },

  {
    role: "admin",

    permissions: [
      "view_dashboard",
      "manage_leases",
      "manage_tasks",
      "view_financials",
      "manage_documents",
    ],
  },

  {
    role: "leasing",

    permissions: [
      "manage_leases",
      "view_dashboard",
    ],
  },

  {
    role: "finance",

    permissions: [
      "view_financials",
      "view_dashboard",
    ],
  },

  {
    role: "operations",

    permissions: [
      "manage_tasks",
      "view_dashboard",
    ],
  },
];