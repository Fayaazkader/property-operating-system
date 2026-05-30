export const TASK_STATUSES = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  ESCALATED: "Escalated",
  COMPLETED: "Completed",
} as const;

export const TASK_PRIORITIES = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
} as const;

export const ESCALATION_LIMIT = 4;