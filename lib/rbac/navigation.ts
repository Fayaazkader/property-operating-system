import {
  navigation,
} from "@/lib/platform/navigation";

import { Role } from "@/app/types/rbac";

export function getNavigationForRole(
  role: Role
) {
  return navigation.filter(
    (item) =>
      item.roles.includes(role)
  );
}