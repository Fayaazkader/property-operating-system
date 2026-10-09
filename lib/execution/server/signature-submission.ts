import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { hashSigningInvitationToken } from './invitation-tokens';
import { stageSignatureEvidence } from './signature-evidence-registry';
import type { SignatureMethod } from './signature-evidence-storage';

const CONSENT_VERSION = 'assetflow-execution-consent-v1';

export interface SignatureSubmissionInput {
  signingToken: string;
  verificationId: string;
  signatureDataUrl: string;
  signatureMethod: SignatureMethod;
  consentAccepted: boolean;
  authorityDeclaration?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timezone?: string | null;
}

export interface SignatureSubmissionResult {
  executionId: string;
  participantId: string;
  signedAt: string;
  remainingParticipants: number;
}

function optionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (value == null) return null;

  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error('Invalid signing metadata');
  }

  return value;
}

/**
 * Trusted-server orchestration only.
 *
 * The caller must establish request provenance and enforce the
 * signer-facing consent/authority workflow before invoking this.
 *
 * Storage upload and staging occur outside the PostgreSQL transaction.
 * The database RPC atomically records the signature, commits evidence,
 * consumes the invitation and appends the signing event.
 */
export async function submitVerifiedSignature(
  serviceClient: SupabaseClient,
  input: SignatureSubmissionInput,
): Promise<SignatureSubmissionResult> {
  if (input.consentAccepted !== true) {
    throw new Error('Explicit signing consent required');
  }

  if (
    input.signatureMethod !== 'drawn' &&
    input.signatureMethod !== 'typed' &&
    input.signatureMethod !== 'uploaded'
  ) {
    throw new Error('Unsupported signature method');
  }

  const tokenHash = hashSigningInvitationToken(input.signingToken);

  const authorityDeclaration = optionalText(
    input.authorityDeclaration,
    2000,
  );

  const ipAddress = optionalText(input.ipAddress, 64);
  const userAgent = optionalText(input.userAgent, 1024);
  const timezone = optionalText(input.timezone, 100);

  const staged = await stageSignatureEvidence(serviceClient, {
    signingToken: input.signingToken,
    verificationId: input.verificationId,
    dataUrl: input.signatureDataUrl,
  });

  const { data, error } = await serviceClient.rpc(
    'record_execution_participant_signature',
    {
      p_token_hash: tokenHash,
      p_verification_id: staged.verificationId,
      p_evidence_id: staged.id,
      p_signature_method: input.signatureMethod,
      p_consent_version: CONSENT_VERSION,
      p_authority_declaration: authorityDeclaration,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_timezone: timezone,
    },
  );

  if (error) {
    // Do not delete registered evidence here. Its storage object
    // and staged database record require coordinated reconciliation.
    throw new Error('Unable to complete verified signature');
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (
    !result ||
    result.recorded_execution_id !== staged.executionId ||
    result.recorded_participant_id !== staged.participantId ||
    typeof result.recorded_signed_at !== 'string' ||
    !Number.isInteger(result.remaining_participants) ||
    result.remaining_participants < 0
  ) {
    // An ambiguous RPC response must not trigger another signing
    // attempt automatically; the committed state must be reconciled.
    throw new Error('Signature result requires reconciliation');
  }

  return {
    executionId: result.recorded_execution_id,
    participantId: result.recorded_participant_id,
    signedAt: result.recorded_signed_at,
    remainingParticipants: result.remaining_participants,
  };
}
