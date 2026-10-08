import 'server-only';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createVerificationCode,
  hashVerificationCode,
  hashVerificationDestination,
} from './verification-codes';
import { validateSigningInvitation } from './invitation-validation';
import { hashSigningInvitationToken } from './invitation-tokens';

export type VerificationChannel = 'email' | 'sms';

export interface VerificationChallenge {
  verificationId: string;
  channel: VerificationChannel;
  destination: string;
  code: string;
}

export async function issueSignerVerification(
  serviceClient: SupabaseClient,
  signingToken: string,
  channel: VerificationChannel,
): Promise<VerificationChallenge> {
  const invitation = await validateSigningInvitation(
    serviceClient,
    signingToken,
  );

  if (!invitation) {
    throw new Error('Signing invitation is invalid or expired');
  }

  const { data: participant, error: participantError } =
    await serviceClient
      .from('execution_participants')
      .select('id, email, phone')
      .eq('id', invitation.participant_id)
      .eq('execution_id', invitation.execution_id)
      .maybeSingle();

  if (participantError || !participant) {
    throw new Error('Signing participant not found');
  }

  const destination =
    channel === 'email' ? participant.email : participant.phone;

  if (!destination || !destination.trim()) {
    throw new Error('Participant verification destination unavailable');
  }

  const verificationId = randomUUID();
  const code = createVerificationCode();
  const codeHash = hashVerificationCode(verificationId, code);
  const destinationHash = hashVerificationDestination(destination);

  const { data, error } = await serviceClient.rpc(
    'issue_execution_email_challenge',
    {
      p_invitation_id: invitation.invitation_id,
      p_verification_id: verificationId,
      p_code_hash: codeHash,
      p_destination_hash: destinationHash,
    },
  );

  if (
    error ||
    !data ||
    typeof data !== 'object' ||
    typeof data.verification_id !== 'string' ||
    data.verification_id !== verificationId ||
    typeof data.destination !== 'string' ||
    !data.destination.trim()
  ) {
    throw new Error('Unable to issue signer verification challenge');
  }

  if (
    hashVerificationDestination(data.destination) !== destinationHash
  ) {
    // The participant's nominated email changed between the initial
    // read and the database transaction. Never send this OTP.
    await serviceClient.rpc(
      'complete_execution_verification_delivery',
      {
        p_verification_id: verificationId,
        p_accepted: false,
      },
    );

    throw new Error('Participant verification destination changed');
  }

  return {
    verificationId,
    channel,
    destination: data.destination,
    code,
  };
}

export async function verifySignerCode(
  serviceClient: SupabaseClient,
  signingToken: string,
  verificationId: string,
  code: string,
): Promise<boolean> {
  if (
    !/^[0-9a-f-]{36}$/i.test(verificationId) ||
    !/^[0-9]{6}$/.test(code)
  ) {
    return false;
  }

  const codeHash = hashVerificationCode(verificationId, code);

  let tokenHash: string;

  try {
    tokenHash = hashSigningInvitationToken(signingToken);
  } catch {
    return false;
  }

  const { data, error } = await serviceClient.rpc(
    'verify_execution_verification_for_invitation',
    {
      p_token_hash: tokenHash,
      p_verification_id: verificationId,
      p_code_hash: codeHash,
    },
  );

  if (error) {
    throw new Error('Unable to verify signer code');
  }

  return data === true;
}
