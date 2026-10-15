import { NextRequest, NextResponse } from 'next/server';
import {
  ExecutionAccessError,
  requireExecutionAuthority,
} from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ opportunityId: string }>;
};

const headers = { 'Cache-Control': 'no-store' };

export async function GET(
  request: NextRequest,
  context: Context,
) {
  try {
    const { opportunityId } = await context.params;
    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401, headers },
      );
    }

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuid.test(opportunityId)) {
      return NextResponse.json(
        { error: 'Invalid opportunity.' },
        { status: 400, headers },
      );
    }

    // Resolve the entity from the opportunity, never from client input.
    // No execution details are returned before authority verification.
    const { createClient } = await import('@supabase/supabase-js');

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: opportunity, error: opportunityError } =
      await service
        .from('leasing_opportunities')
        .select('id, entity_id, activated_lease_id, activated_tenant_id')
        .eq('id', opportunityId)
        .maybeSingle();

    if (opportunityError) {
      throw new Error('Opportunity lookup failed');
    }

    if (!opportunity?.entity_id) {
      return NextResponse.json(
        { error: 'Opportunity not found.' },
        { status: 404, headers },
      );
    }

    await requireExecutionAuthority(
      authorization,
      opportunity.entity_id,
      PERMISSIONS.LEASING.EXECUTION_SEND,
    );

    const { data: executions, error: executionError } =
      await service
        .from('executions')
        .select('id, status, version')
        .eq('source_type', 'leasing_opportunity')
        .eq('source_id', opportunityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

    if (executionError) {
      throw new Error('Execution lookup failed');
    }

    const execution = executions?.[0] ?? null;

    if (!execution) {
      return NextResponse.json(
        {
          execution: null,
          version: null,
          participants: [],
          prepared: false,
        },
        { headers },
      );
    }

    const [versionResult, participantResult] =
      await Promise.all([
        service
          .from('execution_document_versions')
          .select('id, status, version')
          .eq('execution_id', execution.id)
          .eq('version', execution.version)
          .eq('entity_id', opportunity.entity_id)
          .eq('status', 'active')
          .maybeSingle(),
        service
          .from('execution_participants')
          .select(
            'id, participant_type, name, email, status, signing_order, signed_at',
          )
          .eq('execution_id', execution.id)
          .order('signing_order'),
      ]);

    if (versionResult.error || participantResult.error) {
      throw new Error('Execution details lookup failed');
    }

    const version = versionResult.data ?? null;
    let prepared = false;

    if (version) {
      const { data: signingDocument, error: documentError } =
        await service
          .from('execution_signing_documents')
          .select('id')
          .eq('execution_id', execution.id)
          .eq('document_version_id', version.id)
          .eq('entity_id', opportunity.entity_id)
          .eq('status', 'committed')
          .maybeSingle();

      if (documentError) {
        throw new Error('Signing document lookup failed');
      }

      prepared = Boolean(signingDocument);
    }

    return NextResponse.json(
      {
        execution,
        activation: opportunity.activated_lease_id ? {leaseId:opportunity.activated_lease_id,tenantId:opportunity.activated_tenant_id} : null,
        version,
        participants: participantResult.data ?? [],
        prepared,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof ExecutionAccessError) {
      return NextResponse.json(
        { error: 'Execution access denied.' },
        { status: error.status, headers },
      );
    }

    console.error('[EXECUTION WORKSPACE] Read failed.');

    return NextResponse.json(
      { error: 'Unable to load execution workspace.' },
      { status: 500, headers },
    );
  }
}
