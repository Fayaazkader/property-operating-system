export type NavigationItem = {
  label: string;
  href: string;
  workspace?: string;
  roles: string[];
  icon?: string;
  zone?: "primary" | "secondary" | "tertiary";
};