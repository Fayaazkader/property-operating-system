export const workspaces = [

  {
    id: "executive",
    title: "Executive Workspace",
    description:
      "Strategic portfolio and operational intelligence.",
    route: "/executive",
    roles: [
      "executive",
      "enterprise",
    ],
  },

  {
    id: "leases",
    title: "Lease Workspace",
    description:
      "Lease lifecycle and tenant management.",
    route: "/leases",
    roles: [
      "leasing",
      "asset_manager",
      "executive",
    ],
  },

  {
    id: "operations",
    title: "Operations Workspace",
    description:
      "Tasks, workflows, and operational execution.",
    route: "/operations",
    roles: [
      "operations",
      "asset_manager",
      "enterprise",
    ],
  },

  {
    id: "documents",
    title: "Document Workspace",
    description:
      "Enterprise document intelligence and storage.",
    route: "/documents",
    roles: [
      "finance",
      "leasing",
      "enterprise",
    ],
  },

];