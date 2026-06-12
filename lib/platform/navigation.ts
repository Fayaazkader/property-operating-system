import { NavigationItem } from "@/app/types/navigation";

export const navigation: NavigationItem[] = [
  // ZONE 1 — Primary Daily Operations
  {
    label: "Home",
    href: "/",
    workspace: "home",
    roles: ["executive", "admin", "leasing", "finance", "operations"],
    icon: "home",
    zone: "primary",
  },
  {
    label: "Cash Book",
    href: "/financials/cash-book",
    workspace: "finance",
    roles: ["executive", "admin", "finance"],
    icon: "cashbook",
    zone: "primary",
  },
    {
    label: "Revenue Ops",
    href: "/financials/revenue",
    workspace: "finance",
    roles: ["executive", "admin", "finance"],
    icon: "revenue",
    zone: "primary",
  },
  {
    label: "Periods",
    href: "/financials/periods",
    workspace: "finance",
    roles: ["executive", "admin", "finance"],
    icon: "reports",
    zone: "tertiary",
  },
  {
    label: "Leases",
    href: "/leases",
    workspace: "leasing",
    roles: ["executive", "admin", "leasing", "finance"],
    icon: "leases",
    zone: "primary",
  },
  {
    label: "Maintenance",
    href: "/maintenance",
    workspace: "operations",
    roles: ["executive", "admin", "operations", "leasing"],
    icon: "maintenance",
    zone: "primary",
  },

  // ZONE 2 — Secondary Management
  {
    label: "Properties",
    href: "/properties",
    workspace: "properties",
    roles: ["executive", "admin", "leasing", "finance", "operations"],
    icon: "properties",
    zone: "secondary",
  },
  {
    label: "Tenants",
    href: "/tenants",
    workspace: "tenants",
    roles: ["executive", "admin", "leasing", "finance"],
    icon: "tenants",
    zone: "secondary",
  },
  {
    label: "Suppliers",
    href: "/suppliers",
    workspace: "suppliers",
    roles: ["executive", "admin", "finance", "operations"],
    icon: "suppliers",
    zone: "secondary",
  },
  {
    label: "Documents",
    href: "/documents",
    workspace: "documents",
    roles: ["executive", "admin", "leasing", "finance", "operations"],
    icon: "documents",
    zone: "secondary",
  },

  // ZONE 3 — Tertiary Analysis & Settings
  {
    label: "Bank Imports",
    href: "/financials/imports",
    workspace: "finance",
    roles: ["executive", "admin", "finance"],
    icon: "import",
    zone: "tertiary",
  },
  {
    label: "Reports",
    href: "/reports",
    workspace: "reports",
    roles: ["executive", "admin", "finance"],
    icon: "reports",
    zone: "tertiary",
  },
  {
    label: "Settings",
    href: "/settings",
    workspace: "admin",
    roles: ["executive", "admin"],
    icon: "settings",
    zone: "tertiary",
  },
];