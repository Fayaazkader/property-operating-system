import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class ExecutionAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'ExecutionAccessError';
  }
}

export interface ExecutionAuthority {
  actorId: string;
  entityId: string;
  serviceClient: SupabaseClient;
}

export async function requireExecutionAuthority(
  authorization: string | null,
  entityId: string,
  permissionKey: string,
): Promise<ExecutionAuthority> {
  if (!authorization?.startsWith('Bearer ')) {
    throw new ExecutionAccessError(401, 'Unauthorized');
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    throw new ExecutionAccessError(401, 'Unauthorized');
  }

  if (!entityId || !permissionKey) {
    throw new ExecutionAccessError(403, 'Execution authority required');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new ExecutionAccessError(500, 'Execution service unavailable');
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    throw new ExecutionAccessError(401, 'Unauthorized');
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allowed, error: permissionError } =
    await serviceClient.rpc('has_entity_permission', {
      p_user_id: user.id,
      p_entity_id: entityId,
      p_permission_key: permissionKey,
    });

  if (permissionError) {
    throw new ExecutionAccessError(500, 'Permission verification failed');
  }

  if (allowed !== true) {
    throw new ExecutionAccessError(403, 'Permission denied');
  }

  return {
    actorId: user.id,
    entityId,
    serviceClient,
  };
}
