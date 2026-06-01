import {
  WorkspaceConfig,
} from "@/app/types/workspace";

export const workspaces: WorkspaceConfig[] =
  [
    {
      id: "executive",

      label:
        "Executive Workspace",

      description:
        "Portfolio-wide strategic oversight and operational intelligence.",

      dashboard:
        "executive",

      route:
        "/executive",

      roles: [
        "executive",
        "admin",
      ],
    },
  ];