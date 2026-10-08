import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSigningInvitationToken } from './invitation-tokens';

const INVITATION_LIFETIME_HOURS = 24;

export interface IssueSigningInvitationInput {
  executionId: string;
  participantId: string;
  documentVersionId: string;
  actorId: string;
}

export interface IssuedSigningInvitation {
  invitationId: string;
  signingUrl: string;
  expiresAt: string;
}

export async function issueSigningInvitation(
  serviceClient: SupabaseClient,
  input: IssueSigningInvitationInput,
): Promise<IssuedSigningInvitation> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    throw new Error('Signing application URL is not configured');
  }

  const origin = new URL(baseUrl);

  if (
    (origin.protocol !== 'https:' && origin.hostname !== 'localhost') ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('Invalid signing application URL');
  }

  const { token, tokenHash } = createSigningInvitationToken();

  const signingUrl = new URL(
    `/execution/sign/${token}`,
    origin,
  ).toString();

  const expiresAt = new Date(
    Date.now() + INVITATION_LIFETIME_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await serviceClient.rpc(
    'issue_execution_signing_invitation',
    {
      p_execution_id: input.executionId,
      p_participant_id: input.participantId,
      p_document_version_id: input.documentVersionId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
      p_created_by: input.actorId,
    },
  );

  if (error || typeof data !== 'string') {
    throw new Error('Unable to issue signing invitation');
  }

  return {
    invitationId: data,
    signingUrl,
    expiresAt,
  };
}
