import { NavigationItem } from "@/app/types/navigation";

export const navigation: NavigationItem[] = [
  // OPERATIONS
  { label: "Morning Brief", href: "/", roles: ["executive", "admin", "leasing", "finance", "operations"], icon: "home", section: "operations" },
  { label: "Leases", href: "/leases", roles: ["executive", "admin", "leasing", "finance"], icon: "leases", section: "operations" },
  { label: "Revenue Ops", href: "/financials/revenue", roles: ["executive", "admin", "finance"], icon: "revenue", section: "operations" },
  { label: "Cash Book", href: "/financials/cash-book", roles: ["executive", "admin", "finance"], icon: "cashbook", section: "operations" },
  { label: "Communications", href: "/communications", roles: ["executive", "admin", "leasing", "finance", "operations"], icon: "maintenance", section: "operations" },
  { label: "Tasks", href: "/tasks", roles: ["executive", "admin", "leasing", "finance", "operations"], icon: "documents", section: "operations" },
  // PORTFOLIO
  { label: "Properties", href: "/properties", roles: ["executive", "admin", "leasing", "finance", "operations"], icon: "properties", section: "portfolio" },
  { label: "Tenants", href: "/tenants", roles: ["executive", "admin", "leasing", "finance"], icon: "tenants", section: "portfolio" },
  { label: "Suppliers", href: "/suppliers", roles: ["executive", "admin", "finance", "operations"], icon: "suppliers", section: "portfolio" },
  // SYSTEM
  { label: "Imports", href: "/financials/imports", roles: ["executive", "admin", "finance"], icon: "import", section: "control" },
  { label: "Statement Periods", href: "/financials/periods", roles: ["executive", "admin", "finance"], icon: "reports", section: "control" },
  { label: "Settings", href: "/settings", roles: ["executive", "admin"], icon: "settings", section: "administration" },
];