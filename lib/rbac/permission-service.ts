// lib/rbac/permission-service.ts
// Central permission authority.
// user_entity_permissions is the source of truth.

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export const permissionService = {
  async can(
    userId: string,
    entityId: string,
    permissionKey: string,
    db: SupabaseClient = supabase
  ): Promise<PermissionCheck> {
    try {
      const { data, error } = await db
        .from('user_entity_permissions')
        .select('enabled')
        .eq('user_id', userId)
        .eq('entity_id', entityId)
        .eq('permission_key', permissionKey)
        .maybeSingle();

      if (error) {
        return {
          allowed: false,
          reason: error.message,
        };
      }

      if (!data) {
        return {
          allowed: false,
          reason: `No permission record for ${permissionKey}`,
        };
      }

      return {
        allowed: data.enabled === true,
      };
    } catch (err) {
      return {
        allowed: false,
        reason: err instanceof Error ? err.message : 'Permission check failed',
      };
    }
  },
  async require(
  userId: string,
  entityId: string,
  permissionKey: string,
  db: SupabaseClient = supabase
): Promise<void> {
  const result = await this.can(
    userId,
    entityId,
    permissionKey,
    db
  );

  if (!result.allowed) {
    throw new Error(
      result.reason ||
      `You do not have permission: ${permissionKey}`
    );
  }
},

  async canAll(
    userId: string,
    entityId: string,
    permissionKeys: string[],
    db: SupabaseClient = supabase
  ): Promise<PermissionCheck> {
    for (const key of permissionKeys) {
      const result = await this.can(userId, entityId, key, db);

      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true };
  },

  async canAny(
    userId: string,
    entityId: string,
    permissionKeys: string[],
    db: SupabaseClient = supabase
  ): Promise<PermissionCheck> {
    for (const key of permissionKeys) {
      const result = await this.can(userId, entityId, key, db);

      if (result.allowed) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `None of ${permissionKeys.join(', ')} allowed`,
    };
  },

  async getUserPermissions(
    userId: string,
    entityId: string,
    db: SupabaseClient = supabase
  ): Promise<string[]> {
    const { data } = await db
      .from('user_entity_permissions')
      .select('permission_key')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .eq('enabled', true);

    return (data || []).map((row: any) => row.permission_key);
  },

  async setPermission(
    userId: string,
    entityId: string,
    permissionKey: string,
    enabled: boolean,
    assignedBy?: string,
    db: SupabaseClient = supabase
  ): Promise<void> {
    const { error } = await db
      .from('user_entity_permissions')
      .upsert(
        {
          user_id: userId,
          entity_id: entityId,
          permission_key: permissionKey,
          enabled,
          assigned_by: assignedBy || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,entity_id,permission_key',
        }
      );

    if (error) {
      throw error;
    }
  },

  async setPermissions(
    userId: string,
    entityId: string,
    permissions: Record<string, boolean>,
    assignedBy?: string,
    db: SupabaseClient = supabase
  ): Promise<void> {
    const updates = Object.entries(permissions).map(
      ([permissionKey, enabled]) => ({
        user_id: userId,
        entity_id: entityId,
        permission_key: permissionKey,
        enabled,
        assigned_by: assignedBy || null,
        updated_at: new Date().toISOString(),
      })
    );

    if (!updates.length) return;

    const { error } = await db
      .from('user_entity_permissions')
      .upsert(updates, {
        onConflict: 'user_id,entity_id,permission_key',
      });

    if (error) {
      throw error;
    }
  },
};
