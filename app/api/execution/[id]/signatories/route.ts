import { NextRequest, NextResponse } from 'next/server';
import {
  ExecutionAccessError,
  requireExecutionAuthority,
} from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;

    if (!UUID.test(id)) {
      return NextResponse.json({ error: 'Invalid execution.' }, { status: 400 });
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    for (const key of ['tenantName', 'tenantEmail', 'landlordName', 'landlordEmail']) {
      if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 254) {
        return NextResponse.json({ error: 'Invalid signatory details.' }, { status: 400 });
      }
    }

    if (
      !EMAIL.test(input.tenantEmail as string) ||
      !EMAIL.test(input.landlordEmail as string)
    ) {
      return NextResponse.json({ error: 'Invalid signatory email.' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization');

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
      authorization,
      opportunity.entity_id,
      PERMISSIONS.LEASING.EXECUTION_SEND,
    );

    const { data, error } = await authority.serviceClient.rpc(
      'nominate_execution_signatories',
      {
        p_entity_id: opportunity.entity_id,
        p_execution_id: id,
        p_actor_id: authority.actorId,
        p_tenant_name: (input.tenantName as string).trim(),
        p_tenant_email: (input.tenantEmail as string).trim(),
        p_landlord_name: (input.landlordName as string).trim(),
        p_landlord_email: (input.landlordEmail as string).trim(),
      },
    );

    if (error) {
      return NextResponse.json(
        { error: 'Signatories could not be nominated. Check execution readiness.' },
        { status: 409 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.tenant_participant_id || !result?.landlord_participant_id) {
      return NextResponse.json(
        { error: 'Nomination result requires reconciliation.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        tenantParticipantId: result.tenant_participant_id,
        landlordParticipantId: result.landlord_participant_id,
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

    console.error('[EXECUTION SIGNATORIES] Nomination failed.');
    return NextResponse.json({ error: 'Nomination unavailable.' }, { status: 500 });
  }
}
