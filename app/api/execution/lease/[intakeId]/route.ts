import { NextRequest, NextResponse } from 'next/server';
import {
  ExecutionAccessError,
  requireExecutionAuthority,
} from '@/lib/execution/server/authority';
import { PERMISSIONS } from '@/lib/rbac/permissions';

interface RouteContext {
  params: Promise<{ intakeId: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { intakeId } = await params;

    if (!UUID_PATTERN.test(intakeId)) {
      return NextResponse.json(
        { error: 'Invalid intake identifier.' },
        { status: 400 },
      );
    }

    const authorization = request.headers.get('Authorization');

    // Authenticate before accessing execution or lease records.
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Use the caller's JWT and RLS to resolve the intake.
    // Never use an unverified client-supplied entity identifier.
    const { createClient } = await import('@supabase/supabase-js');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error('Supabase configuration unavailable');
    }

    const callerClient = createClient(url, anonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: intake, error: intakeError } = await callerClient
      .from('lease_intake')
      .select('id, lease_id, entity_id')
      .eq('id', intakeId)
      .maybeSingle();

    if (intakeError || !intake?.lease_id || !intake.entity_id) {
      return NextResponse.json(
        { error: 'Lease intake not found.' },
        { status: 404 },
      );
    }

    const authority = await requireExecutionAuthority(
      authorization,
      intake.entity_id,
      PERMISSIONS.LEASING.EXECUTION_VIEW,
    );

    const { serviceClient } = authority;

    const { data: lease, error: leaseError } = await serviceClient
      .from('leases')
      .select('id, owner_entity_id, managing_entity_id')
      .eq('id', intake.lease_id)
      .maybeSingle();

    if (leaseError) {
      throw leaseError;
    }

    if (
      !lease ||
      (
        lease.owner_entity_id !== authority.entityId &&
        lease.managing_entity_id !== authority.entityId
      )
    ) {
      return NextResponse.json(
        { error: 'Lease not found within authorised entity.' },
        { status: 404 },
      );
    }

    const { data: execution, error: executionError } =
      await serviceClient
        .from('executions')
        .select(
          'id, source_type, source_id, version, status, provider, signing_method, signing_order, ready_score, sent_at, executed_at, activated_at, created_at, updated_at',
        )
        .eq('source_type', 'lease')
        .eq('source_id', lease.id)
        .not('status', 'in', '("executed","activated","cancelled","expired")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (executionError) {
      throw executionError;
    }

    if (!execution) {
      return NextResponse.json({
        execution: null,
        participants: [],
      });
    }

    const { data: participants, error: participantError } =
      await serviceClient
        .from('execution_participants')
        .select(
          'id, execution_id, participant_type, name, email, company, signing_order, status, sent_at, viewed_at, signed_at, declined_at',
        )
        .eq('execution_id', execution.id)
        .order('signing_order', { ascending: true });

    if (participantError) {
      throw participantError;
    }

    return NextResponse.json({
      execution,
      participants: participants ?? [],
    });
  } catch (error) {
    if (error instanceof ExecutionAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error('[EXECUTION READ] Failed:', error);

    return NextResponse.json(
      { error: 'Unable to retrieve execution.' },
      { status: 500 },
    );
  }
}
