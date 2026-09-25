import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteContext {
  params: Promise<{
    templateId: string;
  }>;
}

interface ApproveLeaseTemplateRequest {
  entityId?: string;
}

function approvalErrorStatus(message: string): number {
  const normalised = message.toLowerCase();

  if (normalised.includes('access denied')) {
    return 403;
  }

  if (normalised.includes('not found')) {
    return 404;
  }

  if (
    normalised.includes('not currently') ||
    normalised.includes('already')
  ) {
    return 409;
  }

  /*
   * These are governance/invariant failures rather than server failures.
   * They mean the template exists but is not yet valid for approval.
   */
  if (
    normalised.includes('source document') ||
    normalised.includes('confirmed mapping') ||
    normalised.includes('suggested mapping') ||
    normalised.includes('unresolved mapping') ||
    normalised.includes('unreviewed mapping') ||
    normalised.includes('invalid confirmed') ||
    normalised.includes('unresolved target') ||
    normalised.includes('critical')
  ) {
    return 422;
  }

  return 500;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { templateId } = await params;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required.' },
        { status: 400 }
      );
    }

    /*
     * Authenticate the actual caller from the bearer token.
     *
     * Never derive the approving user from service-role context and never
     * infer the active entity from the first entity returned by auth_entities().
     */
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: ApproveLeaseTemplateRequest;

    try {
      body =
        (await request.json()) as ApproveLeaseTemplateRequest;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { entityId } = body;

    /*
     * Approval must use the explicit entity selected by the application.
     * This prevents multi-entity users from approving against an arbitrary
     * "first" authorised entity.
     */
    if (
      typeof entityId !== 'string' ||
      entityId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'entityId is required.' },
        { status: 400 }
      );
    }

    /*
     * The approval RPC is deliberately executable only by service_role.
     *
     * The authenticated user ID supplied here comes exclusively from
     * auth.getUser(accessToken), never from request JSON.
     *
     * Inside the database transaction the RPC independently verifies that
     * this user belongs to entityId before locking or mutating the template.
     */
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } = await serviceClient.rpc(
      'approve_lease_template',
      {
        p_template_id: templateId,
        p_entity_id: entityId,
        p_user_id: user.id,
        p_user_email: user.email ?? null,
        p_user_agent:
          request.headers.get('user-agent'),
      }
    );

    if (error) {
      console.error(
        '[LEASE TEMPLATE APPROVE] RPC failed:',
        error
      );

      const message =
        error.message ||
        'Unable to approve lease template.';

      return NextResponse.json(
        { error: message },
        { status: approvalErrorStatus(message) }
      );
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      console.error(
        '[LEASE TEMPLATE APPROVE] Invalid RPC response:',
        data
      );

      return NextResponse.json(
        {
          error:
            'The lease-template approval transaction returned an invalid response.',
        },
        { status: 500 }
      );
    }

    const result =
      data as {
        success?: boolean;
        template?: unknown;
      };

    if (
      result.success !== true ||
      !result.template
    ) {
      console.error(
        '[LEASE TEMPLATE APPROVE] RPC did not confirm success:',
        result
      );

      return NextResponse.json(
        {
          error:
            'The lease-template approval transaction did not complete successfully.',
        },
        { status: 500 }
      );
    }

    /*
     * The returned template is the authoritative state written inside the
     * locked database transaction.
     *
     * No second application-level update is permitted here.
     */
    return NextResponse.json({
      success: true,
      auditRecorded: true,
      template: result.template,
    });
  } catch (error) {
    console.error(
      '[LEASE TEMPLATE APPROVE] Approval failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to approve lease template.',
      },
      { status: 500 }
    );
  }
}
