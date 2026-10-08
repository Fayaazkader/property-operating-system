import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ExecutionAccessError,
  requireExecutionAuthority,
} from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { issueSigningInvitation } from '@/lib/execution/server/invitations';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== 'object' ||
      !('participantId' in body) ||
      !('documentVersionId' in body) ||
      typeof body.participantId !== 'string' ||
      typeof body.documentVersionId !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid invitation request.' },
        { status: 400 },
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: execution, error: executionError } =
      await serviceClient
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

    const { data: document, error: documentError } =
      await serviceClient
        .from('execution_document_versions')
        .select('id, entity_id')
        .eq('id', body.documentVersionId)
        .eq('execution_id', executionId)
        .maybeSingle();

    if (documentError || !document?.entity_id) {
      return NextResponse.json(
        { error: 'Approved execution document not found.' },
        { status: 404 },
      );
    }

    const { data: opportunity, error: opportunityError } =
      await serviceClient
        .from('leasing_opportunities')
        .select('id, entity_id')
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

    const issued = await issueSigningInvitation(serviceClient, {
      executionId,
      participantId: body.participantId,
      documentVersionId: document.id,
      actorId: authority.actorId,
    });

    return NextResponse.json(
      {
        invitationId: issued.invitationId,
        expiresAt: issued.expiresAt,
        signingUrl: issued.signingUrl,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ExecutionAccessError) {
      return NextResponse.json(
        { error: 'Execution access denied.' },
        { status: error.status },
      );
    }

    console.error(
      '[EXECUTION INVITATION] Invitation issuance failed.',
    );

    return NextResponse.json(
      { error: 'Unable to issue signing invitation.' },
      { status: 500 },
    );
  }
}
