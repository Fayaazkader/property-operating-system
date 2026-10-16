import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceDetails = {
  fullName: string;
  clientName: string;
  entityName: string;
  entityCode: string;
  roleName: string;
};

/** Uses the caller's authenticated client; never a service-role client. */
export async function provisionInitialWorkspace(db: SupabaseClient, details: WorkspaceDetails) {
  const { data: { user }, error: identityError } = await db.auth.getUser();
  if (identityError || !user?.email) throw new Error('Please sign in again before completing workspace setup.');
  if (Object.values(details).some(value => !value.trim())) throw new Error('Complete all workspace fields.');
  const { data, error } = await db.rpc('provision_client_account', {
    p_client_name: details.clientName.trim(),
    p_entity_name: details.entityName.trim(),
    p_entity_code: details.entityCode.trim(),
    p_role_type_name: details.roleName.trim(),
    p_full_name: details.fullName.trim(),
    p_email: user.email,
  });
  if (error) throw new Error(`Workspace setup could not be confirmed: ${error.message}. You can retry safely. If you already belong to an organisation, contact its administrator.`);
  if (data?.status !== 'provisioned' || !data.entity_id || data.user_id !== user.id) {
    throw new Error('Workspace setup was not confirmed. Retry to recover the committed result, or contact support.');
  }
  return data as { entity_id: string; client_account_id: string; user_id: string; status: 'provisioned' };
}

export async function checkWorkspaceAccess(db: SupabaseClient): Promise<'signed-out' | 'allowed' | 'unassigned'> {
  const { data: { user }, error: identityError } = await db.auth.getUser();
  if (identityError?.name === 'AuthSessionMissingError') return 'signed-out';
  if (identityError) throw new Error('Unable to verify your session. Sign in again or retry.');
  if (!user) return 'signed-out';
  const { data, error } = await db.from('user_entity_access').select('id').eq('user_id', user.id).limit(1);
  if (error) throw new Error('Unable to verify workspace access. Please retry; access has not been granted.');
  return data?.length ? 'allowed' : 'unassigned';
}
