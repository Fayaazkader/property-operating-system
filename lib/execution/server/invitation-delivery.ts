import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { issueSigningInvitation } from './invitations';
import { sendSigningInvitationEmail } from './invitation-email';

type DispatchInput = {
  executionId: string;
  participantId: string;
  documentVersionId: string;
  actorId: string;
};

export async function dispatchSigningInvitation(
  client: SupabaseClient,
  input: DispatchInput,
): Promise<{
  invitationId: string;
  expiresAt: string;
  deliveryStatus: 'provider_accepted' | 'delivery_unknown';
}> {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EXECUTION_VERIFICATION_FROM_EMAIL ||
    !process.env.NEXT_PUBLIC_APP_URL
  ) {
    throw new Error('Invitation email delivery is not configured');
  }

  const { data: participant, error: participantError } =
    await client
      .from('execution_participants')
      .select('id, name, email')
      .eq('id', input.participantId)
      .eq('execution_id', input.executionId)
      .maybeSingle();

  if (
    participantError ||
    !participant?.name ||
    !participant.email
  ) {
    throw new Error('Nominated signer email is unavailable');
  }

  const { data: existing, error: existingError } =
    await client
      .from('execution_signing_invitations')
      .select('id')
      .eq('execution_id', input.executionId)
      .eq('participant_id', input.participantId)
      .is('consumed_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

  if (existingError) {
    throw new Error('Unable to check existing invitations');
  }

  if (existing?.length) {
    throw new Error(
      'An active invitation exists. Replacement requires authorisation.',
    );
  }

  const issued = await issueSigningInvitation(client, input);


  const attemptId = issued.deliveryAttemptId;

  let deliveryStatus:
    'provider_accepted' | 'delivery_unknown' =
    'delivery_unknown';

  let providerMessageId: string | null = null;

  try {
    const sent = await sendSigningInvitationEmail({
      destination: participant.email,
      signerName: participant.name,
      signingUrl: issued.signingUrl,
      expiresAt: issued.expiresAt,
      idempotencyKey: attemptId,
    });

    providerMessageId = sent.providerMessageId;
    deliveryStatus = 'provider_accepted';
  } catch {
    // A timeout may happen after provider acceptance.
    // Never retry automatically.
    deliveryStatus = 'delivery_unknown';
  }

  const { data: updated, error: updateError } = await client
    .from('execution_invitation_delivery_attempts')
    .update({
      status: deliveryStatus,
      provider_message_id: providerMessageId,
      acknowledged_at:
        deliveryStatus === 'provider_accepted'
          ? new Date().toISOString()
          : null,
    })
    .eq('id', attemptId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    throw new Error(
      'Delivery outcome could not be recorded. Manual reconciliation required.',
    );
  }

  return {
    invitationId: issued.invitationId,
    expiresAt: issued.expiresAt,
    deliveryStatus,
  };
}
