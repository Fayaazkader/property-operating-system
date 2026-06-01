import {
  rolePermissions,
} from "./roles";

import {
  Permission,
  Role,
} from "@/app/types/rbac";

export function hasPermission(
  role: Role,
  permission: Permission
) {
  const roleConfig =
    rolePermissions.find(
      (item) =>
        item.role === role
    );

  if (!roleConfig) {
    return false;
  }

  return roleConfig.permissions.includes(
    permission
  );
}