export type NavigationItem = {
  label: string;
  href: string;
  workspace?: string;
  roles: string[];
  icon?: string;
  section?: "operations" | "portfolio" | "control" | "intelligence" | "administration";
};
