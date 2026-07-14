// lib/platform/context.ts
// Platform Context — Authentication, Entity, RBAC

import { supabase } from "@/lib/supabase";

export interface PlatformContext {
  userId: string;
  entityId: string;
  roles: string[];
  permissions: string[];
  timezone: string;
  locale: string;
  correlationId: string;
}

export async function getPlatformContext(
  request: Request,
  correlationId?: string
): Promise<PlatformContext> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('entity_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.entity_id) {
    throw new Error('No entity associated with user');
  }

  // Get user permissions
  const { data: permissions } = await supabase
    .from('user_entity_access')
    .select('role')
    .eq('user_id', user.id)
    .eq('entity_id', profile.entity_id);

  return {
    userId: user.id,
    entityId: profile.entity_id,
    roles: [profile.role || 'user'],
    permissions: permissions?.map(p => p.role) || [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: 'en-ZA',
    correlationId: correlationId || crypto.randomUUID(),
  };
}
