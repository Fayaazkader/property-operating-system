// lib/platform/security/rbac-manager.ts
// RBAC Manager — Dynamic role-based access control

import { supabase } from "@/lib/supabase";
import { settingsEngine } from "../settings/engine";
import { Permission, RoleConfig } from "../settings/types";

export class RBACManager {
  async getUserRoles(userId: string, entityId: string): Promise<RoleConfig[]> {
    const settings = await settingsEngine.getSettings(entityId);
    const { data: userRoles } = await supabase
      .from('user_entity_access')
      .select('role')
      .eq('user_id', userId)
      .eq('entity_id', entityId);

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const roleNames = userRoles.map(r => r.role);
    return settings.roles.filter(r => roleNames.includes(r.id));
  }

  async hasPermission(userId: string, entityId: string, resource: string, action: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId, entityId);
    
    for (const role of roles) {
      for (const perm of role.permissions) {
        if (perm.resource === '*' && perm.actions.includes('*')) {
          return true;
        }
        if (perm.resource === '*' && perm.actions.includes(action)) {
          return true;
        }
        if (perm.resource === resource && perm.actions.includes('*')) {
          return true;
        }
        if (perm.resource === resource && perm.actions.includes(action)) {
          return true;
        }
      }
    }
    return false;
  }

  async hasAnyPermission(userId: string, entityId: string, resource: string, actions: string[]): Promise<boolean> {
    for (const action of actions) {
      if (await this.hasPermission(userId, entityId, resource, action)) {
        return true;
      }
    }
    return false;
  }

  async hasAllPermissions(userId: string, entityId: string, resource: string, actions: string[]): Promise<boolean> {
    for (const action of actions) {
      if (!await this.hasPermission(userId, entityId, resource, action)) {
        return false;
      }
    }
    return true;
  }
}

export const rbacManager = new RBACManager();
