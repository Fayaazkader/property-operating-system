import {
  PlatformModule,
} from "@/app/types/module";

export const platformModules:
  PlatformModule[] = [
  {
    id: "executive-dashboard",

    label:
      "Executive Dashboard",

    description:
      "Portfolio-wide executive operational intelligence.",

    enabled: true,

    workspace:
      "executive",
  },

  {
    id: "lease-management",

    label:
      "Lease Management",

    description:
      "Commercial lease lifecycle management.",

    enabled: true,

    workspace:
      "leasing",
  },

  {
    id: "operations-workflows",

    label:
      "Operations Workflows",

    description:
      "Task escalation and operational workflow management.",

    enabled: true,

    workspace:
      "operations",
  },

  {
    id: "financial-intelligence",

    label:
      "Financial Intelligence",

    description:
      "NOI, arrears, and portfolio financial intelligence.",

    enabled: true,

    workspace:
      "finance",
  },
];