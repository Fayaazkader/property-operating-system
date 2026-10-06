import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteContext {
  params: Promise<{
    opportunityId: string;
  }>;
}

interface ApproveForExecutionRequest {
  entityId?: string;
  documentId?: string;
}

function bridgeErrorStatus(message: string): number {
  if (message.includes('execution_bridge_permission_denied')) return 403;

  if (
    message.includes('execution_bridge_opportunity_not_found') ||
    message.includes('execution_bridge_document_not_found')
  ) {
    return 404;
  }

  if (
    message.includes('execution_bridge_actor_mismatch') ||
    message.includes('execution_bridge_entity_mismatch') ||
    message.includes('execution_bridge_commercial_authority_mismatch') ||
    message.includes('execution_bridge_document_checksum_missing') ||
    message.includes('execution_bridge_provenance_not_found') ||
    message.includes('execution_bridge_provenance_mismatch')
  ) {
    return 409;
  }

  return 500;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { opportunityId } = await params;

    if (
      typeof opportunityId !== 'string' ||
      opportunityId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'opportunityId is required.' },
        { status: 400 },
      );
    }

    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    let body: ApproveForExecutionRequest;

    try {
      body = (await request.json()) as ApproveForExecutionRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 },
      );
    }

    const { entityId, documentId } = body;

    if (
      typeof entityId !== 'string' ||
      entityId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'entityId is required.' },
        { status: 400 },
      );
    }

    if (
      typeof documentId !== 'string' ||
      documentId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'documentId is required.' },
        { status: 400 },
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await serviceClient.rpc(
      'approve_generated_lease_for_execution',
      {
        p_entity_id: entityId.trim(),
        p_opportunity_id: opportunityId.trim(),
        p_document_id: documentId.trim(),
        p_actor_id: user.id,
      },
    );

    if (error) {
      const status = bridgeErrorStatus(error.message);

      console.warn(
        '[LEASE EXECUTION BRIDGE] Approval rejected:',
        error.message,
      );

      return NextResponse.json(
        {
          error:
            status === 500
              ? 'Unable to approve the generated lease for execution.'
              : 'The generated lease cannot be approved for execution.',
        },
        { status },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.execution_id) {
      console.error(
        '[LEASE EXECUTION BRIDGE] RPC returned an invalid result:',
        data,
      );

      return NextResponse.json(
        { error: 'Unable to approve the generated lease for execution.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      execution: result,
    });
  } catch (error) {
    console.error(
      '[LEASE EXECUTION BRIDGE] Unexpected failure:',
      error,
    );

    return NextResponse.json(
      { error: 'Unable to approve the generated lease for execution.' },
      { status: 500 },
    );
  }
}
