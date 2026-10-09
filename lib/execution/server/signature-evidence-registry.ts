import 'server-only';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateSigningInvitation } from './invitation-validation';
import {
  storeSignatureEvidence,
  type StoredSignatureEvidence,
} from './signature-evidence-storage';

export interface StagedSignatureEvidence {
  id: string;
  executionId: string;
  participantId: string;
  invitationId: string;
  verificationId: string;
  documentVersionId: string;
  storage: StoredSignatureEvidence;
}

export async function stageSignatureEvidence(
  serviceClient: SupabaseClient,
  args: {
    signingToken: string;
    verificationId: string;
    dataUrl: string;
  },
): Promise<StagedSignatureEvidence> {
  const invitation = await validateSigningInvitation(
    serviceClient,
    args.signingToken,
  );

  if (!invitation) {
    throw new Error('Signing invitation unavailable');
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      args.verificationId,
    )
  ) {
    throw new Error('Invalid verification reference');
  }

  const { data: verification, error: verificationError } =
    await serviceClient
      .from('execution_signer_verifications')
      .select(
        'id, invitation_id, verified_at, revoked_at, delivery_status, channel',
      )
      .eq('id', args.verificationId)
      .eq('invitation_id', invitation.invitation_id)
      .maybeSingle();

  if (
    verificationError ||
    !verification ||
    !verification.verified_at ||
    verification.revoked_at ||
    verification.delivery_status !== 'accepted' ||
    verification.channel !== 'email'
  ) {
    throw new Error('Verified signing challenge required');
  }

  const storage = await storeSignatureEvidence(serviceClient, {
    executionId: invitation.execution_id,
    participantId: invitation.participant_id,
    invitationId: invitation.invitation_id,
    dataUrl: args.dataUrl,
  });

  const evidenceId = randomUUID();

  const { error: insertError } = await serviceClient
    .from('execution_signature_evidence')
    .insert({
      id: evidenceId,
      execution_id: invitation.execution_id,
      participant_id: invitation.participant_id,
      document_version_id: invitation.document_version_id,
      invitation_id: invitation.invitation_id,
      verification_id: args.verificationId,
      bucket_id: storage.bucket,
      storage_path: storage.path,
      content_sha256: storage.sha256,
      content_type: storage.contentType,
      content_length: storage.contentLength,
      status: 'staged',
    });

  if (insertError) {
    await serviceClient.storage
      .from(storage.bucket)
      .remove([storage.path])
      .catch(() => undefined);

    throw new Error('Unable to register signature evidence');
  }

  return {
    id: evidenceId,
    executionId: invitation.execution_id,
    participantId: invitation.participant_id,
    invitationId: invitation.invitation_id,
    verificationId: args.verificationId,
    documentVersionId: invitation.document_version_id,
    storage,
  };
}
