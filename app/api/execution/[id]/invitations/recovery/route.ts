import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ExecutionAccessError,
  requireExecutionAuthority,
} from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { createSigningInvitationToken } from '@/lib/execution/server/invitation-tokens';
import { deliverReservedSigningInvitation } from '@/lib/execution/server/invitation-delivery';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RecoveryAction = 'quarantine' | 'cancel' | 'replace';

type RecoveryRequest = {
  action: RecoveryAction;
  deliveryAttemptId: string;
  reason: string;
  evidence: Record<string, unknown>;
  documentVersionId?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function parseRequest(value: unknown): RecoveryRequest | null {
  if (!isRecord(value)) return null;

  const { action, deliveryAttemptId, reason, evidence, documentVersionId } =
    value;

  if (
    (action !== 'quarantine' && action !== 'cancel' && action !== 'replace') ||
    typeof deliveryAttemptId !== 'string' ||
    !UUID_PATTERN.test(deliveryAttemptId) ||
    typeof reason !== 'string' ||
    reason.trim().length < 10 ||
    reason.trim().length > 1000 ||
    !isRecord(evidence) ||
    Object.keys(evidence).length === 0 ||
    JSON.stringify(evidence).length > 8192
  ) {
    return null;
  }

  if (
    action === 'replace' &&
    (typeof documentVersionId !== 'string' ||
      !UUID_PATTERN.test(documentVersionId))
  ) {
    return null;
  }

  return {
    action,
    deliveryAttemptId,
    reason: reason.trim(),
    evidence,
    documentVersionId:
      typeof documentVersionId === 'string'
        ? documentVersionId
        : undefined,
  };
}


function isRecoveryConflict(message: string): boolean {
  return [
    'Recovery replacement already used',
    'Invitation already revoked',
    'Invitation already consumed',
    'An active invitation',
    'Recovery cancellation required',
  ].some((known) => message.includes(known));
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: executionId } = await context.params;
    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      );
    }

    if (!UUID_PATTERN.test(executionId)) {
      return NextResponse.json(
        { error: 'Execution not found.' },
        { status: 404 },
      );
    }

    if (process.env.EXECUTION_INVITATION_RECOVERY_ENABLED !== 'true') {
      return NextResponse.json(
        { error: 'Invitation recovery is not enabled.' },
        { status: 503 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request.' },
        { status: 400 },
      );
    }

    const input = parseRequest(body);

    if (!input) {
      return NextResponse.json(
        { error: 'Invalid recovery request.' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: 'Execution service unavailable.' },
        { status: 503 },
      );
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      );
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: attempt, error: attemptError } = await serviceClient
      .from('execution_invitation_delivery_attempts')
      .select('id, execution_id, invitation_id')
      .eq('id', input.deliveryAttemptId)
      .eq('execution_id', executionId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: 'Recovery target not found.' },
        { status: 404 },
      );
    }

    const { data: execution, error: executionError } = await serviceClient
      .from('executions')
      .select('id, source_type, source_id, deleted_at')
      .eq('id', executionId)
      .maybeSingle();

    if (
      executionError ||
      !execution ||
      execution.deleted_at ||
      execution.source_type !== 'leasing_opportunity'
    ) {
      return NextResponse.json(
        { error: 'Execution not found.' },
        { status: 404 },
      );
    }

    const { data: invitation, error: invitationError } = await serviceClient
      .from('execution_signing_invitations')
      .select('id, document_version_id')
      .eq('id', attempt.invitation_id)
      .eq('execution_id', executionId)
      .maybeSingle();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Recovery invitation not found.' },
        { status: 404 },
      );
    }

    const { data: document, error: documentError } = await serviceClient
      .from('execution_document_versions')
      .select('id, entity_id')
      .eq('id', invitation.document_version_id)
      .eq('execution_id', executionId)
      .maybeSingle();

    if (documentError || !document?.entity_id) {
      return NextResponse.json(
        { error: 'Execution document not found.' },
        { status: 404 },
      );
    }

    const { data: opportunity, error: opportunityError } =
      await serviceClient
        .from('leasing_opportunities')
        .select('id')
        .eq('id', execution.source_id)
        .eq('entity_id', document.entity_id)
        .maybeSingle();

    if (opportunityError || !opportunity) {
      return NextResponse.json(
        { error: 'Execution entity verification failed.' },
        { status: 403 },
      );
    }

    const authority = await requireExecutionAuthority(
      authorization,
      document.entity_id,
      PERMISSIONS.LEASING.EXECUTION_SEND,
    );

    if (authority.actorId !== user.id) {
      throw new ExecutionAccessError(
        403,
        'Authenticated actor mismatch',
      );
    }

    if (
      input.action === 'replace' &&
      input.documentVersionId !== document.id
    ) {
      return NextResponse.json(
        { error: 'Replacement document does not match the approved version.' },
        { status: 409 },
      );
    }

    const evidence = {
      ...input.evidence,
      channel: 'assetflow_api',
      operation: input.action,
    };

    if (input.action === 'replace') {
      if (
        process.env.EXECUTION_INVITATION_EMAIL_ENABLED !== 'true' ||
        process.env.EXECUTION_PUBLIC_SIGNING_ENABLED !== 'true' ||
        process.env.EXECUTION_EMAIL_OTP_ENABLED !== 'true'
      ) {
        return NextResponse.json(
          { error: 'Replacement delivery is not enabled.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const { data: originalParticipant, error: participantError } =
        await authority.serviceClient
          .from('execution_signing_invitations')
          .select('participant_id')
          .eq('id', invitation.id)
          .single();

      if (participantError || !originalParticipant?.participant_id) {
        throw new Error('Original signer unavailable');
      }

      const { data: participant, error: signerError } =
        await authority.serviceClient
          .from('execution_participants')
          .select('name, email')
          .eq('id', originalParticipant.participant_id)
          .eq('execution_id', executionId)
          .single();

      if (signerError || !participant?.name || !participant.email) {
        throw new Error('Replacement signer unavailable');
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

      if (
        !baseUrl ||
        !process.env.RESEND_API_KEY ||
        !process.env.EXECUTION_VERIFICATION_FROM_EMAIL
      ) {
        throw new Error('Replacement delivery is not configured');
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
      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await authority.serviceClient.rpc(
        'replace_cancelled_execution_invitation',
        {
          p_delivery_attempt_id: input.deliveryAttemptId,
          p_document_version_id: input.documentVersionId,
          p_token_hash: tokenHash,
          p_expires_at: expiresAt,
          p_actor_id: authority.actorId,
          p_reason: input.reason,
          p_evidence: evidence,
        },
      );

      const result = Array.isArray(data) ? data[0] : null;

      if (error) {
        if (isRecoveryConflict(error.message)) {
          return NextResponse.json(
            { error: 'Invitation recovery conflicts with its current state.' },
            { status: 409, headers: { 'Cache-Control': 'no-store' } },
          );
        }
        throw new Error('Replacement recovery RPC failed');
      }

      if (
        !result ||
        typeof result.invitation_id !== 'string' ||
        typeof result.delivery_attempt_id !== 'string' ||
        typeof result.recovery_id !== 'string'
      ) {
        throw new Error('Invalid replacement recovery response');
      }

      const signingUrl = new URL(
        `/execution/sign/${token}`,
        origin,
      ).toString();

      const deliveryStatus = await deliverReservedSigningInvitation(
        authority.serviceClient,
        {
          deliveryAttemptId: result.delivery_attempt_id,
          destination: participant.email,
          signerName: participant.name,
          signingUrl,
          expiresAt,
        },
      );

      return NextResponse.json(
        {
          recoveryId: result.recovery_id,
          invitationId: result.invitation_id,
          deliveryAttemptId: result.delivery_attempt_id,
          deliveryStatus,
          expiresAt,
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const rpcName =
      input.action === 'quarantine'
        ? 'quarantine_execution_invitation_delivery'
        : 'cancel_uncertain_execution_invitation';

    const { data: recoveryId, error: recoveryError } =
      await authority.serviceClient.rpc(rpcName, {
        p_delivery_attempt_id: input.deliveryAttemptId,
        p_actor_id: authority.actorId,
        p_reason: input.reason,
        p_evidence: evidence,
      });

    if (recoveryError) {
      if (isRecoveryConflict(recoveryError.message)) {
        return NextResponse.json(
          { error: 'Invitation recovery conflicts with its current state.' },
          { status: 409, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      throw new Error('Recovery RPC failed');
    }

    if (typeof recoveryId !== 'string') {
      throw new Error('Invalid recovery response');
    }

    return NextResponse.json(
      {
        recoveryId,
        action: input.action,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ExecutionAccessError) {
      return NextResponse.json(
        { error: 'Execution access denied.' },
        { status: error.status },
      );
    }

    console.error('[EXECUTION RECOVERY] Recovery operation failed.');

    return NextResponse.json(
      { error: 'Unable to complete invitation recovery.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
