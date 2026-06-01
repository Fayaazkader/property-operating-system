import {
  NavigationItem,
} from "@/app/types/navigation";

export const navigation:
  NavigationItem[] = [
  {
    label: "Executive",

    href: "/executive",

    workspace:
      "executive",

    roles: [
      "executive",
      "admin",
      "leasing",
      "finance",
      "operations",
    ],

    icon: "executive",
  },

  {
    label: "Properties",

    href:
      "/property/lakewood-offices",

    workspace:
      "properties",

    roles: [
      "executive",
      "admin",
      "leasing",
      "finance",
      "operations",
    ],

    icon: "properties",
  },

  {
    label: "Leases",

    href: "/leases",

    workspace:
      "leasing",

    roles: [
      "executive",
      "admin",
      "leasing",
    ],

    icon: "leases",
  },

  {
    label: "Tasks",

    href: "/tasks",

    workspace:
      "operations",

    roles: [
      "executive",
      "admin",
      "operations",
    ],

    icon: "tasks",
  },

  {
    label: "Documents",

    href: "/documents",

    workspace:
      "documents",

    roles: [
      "executive",
      "admin",
      "leasing",
      "finance",
      "operations",
    ],

    icon: "documents",
  },

  {
    label: "Reports",

    href: "/reports",

    workspace:
      "reports",

    roles: [
      "executive",
      "admin",
      "finance",
    ],

    icon: "reports",
  },

  {
    label: "Operations",

    href: "/operations",

    workspace:
      "operations",

    roles: [
      "executive",
      "admin",
      "operations",
    ],

    icon: "operations",
  },
  {
  label: "Bank Imports",

  href:
    "/financials/imports",

  workspace:
    "finance",

  roles: [
    "executive",
    "admin",
    "finance",
  ],

  icon: "financials",
},
];