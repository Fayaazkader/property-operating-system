import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { hashSigningInvitationToken } from './invitation-tokens';

export interface ValidSigningInvitation {
  invitation_id: string;
  execution_id: string;
  participant_id: string;
  document_version_id: string;
  document_checksum: string;
  expires_at: string;
}

export async function validateSigningInvitation(
  serviceClient: SupabaseClient,
  token: string,
): Promise<ValidSigningInvitation | null> {
  let tokenHash: string;

  try {
    tokenHash = hashSigningInvitationToken(token);
  } catch {
    return null;
  }

  const { data, error } = await serviceClient.rpc(
    'validate_execution_signing_invitation',
    { p_token_hash: tokenHash },
  );

  if (error) {
    throw new Error('Unable to validate signing invitation');
  }

  if (!Array.isArray(data) || data.length !== 1) {
    return null;
  }

  return data[0] as ValidSigningInvitation;
}
