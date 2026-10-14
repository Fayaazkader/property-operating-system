import { NextRequest, NextResponse } from 'next/server';
import {
  ExecutionAccessError,
  requireExecutionAuthority,
} from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;

    if (!UUID.test(id)) {
      return NextResponse.json({ error: 'Invalid execution.' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: execution, error: executionError } = await serviceClient
      .from('executions')
      .select('source_id, source_type, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (
      executionError ||
      !execution ||
      execution.deleted_at ||
      execution.source_type !== 'leasing_opportunity'
    ) {
      return NextResponse.json({ error: 'Execution not found.' }, { status: 404 });
    }

    const { data: opportunity, error: opportunityError } = await serviceClient
      .from('leasing_opportunities')
      .select('entity_id')
      .eq('id', execution.source_id)
      .maybeSingle();

    if (opportunityError || !opportunity?.entity_id) {
      return NextResponse.json({ error: 'Execution entity unavailable.' }, { status: 404 });
    }

    const authority = await requireExecutionAuthority(
      request.headers.get('authorization'),
      opportunity.entity_id,
      PERMISSIONS.LEASING.EXECUTION_SEND,
    );

    const { data, error } = await authority.serviceClient.rpc(
      'mark_execution_ready_for_signing',
      {
        p_entity_id: opportunity.entity_id,
        p_execution_id: id,
        p_actor_id: authority.actorId,
      },
    );

    if (error) {
      return NextResponse.json(
        { error: 'Execution is not ready for signing.' },
        { status: 409 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (
      result?.execution_id !== id ||
      result?.execution_status !== 'ready' ||
      !result?.document_version_id
    ) {
      return NextResponse.json(
        { error: 'Readiness result requires reconciliation.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        executionId: result.execution_id,
        status: result.execution_status,
        documentVersionId: result.document_version_id,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ExecutionAccessError) {
      return NextResponse.json(
        { error: 'Execution access denied.' },
        { status: error.status },
      );
    }

    console.error('[EXECUTION READY] Readiness transition failed.');
    return NextResponse.json({ error: 'Readiness unavailable.' }, { status: 500 });
  }
}
